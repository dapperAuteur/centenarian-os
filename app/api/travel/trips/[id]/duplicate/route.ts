// app/api/travel/trips/[id]/duplicate/route.ts
// POST: duplicate a trip (copy fields, reset date to today, no linked transaction)

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
  const { data: original, error: fetchErr } = await db
    .from('trips')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: newTrip, error: insertErr } = await db
    .from('trips')
    .insert({
      user_id: user.id,
      mode: original.mode,
      vehicle_id: original.vehicle_id,
      date: new Date().toISOString().split('T')[0],
      origin: original.origin,
      destination: original.destination,
      distance_miles: original.distance_miles,
      duration_min: original.duration_min,
      purpose: original.purpose,
      calories_burned: original.calories_burned,
      co2_kg: original.co2_kg,
      cost: original.cost,
      notes: original.notes,
      source: 'manual',
      tax_category: original.tax_category,
      trip_category: original.trip_category,
      is_round_trip: original.is_round_trip,
    })
    .select('id')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ id: newTrip.id });
}
