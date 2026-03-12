import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StudentApplication {
    id: string;
    user_id: string;
    partner_id: string;
    status: "DRAFT" | "SUBMITTED";
    answers: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface PartnerFormField {
    id: string;
    partner_id: string;
    field_name: string;
    question_text: string;
    data_type: string;
    options: unknown[] | null;
    mapping_source: string | null;
    is_criterion: boolean;
    criterion_rule: Record<string, unknown> | null;
    sort_order: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Gets the partner_id for the currently logged-in partner user.
 */
export async function getMyPartnerId(): Promise<string | null> {
    const { data, error } = await supabase.rpc("get_my_partner_id" as any);
    if (error) {
        console.error("Error fetching partner ID:", error);
        return null;
    }
    return data as string | null;
}

/**
 * Gets partner details by ID.
 */
export async function getPartnerDetails(partnerId: string) {
    const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("id", partnerId)
        .single();

    if (error) {
        console.error("Error fetching partner details:", error);
        throw error;
    }

    return data;
}

/**
 * Gets the form field definitions for a partner.
 */
export async function getPartnerFormFields(partnerId: string): Promise<PartnerFormField[]> {
    const { data, error } = await (supabase
        .from("partner_forms" as any)
        .select("*")
        .eq("partner_id", partnerId)
        .order("sort_order", { ascending: true }) as any);

    if (error) {
        console.error("Error fetching partner forms:", error);
        throw error;
    }

    return (data ?? []) as PartnerFormField[];
}

/**
 * Gets all student applications for a specific partner.
 * RLS ensures only the partner's own applications are returned.
 */
export async function getApplicationsByPartner(partnerId: string): Promise<StudentApplication[]> {
    const { data, error } = await (supabase
        .from("student_applications" as any)
        .select("*")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false }) as any);

    if (error) {
        console.error("Error fetching applications:", error);
        throw error;
    }

    return (data ?? []) as StudentApplication[];
}

/**
 * Gets user profile data to enrich the applications table.
 */
export async function getUserProfiles(userIds: string[]) {
    if (userIds.length === 0) return [];

    const { data, error } = await supabase
        .from("user_profiles" as any)
        .select("id, full_name, city, state, education")
        .in("id", userIds);

    if (error) {
        console.error("Error fetching user profiles:", error);
        return [];
    }

    return data ?? [];
}
