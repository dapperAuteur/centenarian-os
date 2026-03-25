import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseGoogleMapsUrl, isGoogleMapsDirectionsUrl } from '@/lib/travel/maps-parser';
import { getRoute } from '@/lib/geo/route';
import { geocodeAddress } from '@/lib/geo/geocode';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await request.json();
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  // Resolve short links by following the redirect
  let fullUrl = url.trim();
  if (!isGoogleMapsDirectionsUrl(fullUrl)) {
    try {
      const res = await fetch(fullUrl, { redirect: 'manual' });
      const location = res.headers.get('location');
      if (location && isGoogleMapsDirectionsUrl(location)) {
        fullUrl = location;
      } else {
        // Try one more redirect hop (some short links do 2 redirects)
        if (location) {
          const res2 = await fetch(location, { redirect: 'manual' });
          const location2 = res2.headers.get('location');
          if (location2 && isGoogleMapsDirectionsUrl(location2)) {
            fullUrl = location2;
          }
        }
      }
    } catch {
      return NextResponse.json({ error: 'Could not resolve the short link' }, { status: 400 });
    }
  }

  // Parse the full URL
  const parsed = parseGoogleMapsUrl(fullUrl);
  if (!parsed || parsed.waypoints.length < 2) {
    return NextResponse.json({ error: 'Could not parse Google Maps directions from this URL' }, { status: 400 });
  }

  // Geocode any waypoints missing coordinates
  for (const wp of parsed.waypoints) {
    if (wp.lat === null || wp.lng === null) {
      const geo = await geocodeAddress(wp.address);
      if (geo) {
        wp.lat = geo.lat;
        wp.lng = geo.lng;
      }
    }
  }

  // Calculate distance and duration for each leg via OSRM
  const legs = [];
  for (let i = 0; i < parsed.waypoints.length - 1; i++) {
    const origin = parsed.waypoints[i];
    const dest = parsed.waypoints[i + 1];

    let distance_miles: number | null = null;
    let duration_min: number | null = null;

    if (origin.lat != null && origin.lng != null && dest.lat != null && dest.lng != null) {
      const routeResult = await getRoute(
        { lat: origin.lat, lng: origin.lng },
        { lat: dest.lat, lng: dest.lng },
      );
      distance_miles = routeResult.distance_miles;
      duration_min = routeResult.duration_min;
    }

    legs.push({
      origin: origin.address,
      destination: dest.address,
      origin_lat: origin.lat,
      origin_lng: origin.lng,
      dest_lat: dest.lat,
      dest_lng: dest.lng,
      distance_miles,
      duration_min,
      mode: parsed.travelMode,
    });
  }

  return NextResponse.json({
    route: {
      name: legs.length > 1 ? `${parsed.waypoints.length}-stop route` : null,
      isRoundTrip: parsed.isRoundTrip,
      travelMode: parsed.travelMode,
      waypoints: parsed.waypoints,
      legs,
    },
  });
}
