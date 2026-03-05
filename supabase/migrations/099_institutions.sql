-- 099_institutions.sql
-- Public institutions directory + admin-managed offers.
-- No RLS — public read, service-role write only.

BEGIN;

-- ── 1. Institutions table (aggregated, anonymized) ──────────────
CREATE TABLE IF NOT EXISTS public.institutions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT NOT NULL UNIQUE,
  slug                      TEXT NOT NULL UNIQUE,
  logo_url                  TEXT,
  website                   TEXT,
  description               TEXT,
  avg_checking_apr           NUMERIC(5,2),
  avg_savings_apr            NUMERIC(5,2),
  avg_credit_card_apr        NUMERIC(5,2),
  avg_loan_apr               NUMERIC(5,2),
  common_monthly_fees        JSONB,
  avg_credit_limit           NUMERIC(10,2),
  known_dispute_window_days  INT,
  known_return_days          INT,
  rewards_summary            TEXT,
  account_count              INT NOT NULL DEFAULT 0,
  short_link_id              TEXT,
  short_link_url             TEXT,
  last_aggregated_at         TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No RLS — public read via unauthenticated API routes
-- Writes handled by service role client in admin API routes

-- ── 2. Institution offers table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.institution_offers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  description      TEXT,
  offer_type       TEXT NOT NULL
                     CHECK (offer_type IN ('promo_apr','balance_transfer','cashback','signup_bonus','fee_waiver','other')),
  details          JSONB,
  expires_at       DATE,
  url              TEXT,
  is_published     BOOLEAN NOT NULL DEFAULT false,
  short_link_id    TEXT,
  short_link_url   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Updated_at triggers ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_institutions_updated ON public.institutions;
CREATE TRIGGER trg_institutions_updated
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_institution_offers_updated ON public.institution_offers;
CREATE TRIGGER trg_institution_offers_updated
  BEFORE UPDATE ON public.institution_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
