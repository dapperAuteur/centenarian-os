import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const from = params.get('from');
  const to = params.get('to');
  const vehicleId = params.get('vehicle_id');
  const limit = Math.min(parseInt(params.get('limit') || '50'), 200);
  const offset = parseInt(params.get('offset') || '0');

  let query = supabase
    .from('fuel_logs')
    .select('*, vehicles(id, nickname, type)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (vehicleId) query = query.eq('vehicle_id', vehicleId);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data || [], total: count || 0 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    vehicle_id, date, odometer_miles, miles_since_last_fill, miles_this_month,
    mpg_display, gallons, total_cost, cost_per_gallon, fuel_grade,
    station, transaction_id, source, notes,
  } = body;

  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 });

  // Auto-calculate derived fields if possible
  const mpg_calculated =
    miles_since_last_fill && gallons && gallons > 0
      ? parseFloat((miles_since_last_fill / gallons).toFixed(2))
      : null;

  const cpg =
    cost_per_gallon ??
    (total_cost && gallons && gallons > 0
      ? parseFloat((total_cost / gallons).toFixed(3))
      : null);

  const { data, error } = await supabase
    .from('fuel_logs')
    .insert({
      user_id: user.id,
      vehicle_id: vehicle_id || null,
      date,
      odometer_miles,
      miles_since_last_fill,
      miles_this_month,
      mpg_display,
      mpg_calculated,
      gallons,
      total_cost,
      cost_per_gallon: cpg,
      fuel_grade,
      station,
      transaction_id: transaction_id || null,
      source: source || 'manual',
      notes,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Recalculate derived fields if source values changed
  if (updates.miles_since_last_fill !== undefined || updates.gallons !== undefined) {
    const existing = await supabase
      .from('fuel_logs')
      .select('miles_since_last_fill, gallons')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    const miles = updates.miles_since_last_fill ?? existing.data?.miles_since_last_fill;
    const gals = updates.gallons ?? existing.data?.gallons;
    if (miles && gals && gals > 0) {
      updates.mpg_calculated = parseFloat((miles / gals).toFixed(2));
    }
  }

  const { data, error } = await supabase
    .from('fuel_logs')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase
    .from('fuel_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
