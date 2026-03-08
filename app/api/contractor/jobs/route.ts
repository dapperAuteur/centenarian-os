// app/api/contractor/jobs/route.ts
// GET: list jobs with filters (status, client, date range, brand)
// POST: create a new contractor job

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { estimateDrivingDistance, milesToKm } from '@/lib/geo/distance';
import { geocodeAddress } from '@/lib/geo/geocode';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Auto-calculate distance from home to venue. Non-blocking — returns null on failure. */
async function calcDistance(
  db: ReturnType<typeof getDb>,
  userId: string,
  locationId: string | null,
  locationName: string | null,
): Promise<{ miles: number; km: number } | null> {
  try {
    const { data: settings } = await db
      .from('travel_settings')
      .select('home_lat, home_lng')
      .eq('user_id', userId)
      .maybeSingle();
    if (!settings?.home_lat || !settings?.home_lng) return null;

    let destLat: number | null = null;
    let destLng: number | null = null;

    if (locationId) {
      const { data: loc } = await db
        .from('contact_locations')
        .select('lat, lng')
        .eq('id', locationId)
        .maybeSingle();
      if (loc?.lat && loc?.lng) {
        destLat = loc.lat;
        destLng = loc.lng;
      }
    }

    if (destLat === null && locationName) {
      const geo = await geocodeAddress(locationName);
      if (geo) {
        destLat = geo.lat;
        destLng = geo.lng;
        if (locationId) {
          await db.from('contact_locations').update({ lat: geo.lat, lng: geo.lng }).eq('id', locationId);
        }
      }
    }

    if (destLat === null || destLng === null) return null;
    const miles = estimateDrivingDistance(settings.home_lat, settings.home_lng, destLat, destLng, 'mi');
    return { miles, km: milesToKm(miles) };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = request.nextUrl;
  const status = url.searchParams.get('status');
  const clientId = url.searchParams.get('client_id');
  const brandId = url.searchParams.get('brand_id');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
  const offset = Number(url.searchParams.get('offset') ?? 0);

  const db = getDb();
  let query = db
    .from('contractor_jobs')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('start_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (clientId) query = query.eq('client_id', clientId);
  if (brandId) query = query.eq('brand_id', brandId);
  if (from) query = query.gte('start_date', from);
  if (to) query = query.lte('start_date', to);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ jobs: data ?? [], count });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    job_number, client_id, client_name, event_name,
    location_id, location_name,
    poc_contact_id, poc_name, poc_phone,
    crew_coordinator_id, crew_coordinator_name, crew_coordinator_phone,
    status: jobStatus, start_date, end_date,
    is_multi_day, scheduled_dates,
    pay_rate, ot_rate, dt_rate, rate_type,
    distance_from_home_miles, benefits_eligible, travel_benefits,
    union_local, department, brand_id, est_pay_date,
    notes, metadata,
  } = body;

  if (!job_number?.trim() || !client_name?.trim()) {
    return NextResponse.json(
      { error: 'job_number and client_name are required' },
      { status: 400 },
    );
  }

  const db = getDb();
  const { data, error } = await db
    .from('contractor_jobs')
    .insert({
      user_id: user.id,
      job_number: job_number.trim(),
      client_id: client_id ?? null,
      client_name: client_name.trim(),
      event_name: event_name ?? null,
      location_id: location_id ?? null,
      location_name: location_name ?? null,
      poc_contact_id: poc_contact_id ?? null,
      poc_name: poc_name ?? null,
      poc_phone: poc_phone ?? null,
      crew_coordinator_id: crew_coordinator_id ?? null,
      crew_coordinator_name: crew_coordinator_name ?? null,
      crew_coordinator_phone: crew_coordinator_phone ?? null,
      status: jobStatus ?? 'assigned',
      start_date: start_date ?? null,
      end_date: end_date ?? null,
      is_multi_day: is_multi_day ?? false,
      scheduled_dates: scheduled_dates ?? [],
      pay_rate: pay_rate ?? null,
      ot_rate: ot_rate ?? null,
      dt_rate: dt_rate ?? null,
      rate_type: rate_type ?? 'hourly',
      distance_from_home_miles: distance_from_home_miles ?? null,
      benefits_eligible: benefits_eligible ?? false,
      travel_benefits: travel_benefits ?? {},
      union_local: union_local ?? null,
      department: department ?? null,
      brand_id: brand_id ?? null,
      est_pay_date: est_pay_date ?? null,
      notes: notes ?? null,
      metadata: metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `Job number "${job_number.trim()}" already exists` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-calculate distance from home if not provided and location is set
  if (!distance_from_home_miles && (data.location_id || data.location_name)) {
    const dist = await calcDistance(db, user.id, data.location_id, data.location_name);
    if (dist) {
      const { data: updated } = await db
        .from('contractor_jobs')
        .update({ distance_from_home_miles: dist.miles, distance_from_home_km: dist.km })
        .eq('id', data.id)
        .select()
        .single();
      if (updated) return NextResponse.json(updated, { status: 201 });
    }
  }

  return NextResponse.json(data, { status: 201 });
}
