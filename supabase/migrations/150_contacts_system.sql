-- 150_contacts_system.sql
-- Hybrid Contacts System: Rolodex (person-first with tags) + Crew Sheets (job-linked roles)
-- Work.WitUS only — CentenarianOS can safely ignore these tables.

-- ============================================================
-- 1. Extend user_contacts with person fields
-- ============================================================

ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS contact_subtype TEXT;
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS home_city TEXT;
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS home_state TEXT;
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS home_country TEXT;
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS last_worked_with DATE;
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS total_jobs_together INT NOT NULL DEFAULT 0;

-- ============================================================
-- 2. contact_phones — multiple phone numbers per contact
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_phones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES user_contacts(id) ON DELETE CASCADE,
  phone       TEXT NOT NULL,
  label       TEXT DEFAULT 'mobile',
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_phones_contact ON contact_phones(contact_id);

-- ============================================================
-- 3. contact_emails — multiple email addresses per contact
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_emails (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES user_contacts(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  label       TEXT DEFAULT 'work',
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_emails_contact ON contact_emails(contact_id);

-- ============================================================
-- 4. contact_tags — flexible tagging (company, role, skill, group, custom)
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES user_contacts(id) ON DELETE CASCADE,
  tag_type    TEXT NOT NULL CHECK (tag_type IN ('company', 'role', 'skill', 'group', 'custom')),
  value       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contact_id, tag_type, value)
);

CREATE INDEX IF NOT EXISTS idx_contact_tags_contact ON contact_tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_type_value ON contact_tags(tag_type, value);

-- ============================================================
-- 5. contact_job_roles — many-to-many contacts <-> jobs with roles
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_job_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES user_contacts(id) ON DELETE CASCADE,
  job_id      UUID NOT NULL REFERENCES contractor_jobs(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES contractor_events(id) ON DELETE SET NULL,
  role        TEXT NOT NULL CHECK (role IN (
    'poc', 'crew_coordinator', 'tech_lead', 'producer', 'eic',
    'a1', 'a2', 'v1', 'v2', 'graphics', 'replay', 'utility', 'other'
  )),
  role_label  TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contact_id, job_id, role)
);

CREATE INDEX IF NOT EXISTS idx_contact_job_roles_contact ON contact_job_roles(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_job_roles_job ON contact_job_roles(job_id);

-- ============================================================
-- 6. contact_shares — sharing contacts between users
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_shares (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES user_contacts(id) ON DELETE CASCADE,
  shared_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contact_id, shared_with)
);

CREATE INDEX IF NOT EXISTS idx_contact_shares_shared_with ON contact_shares(shared_with, status);
CREATE INDEX IF NOT EXISTS idx_contact_shares_shared_by ON contact_shares(shared_by);

-- ============================================================
-- 7. Migrate existing single phone/email into multi-value tables
-- ============================================================

INSERT INTO contact_phones (contact_id, phone, label, is_primary)
SELECT id, phone, 'mobile', true
FROM user_contacts
WHERE phone IS NOT NULL AND phone <> ''
ON CONFLICT DO NOTHING;

INSERT INTO contact_emails (contact_id, email, label, is_primary)
SELECT id, email, 'work', true
FROM user_contacts
WHERE email IS NOT NULL AND email <> ''
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. RLS policies
-- ============================================================

ALTER TABLE contact_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_job_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_shares ENABLE ROW LEVEL SECURITY;

-- contact_phones: owner access via user_contacts FK
CREATE POLICY contact_phones_owner ON contact_phones
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_contacts uc WHERE uc.id = contact_phones.contact_id AND uc.user_id = auth.uid())
  );

-- contact_emails: owner access via user_contacts FK
CREATE POLICY contact_emails_owner ON contact_emails
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_contacts uc WHERE uc.id = contact_emails.contact_id AND uc.user_id = auth.uid())
  );

-- contact_tags: owner access via user_contacts FK
CREATE POLICY contact_tags_owner ON contact_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_contacts uc WHERE uc.id = contact_tags.contact_id AND uc.user_id = auth.uid())
  );

-- contact_job_roles: owner access via user_contacts FK
CREATE POLICY contact_job_roles_owner ON contact_job_roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_contacts uc WHERE uc.id = contact_job_roles.contact_id AND uc.user_id = auth.uid())
  );

-- contact_shares: visible to sender and recipient
CREATE POLICY contact_shares_sender ON contact_shares
  FOR ALL USING (shared_by = auth.uid());

CREATE POLICY contact_shares_recipient ON contact_shares
  FOR SELECT USING (shared_with = auth.uid());

CREATE POLICY contact_shares_recipient_update ON contact_shares
  FOR UPDATE USING (shared_with = auth.uid());
