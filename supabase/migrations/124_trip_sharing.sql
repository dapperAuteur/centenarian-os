-- Migration: 124_trip_sharing.sql
-- Add visibility and sharing support to trips

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'shared', 'public'));

ALTER TABLE public.trip_routes
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'shared', 'public'));

-- Trip sharing grants (per-user or token-based public links)
CREATE TABLE IF NOT EXISTS public.trip_shares (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id     UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  route_id    UUID REFERENCES public.trip_routes(id) ON DELETE CASCADE,
  shared_with UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE,
  expires_at  TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (trip_id IS NOT NULL OR route_id IS NOT NULL),
  CHECK (shared_with IS NOT NULL OR share_token IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_trip_shares_trip ON public.trip_shares(trip_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_trip_shares_route ON public.trip_shares(route_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_trip_shares_token ON public.trip_shares(share_token) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_trip_shares_shared_with ON public.trip_shares(shared_with) WHERE is_active = true;

ALTER TABLE public.trip_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_shares_owner_all"
  ON public.trip_shares FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "trip_shares_recipient_read"
  ON public.trip_shares FOR SELECT
  USING (shared_with = auth.uid() AND is_active = true);
