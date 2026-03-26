-- 163_referral_rewards.sql
-- Referral reward tiers — auto-credit referrers when they hit milestones.
-- Shared table: `app` column differentiates Work.WitUS vs CentenarianOS.
-- COPY THIS MIGRATION TO THE CENTENARIAN-OS REPO (per SHARED_DB.md).

BEGIN;

CREATE TABLE IF NOT EXISTS public.referral_reward_tiers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app            TEXT NOT NULL DEFAULT 'contractor',
  name           TEXT NOT NULL,                       -- 'Bronze', 'Silver', 'Gold'
  paid_referrals INT NOT NULL,                        -- threshold: 3, 10, 25
  reward_type    TEXT NOT NULL DEFAULT 'credit',      -- 'credit' (Stripe balance) or 'upgrade' (lifetime)
  reward_months  INT NOT NULL DEFAULT 1,              -- months of free service (0 for lifetime upgrade)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tier_id        UUID NOT NULL REFERENCES public.referral_reward_tiers ON DELETE CASCADE,
  paid_count     INT NOT NULL,                        -- paid referrals at time of reward
  applied_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stripe_credit_id TEXT                               -- Stripe customer balance transaction ID (if credit)
);

-- Prevent duplicate rewards for same user + tier
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_rewards_user_tier
  ON public.referral_rewards (user_id, tier_id);

CREATE INDEX IF NOT EXISTS idx_referral_reward_tiers_app
  ON public.referral_reward_tiers (app);

-- Seed default tiers for Work.WitUS
INSERT INTO public.referral_reward_tiers (app, name, paid_referrals, reward_type, reward_months)
VALUES
  ('contractor', 'Bronze', 3, 'credit', 1),
  ('contractor', 'Silver', 10, 'credit', 3),
  ('contractor', 'Gold', 25, 'upgrade', 0)
ON CONFLICT DO NOTHING;

ALTER TABLE public.referral_reward_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

COMMIT;
