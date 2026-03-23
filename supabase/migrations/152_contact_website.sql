-- 152_contact_website.sql
-- Add website field to user_contacts for person contacts.
-- Work.WitUS only — CentenarianOS can safely ignore this column.

ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS website TEXT;
