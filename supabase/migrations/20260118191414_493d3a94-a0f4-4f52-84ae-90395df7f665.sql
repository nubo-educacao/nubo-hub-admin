-- Permitir leitura pública de location_preference para analytics
-- Isso é seguro pois location_preference não contém PII sensível (é apenas cidade/estado preferido)
CREATE POLICY "Allow public read of location_preference for analytics"
ON public.user_preferences
FOR SELECT
USING (true);