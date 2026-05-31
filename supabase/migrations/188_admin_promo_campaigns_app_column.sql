-- 188_admin_promo_campaigns_app_column.sql
-- Differentiate admin promo campaigns between Work.WitUS (contractor) and CentenarianOS.
-- Without this, an admin in either app would see/activate campaigns belonging to the other,
-- and the Stripe checkout / CashApp bypass logic would match across both products.
-- COPY THIS MIGRATION TO THE CENTENARIAN-OS REPO (per SHARED_DB.md).

BEGIN;

ALTER TABLE public.admin_promo_campaigns
  ADD COLUMN IF NOT EXISTS app TEXT NOT NULL DEFAULT 'contractor';

-- Track which CashApp submission was tied to which promo so verification
-- increments the correct campaign's current_uses count.
ALTER TABLE public.cashapp_payments
  ADD COLUMN IF NOT EXISTS promo_campaign_id UUID
  REFERENCES public.admin_promo_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admin_promo_campaigns_app_active
  ON public.admin_promo_campaigns (app, is_active);

CREATE INDEX IF NOT EXISTS idx_cashapp_payments_promo_campaign
  ON public.cashapp_payments (promo_campaign_id);

COMMIT;
