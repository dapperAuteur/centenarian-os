-- File: supabase/migrations/002_nutrition_module.sql
-- Run this in Supabase SQL Editor

-- Ingredients table
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ncv_score TEXT NOT NULL CHECK (ncv_score IN ('Green', 'Yellow', 'Red')),
  calories_per_100g DECIMAL NOT NULL,
  protein_per_100g DECIMAL NOT NULL,
  carbs_per_100g DECIMAL NOT NULL,
  fat_per_100g DECIMAL NOT NULL,
  fiber_per_100g DECIMAL DEFAULT 0,
  cost_per_unit DECIMAL NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'oz', 'lb', 'kg', 'cup', 'tbsp', 'tsp', 'whole')),
  notes TEXT,
  usda_fdc_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Protocols (saved recipes)
CREATE TABLE protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  ncv_score TEXT NOT NULL CHECK (ncv_score IN ('Green', 'Yellow', 'Red')),
  total_cost DECIMAL NOT NULL DEFAULT 0,
  total_calories DECIMAL NOT NULL DEFAULT 0,
  total_protein DECIMAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Protocol ingredients (junction table)
CREATE TABLE protocol_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory tracking
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  low_stock_threshold DECIMAL DEFAULT 0,
  last_restocked TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ingredient_id)
);

-- Meal logs
CREATE TABLE meal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME NOT NULL,
  protocol_id UUID REFERENCES protocols(id) ON DELETE SET NULL,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom meal ingredients (for non-protocol meals)
CREATE TABLE meal_log_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_log_id UUID NOT NULL REFERENCES meal_logs(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ingredients_user ON ingredients(user_id);
CREATE INDEX idx_ingredients_ncv ON ingredients(ncv_score);
CREATE INDEX idx_protocols_user ON protocols(user_id);
CREATE INDEX idx_inventory_user ON inventory(user_id);
CREATE INDEX idx_meal_logs_user_date ON meal_logs(user_id, date);

-- Row Level Security
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocol_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_log_ingredients ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can CRUD their ingredients" ON ingredients
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their protocols" ON protocols
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their protocol ingredients" ON protocol_ingredients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM protocols
      WHERE protocols.id = protocol_ingredients.protocol_id
      AND protocols.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can CRUD their inventory" ON inventory
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their meal logs" ON meal_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their meal log ingredients" ON meal_log_ingredients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM meal_logs
      WHERE meal_logs.id = meal_log_ingredients.meal_log_id
      AND meal_logs.user_id = auth.uid()
    )
  );

-- Triggers
CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON ingredients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_protocols_updated_at BEFORE UPDATE ON protocols
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();