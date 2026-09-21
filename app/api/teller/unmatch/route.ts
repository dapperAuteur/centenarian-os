// app/api/teller/unmatch/route.ts
// POST { transaction_id }: undo a bank match. When a sync links a manual or
// scanned entry to a bank transaction (by setting its teller_transaction_id),
// this splits them apart again without a schema change:
// 1. Re-fetch the bank transaction from Teller (one call, a small date window).
// 2. Clear the link on the manual entry.
// 3. Insert the bank transaction as its own bank_sync row.
// Because the bank row now holds that Teller ID, later syncs skip it instead of
// matching it back to the manual entry.
//
// If the account is no longer connected to Teller, only the link is cleared:
// nothing will sync that account again, so there is nothing to re-match.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { decryptToken, listTransactions, mapTellerTransaction } from '@/lib/teller';
import { logError, logInfo } from '@/lib/logging';
import { lookupLearnedCategory, shiftDate, MATCH_WINDOW_DAYS } from '@/lib/finance/transaction-matching';
import { loadLearnedCategoryIndex } from '@/lib/finance/learned-categories';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Days either side of the entry's date to ask Teller for; wider than the match window. */
const REFETCH_WINDOW_DAYS = MATCH_WINDOW_DAYS + 5;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const transactionId = typeof body.transaction_id === 'string' ? body.transaction_id : null;
  if (!transactionId) return NextResponse.json({ error: 'transaction_id is required' }, { status: 400 });

  const db = getDb();

  const { data: entry, error: entryErr } = await db
    .from('financial_transactions')
    .select('id, source, teller_transaction_id, account_id, transaction_date')
    .eq('id', transactionId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (entryErr) return NextResponse.json({ error: entryErr.message }, { status: 500 });
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!entry.teller_transaction_id || entry.source === 'bank_sync') {
    return NextResponse.json(
      { error: "This transaction isn't a manual or scanned entry matched to a bank transaction." },
      { status: 400 },
    );
  }
  const tellerId: string = entry.teller_transaction_id;

  const clearLink = async () => {
    const { data } = await db
      .from('financial_transactions')
      .update({ teller_transaction_id: null })
      .eq('id', entry.id)
      .eq('teller_transaction_id', tellerId)
      .select('id');
    return (data?.length ?? 0) > 0;
  };

  // Find the bank connection for the entry's account.
  const { data: account } = entry.account_id
    ? await db
        .from('financial_accounts')
        .select('id, teller_account_id, teller_enrollment_id')
        .eq('id', entry.account_id)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };

  const { data: enrollment } = account?.teller_enrollment_id
    ? await db
        .from('teller_enrollments')
        .select('id, access_token, status')
        .eq('id', account.teller_enrollment_id)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };

  if (!account?.teller_account_id || !enrollment || enrollment.status !== 'connected') {
    if (!(await clearLink())) {
      return NextResponse.json({ error: 'The match changed while you were unmatching. Reload and try again.' }, { status: 409 });
    }
    return NextResponse.json({ unmatched: true, bank_transaction_id: null });
  }

  // Re-fetch the bank transaction so it can stand on its own.
  let bankTxn;
  try {
    const accessToken = decryptToken(enrollment.access_token);
    const txns = await listTransactions(accessToken, account.teller_account_id, {
      startDate: shiftDate(entry.transaction_date, -REFETCH_WINDOW_DAYS),
      endDate: shiftDate(entry.transaction_date, REFETCH_WINDOW_DAYS),
    });
    bankTxn = txns.find((t) => t.id === tellerId);
  } catch (err) {
    logError({ source: 'api', module: 'finance', message: 'Teller unmatch fetch failed', metadata: { transactionId, error: err instanceof Error ? err.message : 'Unknown' } });
    return NextResponse.json({ error: "Couldn't reach your bank. Nothing was changed. Try again later." }, { status: 502 });
  }
  if (!bankTxn) {
    return NextResponse.json(
      { error: 'Your bank no longer lists this transaction near that date, so it can’t be split out. Nothing was changed.' },
      { status: 409 },
    );
  }

  // The unique index on teller_transaction_id means the link must be cleared
  // before the bank row can take that ID.
  if (!(await clearLink())) {
    return NextResponse.json({ error: 'The match changed while you were unmatching. Reload and try again.' }, { status: 409 });
  }

  const mapped = mapTellerTransaction(bankTxn, account.id, user.id);
  const learned = await loadLearnedCategoryIndex(db, user.id);
  const categoryId = lookupLearnedCategory(learned, mapped.vendor, mapped.type);
  const { data: inserted, error: insertErr } = await db
    .from('financial_transactions')
    .insert(categoryId ? { ...mapped, category_id: categoryId } : mapped)
    .select('id')
    .maybeSingle();

  if (insertErr || !inserted) {
    // Put the link back so the bank transaction isn't lost.
    await db
      .from('financial_transactions')
      .update({ teller_transaction_id: tellerId })
      .eq('id', entry.id)
      .is('teller_transaction_id', null);
    logError({ source: 'api', module: 'finance', message: 'Teller unmatch insert failed', metadata: { transactionId, error: insertErr?.message ?? 'no row' } });
    return NextResponse.json({ error: "Couldn't save the bank transaction. Nothing was changed." }, { status: 500 });
  }

  logInfo({ source: 'api', module: 'finance', message: 'Teller match undone', metadata: { transactionId, bankTransactionId: inserted.id } });
  return NextResponse.json({ unmatched: true, bank_transaction_id: inserted.id });
}
