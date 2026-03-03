-- Migration 084: Dashboard Home Preference
-- Allows users to choose which dashboard page they land on after login or
-- when clicking "Go to Dashboard" from the landing/pricing page.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dashboard_home TEXT DEFAULT '/dashboard/blog';
