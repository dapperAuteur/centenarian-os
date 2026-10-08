// app/api/equipment/depreciation/summary/route.ts
// Book value and this year's depreciation across the caller's active equipment
// and vehicles that have depreciation settings (migration 214).
//
// GET -> {
//   ready, year,
//   items: [{ kind, id, name, bookValue, accumulated, thisYearToDate, workShare,
//             workDepreciationThisYear, usedForWork, needs }],
//   totals: { bookValue, thisYearToDate, workDepreciationThisYear, configured }
// }
// Before migration 214: { ready: false, error, items: [], totals: zeros }.
// Estimates, not tax advice. The work is in lib/equipment/book-values.ts, which the Wallet also uses.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadBookValues } from '@/lib/equipment/book-values';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return NextResponse.json(await loadBookValues(supabase, user.id));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not load book values.' }, { status: 500 });
  }
}
