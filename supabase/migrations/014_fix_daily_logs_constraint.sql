-- supabase/migrations/014_fix_daily_logs_constraint.sql

-- Migration: Fix daily_logs unique constraint to support multiple users
-- Issue: Current constraint is only on 'date', should be on (user_id, date)

-- Drop the old single-column unique constraint on date
ALTER TABLE daily_logs DROP CONSTRAINT IF EXISTS daily_logs_date_key;

-- Add the correct composite unique constraint
ALTER TABLE daily_logs ADD CONSTRAINT daily_logs_user_date_unique UNIQUE (user_id, date);

-- Verify the constraint was added
-- Run this to confirm: 
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'daily_logs'::regclass;