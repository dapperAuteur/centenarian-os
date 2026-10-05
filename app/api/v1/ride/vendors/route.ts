// app/api/v1/ride/vendors/route.ts
// GET: the user's vendors, for RideWitUS's vendor picker (RideWitUS PRD §6.9).
// Read-only by owner decision (PRD Q14): RideWitUS never creates vendors; it
// links to create_vendor_url instead.
//
// Server to server. Signed with X-Witus-* headers by source `ride-witus` and
// the secret RIDE_VENDOR_API_SECRET; a GET signs its path + query exactly as
// sent (lib/events/sign-request.ts). The user is the witus_sub, resolved
// through witus_identities (lib/witus/identity.ts).
//
//   ?witus_sub=<sub>     required
//   &q=<text>            optional, name contains (case-insensitive)
//   &limit=1..200        default 50
//   &offset=<n>          default 0; use next_offset from the previous page
//   &since=YYYY-MM-DD    optional: include each vendor's recent_prices recorded
//                        on or after this date (up to 10 per vendor, newest first)
//
// 200 { ok: true, data: { vendors: Vendor[], next_offset: number | null,
//                         currency: null, create_vendor_url } }
// 400 invalid_subject · 401 unauthorized · 404 unknown_subject · 500 · 503 not_configured
// Vendor: lib/integrations/ridewitus/vendors.ts. No coordinates, email or notes.

import { NextRequest, NextResponse } from 'next/server';
import { signedGetBody } from '@/lib/events/sign-request';
import { errorEnvelope, okEnvelope } from '@/lib/integrations/ridewitus/auth';
import { authorizeRideRequest, getServiceDb } from '@/lib/integrations/ridewitus/server';
import {
  createVendorUrl,
  listVendors,
  parseLimit,
  parseOffset,
  parseSince,
  VendorLookupError,
} from '@/lib/integrations/ridewitus/vendors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const auth = await authorizeRideRequest({
    request,
    module: 'v1/ride/vendors',
    secret: process.env.RIDE_VENDOR_API_SECRET,
    signedBody: signedGetBody(new URL(request.url)),
    witusSub: params.get('witus_sub'),
  });
  if (!auth.ok) return auth.response;

  const q = params.get('q');
  try {
    const page = await listVendors(getServiceDb(), auth.userId, {
      q,
      limit: parseLimit(params.get('limit')),
      offset: parseOffset(params.get('offset')),
      pricesSince: params.get('since') ? parseSince(params.get('since'), new Date()) : null,
    });
    return NextResponse.json(
      okEnvelope({ ...page, currency: null, create_vendor_url: createVendorUrl(request.nextUrl.origin, q) }),
    );
  } catch (err) {
    if (err instanceof VendorLookupError) {
      return NextResponse.json(errorEnvelope('lookup_failed', err.message), { status: 500 });
    }
    throw err;
  }
}
