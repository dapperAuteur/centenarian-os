-- Add clock_format preference to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS clock_format text NOT NULL DEFAULT '12h'
  CHECK (clock_format IN ('12h', '24h'));
