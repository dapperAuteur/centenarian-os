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

  // Fetch trip data
  if (share.trip_id) {
    const { data: trip, error: tripError } = await db
      .from('trips')
      .select('*')
      .eq('id', share.trip_id)
      .maybeSingle();

    if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 });
    if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ trip });
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

    // Fetch legs (individual trips belonging to this route)
    const { data: legs } = await db
      .from('trips')
      .select('*')
      .eq('route_id', share.route_id)
      .order('leg_order', { ascending: true });

    return NextResponse.json({ route, legs: legs || [] });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
