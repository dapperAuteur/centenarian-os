-- 162_marketing_banners.sql
-- Admin-managed marketing banners for in-app upgrade prompts.
-- Shared table: `app` column differentiates Work.WitUS vs CentenarianOS.
-- COPY THIS MIGRATION TO THE CENTENARIAN-OS REPO (per SHARED_DB.md).

BEGIN;

CREATE TABLE IF NOT EXISTS public.marketing_banners (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app            TEXT NOT NULL DEFAULT 'contractor',  -- 'contractor' or 'centenarian'
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  cta_text       TEXT NOT NULL DEFAULT 'Upgrade',
  cta_url        TEXT NOT NULL DEFAULT '/pricing',
  target_tiers   TEXT[] NOT NULL DEFAULT '{free}',    -- subscription tiers to show to
  is_active      BOOLEAN NOT NULL DEFAULT true,
  starts_at      TIMESTAMPTZ,
  ends_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_banners_app ON public.marketing_banners (app);
CREATE INDEX IF NOT EXISTS idx_marketing_banners_active ON public.marketing_banners (is_active);

ALTER TABLE public.marketing_banners ENABLE ROW LEVEL SECURITY;

COMMIT;
