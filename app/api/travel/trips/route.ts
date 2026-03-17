import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createLinkedTransaction,
  updateLinkedTransaction,
  deleteLinkedTransaction,
} from '@/lib/finance/linked-transaction';
import { getRoute } from '@/lib/geo/route';

// CO2 emission factors in kg per mile
const CO2_PER_MILE: Record<string, number> = {
  plane: 0.255,
  car: 0.170,
  rideshare: 0.170,
  bus: 0.089,
  train: 0.041,
  ferry: 0.120,
  bike: 0,
  walk: 0,
  run: 0,
  other: 0,
};

function calcCo2(mode: string, distanceMiles: number | null, isRoundTrip = false): number | null {
  if (!distanceMiles || distanceMiles <= 0) return null;
  const factor = CO2_PER_MILE[mode] ?? 0;
  const effectiveDist = isRoundTrip ? distanceMiles * 2 : distanceMiles;
  return parseFloat((factor * effectiveDist).toFixed(3));
}

// Modes that support the travel/fitness distinction
const HUMAN_POWERED_MODES = new Set(['bike', 'walk', 'run', 'other']);

function tripDescription(mode: string, origin?: string | null, destination?: string | null, isRoundTrip = false): string {
  const route = origin && destination ? ` – ${origin} to ${destination}` : '';
  const prefix = isRoundTrip ? 'Round trip' : 'Trip';
  return `${prefix}: ${mode}${route}`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const from = params.get('from');
  const to = params.get('to');
  const mode = params.get('mode');
  const purpose = params.get('purpose');
  const tax_category = params.get('tax_category');
  const trip_category = params.get('trip_category');
  const trip_status = params.get('trip_status');
  const search = params.get('search');
  const limit = Math.min(parseInt(params.get('limit') || '50'), 500);
  const offset = parseInt(params.get('offset') || '0');

  const jobId = params.get('job_id');

  // Build a helper to apply all shared filters to any query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(q: any) {
    if (from) q = q.gte('date', from);
    if (to) q = q.lte('date', to);
    if (mode) q = q.eq('mode', mode);
    if (purpose) q = q.eq('purpose', purpose);
    if (tax_category) q = q.eq('tax_category', tax_category);
    if (trip_category) q = q.eq('trip_category', trip_category);
    if (trip_status) q = q.eq('trip_status', trip_status);
    if (jobId) q = q.eq('job_id', jobId);
    if (search) {
      const term = `%${search}%`;
      q = q.or(`origin.ilike.${term},destination.ilike.${term},notes.ilike.${term},purpose.ilike.${term}`);
    }
    return q;
  }

  // Data query: join vehicles for display, paginated, no count (avoids join+count issues)
  const dataQuery = applyFilters(
    supabase
      .from('trips')
      .select('*, vehicles(id, nickname, type)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1)
  );

  // Count query: HEAD request (no data returned), no join — most reliable way to get total
  const countQuery = applyFilters(
    supabase
      .from('trips')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
  );

  const [{ data, error }, { count }] = await Promise.all([dataQuery, countQuery]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trips: data || [], total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    mode, vehicle_id, date, departed_at, arrived_at,
    origin, destination, distance_miles, duration_min,
    purpose, calories_burned, cost,
    garmin_activity_id, health_metric_date, notes, source,
    tax_category, trip_category, finance_category_id,
    is_round_trip, job_id,
    origin_lat, origin_lng, dest_lat, dest_lng,
    trip_status, end_date, packing_notes,
    // Booking details
    confirmation_number, booking_reference, carrier_name,
    check_in_date, check_out_date,
    pickup_address, return_address, pickup_time, return_time,
    seat_assignment, terminal, gate, booking_url,
    accommodation_name, accommodation_address, room_type,
    loyalty_program, loyalty_number,
    // Budget & sharing
    budget_amount, brand_id, visibility,
  } = body;

  if (!mode || !date) {
    return NextResponse.json({ error: 'mode and date are required' }, { status: 400 });
  }

  // Auto-calculate distance via OSRM if coordinates provided and no manual distance
  let resolvedDistance = distance_miles;
  let resolvedDuration = duration_min;
  let distanceSource: string = 'manual';
  let routeGeometry: string | null = null;

  const hasCoords = typeof origin_lat === 'number' && typeof origin_lng === 'number'
    && typeof dest_lat === 'number' && typeof dest_lng === 'number';

  if (hasCoords && !distance_miles) {
    const routeResult = await getRoute(
      { lat: origin_lat, lng: origin_lng },
      { lat: dest_lat, lng: dest_lng },
    );
    resolvedDistance = routeResult.distance_miles;
    resolvedDuration = resolvedDuration ?? routeResult.duration_min;
    distanceSource = routeResult.source;
    routeGeometry = routeResult.geometry;
  }

  const roundTrip = is_round_trip === true;
  const co2_kg = calcCo2(mode, resolvedDistance, roundTrip);

  const resolvedTripCategory = HUMAN_POWERED_MODES.has(mode)
    ? (trip_category || 'travel')
    : 'travel';

  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: user.id,
      mode,
      vehicle_id: vehicle_id || null,
      date,
      departed_at: departed_at || null,
      arrived_at: arrived_at || null,
      origin,
      destination,
      distance_miles: resolvedDistance,
      duration_min: resolvedDuration,
      distance_source: distanceSource,
      route_geometry: routeGeometry,
      purpose,
      calories_burned,
      co2_kg,
      cost,
      transaction_id: null,
      garmin_activity_id: garmin_activity_id || null,
      health_metric_date: health_metric_date || null,
      notes,
      source: source || 'manual',
      tax_category: tax_category || 'personal',
      trip_category: resolvedTripCategory,
      is_round_trip: roundTrip,
      job_id: job_id || null,
      trip_status: trip_status || 'completed',
      end_date: end_date || null,
      packing_notes: packing_notes || null,
      // Booking details
      confirmation_number: confirmation_number || null,
      booking_reference: booking_reference || null,
      carrier_name: carrier_name || null,
      check_in_date: check_in_date || null,
      check_out_date: check_out_date || null,
      pickup_address: pickup_address || null,
      return_address: return_address || null,
      pickup_time: pickup_time || null,
      return_time: return_time || null,
      seat_assignment: seat_assignment || null,
      terminal: terminal || null,
      gate: gate || null,
      booking_url: booking_url || null,
      accommodation_name: accommodation_name || null,
      accommodation_address: accommodation_address || null,
      room_type: room_type || null,
      loyalty_program: loyalty_program || null,
      loyalty_number: loyalty_number || null,
      // Budget & sharing
      budget_amount: budget_amount ? parseFloat(budget_amount) : null,
      brand_id: brand_id || null,
      visibility: visibility || 'private',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-create linked finance transaction if cost is provided (skip for planned trips)
  const resolvedStatus = trip_status || 'completed';
  if (cost && cost > 0 && resolvedStatus === 'completed') {
    try {
      const arrow = roundTrip ? '↔' : '→';
      const txId = await createLinkedTransaction(supabase, {
        userId: user.id,
        amount: cost,
        vendor: origin && destination ? `${origin} ${arrow} ${destination}` : null,
        date,
        source_module: 'trip',
        source_module_id: data.id,
        description: tripDescription(mode, origin, destination, roundTrip),
        category_id: finance_category_id ?? null,
      });
      await supabase.from('trips').update({ transaction_id: txId }).eq('id', data.id);
      data.transaction_id = txId;
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({ trip: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, origin_lat, origin_lng, dest_lat, dest_lng, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Auto-calculate distance via OSRM if coordinates provided and no manual distance override
  const hasCoords = typeof origin_lat === 'number' && typeof origin_lng === 'number'
    && typeof dest_lat === 'number' && typeof dest_lng === 'number';
  if (hasCoords && updates.distance_miles === undefined) {
    const routeResult = await getRoute(
      { lat: origin_lat, lng: origin_lng },
      { lat: dest_lat, lng: dest_lng },
    );
    updates.distance_miles = routeResult.distance_miles;
    if (updates.duration_min === undefined) updates.duration_min = routeResult.duration_min;
    updates.distance_source = routeResult.source;
    updates.route_geometry = routeResult.geometry;
  }

  // Fetch existing record for CO2 recalc and transaction sync
  const { data: existing } = await supabase
    .from('trips')
    .select('mode, distance_miles, cost, origin, destination, date, transaction_id, is_round_trip, trip_status')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Recalculate CO2 if mode, distance, or round-trip changed
  const roundTripChanged = updates.is_round_trip !== undefined;
  if (updates.mode !== undefined || updates.distance_miles !== undefined || roundTripChanged) {
    const mode = updates.mode ?? existing.mode;
    const dist = updates.distance_miles ?? existing.distance_miles;
    const rt = updates.is_round_trip ?? existing.is_round_trip;
    updates.co2_kg = calcCo2(mode, dist, rt);
  }

  // If mode changes to a non-human-powered mode, force trip_category to 'travel'
  if (updates.mode !== undefined && !HUMAN_POWERED_MODES.has(updates.mode)) {
    updates.trip_category = 'travel';
  }

  const { data, error } = await supabase
    .from('trips')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // When a planned trip is marked completed, create the finance transaction
  const statusChanged = updates.trip_status !== undefined;
  const justCompleted = statusChanged && updates.trip_status === 'completed' && existing.trip_status !== 'completed';

  // Sync linked finance transaction if cost-related fields changed
  const costChanged = updates.cost !== undefined;
  const originChanged = updates.origin !== undefined;
  const destinationChanged = updates.destination !== undefined;
  const dateChanged = updates.date !== undefined;
  const modeChanged = updates.mode !== undefined;

  if (costChanged || originChanged || destinationChanged || dateChanged || modeChanged || roundTripChanged || justCompleted) {
    const newCost = updates.cost ?? existing.cost;
    const newOrigin = updates.origin ?? existing.origin;
    const newDest = updates.destination ?? existing.destination;
    const newDate = updates.date ?? existing.date;
    const newMode = updates.mode ?? existing.mode;
    const newRt = updates.is_round_trip ?? existing.is_round_trip;
    const arrow = newRt ? '↔' : '→';
    const newVendor = newOrigin && newDest ? `${newOrigin} ${arrow} ${newDest}` : null;

    if (existing.transaction_id) {
      if (!newCost || newCost <= 0) {
        try {
          await deleteLinkedTransaction(supabase, existing.transaction_id);
          await supabase.from('trips').update({ transaction_id: null }).eq('id', id);
        } catch { /* non-fatal */ }
      } else {
        try {
          await updateLinkedTransaction(supabase, existing.transaction_id, {
            amount: newCost,
            vendor: newVendor,
            date: newDate,
            description: tripDescription(newMode, newOrigin, newDest, newRt),
          });
        } catch { /* non-fatal */ }
      }
    } else if (newCost && newCost > 0) {
      try {
        const txId = await createLinkedTransaction(supabase, {
          userId: user.id,
          amount: newCost,
          vendor: newVendor,
          date: newDate,
          source_module: 'trip',
          source_module_id: id,
          description: tripDescription(newMode, newOrigin, newDest, newRt),
        });
        await supabase.from('trips').update({ transaction_id: txId }).eq('id', id);
        data.transaction_id = txId;
      } catch { /* non-fatal */ }
    }
  }

  return NextResponse.json({ trip: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Check for linked finance transaction before deleting
  const { data: existing } = await supabase
    .from('trips')
    .select('transaction_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    hasLinkedTransaction: !!existing.transaction_id,
    transactionId: existing.transaction_id ?? null,
  });
}
