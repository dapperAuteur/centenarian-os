// app/api/finance/fx/home/route.ts
// GET:   { home_currency }  (USD when unset)
// PATCH: { home_currency: 'EUR' } sets the currency totals are reported in. Home amounts stored
//        against the old home currency are cleared and recomputed for the new one (bounded per
//        request; "Update rates now" continues where this stops).
//        -> { home_currency, converted, unconverted }
//
// home_currency is a nullable profiles column added by migration 210 (profiles was shared with
// Work.WitUS until the 2026-10 database split),
// and is not one of migration 206's protected columns. Written with the service client, scoped to
// the signed-in user's own row.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceDb } from '@/lib/finance/transfers/server';
import { normalizeCurrency } from '@/lib/finance/fx/math';
import { isFxSchemaMissing } from '@/lib/finance/fx/rates';
import { backfillHomeAmounts, clearHomeAmounts, loadHomeCurrency } from '@/lib/finance/fx/server';

export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ home_currency: await loadHomeCurrency(getServiceDb(), user.id) });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const code = normalizeCurrency(body?.home_currency);
  if (!code) return NextResponse.json({ error: 'Pick a three-letter currency code.' }, { status: 400 });

  const db = getServiceDb();
  const previous = await loadHomeCurrency(db, user.id);
  const { error } = await db.from('profiles').update({ home_currency: code }).eq('id', user.id);
  if (error) {
    if (isFxSchemaMissing(error)) {
      return NextResponse.json(
        { error: 'Currencies are not set up in this database yet. Run migration 210 first.', code: 'fx_not_migrated' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (previous === code) return NextResponse.json({ home_currency: code, converted: 0, unconverted: 0 });

  const cleared = await clearHomeAmounts(db, user.id);
  if (cleared.error) return NextResponse.json({ error: cleared.error.message }, { status: 500 });
  const filled = await backfillHomeAmounts(db, user.id);
  if (filled.error) return NextResponse.json({ error: filled.error.message }, { status: 500 });

  return NextResponse.json({ home_currency: code, converted: filled.updated, unconverted: filled.unconverted });
}
