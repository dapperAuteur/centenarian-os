// app/api/finance/fx/refresh/route.ts
// POST: "Update rates now". Fetches the latest rates (server-side) for every currency the user
// holds plus their home currency, skipping ones already fetched today or yesterday, then fills
// home-currency amounts that are still missing on their foreign-currency transactions.
// -> { stored, checked, skipped, uncovered, converted, unconverted }
// 503 { code: 'fx_not_migrated' } before migration 210.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceDb } from '@/lib/finance/transfers/server';
import { isFxSchemaMissing, refreshLatest } from '@/lib/finance/fx/rates';
import { backfillHomeAmounts, loadHomeCurrency, loadUserCurrencyCodes } from '@/lib/finance/fx/server';

export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceDb();
  const home = await loadHomeCurrency(db, user.id);
  const { codes, error: codeError } = await loadUserCurrencyCodes(db, user.id);
  if (codeError) {
    if (isFxSchemaMissing(codeError)) {
      return NextResponse.json(
        { error: 'Currencies are not set up in this database yet. Run migration 210 first.', code: 'fx_not_migrated' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: codeError.message }, { status: 500 });
  }

  const refreshed = await refreshLatest(db, [...codes, home]);
  if (refreshed.error) return NextResponse.json({ error: refreshed.error.message }, { status: 500 });

  const filled = await backfillHomeAmounts(db, user.id);
  if (filled.error) return NextResponse.json({ error: filled.error.message }, { status: 500 });

  return NextResponse.json({
    stored: refreshed.stored,
    checked: refreshed.checked,
    skipped: refreshed.skipped,
    uncovered: refreshed.uncovered,
    converted: filled.updated,
    unconverted: filled.unconverted,
  });
}
