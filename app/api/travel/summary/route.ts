import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const CAR_CO2_PER_MILE = 0.170; // kg

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const months = Math.min(parseInt(params.get('months') || '6'), 24);

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    .toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const [tripsRes, fuelRes, maintenanceRes, ownedVehiclesRes] = await Promise.all([
    supabase
      .from('trips')
      .select('mode, date, distance_miles, duration_min, calories_burned, co2_kg, purpose, cost, trip_category, vehicle_id')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate),
    supabase
      .from('fuel_logs')
      .select('date, total_cost, gallons, mpg_calculated, mpg_display, miles_since_last_fill, miles_this_month, vehicle_id')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate),
    supabase
      .from('vehicle_maintenance')
      .select('id, date, cost, service_type, vehicle_id, next_service_miles, next_service_date, vehicles(id, nickname, type, active)')
      .eq('user_id', user.id),
    // Owned vehicles only — used to exclude rental/borrowed from cost calculations
    supabase
      .from('vehicles')
      .select('id')
      .eq('user_id', user.id)
      .eq('ownership_type', 'owned'),
  ]);

  const trips = tripsRes.data || [];
  const fuelLogs = fuelRes.data || [];
  const maintenance = maintenanceRes.data || [];
  const ownedVehicleIds = new Set((ownedVehiclesRes.data || []).map((v) => v.id));

  // ── Current month stats ──
  const thisMonthTrips = trips.filter((t) => t.date >= thisMonthStart);
  // Only count fuel from owned vehicles (exclude rentals from personal cost calculations)
  const thisMonthFuel = fuelLogs.filter(
    (f) => f.date >= thisMonthStart &&
      (f.vehicle_id === null || ownedVehicleIds.has(f.vehicle_id))
  );

  const milesByMode: Record<string, number> = {};
  const calsByMode: Record<string, number> = {};
  let totalCo2Emitted = 0;
  let bikeCommuteDays = 0;
  // Only travel-category bike miles count toward savings
  let bikeTravelMilesMonth = 0;
  let carMilesMonth = 0;

  for (const t of thisMonthTrips) {
    const dist = Number(t.distance_miles) || 0;
    milesByMode[t.mode] = (milesByMode[t.mode] || 0) + dist;
    calsByMode[t.mode] = (calsByMode[t.mode] || 0) + (Number(t.calories_burned) || 0);
    totalCo2Emitted += Number(t.co2_kg) || 0;
    if (t.mode === 'bike' && t.purpose === 'commute') bikeCommuteDays++;
    if (t.mode === 'bike' && t.trip_category === 'travel') bikeTravelMilesMonth += dist;
    if (t.mode === 'car') carMilesMonth += dist;
  }

  const fuelSpendMonth = thisMonthFuel.reduce((s, f) => s + (Number(f.total_cost) || 0), 0);
  const fuelGallonsMonth = thisMonthFuel.reduce((s, f) => s + (Number(f.gallons) || 0), 0);
  const avgMpg =
    thisMonthFuel.length > 0
      ? thisMonthFuel.reduce((s, f) => s + (Number(f.mpg_display) || Number(f.mpg_calculated) || 0), 0) /
        thisMonthFuel.filter((f) => f.mpg_display || f.mpg_calculated).length
      : null;

  // CO2 saved by biking (travel trips only) instead of driving
  const co2SavedKg = parseFloat((bikeTravelMilesMonth * CAR_CO2_PER_MILE).toFixed(2));

  // Financial savings: owned car cost per mile × travel bike miles
  const carCostPerMile =
    carMilesMonth > 0 && fuelSpendMonth > 0 ? fuelSpendMonth / carMilesMonth : null;
  const bikeSavingsMonth =
    carCostPerMile !== null
      ? parseFloat((bikeTravelMilesMonth * carCostPerMile).toFixed(2))
      : null;

  // ── Monthly trend (for charts) ──
  const monthlyMap: Record<string, { miles: number; fuel_cost: number; bike_miles: number; car_miles: number; co2_kg: number }> = {};
  for (const t of trips) {
    const month = t.date.substring(0, 7);
    if (!monthlyMap[month]) monthlyMap[month] = { miles: 0, fuel_cost: 0, bike_miles: 0, car_miles: 0, co2_kg: 0 };
    monthlyMap[month].miles += Number(t.distance_miles) || 0;
    monthlyMap[month].co2_kg += Number(t.co2_kg) || 0;
    // Monthly bike trend uses all bike miles (not just travel) for mileage chart accuracy
    if (t.mode === 'bike') monthlyMap[month].bike_miles += Number(t.distance_miles) || 0;
    if (t.mode === 'car') monthlyMap[month].car_miles += Number(t.distance_miles) || 0;
  }
  for (const f of fuelLogs) {
    if (f.vehicle_id !== null && !ownedVehicleIds.has(f.vehicle_id)) continue;
    const month = f.date.substring(0, 7);
    if (!monthlyMap[month]) monthlyMap[month] = { miles: 0, fuel_cost: 0, bike_miles: 0, car_miles: 0, co2_kg: 0 };
    monthlyMap[month].fuel_cost += Number(f.total_cost) || 0;
  }
  const monthlyTrend = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({ month, ...d }));

  // ── MPG trend — owned vehicles only ──
  const mpgTrend = fuelLogs
    .filter((f) => {
      if (!f.mpg_display && !f.mpg_calculated) return false;
      return f.vehicle_id === null || ownedVehicleIds.has(f.vehicle_id);
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((f) => ({
      date: f.date,
      mpg: Number(f.mpg_display) || Number(f.mpg_calculated),
    }));

  // ── Maintenance alerts ──
  const maintenanceAlerts = maintenance
    .filter((m) => {
      const nextMiles = Number(m.next_service_miles);
      return nextMiles > 0;
    })
    .map((m) => ({
      id: m.id,
      service_type: m.service_type,
      vehicle: m.vehicles,
      next_service_miles: m.next_service_miles,
      next_service_date: m.next_service_date,
    }));

  return NextResponse.json({
    currentMonth: {
      milesByMode,
      calsByMode,
      totalCo2EmittedKg: parseFloat(totalCo2Emitted.toFixed(2)),
      co2SavedKgVsCar: co2SavedKg,
      fuelSpend: fuelSpendMonth,
      fuelGallons: fuelGallonsMonth,
      avgMpg: avgMpg ? parseFloat(avgMpg.toFixed(1)) : null,
      bikeCommuteDays,
      bikeMiles: milesByMode['bike'] || 0,
      bikeTravelMiles: bikeTravelMilesMonth,
      carMiles: carMilesMonth,
      bikeSavings: bikeSavingsMonth,
      carCostPerMile: carCostPerMile ? parseFloat(carCostPerMile.toFixed(3)) : null,
    },
    monthlyTrend,
    mpgTrend,
    maintenanceAlerts,
  });
}
