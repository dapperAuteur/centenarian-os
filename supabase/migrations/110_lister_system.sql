-- 110_lister_system.sql
-- Job Lister / Union Leader: assignments, roster extensions, messaging, groups.
-- Extends profiles and contractor_jobs for lister role.

BEGIN;

-- ── 1. Extend profiles for lister role ──────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contractor_role TEXT DEFAULT 'worker'
  CHECK (contractor_role IN ('worker', 'lister', 'union_leader'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lister_company_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lister_union_local TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS products TEXT[] DEFAULT '{}';

-- ── 2. Extend contractor_jobs for lister-created jobs ───────────────────
ALTER TABLE contractor_jobs ADD COLUMN IF NOT EXISTS lister_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE contractor_jobs ADD COLUMN IF NOT EXISTS is_lister_job BOOLEAN DEFAULT false;

-- ── 3. Extend user_contacts for roster ──────────────────────────────────
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS is_contractor BOOLEAN DEFAULT false;
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS skills TEXT[];
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS availability_notes TEXT;

-- ── 4. contractor_job_assignments table ─────────────────────────────────
CREATE TABLE contractor_job_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES contractor_jobs(id) ON DELETE CASCADE,
  assigned_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'offered'
                  CHECK (status IN ('offered', 'accepted', 'declined', 'removed')),
  message         TEXT,
  response_note   TEXT,
  assigned_at     TIMESTAMPTZ DEFAULT now(),
  responded_at    TIMESTAMPTZ,
  UNIQUE (job_id, assigned_to)
);

ALTER TABLE contractor_job_assignments ENABLE ROW LEVEL SECURITY;

-- Lister (assigner) full access
CREATE POLICY assignments_assigner ON contractor_job_assignments
  FOR ALL USING (assigned_by = auth.uid());

-- Worker (assignee) can read + update own
CREATE POLICY assignments_assignee_read ON contractor_job_assignments
  FOR SELECT USING (assigned_to = auth.uid());

CREATE POLICY assignments_assignee_update ON contractor_job_assignments
  FOR UPDATE USING (assigned_to = auth.uid());

-- ── 5. Lister message groups ────────────────────────────────────────────
CREATE TABLE lister_message_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lister_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE lister_message_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY msg_groups_owner ON lister_message_groups
  FOR ALL USING (lister_id = auth.uid());

-- Members can read groups they belong to
CREATE POLICY msg_groups_member_read ON lister_message_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lister_message_group_members
      WHERE group_id = id AND user_id = auth.uid()
    )
  );

-- ── 6. Group members ───────────────────────────────────────────────────
CREATE TABLE lister_message_group_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  UUID NOT NULL REFERENCES lister_message_groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE lister_message_group_members ENABLE ROW LEVEL SECURITY;

-- Group owner manages members
CREATE POLICY group_members_owner ON lister_message_group_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lister_message_groups
      WHERE id = group_id AND lister_id = auth.uid()
    )
  );

-- Members can see their own memberships
CREATE POLICY group_members_self ON lister_message_group_members
  FOR SELECT USING (user_id = auth.uid());

-- ── 7. Lister messages ─────────────────────────────────────────────────
CREATE TABLE lister_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id      UUID REFERENCES lister_message_groups(id) ON DELETE CASCADE,
  subject       TEXT,
  body          TEXT NOT NULL,
  is_read       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  CHECK (
    (recipient_id IS NOT NULL AND group_id IS NULL)
    OR (recipient_id IS NULL AND group_id IS NOT NULL)
  )
);

ALTER TABLE lister_messages ENABLE ROW LEVEL SECURITY;

-- Sender can manage own messages
CREATE POLICY messages_sender ON lister_messages
  FOR ALL USING (sender_id = auth.uid());

-- Recipient can read direct messages
CREATE POLICY messages_recipient_read ON lister_messages
  FOR SELECT USING (recipient_id = auth.uid());

-- Recipient can update (mark read)
CREATE POLICY messages_recipient_update ON lister_messages
  FOR UPDATE USING (recipient_id = auth.uid());

-- Group members can read group messages
CREATE POLICY messages_group_read ON lister_messages
  FOR SELECT USING (
    group_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM lister_message_group_members
      WHERE group_id = lister_messages.group_id AND user_id = auth.uid()
    )
  );

-- ── 8. Indexes ──────────────────────────────────────────────────────────
CREATE INDEX idx_assignments_job ON contractor_job_assignments(job_id);
CREATE INDEX idx_assignments_assigned_by ON contractor_job_assignments(assigned_by);
CREATE INDEX idx_assignments_assigned_to ON contractor_job_assignments(assigned_to);
CREATE INDEX idx_msg_groups_lister ON lister_message_groups(lister_id);
CREATE INDEX idx_group_members_group ON lister_message_group_members(group_id);
CREATE INDEX idx_group_members_user ON lister_message_group_members(user_id);
CREATE INDEX idx_messages_sender ON lister_messages(sender_id);
CREATE INDEX idx_messages_recipient ON lister_messages(recipient_id);
CREATE INDEX idx_messages_group ON lister_messages(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_contacts_contractor ON user_contacts(is_contractor) WHERE is_contractor = true;

COMMIT;
