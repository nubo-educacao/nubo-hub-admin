-- Migration: Create external_redirect_clicks table
-- Tracks when users click external redirect links (e.g., WhatsApp for Instituto Sol)

CREATE TABLE IF NOT EXISTS external_redirect_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  partner_id UUID NOT NULL REFERENCES partners(id),
  redirect_url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE external_redirect_clicks ENABLE ROW LEVEL SECURITY;

-- Users can insert their own redirect clicks
CREATE POLICY "Users can insert their own redirect clicks"
  ON external_redirect_clicks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own redirect clicks
CREATE POLICY "Users can read their own redirect clicks"
  ON external_redirect_clicks FOR SELECT
  USING (auth.uid() = user_id);
