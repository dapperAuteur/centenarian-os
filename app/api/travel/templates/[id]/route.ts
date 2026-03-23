// app/api/travel/templates/[id]/route.ts
// GET: fetch single template  |  PATCH: update template  |  DELETE: remove template

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data, error } = await db
    .from('trip_templates')
    .select('*, vehicles(nickname, type)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Fetch stops for multi-stop templates
  if (data.is_multi_stop) {
    const { data: stops } = await db
      .from('trip_template_stops')
      .select('*')
      .eq('template_id', id)
      .order('stop_order', { ascending: true });
    data.stops = stops || [];
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const allowed = [
    'name', 'mode', 'vehicle_id', 'origin', 'destination',
    'distance_miles', 'duration_min', 'cost', 'purpose',
    'trip_category', 'tax_category', 'notes',
    'is_round_trip', 'brand_id',
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const db = getDb();

  // Update template fields
  if (Object.keys(updates).length > 0) {
    const { error } = await db
      .from('trip_templates')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Replace stops if provided (for multi-stop templates)
  if (Array.isArray(body.stops)) {
    // Delete existing stops
    await db.from('trip_template_stops').delete().eq('template_id', id);

    // Insert new stops
    if (body.stops.length > 0) {
      const stopRows = body.stops.map((s: Record<string, unknown>, i: number) => ({
        template_id: id,
        stop_order: i,
        location_name: (s.location_name as string)?.trim() || null,
        contact_id: s.contact_id || null,
        location_id: s.location_id || null,
        mode: s.mode || null,
        vehicle_id: s.vehicle_id || null,
        distance_miles: s.distance_miles ? Number(s.distance_miles) : null,
        duration_min: s.duration_min ? Number(s.duration_min) : null,
        cost: s.cost ? Number(s.cost) : null,
        purpose: s.purpose || null,
        notes: (s.notes as string)?.trim() || null,
      }));
      await db.from('trip_template_stops').insert(stopRows);
    }
  }

  // Return updated template with stops
  const { data, error: fetchErr } = await db
    .from('trip_templates')
    .select('*, vehicles(nickname, type)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  if (data?.is_multi_stop) {
    const { data: stops } = await db
      .from('trip_template_stops')
      .select('*')
      .eq('template_id', id)
      .order('stop_order', { ascending: true });
    data.stops = stops || [];
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { error } = await db
    .from('trip_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
