-- Migration: create_knowledge_base
-- Creates the Knowledge Base management system for Cloudinha agent content.
-- Tables: knowledge_categories, knowledge_documents, knowledge_document_versions, knowledge_keywords
-- RPCs: manage_knowledge_document, get_knowledge_documents, search_knowledge_by_keyword
-- Storage: knowledge-base bucket

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Editable categories for knowledge documents
CREATE TABLE IF NOT EXISTS public.knowledge_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default categories
INSERT INTO public.knowledge_categories (name, label) VALUES
    ('partner', 'Parceiros'),
    ('prouni', 'ProUni'),
    ('sisu', 'Sisu'),
    ('cloudinha', 'Cloudinha'),
    ('passport', 'Passaporte'),
    ('general', 'Geral')
ON CONFLICT (name) DO NOTHING;

-- Main documents table
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES public.knowledge_categories(id) ON DELETE SET NULL,
    partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    current_version INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_category ON public.knowledge_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_partner ON public.knowledge_documents(partner_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_active ON public.knowledge_documents(is_active);

-- Version history for documents
CREATE TABLE IF NOT EXISTS public.knowledge_document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    change_summary TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_versions_document ON public.knowledge_document_versions(document_id);

-- Keywords/tags for document discovery
CREATE TABLE IF NOT EXISTS public.knowledge_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_keywords_unique ON public.knowledge_keywords(document_id, keyword);
CREATE INDEX IF NOT EXISTS idx_knowledge_keywords_keyword ON public.knowledge_keywords USING gin (keyword gin_trgm_ops);

-- ============================================================
-- 2. RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.knowledge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_keywords ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users (agents use service key, so RLS is bypassed)
DROP POLICY IF EXISTS "knowledge_categories_read" ON public.knowledge_categories;
CREATE POLICY "knowledge_categories_read" ON public.knowledge_categories
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "knowledge_documents_read" ON public.knowledge_documents;
CREATE POLICY "knowledge_documents_read" ON public.knowledge_documents
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "knowledge_document_versions_read" ON public.knowledge_document_versions;
CREATE POLICY "knowledge_document_versions_read" ON public.knowledge_document_versions
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "knowledge_keywords_read" ON public.knowledge_keywords;
CREATE POLICY "knowledge_keywords_read" ON public.knowledge_keywords
    FOR SELECT TO authenticated USING (true);

-- Write access only via RPCs (SECURITY DEFINER), so no INSERT/UPDATE/DELETE policies needed for direct table access.

-- ============================================================
-- 3. RPCs
-- ============================================================

-- RPC: manage_knowledge_document
-- Handles CREATE, UPDATE, DELETE for knowledge_documents + keywords.
-- On UPDATE, automatically creates a version snapshot.
CREATE OR REPLACE FUNCTION public.manage_knowledge_document(
    p_id UUID DEFAULT NULL,
    p_title TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_partner_id UUID DEFAULT NULL,
    p_storage_path TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL,
    p_keywords TEXT[] DEFAULT NULL,
    p_change_summary TEXT DEFAULT NULL,
    p_delete BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_doc RECORD;
    v_new_id UUID;
    v_new_version INTEGER;
BEGIN
    -- Auth check: caller must be admin
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Not authenticated');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = v_user_id AND permission = 'Conhecimento') THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Insufficient permissions');
    END IF;

    -- DELETE
    IF p_delete AND p_id IS NOT NULL THEN
        DELETE FROM public.knowledge_documents WHERE id = p_id;
        RETURN jsonb_build_object('status', 'success', 'action', 'deleted', 'id', p_id);
    END IF;

    -- UPDATE
    IF p_id IS NOT NULL THEN
        -- Fetch current state for versioning
        SELECT * INTO v_doc FROM public.knowledge_documents WHERE id = p_id;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('status', 'error', 'message', 'Document not found');
        END IF;

        -- Save current version to history before updating
        v_new_version := v_doc.current_version + 1;

        INSERT INTO public.knowledge_document_versions (document_id, version_number, storage_path, change_summary, created_by)
        VALUES (p_id, v_new_version, COALESCE(p_storage_path, v_doc.storage_path), p_change_summary, v_user_id);

        -- Update document
        UPDATE public.knowledge_documents SET
            title = COALESCE(p_title, title),
            description = COALESCE(p_description, description),
            category_id = COALESCE(p_category_id, category_id),
            partner_id = p_partner_id,  -- Allow setting to NULL
            storage_path = COALESCE(p_storage_path, storage_path),
            is_active = COALESCE(p_is_active, is_active),
            current_version = v_new_version,
            updated_at = now()
        WHERE id = p_id;

        -- Update keywords if provided
        IF p_keywords IS NOT NULL THEN
            DELETE FROM public.knowledge_keywords WHERE document_id = p_id;
            INSERT INTO public.knowledge_keywords (document_id, keyword)
            SELECT p_id, LOWER(TRIM(kw)) FROM unnest(p_keywords) AS kw
            WHERE TRIM(kw) <> '';
        END IF;

        RETURN jsonb_build_object('status', 'success', 'action', 'updated', 'id', p_id, 'version', v_new_version);
    END IF;

    -- CREATE
    IF p_title IS NOT NULL AND p_storage_path IS NOT NULL THEN
        INSERT INTO public.knowledge_documents (title, description, category_id, partner_id, storage_path, created_by)
        VALUES (p_title, p_description, p_category_id, p_partner_id, p_storage_path, v_user_id)
        RETURNING id INTO v_new_id;

        -- Save version 1
        INSERT INTO public.knowledge_document_versions (document_id, version_number, storage_path, change_summary, created_by)
        VALUES (v_new_id, 1, p_storage_path, 'Versão inicial', v_user_id);

        -- Insert keywords
        IF p_keywords IS NOT NULL THEN
            INSERT INTO public.knowledge_keywords (document_id, keyword)
            SELECT v_new_id, LOWER(TRIM(kw)) FROM unnest(p_keywords) AS kw
            WHERE TRIM(kw) <> '';
        END IF;

        RETURN jsonb_build_object('status', 'success', 'action', 'created', 'id', v_new_id);
    END IF;

    RETURN jsonb_build_object('status', 'error', 'message', 'Invalid parameters: title and storage_path required for creation');
END;
$$;


-- RPC: get_knowledge_documents
-- Returns all documents with category info, partner info, and keywords.
CREATE OR REPLACE FUNCTION public.get_knowledge_documents(
    p_category_id UUID DEFAULT NULL,
    p_partner_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_results JSONB;
BEGIN
    SELECT jsonb_agg(row_data ORDER BY row_data->>'updated_at' DESC) INTO v_results
    FROM (
        SELECT jsonb_build_object(
            'id', kd.id,
            'title', kd.title,
            'description', kd.description,
            'category_id', kd.category_id,
            'category_name', kc.name,
            'category_label', kc.label,
            'partner_id', kd.partner_id,
            'partner_name', p.name,
            'storage_path', kd.storage_path,
            'is_active', kd.is_active,
            'current_version', kd.current_version,
            'created_by', kd.created_by,
            'created_at', kd.created_at,
            'updated_at', kd.updated_at,
            'keywords', COALESCE((
                SELECT jsonb_agg(kk.keyword)
                FROM public.knowledge_keywords kk
                WHERE kk.document_id = kd.id
            ), '[]'::jsonb)
        ) AS row_data
        FROM public.knowledge_documents kd
        LEFT JOIN public.knowledge_categories kc ON kd.category_id = kc.id
        LEFT JOIN public.partners p ON kd.partner_id = p.id
        WHERE (p_category_id IS NULL OR kd.category_id = p_category_id)
          AND (p_partner_id IS NULL OR kd.partner_id = p_partner_id)
          AND (p_is_active IS NULL OR kd.is_active = p_is_active)
    ) sub;

    RETURN COALESCE(v_results, '[]'::jsonb);
END;
$$;


-- RPC: search_knowledge_by_keyword
-- Used by the Python agent to find relevant documents by keyword or partner_id.
CREATE OR REPLACE FUNCTION public.search_knowledge_by_keyword(
    p_keyword TEXT DEFAULT NULL,
    p_partner_id UUID DEFAULT NULL,
    p_category_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_results JSONB;
BEGIN
    SELECT jsonb_agg(row_data) INTO v_results
    FROM (
        SELECT DISTINCT jsonb_build_object(
            'id', kd.id,
            'title', kd.title,
            'storage_path', kd.storage_path,
            'category_name', kc.name,
            'partner_name', p.name
        ) AS row_data
        FROM public.knowledge_documents kd
        LEFT JOIN public.knowledge_categories kc ON kd.category_id = kc.id
        LEFT JOIN public.partners p ON kd.partner_id = p.id
        LEFT JOIN public.knowledge_keywords kk ON kk.document_id = kd.id
        WHERE kd.is_active = true
          AND (
              (p_keyword IS NOT NULL AND kk.keyword ILIKE '%' || p_keyword || '%')
              OR (p_partner_id IS NOT NULL AND kd.partner_id = p_partner_id)
              OR (p_category_name IS NOT NULL AND kc.name = p_category_name)
          )
    ) sub;

    RETURN COALESCE(v_results, '[]'::jsonb);
END;
$$;


-- ============================================================
-- 4. STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-base', 'knowledge-base', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. STORAGE RLS POLICIES
-- ============================================================

-- Allow authenticated users to upload files to knowledge-base
DROP POLICY IF EXISTS "knowledge_base_insert" ON storage.objects;
CREATE POLICY "knowledge_base_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'knowledge-base');

-- Allow authenticated users to read files from knowledge-base
DROP POLICY IF EXISTS "knowledge_base_select" ON storage.objects;
CREATE POLICY "knowledge_base_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'knowledge-base');

-- Allow authenticated users to update (upsert) files in knowledge-base
DROP POLICY IF EXISTS "knowledge_base_update" ON storage.objects;
CREATE POLICY "knowledge_base_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'knowledge-base');

-- Allow authenticated users to delete files from knowledge-base
DROP POLICY IF EXISTS "knowledge_base_delete" ON storage.objects;
CREATE POLICY "knowledge_base_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'knowledge-base');
