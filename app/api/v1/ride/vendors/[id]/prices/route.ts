// app/api/v1/ride/vendors/[id]/prices/route.ts
// GET: recent item prices at one of the user's vendors (RideWitUS PRD §6.9),
// from item_prices.vendor_contact_id (migration 093). Signed like the other
// vendor routes (secret RIDE_VENDOR_API_SECRET, path + query signed).
//
//   ?witus_sub=<sub>     required
//   &since=YYYY-MM-DD    default 180 days ago
//   &limit=1..200        default 50
//
// 200 { ok: true, data: { vendor_id, since, prices: [{ item_name, price, unit,
//       unit_price, recorded_date, source }], currency: null } }  newest first.
// currency is null: item_prices stores no currency yet.
// 404 not_found (not this user's vendor) · 404 unknown_subject · 400 · 401 · 500 · 503

import { NextRequest, NextResponse } from 'next/server';
import { signedGetBody } from '@/lib/events/sign-request';
import { errorEnvelope, okEnvelope } from '@/lib/integrations/ridewitus/auth';
import { authorizeRideRequest, getServiceDb } from '@/lib/integrations/ridewitus/server';
import { getVendor, loadPrices, parseLimit, parseSince, VendorLookupError } from '@/lib/integrations/ridewitus/vendors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const search = request.nextUrl.searchParams;
  const auth = await authorizeRideRequest({
    request,
    module: 'v1/ride/vendors/[id]/prices',
    secret: process.env.RIDE_VENDOR_API_SECRET,
    signedBody: signedGetBody(new URL(request.url)),
    witusSub: search.get('witus_sub'),
  });
  if (!auth.ok) return auth.response;

  try {
    const db = getServiceDb();
    // The vendor must be this user's before any price is read.
    const vendor = await getVendor(db, auth.userId, id);
    if (!vendor) return NextResponse.json(errorEnvelope('not_found', 'Vendor not found.'), { status: 404 });
    const since = parseSince(search.get('since'), new Date());
    const prices = await loadPrices(db, auth.userId, [vendor.id], since, parseLimit(search.get('limit')));
    return NextResponse.json(okEnvelope({ vendor_id: vendor.id, since, prices: prices.get(vendor.id) ?? [], currency: null }));
  } catch (err) {
    if (err instanceof VendorLookupError) {
      return NextResponse.json(errorEnvelope('lookup_failed', err.message), { status: 500 });
    }
    throw err;
  }
}
