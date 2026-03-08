-- 113_union_memberships.sql
-- Phase 10: Union Membership + Dues Tracking
-- Track memberships across multiple unions/locals with dues scheduling and payment history.

BEGIN;

-- ── 1. union_memberships table ────────────────────────────────────────
CREATE TABLE union_memberships (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  union_name        TEXT NOT NULL,
  local_number      TEXT NOT NULL,
  member_id         TEXT,
  status            TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended', 'retired', 'honorary')),
  join_date         DATE,
  expiration_date   DATE,
  dues_amount       NUMERIC(10,2),
  dues_frequency    TEXT DEFAULT 'quarterly'
    CHECK (dues_frequency IN ('monthly', 'quarterly', 'semi_annual', 'annual')),
  next_dues_date    DATE,
  auto_pay          BOOLEAN DEFAULT false,
  initiation_fee    NUMERIC(10,2),
  initiation_paid   BOOLEAN DEFAULT false,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, union_name, local_number)
);

ALTER TABLE union_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY union_memberships_owner ON union_memberships
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX idx_union_memberships_user ON union_memberships(user_id);

-- ── 2. union_dues_payments table ──────────────────────────────────────
CREATE TABLE union_dues_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id       UUID NOT NULL REFERENCES union_memberships(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount              NUMERIC(10,2) NOT NULL,
  payment_date        DATE NOT NULL,
  period_start        DATE,
  period_end          DATE,
  payment_method      TEXT,
  confirmation_number TEXT,
  transaction_id      UUID REFERENCES financial_transactions(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE union_dues_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY union_dues_payments_owner ON union_dues_payments
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX idx_union_dues_membership ON union_dues_payments(membership_id);
CREATE INDEX idx_union_dues_user ON union_dues_payments(user_id);

COMMIT;
