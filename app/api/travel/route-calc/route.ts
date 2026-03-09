// POST /api/travel/route-calc
// Calculate driving route between two or more points via OSRM (or Haversine fallback).
// Body: { waypoints: [{ lat, lng }, ...] }
// Returns per-leg and total distance/duration/geometry.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRoute, getMultiStopRoute } from '@/lib/geo/route';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { waypoints } = body;

  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return NextResponse.json({ error: 'At least 2 waypoints required (each with lat and lng)' }, { status: 400 });
  }

  for (const wp of waypoints) {
    if (typeof wp.lat !== 'number' || typeof wp.lng !== 'number') {
      return NextResponse.json({ error: 'Each waypoint must have numeric lat and lng' }, { status: 400 });
    }
  }

  if (waypoints.length === 2) {
    const result = await getRoute(waypoints[0], waypoints[1]);
    return NextResponse.json({
      legs: [result],
      total_miles: result.distance_miles,
      total_min: result.duration_min,
      source: result.source,
    });
  }

  const result = await getMultiStopRoute(waypoints);
  return NextResponse.json({
    legs: result.legs,
    total_miles: result.total_miles,
    total_min: result.total_min,
    source: result.legs[0]?.source ?? 'haversine',
  });
}
