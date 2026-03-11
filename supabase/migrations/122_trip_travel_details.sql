-- Migration: 122_trip_travel_details.sql
-- Add travel booking detail columns to trips for business travel tracking

-- Booking/confirmation details
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS confirmation_number TEXT,
  ADD COLUMN IF NOT EXISTS booking_reference TEXT,
  ADD COLUMN IF NOT EXISTS carrier_name TEXT;

-- Hotel / accommodation details
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS check_in_date DATE,
  ADD COLUMN IF NOT EXISTS check_out_date DATE,
  ADD COLUMN IF NOT EXISTS accommodation_name TEXT,
  ADD COLUMN IF NOT EXISTS accommodation_address TEXT,
  ADD COLUMN IF NOT EXISTS room_type TEXT;

-- Pickup / return details (car rentals, hotels, etc.)
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS return_address TEXT,
  ADD COLUMN IF NOT EXISTS pickup_time TIME,
  ADD COLUMN IF NOT EXISTS return_time TIME;

-- Flight-specific details
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS seat_assignment TEXT,
  ADD COLUMN IF NOT EXISTS terminal TEXT,
  ADD COLUMN IF NOT EXISTS gate TEXT;

-- Booking URL for quick reference
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS booking_url TEXT;

-- Loyalty / rewards tracking
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS loyalty_program TEXT,
  ADD COLUMN IF NOT EXISTS loyalty_number TEXT;
