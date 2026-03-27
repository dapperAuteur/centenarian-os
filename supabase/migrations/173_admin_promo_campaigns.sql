-- 173_admin_promo_campaigns.sql
-- Admin-managed promotional campaigns for lifetime membership discounts.

CREATE TABLE IF NOT EXISTS public.admin_promo_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage','fixed','free_months')),
  discount_value NUMERIC(10,2) NOT NULL,
  stripe_coupon_id TEXT,
  plan_types JSONB NOT NULL DEFAULT '["lifetime"]'::jsonb,
  promo_code TEXT,
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  max_uses INT,
  current_uses INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_promo_campaigns ENABLE ROW LEVEL SECURITY;

-- Only service role can access (admin routes use service role client)
