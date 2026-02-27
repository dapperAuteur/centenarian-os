import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createLinkedTransaction,
  updateLinkedTransaction,
  deleteLinkedTransaction,
} from '@/lib/finance/linked-transaction';

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
  const limit = Math.min(parseInt(params.get('limit') || '50'), 500);
  const offset = parseInt(params.get('offset') || '0');

  let query = supabase
    .from('trips')
    .select('*, vehicles(id, nickname, type)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (mode) query = query.eq('mode', mode);
  if (purpose) query = query.eq('purpose', purpose);
  if (tax_category) query = query.eq('tax_category', tax_category);
  if (trip_category) query = query.eq('trip_category', trip_category);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trips: data || [], total: count || 0 });
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
    is_round_trip,
  } = body;

  if (!mode || !date) {
    return NextResponse.json({ error: 'mode and date are required' }, { status: 400 });
  }

  const roundTrip = is_round_trip === true;
  const co2_kg = calcCo2(mode, distance_miles, roundTrip);

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
      distance_miles,
      duration_min,
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
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-create linked finance transaction if cost is provided
  if (cost && cost > 0) {
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
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Fetch existing record for CO2 recalc and transaction sync
  const { data: existing } = await supabase
    .from('trips')
    .select('mode, distance_miles, cost, origin, destination, date, transaction_id, is_round_trip')
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

  // Sync linked finance transaction if cost-related fields changed
  const costChanged = updates.cost !== undefined;
  const originChanged = updates.origin !== undefined;
  const destinationChanged = updates.destination !== undefined;
  const dateChanged = updates.date !== undefined;
  const modeChanged = updates.mode !== undefined;

  if (costChanged || originChanged || destinationChanged || dateChanged || modeChanged || roundTripChanged) {
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
