-- Migration: 052_travel_schema.sql
-- Travel module: vehicles, fuel logs, maintenance, trips

-- ─── VEHICLES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicles (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type      TEXT NOT NULL CHECK (type IN ('car','bike','ebike','motorcycle','scooter')),
  nickname  TEXT NOT NULL,
  make      TEXT,
  model     TEXT,
  year      INT,
  color     TEXT,
  active    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their vehicles" ON public.vehicles
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_user ON public.vehicles(user_id);

-- ─── FUEL LOGS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fuel_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id            UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  date                  DATE NOT NULL,
  odometer_miles        NUMERIC(10,1),
  miles_since_last_fill NUMERIC(8,1),   -- Trip A: resets each fill-up
  miles_this_month      NUMERIC(8,1),   -- Trip B: resets each calendar month
  mpg_display           NUMERIC(6,2),   -- car computer reading
  mpg_calculated        NUMERIC(6,2),   -- miles_since_last_fill / gallons
  gallons               NUMERIC(8,3),
  total_cost            NUMERIC(10,2),
  cost_per_gallon       NUMERIC(6,3),
  fuel_grade            TEXT CHECK (fuel_grade IN ('regular','midgrade','premium','diesel','e85')),
  station               TEXT,
  transaction_id        UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  source                TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','image_ocr','import')),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their fuel logs" ON public.fuel_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fuel_logs_user ON public.fuel_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_date ON public.fuel_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle ON public.fuel_logs(vehicle_id);

-- ─── VEHICLE MAINTENANCE ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicle_maintenance (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id          UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  service_type        TEXT NOT NULL CHECK (service_type IN (
                        'oil_change','tire_rotation','brake_pads','inspection',
                        'battery','transmission','tires','chain','tune_up','other')),
  date                DATE NOT NULL,
  odometer_at_service NUMERIC(10,1),
  cost                NUMERIC(10,2),
  vendor              TEXT,
  notes               TEXT,
  transaction_id      UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  next_service_miles  NUMERIC(10,1),
  next_service_date   DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vehicle_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their vehicle maintenance" ON public.vehicle_maintenance
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_user ON public.vehicle_maintenance(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_vehicle ON public.vehicle_maintenance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_date ON public.vehicle_maintenance(user_id, date DESC);

-- ─── TRIPS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trips (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode               TEXT NOT NULL CHECK (mode IN (
                       'bike','car','bus','train','plane','walk','run',
                       'ferry','rideshare','other')),
  vehicle_id         UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  date               DATE NOT NULL,
  departed_at        TIMESTAMPTZ,
  arrived_at         TIMESTAMPTZ,
  origin             TEXT,
  destination        TEXT,
  distance_miles     NUMERIC(8,2),
  duration_min       INT,
  purpose            TEXT CHECK (purpose IN ('commute','leisure','work','errand','exercise','other')),
  calories_burned    INT,
  co2_kg             NUMERIC(8,3),  -- auto-calculated: mode × distance × emission factor
  cost               NUMERIC(10,2),
  transaction_id     UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  garmin_activity_id TEXT,          -- Date+Title dedup key for Garmin import
  health_metric_date DATE,          -- linked user_health_metrics row date
  notes              TEXT,
  source             TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','garmin_import','csv_import')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their trips" ON public.trips
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_trips_user ON public.trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_date ON public.trips(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_trips_mode ON public.trips(user_id, mode);
CREATE INDEX IF NOT EXISTS idx_trips_garmin_id ON public.trips(user_id, garmin_activity_id)
  WHERE garmin_activity_id IS NOT NULL;

-- ─── TRAVEL SETTINGS ──────────────────────────────────────────────────────────
-- Stores per-user commute defaults for quick-log feature
CREATE TABLE IF NOT EXISTS public.travel_settings (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  commute_distance_miles NUMERIC(6,2),  -- one-way distance home→work
  commute_duration_min   INT,           -- typical one-way duration
  default_vehicle_id     UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.travel_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their travel settings" ON public.travel_settings
  FOR ALL USING (auth.uid() = user_id);
