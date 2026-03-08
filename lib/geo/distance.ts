// lib/geo/distance.ts
// Haversine distance calculation — no external API, fully private.

const EARTH_RADIUS_MI = 3958.8;
const EARTH_RADIUS_KM = 6371.0;
const DRIVING_MULTIPLIER = 1.3; // Approximate straight-line → driving distance

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate the straight-line (great-circle) distance between two points.
 * @returns distance in the specified unit
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  unit: 'mi' | 'km' = 'mi',
): number {
  const R = unit === 'km' ? EARTH_RADIUS_KM : EARTH_RADIUS_MI;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate driving distance by applying a multiplier to straight-line distance.
 * Accurate within ~10-20% for most US road networks.
 */
export function estimateDrivingDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  unit: 'mi' | 'km' = 'mi',
): number {
  const straight = haversineDistance(lat1, lng1, lat2, lng2, unit);
  return Math.round(straight * DRIVING_MULTIPLIER * 100) / 100;
}

/**
 * Convert miles to kilometers.
 */
export function milesToKm(miles: number): number {
  return Math.round(miles * 1.60934 * 100) / 100;
}

/**
 * Convert kilometers to miles.
 */
export function kmToMiles(km: number): number {
  return Math.round(km * 0.621371 * 100) / 100;
}
