-- 225: vendor_bills — CentOS-local projection of third-party service bills pushed by witus.online
-- (/admin/costs collects Vercel, Neon and marketplace usage daily and POSTs a signed snapshot to
-- /api/events/vendor-bills). Additive and idempotent per the shared-database rules in CLAUDE.md.
-- Why a projection and not a cross-app read: the registry rule (never share databases) and the
-- same pattern as income_events (196).

CREATE TABLE IF NOT EXISTS public.vendor_bills (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id      TEXT NOT NULL,
  source_app    TEXT NOT NULL DEFAULT 'witus-online',
  service_slug  TEXT NOT NULL,
  service_name  TEXT NOT NULL,
  vendor        TEXT NOT NULL,
  plan          TEXT,
  billed_via    TEXT,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  base_fee      NUMERIC(10,2),
  usage_cost    NUMERIC(12,4) NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  account_url   TEXT,
  witus_url     TEXT,
  detail        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_bills_user_event
  ON public.vendor_bills(user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_vendor_bills_user_period
  ON public.vendor_bills(user_id, period_end DESC);

ALTER TABLE public.vendor_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendor_bills_owner" ON public.vendor_bills;
CREATE POLICY "vendor_bills_owner" ON public.vendor_bills
  FOR ALL USING (user_id = auth.uid());

COMMENT ON TABLE public.vendor_bills IS
  'Projection of ecosystem service bills pushed by witus.online /admin/costs (signed X-Witus-* events). Match against financial_transactions by vendor to see the payment account used.';
