// app/api/finance/cash/counts/route.ts
// GET ?account_id=: one cash account's counts, newest first ({ ready, counts }).
//      Before migration 213: { ready: false, counts: [] }.
// POST: count the cash in a cash account.
//      { account_id, counted_amount?, denominations?, category_id?, counted_on?, note?, today? }
//      counted_amount is what was counted, in the account's currency. denominations
//      ({ "<value in cents>": pieces }) may stand in for it, or must add up to it.
//      The difference from the recorded balance is saved as one adjustment on the
//      account ("Unrecorded cash spending" expense or "Cash found" income, tag
//      cash-count, the category given or none), and the count is kept.
//      -> 201 { count, adjustment_transaction_id, adjustment }
//      Before migration 213: 503 { code: 'cash_counts_not_migrated' } and nothing is written.
//
// Rules: lib/finance/cash/logic.ts. Writes: lib/finance/cash/server.ts.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listCounts, recordCashCount } from '@/lib/finance/cash/server';
import { errorResponse, fxForUser, resolveToday } from '@/lib/finance/cash/request';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const accountId = request.nextUrl.searchParams.get('account_id')?.trim();
  if (!accountId) return NextResponse.json({ error: 'account_id is required.' }, { status: 400 });
  const { counts, ready, error } = await listCounts(supabase, user.id, accountId);
  if (error) return NextResponse.json({ error: error.message || 'Could not load the counts.' }, { status: 500 });
  return NextResponse.json({ ready, counts });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) ?? {};
  } catch {
    return NextResponse.json({ error: 'The request body must be JSON.' }, { status: 400 });
  }
  try {
    const result = await recordCashCount(supabase, user.id, body, resolveToday(body.today), fxForUser(user.id));
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
