-- 056_user_contacts.sql
-- Saved contacts for reuse across finance (vendors/customers) and travel (locations).
-- use_count tracks frequency so most-used suggestions appear first.

CREATE TABLE user_contacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  contact_type        TEXT NOT NULL CHECK (contact_type IN ('vendor', 'customer', 'location')),
  default_category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  notes               TEXT,
  use_count           INT NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name, contact_type)
);

CREATE INDEX ON user_contacts (user_id, contact_type);

ALTER TABLE user_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own contacts"
  ON user_contacts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
