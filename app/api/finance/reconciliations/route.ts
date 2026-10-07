// app/api/finance/reconciliations/route.ts
// GET ?account_id=&date=&balance=&statement=
//      What the Reconcile page shows for one account: the account (starting balance and date),
//      its imported statements, the suggested statement date and ending balance (the statement
//      closing on ?statement=YYYY-MM-DD, else the latest), a starting balance from the earliest
//      statement, past reconciliations, the date it is reconciled through, and (with ?date=) the
//      comparison for that statement date: computed balance, difference (with ?balance=), the
//      period's transactions with their Cleared state. Balances of cards and loans are amounts owed.
//      ready: false before migration 221.
// POST: finish a reconciliation.
//      { account_id, statement_date, statement_balance, cleared_ids?, difference_choice?, note?,
//        statement_id?, today? }
//      difference_choice ('adjustment' | 'starting_balance' | 'left_open') is required when the
//      statement and the books differ. -> 201 { reconciliation, adjustment, starting_balance, cleared }
//      Before migration 221: 503 { code: 'reconcile_not_migrated' } and nothing is written.
//
// Rules: lib/finance/reconciliation/logic.ts. Reads and writes: lib/finance/reconciliation/server.ts.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isDateString } from '@/lib/finance/reconciliation/logic';
import { finishReconciliation, loadReconcileView } from '@/lib/finance/reconciliation/server';
import { fxForUser, reconcileErrorResponse, resolveToday } from '@/lib/finance/reconciliation/request';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const accountId = params.get('account_id')?.trim();
  if (!accountId) return NextResponse.json({ error: 'account_id is required.' }, { status: 400 });
  const date = params.get('date');
  const rawBalance = params.get('balance');
  const balance = rawBalance !== null && rawBalance.trim() !== '' ? Number(rawBalance) : null;
  const statement = params.get('statement');

  try {
    const view = await loadReconcileView(supabase, user.id, accountId, {
      statementDate: isDateString(date) ? date : null,
      statementBalance: balance !== null && Number.isFinite(balance) ? balance : null,
      statementPeriodEnd: isDateString(statement) ? statement : null,
    });
    return NextResponse.json(view);
  } catch (err) {
    return reconcileErrorResponse(err);
  }
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
    const result = await finishReconciliation(supabase, user.id, body, resolveToday(body.today), fxForUser(user.id));
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return reconcileErrorResponse(err);
  }
}
