import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

function calcCo2(mode: string, distanceMiles: number | null): number | null {
  if (!distanceMiles || distanceMiles <= 0) return null;
  const factor = CO2_PER_MILE[mode] ?? 0;
  return parseFloat((factor * distanceMiles).toFixed(3));
}

// Modes that support the travel/fitness distinction
const HUMAN_POWERED_MODES = new Set(['bike', 'walk', 'run', 'other']);

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
    purpose, calories_burned, cost, transaction_id,
    garmin_activity_id, health_metric_date, notes, source,
    tax_category, trip_category,
  } = body;

  if (!mode || !date) {
    return NextResponse.json({ error: 'mode and date are required' }, { status: 400 });
  }

  const co2_kg = calcCo2(mode, distance_miles);

  // Default trip_category: human-powered modes default to 'travel' for manual entries;
  // non-human-powered modes are always 'travel'.
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
      transaction_id: transaction_id || null,
      garmin_activity_id: garmin_activity_id || null,
      health_metric_date: health_metric_date || null,
      notes,
      source: source || 'manual',
      tax_category: tax_category || 'personal',
      trip_category: resolvedTripCategory,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trip: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Recalculate CO2 if mode or distance changed
  if (updates.mode !== undefined || updates.distance_miles !== undefined) {
    const existing = await supabase
      .from('trips')
      .select('mode, distance_miles')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    const mode = updates.mode ?? existing.data?.mode;
    const dist = updates.distance_miles ?? existing.data?.distance_miles;
    updates.co2_kg = calcCo2(mode, dist);
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
  return NextResponse.json({ trip: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
