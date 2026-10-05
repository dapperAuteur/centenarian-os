-- 211_debt_plans_bill_due.sql
-- Debt-free plans, card/loan due dates as planner tasks, and due-date email reminder settings
-- (plans/61 sections 2 and 5).
--
-- PURPOSE
--   debt_plans              a saved debt-free plan: strategy (avalanche / snowball / promo_first /
--                           custom), extra monthly amount, custom order, and a snapshot of the
--                           planned payments when it was saved (baseline), so progress can be
--                           compared with the linked card/loan payments made since.
--   bill_due_items          one row per card/loan due date or promo deadline the app has turned
--                           into a planner task. tasks.source_id is a UUID and a due date has no
--                           row of its own, so tasks.source_id points here (source_type
--                           'bill_due'), the same pattern as calendar_sync_items (migration 204).
--                           Also records which email reminders went out, so each is sent once.
--   debt_reminder_settings  per-user email reminder choice for due dates: off / 3_days / 1_day /
--                           both. Its own table, not a column on the shared profiles table.
--
-- WHO CAN READ WHAT
--   debt_plans and debt_reminder_settings: the owner reads and writes their own rows.
--   bill_due_items: the owner may SELECT; writes go through the service role (the daily cron
--   /api/cron/bill-due-tasks and POST /api/finance/debt/due-tasks).
--
-- ADDITIVE ONLY. SHARED DB (contractor-os / Work.WitUS uses the same database): three new tables.
-- Nothing existing is dropped, renamed or narrowed. roadmaps.system_kind is NOT touched: the
-- "Bills" milestone lives under the existing Inbox system roadmap and goal.
--
-- SAFE TO RE-RUN: every CREATE uses IF NOT EXISTS and every policy sits in a DO block that checks
-- pg_policies first.
--
-- NOT APPLIED AUTOMATICALLY: run it by hand in the Supabase SQL editor. Until it is applied the
-- debt page still shows debts, interest paid and the calculator, and says "Run migration 211
-- first" for saved plans, planner tasks and email reminders. If it still says so afterwards,
-- PostgREST has not reloaded its schema cache:  NOTIFY pgrst, 'reload schema';

BEGIN;

-- ── debt_plans ──────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.debt_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL
                    CONSTRAINT debt_plans_user_id_fkey REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT 'My debt-free plan',
  strategy        TEXT NOT NULL DEFAULT 'avalanche'
                    CONSTRAINT debt_plans_strategy_check
                    CHECK (strategy IN ('avalanche', 'snowball', 'promo_first', 'custom')),
  extra_monthly   NUMERIC(12,2) NOT NULL DEFAULT 0
                    CONSTRAINT debt_plans_extra_monthly_check CHECK (extra_monthly >= 0),
  -- Account ids, first paid first. Used when strategy = 'custom'.
  custom_order    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Clear deferred-interest promo balances before their deadline first (BAM's default).
  protect_promos  BOOLEAN NOT NULL DEFAULT true,
  -- { start_date, debts: [{ id, name, balance, apr, min }], months: [{ date, payments: { id: dollars } }] }
  baseline        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debt_plans_user ON public.debt_plans (user_id, created_at DESC);

ALTER TABLE public.debt_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'debt_plans' AND policyname = 'debt_plans_owner'
  ) THEN
    CREATE POLICY debt_plans_owner ON public.debt_plans
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── bill_due_items ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bill_due_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL
                          CONSTRAINT bill_due_items_user_id_fkey REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id            UUID NOT NULL
                          CONSTRAINT bill_due_items_account_id_fkey REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  kind                  TEXT NOT NULL
                          CONSTRAINT bill_due_items_kind_check CHECK (kind IN ('payment_due', 'promo_deadline')),
  -- The payment due date, or the promo's expiry date.
  due_date              DATE NOT NULL,
  -- '' for payment due dates; expiry|description for a promo (lib/finance/debt/overview.ts promoKey).
  promo_key             TEXT NOT NULL DEFAULT '',
  task_id               UUID
                          CONSTRAINT bill_due_items_task_id_fkey REFERENCES public.tasks(id) ON DELETE SET NULL,
  paid_at               TIMESTAMPTZ,
  reminder_3d_sent_at   TIMESTAMPTZ,
  reminder_1d_sent_at   TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bill_due_items_identity_key UNIQUE (user_id, account_id, kind, due_date, promo_key)
);

CREATE INDEX IF NOT EXISTS idx_bill_due_items_user_due ON public.bill_due_items (user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_bill_due_items_task ON public.bill_due_items (task_id) WHERE task_id IS NOT NULL;

ALTER TABLE public.bill_due_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bill_due_items' AND policyname = 'bill_due_items_owner_select'
  ) THEN
    CREATE POLICY bill_due_items_owner_select ON public.bill_due_items
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── debt_reminder_settings ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.debt_reminder_settings (
  user_id          UUID PRIMARY KEY
                     CONSTRAINT debt_reminder_settings_user_id_fkey REFERENCES auth.users(id) ON DELETE CASCADE,
  email_reminders  TEXT NOT NULL DEFAULT 'off'
                     CONSTRAINT debt_reminder_settings_email_check
                     CHECK (email_reminders IN ('off', '3_days', '1_day', 'both')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.debt_reminder_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'debt_reminder_settings' AND policyname = 'debt_reminder_settings_owner'
  ) THEN
    CREATE POLICY debt_reminder_settings_owner ON public.debt_reminder_settings
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE public.debt_plans IS
  'Saved debt-free plans (CentenarianOS, migration 211): strategy, extra monthly amount, custom order, promo protection, and a baseline snapshot of planned payments for progress tracking.';
COMMENT ON TABLE public.bill_due_items IS
  'Card/loan due dates and deferred-interest promo deadlines turned into planner tasks (CentenarianOS, migration 211). tasks.source_id = this id with tasks.source_type = ''bill_due''. Records email reminders sent. Owner may SELECT; writes go through the service role.';
COMMENT ON TABLE public.debt_reminder_settings IS
  'Per-user email reminder setting for card/loan due dates (CentenarianOS, migration 211): off, 3_days, 1_day or both.';

COMMIT;
