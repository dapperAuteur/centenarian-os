-- Add missing fields to trip_templates so all trip data is preserved
ALTER TABLE trip_templates
  ADD COLUMN IF NOT EXISTS is_round_trip BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.user_brands(id) ON DELETE SET NULL;

-- Add vehicle_id to template stops so per-leg vehicle is preserved
ALTER TABLE trip_template_stops
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL;
