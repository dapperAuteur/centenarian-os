// app/api/travel/shares/route.ts
// GET: list shares for a trip or route
// POST: create a share (by email or public link)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

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

  const params = request.nextUrl.searchParams;
  const tripId = params.get('trip_id');
  const routeId = params.get('route_id');

  let query = supabase
    .from('trip_shares')
    .select('*')
    .eq('user_id', user.id);

  if (tripId) query = query.eq('trip_id', tripId);
  if (routeId) query = query.eq('route_id', routeId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ shares: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  // Accept both direct trip_id/route_id and entity_type/entity_id formats
  const trip_id = body.trip_id || (body.entity_type === 'trip' ? body.entity_id : null);
  const route_id = body.route_id || (body.entity_type === 'route' ? body.entity_id : null);
  const email = body.email || body.shared_with_email || null;
  const expires_at = body.expires_at || null;
  const included_sections = body.included_sections || null;

  if (!trip_id && !route_id) {
    return NextResponse.json({ error: 'trip_id or route_id is required' }, { status: 400 });
  }

  let shared_with: string | null = null;
  let share_token: string | null = null;

  if (email) {
    // Look up the user by email in profiles table
    const db = getDb();
    const { data: profile } = await db
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (profile) {
      shared_with = profile.id;
    } else {
      // Email not found — generate a public share token
      share_token = randomBytes(32).toString('hex');
    }
  } else {
    // No email — generate a public link token
    share_token = randomBytes(32).toString('hex');
  }

  const { data: share, error } = await supabase
    .from('trip_shares')
    .insert({
      user_id: user.id,
      trip_id: trip_id || null,
      route_id: route_id || null,
      shared_with,
      share_token,
      expires_at: expires_at || null,
      included_sections,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update visibility to 'shared' if currently 'private'
  if (trip_id) {
    await supabase
      .from('trips')
      .update({ visibility: 'shared' })
      .eq('id', trip_id)
      .eq('user_id', user.id)
      .eq('visibility', 'private');
  }

  if (route_id) {
    await supabase
      .from('trip_routes')
      .update({ visibility: 'shared' })
      .eq('id', route_id)
      .eq('user_id', user.id)
      .eq('visibility', 'private');
  }

  return NextResponse.json({ share }, { status: 201 });
}
