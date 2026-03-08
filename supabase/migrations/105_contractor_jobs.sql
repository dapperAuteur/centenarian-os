-- 105_contractor_jobs.sql
-- Contractor Job Hub: central job tracking, time entries, documents,
-- contact email/phone, venue KB fields, and FK extensions.

BEGIN;

-- ── 1. Add email + phone to user_contacts ─────────────────────────────
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS phone TEXT;

-- ── 2. Add venue KB fields to contact_locations ───────────────────────
ALTER TABLE contact_locations ADD COLUMN IF NOT EXISTS schematics_url TEXT;
ALTER TABLE contact_locations ADD COLUMN IF NOT EXISTS knowledge_base JSONB DEFAULT '{}';

-- ── 3. contractor_jobs table ──────────────────────────────────────────
CREATE TABLE contractor_jobs (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_number                  TEXT NOT NULL,
  client_id                   UUID REFERENCES user_contacts(id) ON DELETE SET NULL,
  client_name                 TEXT NOT NULL,
  event_name                  TEXT,
  location_id                 UUID REFERENCES contact_locations(id) ON DELETE SET NULL,
  location_name               TEXT,
  poc_contact_id              UUID REFERENCES user_contacts(id) ON DELETE SET NULL,
  poc_name                    TEXT,
  poc_phone                   TEXT,
  crew_coordinator_id         UUID REFERENCES user_contacts(id) ON DELETE SET NULL,
  crew_coordinator_name       TEXT,
  crew_coordinator_phone      TEXT,
  status                      TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned','confirmed','in_progress','completed','invoiced','paid','cancelled')),
  start_date                  DATE,
  end_date                    DATE,
  is_multi_day                BOOLEAN NOT NULL DEFAULT false,
  scheduled_dates             JSONB NOT NULL DEFAULT '[]',
  pay_rate                    NUMERIC(10,2),
  ot_rate                     NUMERIC(10,2),
  dt_rate                     NUMERIC(10,2),
  rate_type                   TEXT NOT NULL DEFAULT 'hourly'
    CHECK (rate_type IN ('hourly','daily','flat')),
  distance_from_home_miles    NUMERIC(8,2),
  benefits_eligible           BOOLEAN NOT NULL DEFAULT false,
  travel_benefits             JSONB NOT NULL DEFAULT '{}',
  union_local                 TEXT,
  department                  TEXT,
  brand_id                    UUID REFERENCES user_brands(id) ON DELETE SET NULL,
  est_pay_date                DATE,
  is_public                   BOOLEAN NOT NULL DEFAULT false,
  notes                       TEXT,
  metadata                    JSONB NOT NULL DEFAULT '{}',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contractor_jobs_user ON contractor_jobs (user_id);
CREATE INDEX idx_contractor_jobs_status ON contractor_jobs (user_id, status);
CREATE INDEX idx_contractor_jobs_dates ON contractor_jobs (user_id, start_date DESC);
CREATE INDEX idx_contractor_jobs_client ON contractor_jobs (client_id);
CREATE UNIQUE INDEX idx_contractor_jobs_number ON contractor_jobs (user_id, job_number);

ALTER TABLE contractor_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY contractor_jobs_owner ON contractor_jobs
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY contractor_jobs_public_read ON contractor_jobs
  FOR SELECT USING (is_public = true);

-- ── 4. job_time_entries table ─────────────────────────────────────────
CREATE TABLE job_time_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES contractor_jobs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date       DATE NOT NULL,
  time_in         TIMESTAMPTZ,
  time_out        TIMESTAMPTZ,
  adjusted_in     TIMESTAMPTZ,
  adjusted_out    TIMESTAMPTZ,
  break_minutes   INT NOT NULL DEFAULT 0,
  total_hours     NUMERIC(6,2),
  st_hours        NUMERIC(6,2),
  ot_hours        NUMERIC(6,2),
  dt_hours        NUMERIC(6,2),
  meal_provided   BOOLEAN NOT NULL DEFAULT false,
  invoice_id      UUID REFERENCES invoices(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_time_entries_job ON job_time_entries (job_id);
CREATE INDEX idx_job_time_entries_date ON job_time_entries (user_id, work_date DESC);
CREATE UNIQUE INDEX idx_job_time_entries_unique ON job_time_entries (job_id, work_date);

ALTER TABLE job_time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY job_time_entries_owner ON job_time_entries
  FOR ALL USING (user_id = auth.uid());

-- ── 5. job_documents table ────────────────────────────────────────────
CREATE TABLE job_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES contractor_jobs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  doc_type    TEXT NOT NULL DEFAULT 'other'
    CHECK (doc_type IN ('call_sheet','crew_list','w9','certificate','contract','receipt','schematic','map','other')),
  is_shared   BOOLEAN NOT NULL DEFAULT false,
  file_size   INT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_documents_job ON job_documents (job_id);

ALTER TABLE job_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY job_documents_owner ON job_documents
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY job_documents_shared_read ON job_documents
  FOR SELECT USING (is_shared = true);

-- ── 6. Add job_id FK to invoices, trips, financial_transactions ───────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES contractor_jobs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices (job_id);

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES contractor_jobs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_trips_job ON trips (job_id);

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES contractor_jobs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ft_job ON financial_transactions (job_id);

-- ── 7. Extend activity_links CHECK constraints for 'job' type ─────────
ALTER TABLE activity_links DROP CONSTRAINT IF EXISTS activity_links_source_type_check;
ALTER TABLE activity_links ADD CONSTRAINT activity_links_source_type_check
  CHECK (source_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment',
    'focus_session','exercise','daily_log','job'
  ));

ALTER TABLE activity_links DROP CONSTRAINT IF EXISTS activity_links_target_type_check;
ALTER TABLE activity_links ADD CONSTRAINT activity_links_target_type_check
  CHECK (target_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment',
    'focus_session','exercise','daily_log','job'
  ));

-- ── 8. Extend entity_life_categories CHECK constraint ─────────────────
ALTER TABLE entity_life_categories DROP CONSTRAINT IF EXISTS entity_life_categories_entity_type_check;
ALTER TABLE entity_life_categories ADD CONSTRAINT entity_life_categories_entity_type_check
  CHECK (entity_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment',
    'focus_session','exercise','daily_log','job'
  ));

-- ── 9. Extend financial_transactions source + source_module ───────────
ALTER TABLE financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_source_check;
ALTER TABLE financial_transactions
  ADD CONSTRAINT financial_transactions_source_check
    CHECK (source IN ('manual','csv_import','stripe','fuel_log','vehicle_maintenance','trip','transfer','interest','recurring','scan','bank_sync','job'));

ALTER TABLE financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_source_module_check;
ALTER TABLE financial_transactions
  ADD CONSTRAINT financial_transactions_source_module_check
    CHECK (source_module IS NULL OR source_module IN ('fuel_log','vehicle_maintenance','trip','scan','job'));

COMMIT;
