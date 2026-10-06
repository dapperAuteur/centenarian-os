// app/api/v1/ride/vendors/[id]/route.ts
// GET: one of the user's vendors (RideWitUS PRD §6.9), same shape as the list.
// Signed like GET /api/v1/ride/vendors (secret RIDE_VENDOR_API_SECRET, path +
// query signed).
//
//   ?witus_sub=<sub>     required
//   &since=YYYY-MM-DD    optional: include recent_prices since that date
//
// 200 { ok: true, data: { vendor, currency: null } }
// 404 not_found when the id is not a vendor of this user's (or does not exist:
//     the same answer) · 404 unknown_subject · 400 · 401 · 500 · 503

import { NextRequest, NextResponse } from 'next/server';
import { signedGetBody } from '@/lib/events/sign-request';
import { errorEnvelope, okEnvelope } from '@/lib/integrations/ridewitus/auth';
import { authorizeRideRequest, getServiceDb } from '@/lib/integrations/ridewitus/server';
import { getVendor, parseSince, VendorLookupError } from '@/lib/integrations/ridewitus/vendors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const search = request.nextUrl.searchParams;
  const auth = await authorizeRideRequest({
    request,
    module: 'v1/ride/vendors/[id]',
    secret: process.env.RIDE_VENDOR_API_SECRET,
    signedBody: signedGetBody(new URL(request.url)),
    witusSub: search.get('witus_sub'),
  });
  if (!auth.ok) return auth.response;

  try {
    const since = search.get('since') ? parseSince(search.get('since'), new Date()) : null;
    const vendor = await getVendor(getServiceDb(), auth.userId, id, since);
    if (!vendor) return NextResponse.json(errorEnvelope('not_found', 'Vendor not found.'), { status: 404 });
    return NextResponse.json(okEnvelope({ vendor, currency: null }));
  } catch (err) {
    if (err instanceof VendorLookupError) {
      return NextResponse.json(errorEnvelope('lookup_failed', err.message), { status: 500 });
    }
    throw err;
  }
}
