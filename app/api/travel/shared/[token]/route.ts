// app/api/travel/shared/[token]/route.ts
// GET: public endpoint to view a shared trip/route by token

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

type Params = { params: Promise<{ token: string }> };

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params;
  const db = getDb();

  // Look up the share by token
  const { data: share, error } = await db
    .from('trip_shares')
    .select('*')
    .eq('share_token', token)
    .eq('is_active', true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!share) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Check expiry
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const included_sections = share.included_sections ?? null;

  // Helper to format date range
  function fmtDateRange(start: string, end?: string | null) {
    const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    let range = fmt(start);
    if (end && end !== start) range += ` – ${fmt(end)}`;
    return range;
  }

  // Fetch equipment items linked to this trip/route
  async function fetchEquipment(entityType: string, entityId: string) {
    const { data: links } = await db
      .from('activity_links')
      .select('target_id, relationship')
      .eq('source_type', entityType)
      .eq('source_id', entityId)
      .eq('target_type', 'equipment');

    if (!links || links.length === 0) return [];

    const eqIds = links.map((l: { target_id: string }) => l.target_id);
    const { data: eqData } = await db.from('equipment').select('id, name').in('id', eqIds);
    if (!eqData) return [];

    const eqMap = new Map(eqData.map((e: { id: string; name: string }) => [e.id, e.name]));
    return links.map((l: { target_id: string; relationship: string | null }) => ({
      name: eqMap.get(l.target_id) || 'Unknown',
      relationship: l.relationship,
    }));
  }

  // Fetch trip data
  if (share.trip_id) {
    const { data: trip, error: tripError } = await db
      .from('trips')
      .select('*, vehicles(nickname, type)')
      .eq('id', share.trip_id)
      .maybeSingle();

    if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 });
    if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const equipment_items = await fetchEquipment('trip', share.trip_id);

    return NextResponse.json({
      title: trip.origin && trip.destination ? `${trip.origin} → ${trip.destination}` : 'Trip',
      date_range: fmtDateRange(trip.date, trip.end_date),
      trips: [trip],
      packing_notes: trip.packing_notes,
      equipment_items,
      budget: trip.budget_amount,
      total_cost: Number(trip.cost) || 0,
      included_sections,
    });
  }

  // Fetch route data with legs
  if (share.route_id) {
    const { data: route, error: routeError } = await db
      .from('trip_routes')
      .select('*')
      .eq('id', share.route_id)
      .maybeSingle();

    if (routeError) return NextResponse.json({ error: routeError.message }, { status: 500 });
    if (!route) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: legs } = await db
      .from('trips')
      .select('*, vehicles(nickname, type)')
      .eq('route_id', share.route_id)
      .order('leg_order', { ascending: true });

    const trips = legs || [];
    const equipment_items = await fetchEquipment('route', share.route_id);
    const total_cost = route.total_cost ?? trips.reduce((s: number, t: { cost?: number }) => s + (Number(t.cost) || 0), 0);

    return NextResponse.json({
      title: route.name || 'Multi-Stop Trip',
      date_range: fmtDateRange(route.date, route.end_date),
      trips,
      packing_notes: route.packing_notes,
      equipment_items,
      budget: route.budget_amount,
      total_cost,
      included_sections,
    });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
