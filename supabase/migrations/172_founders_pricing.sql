-- 172_founders_pricing.sql
-- Seed founder's pricing settings for lifetime plan tier tracking.

INSERT INTO public.platform_settings (key, value, updated_at)
VALUES
  ('lifetime_founders_limit', '100', now()),
  ('lifetime_founders_label', 'Founder''s Price', now())
ON CONFLICT (key) DO NOTHING;
