/**
 * Parse Google Maps directions URLs to extract waypoints, coordinates, and travel mode.
 *
 * Supports:
 *  - Full URLs: https://www.google.com/maps/dir/Place+A/Place+B/@lat,lng,zoom/data=...
 *  - The `data=` parameter encodes coordinates as !1d{lng}!2d{lat} pairs per waypoint
 *  - Travel mode from !3e{N}: 0=driving, 1=bicycling, 2=transit, 3=walking
 */

export interface MapsWaypoint {
  address: string;
  lat: number | null;
  lng: number | null;
}

export interface ParsedMapsRoute {
  waypoints: MapsWaypoint[];
  travelMode: 'car' | 'bike' | 'bus' | 'walk';
  isRoundTrip: boolean;
}

const MODE_MAP: Record<string, ParsedMapsRoute['travelMode']> = {
  '0': 'car',
  '1': 'bike',
  '2': 'bus',   // transit → closest CentenarianOS mode
  '3': 'walk',
};

/**
 * Parse a full Google Maps directions URL (not a short link — resolve those first).
 */
export function parseGoogleMapsUrl(url: string): ParsedMapsRoute | null {
  try {
    const parsed = new URL(url);

    // Must be a Google Maps directions URL
    if (!parsed.hostname.includes('google.com') && !parsed.hostname.includes('google.co')) {
      return null;
    }

    const pathMatch = parsed.pathname.match(/\/maps\/dir\/(.+)/);
    if (!pathMatch) return null;

    const dirPath = pathMatch[1];

    // Split path segments — addresses are separated by /
    // Stop at @ (map viewport) if present
    const segments = dirPath.split('/');
    const addresses: string[] = [];
    for (const seg of segments) {
      if (seg.startsWith('@')) break;
      if (!seg) continue;
      // Decode URL-encoded addresses (+ → space, %XX → chars)
      addresses.push(decodeURIComponent(seg.replace(/\+/g, ' ')));
    }

    if (addresses.length < 2) return null;

    // Extract coordinates from the data= parameter
    // Format: !1m5!1m1!1s{placeId}!2m2!1d{lng}!2d{lat} per waypoint
    const coordinates: { lat: number; lng: number }[] = [];
    const dataParam = parsed.searchParams.get('data') || '';

    // Find all !1d{lng}!2d{lat} pairs
    const coordPattern = /!1d(-?[\d.]+)!2d(-?[\d.]+)/g;
    let match;
    while ((match = coordPattern.exec(dataParam)) !== null) {
      const lng = parseFloat(match[1]);
      const lat = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        coordinates.push({ lat, lng });
      }
    }

    // Extract travel mode from !3e{N}
    const modeMatch = dataParam.match(/!3e(\d)/);
    const travelMode = modeMatch ? (MODE_MAP[modeMatch[1]] || 'car') : 'car';

    // Build waypoints — match addresses with coordinates
    const waypoints: MapsWaypoint[] = addresses.map((address, i) => ({
      address,
      lat: coordinates[i]?.lat ?? null,
      lng: coordinates[i]?.lng ?? null,
    }));

    // Detect round trip: first and last address match
    const first = addresses[0].toLowerCase().trim();
    const last = addresses[addresses.length - 1].toLowerCase().trim();
    const isRoundTrip = addresses.length > 2 && first === last;

    return { waypoints, travelMode, isRoundTrip };
  } catch {
    return null;
  }
}

/**
 * Check if a URL is a Google Maps short link that needs redirect resolution.
 */
export function isGoogleMapsShortLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'maps.app.goo.gl' ||
      parsed.hostname === 'goo.gl' ||
      (parsed.hostname.includes('google.com') && parsed.pathname.startsWith('/maps/'))
    );
  } catch {
    return false;
  }
}

/**
 * Check if a URL is a full Google Maps directions URL (already resolved).
 */
export function isGoogleMapsDirectionsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('google.com') && parsed.pathname.includes('/maps/dir/');
  } catch {
    return false;
  }
}
