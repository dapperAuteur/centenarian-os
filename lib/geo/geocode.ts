// lib/geo/geocode.ts
// Geocoding via OpenStreetMap Nominatim — free, open-source, no API key.
// Privacy: only the address string is sent to OSM. No tracking, no cookies.
// Rate limit: max 1 request/second per Nominatim usage policy.

export interface GeoResult {
  lat: number;
  lng: number;
  display_name: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Geocode an address string to lat/lng using OpenStreetMap Nominatim.
 * Returns null if no results found.
 */
export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  if (!address.trim()) return null;

  const params = new URLSearchParams({
    q: address,
    format: 'json',
    limit: '1',
    addressdetails: '0',
  });

  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: {
      'User-Agent': 'CentenarianOS/1.0 (contractor-job-hub)',
    },
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    display_name: data[0].display_name,
  };
}
