-- Migration 155: Fiscal calendar settings
-- Allows users to set their fiscal year start date for financial reporting.
-- Default (1, 1) = calendar year (Jan 1).
-- Copy this migration to both repos (contractor-os + centenarian-os)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fiscal_year_start_month INT DEFAULT 1
  CHECK (fiscal_year_start_month BETWEEN 1 AND 12);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fiscal_year_start_day INT DEFAULT 1
  CHECK (fiscal_year_start_day BETWEEN 1 AND 28);

COMMENT ON COLUMN profiles.fiscal_year_start_month IS 'Month the fiscal year begins (1=Jan, 12=Dec). Default 1 = calendar year.';
COMMENT ON COLUMN profiles.fiscal_year_start_day IS 'Day of month the fiscal year begins. Capped at 28 to avoid month-length issues.';
