-- 081_invoice_custom_fields.sql
-- Add customizable fields, invoice number prefix, and item types to invoices/templates
-- Supports: custom fields per template (POC, location, job ref, etc.), invoice # prefix,
-- and line item types (line_item vs benefit)

-- ── Invoice templates additions ───────────────────────────────────────────
ALTER TABLE invoice_templates
  ADD COLUMN IF NOT EXISTS invoice_number_prefix TEXT,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '[]';

-- custom_fields stores field definitions:
-- [{"key":"poc_name","label":"Point of Contact","type":"text"},
--  {"key":"location","label":"Location / Venue","type":"text"}, ...]

ALTER TABLE invoice_template_items
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'line_item'
    CHECK (item_type IN ('line_item', 'benefit'));

-- ── Invoices additions ────────────────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_number_prefix TEXT,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- custom_fields stores actual values: {"poc_name":"Michael Aagaard","location":"Gainbridge Fieldhouse"}

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'line_item'
    CHECK (item_type IN ('line_item', 'benefit'));
