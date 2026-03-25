import { SupabaseClient } from '@supabase/supabase-js';

// Modes that consume fuel from the user's own tank
const FUEL_CONSUMING_MODES = new Set(['car', 'motorcycle']);

interface FifoResult {
  fifoCost: number;
  gallonsConsumed: number;
  isPartial: boolean;
  mpgUsed: number;
  allocations: { fuelLogId: string; gallonsUsed: number; costAllocated: number }[];
}

/**
 * Check whether a trip is eligible for FIFO fuel cost allocation.
 */
export async function isFifoEligible(
  supabase: SupabaseClient,
  userId: string,
  opts: { mode: string; vehicleId: string | null; tripDate: string; tripStatus: string; manualCost: number | null },
): Promise<boolean> {
  if (!opts.vehicleId) return false;
  if (!FUEL_CONSUMING_MODES.has(opts.mode)) return false;
  if (opts.tripStatus !== 'completed') return false;
  if (opts.manualCost && opts.manualCost > 0) return false;

  // Check vehicle is owned
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('ownership_type')
    .eq('id', opts.vehicleId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!vehicle || vehicle.ownership_type !== 'owned') return false;

  // Check FIFO is enabled and trip date >= cutoff
  const { data: settings } = await supabase
    .from('travel_settings')
    .select('fifo_enabled_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!settings?.fifo_enabled_at) return false;

  const cutoff = new Date(settings.fifo_enabled_at).toISOString().slice(0, 10);
  if (opts.tripDate < cutoff) return false;

  return true;
}

/**
 * Get the best available MPG for a vehicle at a given date.
 * Uses the most recent fuel log's mpg_calculated (fallback mpg_display) on or before tripDate.
 */
async function getMpgForVehicle(
  supabase: SupabaseClient,
  userId: string,
  vehicleId: string,
  tripDate: string,
): Promise<number | null> {
  const { data } = await supabase
    .from('fuel_logs')
    .select('mpg_calculated, mpg_display')
    .eq('user_id', userId)
    .eq('vehicle_id', vehicleId)
    .lte('date', tripDate)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const mpg = Number(data.mpg_calculated) || Number(data.mpg_display) || 0;
  return mpg > 0 ? mpg : null;
}

/**
 * Allocate fuel cost to a trip using FIFO from the vehicle's fuel purchase history.
 * Creates fuel_allocations records and decrements gallons_remaining on fuel_logs.
 */
export async function allocateFifoForTrip(
  supabase: SupabaseClient,
  userId: string,
  vehicleId: string,
  effectiveDistanceMiles: number,
  tripId: string,
  tripDate: string,
): Promise<FifoResult | null> {
  const mpg = await getMpgForVehicle(supabase, userId, vehicleId, tripDate);
  if (!mpg) return null;

  let gallonsNeeded = effectiveDistanceMiles / mpg;
  if (gallonsNeeded <= 0) return null;

  // Get available fuel in FIFO order (oldest first)
  const { data: fuelQueue } = await supabase
    .from('fuel_logs')
    .select('id, gallons_remaining, cost_per_gallon')
    .eq('user_id', userId)
    .eq('vehicle_id', vehicleId)
    .not('gallons_remaining', 'is', null)
    .gt('gallons_remaining', 0)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  if (!fuelQueue || fuelQueue.length === 0) return null;

  const allocations: FifoResult['allocations'] = [];
  let totalCost = 0;
  let totalGallons = 0;

  for (const fuel of fuelQueue) {
    if (gallonsNeeded <= 0) break;

    const available = Number(fuel.gallons_remaining);
    const cpg = Number(fuel.cost_per_gallon) || 0;
    const consume = Math.min(gallonsNeeded, available);
    const costPortion = parseFloat((consume * cpg).toFixed(2));

    // Create allocation record
    await supabase.from('fuel_allocations').insert({
      user_id: userId,
      trip_id: tripId,
      fuel_log_id: fuel.id,
      gallons_used: parseFloat(consume.toFixed(3)),
      cost_allocated: costPortion,
    });

    // Decrement gallons_remaining
    const newRemaining = parseFloat((available - consume).toFixed(3));
    await supabase
      .from('fuel_logs')
      .update({ gallons_remaining: newRemaining })
      .eq('id', fuel.id);

    allocations.push({
      fuelLogId: fuel.id,
      gallonsUsed: parseFloat(consume.toFixed(3)),
      costAllocated: costPortion,
    });

    totalCost += costPortion;
    totalGallons += consume;
    gallonsNeeded -= consume;
  }

  return {
    fifoCost: parseFloat(totalCost.toFixed(2)),
    gallonsConsumed: parseFloat(totalGallons.toFixed(3)),
    isPartial: gallonsNeeded > 0.001, // tolerance for floating point
    mpgUsed: mpg,
    allocations,
  };
}

/**
 * Reverse all FIFO allocations for a trip, returning gallons to fuel logs.
 */
export async function deallocateFifoForTrip(
  supabase: SupabaseClient,
  tripId: string,
): Promise<void> {
  // Get all allocations for this trip
  const { data: allocations } = await supabase
    .from('fuel_allocations')
    .select('id, fuel_log_id, gallons_used')
    .eq('trip_id', tripId);

  if (!allocations || allocations.length === 0) return;

  // Return gallons to each fuel log
  for (const alloc of allocations) {
    const { data: fuel } = await supabase
      .from('fuel_logs')
      .select('gallons_remaining')
      .eq('id', alloc.fuel_log_id)
      .maybeSingle();

    if (fuel) {
      const restored = parseFloat(((Number(fuel.gallons_remaining) || 0) + Number(alloc.gallons_used)).toFixed(3));
      await supabase
        .from('fuel_logs')
        .update({ gallons_remaining: restored })
        .eq('id', alloc.fuel_log_id);
    }
  }

  // Delete all allocation records for this trip
  await supabase.from('fuel_allocations').delete().eq('trip_id', tripId);
}

/**
 * Estimate FIFO fuel cost without writing to the database. For UI previews.
 */
export async function estimateFifoCost(
  supabase: SupabaseClient,
  userId: string,
  vehicleId: string,
  effectiveDistanceMiles: number,
  tripDate: string,
): Promise<{ estimatedCost: number; mpgUsed: number; isPartial: boolean } | null> {
  const mpg = await getMpgForVehicle(supabase, userId, vehicleId, tripDate);
  if (!mpg) return null;

  let gallonsNeeded = effectiveDistanceMiles / mpg;
  if (gallonsNeeded <= 0) return null;

  const { data: fuelQueue } = await supabase
    .from('fuel_logs')
    .select('gallons_remaining, cost_per_gallon')
    .eq('user_id', userId)
    .eq('vehicle_id', vehicleId)
    .not('gallons_remaining', 'is', null)
    .gt('gallons_remaining', 0)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  if (!fuelQueue || fuelQueue.length === 0) return null;

  let totalCost = 0;

  for (const fuel of fuelQueue) {
    if (gallonsNeeded <= 0) break;
    const available = Number(fuel.gallons_remaining);
    const cpg = Number(fuel.cost_per_gallon) || 0;
    const consume = Math.min(gallonsNeeded, available);
    totalCost += consume * cpg;
    gallonsNeeded -= consume;
  }

  return {
    estimatedCost: parseFloat(totalCost.toFixed(2)),
    mpgUsed: mpg,
    isPartial: gallonsNeeded > 0.001,
  };
}
