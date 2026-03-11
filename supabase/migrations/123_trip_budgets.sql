-- Migration: 123_trip_budgets.sql
-- Add budget tracking and brand association to trips

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS budget_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.user_brands(id) ON DELETE SET NULL;

ALTER TABLE public.trip_routes
  ADD COLUMN IF NOT EXISTS budget_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.user_brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trips_brand ON public.trips(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trip_routes_brand ON public.trip_routes(brand_id) WHERE brand_id IS NOT NULL;
