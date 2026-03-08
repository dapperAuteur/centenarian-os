// app/api/contractor/distance/route.ts
// GET: calculate distance from home to a venue/address
// POST: geocode an address and save home coordinates

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

// GET: calculate distance from home to a destination
// ?dest_lat=&dest_lng= OR ?address=VenueName
// ?job_id= (optional) — also saves distance_from_home_miles on the job
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { searchParams } = new URL(request.url);

  // Get user's home coordinates
  const { data: settings } = await db
    .from('travel_settings')
    .select('home_lat, home_lng, home_address, distance_unit')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!settings?.home_lat || !settings?.home_lng) {
    return NextResponse.json({ error: 'Home address not set. Go to Settings to add your home address.' }, { status: 400 });
  }

  const unit = (settings.distance_unit as 'mi' | 'km') || 'mi';
  let destLat = parseFloat(searchParams.get('dest_lat') ?? '');
  let destLng = parseFloat(searchParams.get('dest_lng') ?? '');

  // If no lat/lng provided, try geocoding the address param
  if ((isNaN(destLat) || isNaN(destLng)) && searchParams.get('address')) {
    const geo = await geocodeAddress(searchParams.get('address')!);
    if (!geo) return NextResponse.json({ error: 'Could not geocode destination address' }, { status: 400 });
    destLat = geo.lat;
    destLng = geo.lng;
  }

  if (isNaN(destLat) || isNaN(destLng)) {
    return NextResponse.json({ error: 'dest_lat/dest_lng or address required' }, { status: 400 });
  }

  const distanceMi = estimateDrivingDistance(settings.home_lat, settings.home_lng, destLat, destLng, 'mi');
  const distanceKm = milesToKm(distanceMi);

  // Optionally save to job
  const jobId = searchParams.get('job_id');
  if (jobId) {
    await db
      .from('contractor_jobs')
      .update({
        distance_from_home_miles: distanceMi,
        distance_from_home_km: distanceKm,
      })
      .eq('id', jobId)
      .eq('user_id', user.id);
  }

  return NextResponse.json({
    distance_miles: distanceMi,
    distance_km: distanceKm,
    display_distance: unit === 'km' ? `${distanceKm} km` : `${distanceMi} mi`,
    unit,
    from: { lat: settings.home_lat, lng: settings.home_lng, address: settings.home_address },
    to: { lat: destLat, lng: destLng },
  });
}

// POST: geocode and save home address (or geocode any address)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const body = await request.json();
  const { address, save_as_home, distance_unit, location_id } = body;

  if (!address?.trim()) {
    return NextResponse.json({ error: 'address required' }, { status: 400 });
  }

  const geo = await geocodeAddress(address.trim());
  if (!geo) {
    return NextResponse.json({ error: 'Could not geocode address. Try a more specific address.' }, { status: 400 });
  }

  // Save as home address
  if (save_as_home) {
    const updates: Record<string, unknown> = {
      home_address: address.trim(),
      home_lat: geo.lat,
      home_lng: geo.lng,
      updated_at: new Date().toISOString(),
    };
    if (distance_unit) updates.distance_unit = distance_unit;

    // Upsert travel_settings
    const { data: existing } = await db
      .from('travel_settings')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await db.from('travel_settings').update(updates).eq('user_id', user.id);
    } else {
      await db.from('travel_settings').insert({ user_id: user.id, ...updates });
    }
  }

  // Save to a contact location
  if (location_id) {
    await db
      .from('contact_locations')
      .update({ lat: geo.lat, lng: geo.lng })
      .eq('id', location_id);
  }

  return NextResponse.json({
    lat: geo.lat,
    lng: geo.lng,
    display_name: geo.display_name,
    saved: save_as_home ? 'home' : location_id ? 'location' : null,
  });
}
