-- 161_email_campaigns.sql
-- Admin email campaign infrastructure for marketing automation.
-- Shared table: both Work.WitUS and CentenarianOS can create campaigns.
-- The `app` column differentiates which product created/owns each campaign.
-- COPY THIS MIGRATION TO THE CENTENARIAN-OS REPO (per SHARED_DB.md).

BEGIN;

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app            TEXT NOT NULL DEFAULT 'contractor',  -- 'contractor' (Work.WitUS) or 'centenarian' (CentenarianOS)
  title          TEXT NOT NULL,
  subject        TEXT NOT NULL,
  body_html      TEXT NOT NULL DEFAULT '',
  template_key   TEXT,  -- optional: references a built-in template (welcome, upgrade, win-back, announcement)
  audience_filter JSONB NOT NULL DEFAULT '{}',  -- { tiers: [], roles: [], activity: '', has_feature: '' }
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at   TIMESTAMPTZ,
  sent_at        TIMESTAMPTZ,
  sent_count     INT NOT NULL DEFAULT 0,
  open_count     INT NOT NULL DEFAULT 0,
  click_count    INT NOT NULL DEFAULT 0,
  created_by     UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_sends (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID NOT NULL REFERENCES public.email_campaigns ON DELETE CASCADE,
  user_id        UUID REFERENCES auth.users ON DELETE SET NULL,
  email          TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'clicked', 'bounced', 'failed')),
  sent_at        TIMESTAMPTZ,
  opened_at      TIMESTAMPTZ,
  clicked_at     TIMESTAMPTZ,
  error_message  TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_campaigns_app ON public.email_campaigns (app);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign ON public.email_sends (campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_user ON public.email_sends (user_id);

-- RLS: admin-only access (both apps use service role client)
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed — all access is through service role client in admin API routes

COMMIT;
