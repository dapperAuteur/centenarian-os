-- 170_contact_share_visible_fields.sql
-- Add field-level privacy controls to contact sharing.
-- Sharer picks which fields the recipient can see via a JSON allowlist.

ALTER TABLE public.contact_shares
  ADD COLUMN IF NOT EXISTS visible_fields JSONB NOT NULL DEFAULT
    '["name","company_name","job_title","email","phone","notes","addresses","tags","website","paycheck_portal"]'::jsonb;

COMMENT ON COLUMN public.contact_shares.visible_fields IS
  'JSON array of field keys the sharer allows the recipient to see. '
  'Keys: name (always included), company_name, job_title, email, phone, '
  'notes, addresses, tags, website, paycheck_portal. '
  'On accept, only allowed fields are copied to the recipient contact.';
