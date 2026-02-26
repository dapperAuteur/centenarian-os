// app/api/travel/components/route.ts
// GET: list active component wear records (tires, shoes, chains, etc.)
// POST: create a new component wear record

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const vehicleId = request.nextUrl.searchParams.get('vehicle_id');
  const includeRetired = request.nextUrl.searchParams.get('include_retired') === 'true';

  let query = db
    .from('component_wear')
    .select('*, vehicles(nickname, type)')
    .eq('user_id', user.id)
    .order('installed_date', { ascending: false });

  if (vehicleId) query = query.eq('vehicle_id', vehicleId);
  if (!includeRetired) query = query.is('retired_date', null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Calculate current miles for each component using latest vehicle odometer
  const components = (data ?? []).map((comp) => {
    const currentMiles = comp.retired_miles
      ? Number(comp.retired_miles) - Number(comp.installed_miles)
      : null; // Will be enriched client-side with current odometer
    const expectedLife = comp.expected_life_miles ? Number(comp.expected_life_miles) : null;
    const wearPct = currentMiles && expectedLife ? Math.round((currentMiles / expectedLife) * 100) : null;

    return { ...comp, current_miles: currentMiles, wear_pct: wearPct };
  });

  return NextResponse.json(components);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    vehicle_id, component_type, brand, model,
    installed_date, installed_miles = 0, expected_life_miles, notes,
  } = body;

  if (!vehicle_id || !component_type) {
    return NextResponse.json({ error: 'vehicle_id and component_type are required' }, { status: 400 });
  }

  const db = getDb();

  // Verify vehicle ownership
  const { data: vehicle } = await db
    .from('vehicles')
    .select('id')
    .eq('id', vehicle_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });

  const { data, error } = await db
    .from('component_wear')
    .insert({
      user_id: user.id,
      vehicle_id,
      component_type,
      brand: brand ?? null,
      model: model ?? null,
      installed_date: installed_date ?? new Date().toISOString().split('T')[0],
      installed_miles: Number(installed_miles),
      expected_life_miles: expected_life_miles ? Number(expected_life_miles) : null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
