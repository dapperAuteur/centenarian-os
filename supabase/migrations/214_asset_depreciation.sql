-- 214_asset_depreciation.sql
-- Depreciation settings for every equipment item and vehicle (plans/61, section 3).
--
-- PURPOSE
--   asset_depreciation   one optional row per equipment item OR per vehicle: how it loses value
--                        (method, expected life in years and/or uses or miles, salvage value,
--                        in-service date), whether it is used for work (and an optional work-share
--                        override), uses or miles logged outside the app, and a replacement cost and
--                        date that can prefill a savings goal. The app computes book value, the
--                        schedule, cost per use and work share from this row; nothing computed is
--                        stored.
--
-- WHY A SIDE TABLE (not new columns on equipment / vehicles)
--   SHARED DB: contractor-os (Work.WitUS) reads and writes public.equipment and public.vehicles
--   (its app/api/equipment/** and app/api/travel/vehicles/** routes). Adding a dozen
--   CentenarianOS-only columns to those tables would widen rows another app owns. A side table keyed
--   by the item keeps both tables exactly as they are.
--
-- WORK USE
--   Uses of an equipment item are its activity_links to planner tasks (synced Google Calendar events
--   become planner tasks, so they count too), workouts, trips and focus sessions. 'equipment' and
--   'task' are already allowed types in activity_links, so this file does NOT touch that shared
--   table or its CHECK constraints. A link whose relationship is 'work' counts as a work use.
--   Vehicles count miles from their trips: purpose 'work' or tax_category 'business' = work miles.
--
-- WHO CAN READ WHAT
--   Row Level Security is on. Owners read and write their own rows (auth.uid() = user_id). The
--   policy is app-agnostic: it does not assume which app wrote the row.
--
-- ADDITIVE ONLY: one new table with its indexes, trigger and policy. Nothing existing is dropped,
-- renamed, narrowed or altered.
--
-- SAFE TO RE-RUN: CREATE ... IF NOT EXISTS; the trigger and policy sit in DO blocks that check first;
-- ENABLE ROW LEVEL SECURITY and COMMENT are repeatable.
--
-- NOT APPLIED AUTOMATICALLY: run by hand in the Supabase SQL editor. Until it is applied the
-- Depreciation sections say "Run migration 214 first" and /api/equipment/depreciation answers 503.

BEGIN;

CREATE TABLE IF NOT EXISTS public.asset_depreciation (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Exactly one of these is set. Deleting the item deletes its depreciation row.
  equipment_id         UUID REFERENCES public.equipment(id) ON DELETE CASCADE,
  vehicle_id           UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,

  -- Cost basis. NULL = use equipment.purchase_price (vehicles have no price column, so a vehicle
  -- needs this filled in).
  cost_basis           NUMERIC(12,2),
  -- NULL = use equipment.purchase_date (or the row's created_at day for a vehicle).
  in_service_date      DATE,

  method               TEXT NOT NULL DEFAULT 'straight_line',
  life_years           NUMERIC(6,2),
  -- Expected uses (equipment) or miles (vehicles) over the item's life. Needed for units_of_use.
  life_units           NUMERIC(12,2),
  salvage_value        NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Declining balance rate = db_factor / life_years (2 = double declining balance).
  db_factor            NUMERIC(4,2) NOT NULL DEFAULT 2,

  used_for_work        BOOLEAN NOT NULL DEFAULT false,
  -- Percent 0-100. NULL = work share is computed from work uses / all uses.
  work_share_override  NUMERIC(5,2),

  -- Uses (or miles) that happened outside the app, added to the linked ones.
  manual_uses          NUMERIC(12,2) NOT NULL DEFAULT 0,
  manual_work_uses     NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- For "Save for replacement" (prefills a savings goal).
  replacement_cost     NUMERIC(12,2),
  replacement_date     DATE,

  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT asset_depreciation_one_item
    CHECK (num_nonnulls(equipment_id, vehicle_id) = 1),
  CONSTRAINT asset_depreciation_method_check
    CHECK (method IN ('straight_line', 'declining_balance', 'units_of_use')),
  CONSTRAINT asset_depreciation_nonnegative
    CHECK (
      (cost_basis IS NULL OR cost_basis >= 0)
      AND salvage_value >= 0
      AND (life_years IS NULL OR life_years > 0)
      AND (life_units IS NULL OR life_units > 0)
      AND db_factor > 0
      AND manual_uses >= 0
      AND manual_work_uses >= 0
      AND (replacement_cost IS NULL OR replacement_cost >= 0)
    ),
  CONSTRAINT asset_depreciation_work_share_range
    CHECK (work_share_override IS NULL OR (work_share_override >= 0 AND work_share_override <= 100))
);

CREATE UNIQUE INDEX IF NOT EXISTS asset_depreciation_equipment_uidx
  ON public.asset_depreciation (equipment_id) WHERE equipment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS asset_depreciation_vehicle_uidx
  ON public.asset_depreciation (vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS asset_depreciation_user_idx
  ON public.asset_depreciation (user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_asset_depreciation_updated_at'
      AND tgrelid = 'public.asset_depreciation'::regclass
  ) THEN
    CREATE TRIGGER update_asset_depreciation_updated_at
      BEFORE UPDATE ON public.asset_depreciation
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.asset_depreciation ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'asset_depreciation'
      AND policyname = 'asset_depreciation_owner'
  ) THEN
    CREATE POLICY "asset_depreciation_owner" ON public.asset_depreciation
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

COMMENT ON TABLE public.asset_depreciation IS
  'Depreciation settings per equipment item or vehicle (migration 214, CentenarianOS). Side table so the shared equipment/vehicles tables stay unchanged. Book value, schedule, cost per use and work share are computed by the app (lib/equipment/depreciation.ts); estimates, not tax advice.';

COMMIT;
