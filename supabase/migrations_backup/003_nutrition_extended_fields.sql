-- File: supabase/migrations/003_nutrition_extended_fields.sql
-- Run this AFTER 002_nutrition_module.sql

-- Add vendor fields to ingredients
ALTER TABLE ingredients
ADD COLUMN brand TEXT,
ADD COLUMN store_name TEXT,
ADD COLUMN store_website TEXT,
ADD COLUMN vendor_notes TEXT;

-- Add meal prep fields to protocols
ALTER TABLE protocols
ADD COLUMN prep_time_minutes INT,
ADD COLUMN cook_time_minutes INT,
ADD COLUMN servings DECIMAL,
ADD COLUMN date_made DATE,
ADD COLUMN date_finished DATE;

-- Add restaurant fields to meal_logs
ALTER TABLE meal_logs
ADD COLUMN restaurant_name TEXT,
ADD COLUMN restaurant_address TEXT,
ADD COLUMN restaurant_city TEXT,
ADD COLUMN restaurant_state TEXT,
ADD COLUMN restaurant_country TEXT,
ADD COLUMN restaurant_website TEXT,
ADD COLUMN is_restaurant_meal BOOLEAN DEFAULT FALSE;

-- Create meal prep batches table (for tracking large prep sessions)
CREATE TABLE meal_prep_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  protocol_id UUID NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  date_made DATE NOT NULL,
  date_finished DATE,
  servings_made DECIMAL NOT NULL,
  servings_remaining DECIMAL NOT NULL,
  storage_location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meal_prep_batches_user ON meal_prep_batches(user_id);
CREATE INDEX idx_meal_prep_batches_date ON meal_prep_batches(date_made);

ALTER TABLE meal_prep_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their meal prep batches" ON meal_prep_batches
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER update_meal_prep_batches_updated_at BEFORE UPDATE ON meal_prep_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();