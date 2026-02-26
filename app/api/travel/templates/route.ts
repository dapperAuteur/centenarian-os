// app/api/travel/templates/route.ts
// GET: list trip templates
// POST: create a trip template (or save from existing trip)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data, error } = await db
    .from('trip_templates')
    .select('*, vehicles(nickname, type)')
    .eq('user_id', user.id)
    .order('use_count', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    name, mode, vehicle_id, origin, destination,
    distance_miles, duration_min, purpose, trip_category, tax_category, notes,
    // If logging from template: create_trip = true creates both template usage + new trip
    create_trip, trip_date,
  } = body;

  if (!name?.trim() || !mode) {
    return NextResponse.json({ error: 'name and mode are required' }, { status: 400 });
  }

  const db = getDb();

  // If create_trip, log a trip from this template
  if (create_trip && body.template_id) {
    // Get template
    const { data: tmpl } = await db
      .from('trip_templates')
      .select('*')
      .eq('id', body.template_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tmpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // Increment use_count
    await db
      .from('trip_templates')
      .update({ use_count: (tmpl.use_count ?? 0) + 1 })
      .eq('id', body.template_id);

    const { data: trip, error: tripErr } = await db
      .from('trips')
      .insert({
        user_id: user.id,
        date: trip_date ?? new Date().toISOString().split('T')[0],
        mode: tmpl.mode,
        vehicle_id: tmpl.vehicle_id,
        origin: tmpl.origin,
        destination: tmpl.destination,
        distance_miles: tmpl.distance_miles,
        duration_min: tmpl.duration_min,
        purpose: tmpl.purpose,
        trip_category: tmpl.trip_category,
        tax_category: tmpl.tax_category,
        notes: tmpl.notes,
        source: 'manual',
      })
      .select()
      .single();

    if (tripErr) return NextResponse.json({ error: tripErr.message }, { status: 500 });
    return NextResponse.json({ trip, template_id: tmpl.id }, { status: 201 });
  }

  // Create new template
  const { data, error } = await db
    .from('trip_templates')
    .insert({
      user_id: user.id,
      name: name.trim(),
      mode,
      vehicle_id: vehicle_id ?? null,
      origin: origin ?? null,
      destination: destination ?? null,
      distance_miles: distance_miles ? Number(distance_miles) : null,
      duration_min: duration_min ? Number(duration_min) : null,
      purpose: purpose ?? null,
      trip_category: trip_category ?? null,
      tax_category: tax_category ?? null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
