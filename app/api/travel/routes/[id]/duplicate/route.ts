// app/api/travel/routes/[id]/duplicate/route.ts
// POST: duplicate a route and all its legs (reset date to today, no linked transactions)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: original } = await db
    .from('trip_routes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: originalLegs } = await db
    .from('trips')
    .select('*')
    .eq('route_id', id)
    .order('leg_order', { ascending: true });

  const today = new Date().toISOString().split('T')[0];

  // Create new route
  const { data: newRoute, error: routeErr } = await db
    .from('trip_routes')
    .insert({
      user_id: user.id,
      name: original.name ? `${original.name} (copy)` : 'Route (copy)',
      date: today,
      is_round_trip: original.is_round_trip,
      notes: original.notes,
      total_distance: original.total_distance,
      total_duration: original.total_duration,
      total_cost: original.total_cost,
      total_co2_kg: original.total_co2_kg,
    })
    .select()
    .single();

  if (routeErr) return NextResponse.json({ error: routeErr.message }, { status: 500 });

  // Duplicate all legs
  const newLegs = [];
  for (const leg of originalLegs ?? []) {
    const { data: newLeg, error: legErr } = await db
      .from('trips')
      .insert({
        user_id: user.id,
        mode: leg.mode,
        date: today,
        origin: leg.origin,
        destination: leg.destination,
        distance_miles: leg.distance_miles,
        duration_min: leg.duration_min,
        calories_burned: leg.calories_burned,
        cost: leg.cost,
        co2_kg: leg.co2_kg,
        purpose: leg.purpose,
        vehicle_id: leg.vehicle_id,
        tax_category: leg.tax_category,
        trip_category: leg.trip_category,
        notes: leg.notes,
        source: 'manual',
        route_id: newRoute.id,
        leg_order: leg.leg_order,
      })
      .select()
      .single();

    if (legErr) return NextResponse.json({ error: legErr.message }, { status: 500 });
    newLegs.push(newLeg);
  }

  return NextResponse.json({ route: newRoute, legs: newLegs }, { status: 201 });
}
