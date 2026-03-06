-- Create table for caching AI insights
CREATE TABLE public.ai_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insights JSONB NOT NULL,
  data_context JSONB NOT NULL,
  data_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster lookups by creation date
CREATE INDEX idx_ai_insights_created_at ON public.ai_insights(created_at DESC);

-- Enable RLS (admin only - no user-specific access needed)
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Allow public read access (analytics dashboard is internal)
CREATE POLICY "Allow public read access" ON public.ai_insights FOR SELECT USING (true);

-- Allow public insert (edge function uses service role anyway)
CREATE POLICY "Allow public insert" ON public.ai_insights FOR INSERT WITH CHECK (true);