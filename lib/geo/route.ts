// lib/geo/route.ts
// OSRM API client with Haversine fallback for road routing.

import { estimateDrivingDistance } from './distance';

const DEFAULT_OSRM_URL = 'https://router.project-osrm.org';

export interface RouteResult {
  distance_miles: number;
  duration_min: number;
  geometry: string | null; // encoded polyline
  source: 'osrm' | 'haversine';
}

/**
 * Calculate driving route between two points via OSRM.
 * Falls back to Haversine × 1.3 if OSRM is unreachable or env var not set.
 */
export async function getRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<RouteResult> {
  const osrmUrl = process.env.OSRM_API_URL || DEFAULT_OSRM_URL;

  try {
    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `${osrmUrl}/route/v1/driving/${coords}?overview=full&geometries=polyline`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!res.ok) throw new Error(`OSRM ${res.status}`);

    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes?.length) {
      throw new Error(json.message || 'No route found');
    }

    const route = json.routes[0];
    const distanceMeters: number = route.distance;
    const durationSec: number = route.duration;

    return {
      distance_miles: Math.round((distanceMeters / 1609.344) * 100) / 100,
      duration_min: Math.round(durationSec / 60),
      geometry: route.geometry || null,
      source: 'osrm',
    };
  } catch {
    // Fallback to Haversine estimate
    const miles = estimateDrivingDistance(origin.lat, origin.lng, destination.lat, destination.lng, 'mi');
    // Rough duration estimate: 35 mph average for driving
    const durationMin = Math.round((miles / 35) * 60);
    return {
      distance_miles: miles,
      duration_min: durationMin,
      geometry: null,
      source: 'haversine',
    };
  }
}

/**
 * Calculate route for multiple waypoints (multi-stop).
 * Returns per-leg results plus totals.
 */
export async function getMultiStopRoute(
  waypoints: { lat: number; lng: number }[],
): Promise<{ legs: RouteResult[]; total_miles: number; total_min: number }> {
  if (waypoints.length < 2) {
    return { legs: [], total_miles: 0, total_min: 0 };
  }

  const legs: RouteResult[] = [];
  let totalMiles = 0;
  let totalMin = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const leg = await getRoute(waypoints[i], waypoints[i + 1]);
    legs.push(leg);
    totalMiles += leg.distance_miles;
    totalMin += leg.duration_min;
  }

  return {
    legs,
    total_miles: Math.round(totalMiles * 100) / 100,
    total_min: totalMin,
  };
}
