-- 160_trip_share_sections.sql
-- Add included_sections JSONB to trip_shares so sharers can control what recipients see.
-- NULL = show all sections (backwards compatible with existing shares).

ALTER TABLE public.trip_shares
  ADD COLUMN IF NOT EXISTS included_sections JSONB DEFAULT NULL;
