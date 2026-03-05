// app/api/finance/accounts/[id]/link-teller/route.ts
// POST: Link a manual account to a Teller-connected account.
// Migrates all transactions from the Teller account into this one,
// runs fuzzy dedup, then deletes the now-empty Teller account.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Subtract N days from a YYYY-MM-DD string. */
function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id: targetId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { tellerAccountId } = body;
  if (!tellerAccountId) {
    return NextResponse.json({ error: 'tellerAccountId is required' }, { status: 400 });
  }

  const db = getDb();

  // Fetch both accounts and verify ownership
  const { data: target } = await db
    .from('financial_accounts')
    .select('id, user_id, teller_account_id, teller_enrollment_id')
    .eq('id', targetId)
    .maybeSingle();

  if (!target || target.user_id !== user.id) {
    return NextResponse.json({ error: 'Target account not found' }, { status: 404 });
  }
  if (target.teller_account_id) {
    return NextResponse.json({ error: 'Target account is already linked to Teller' }, { status: 400 });
  }

  const { data: source } = await db
    .from('financial_accounts')
    .select('id, user_id, teller_account_id, teller_enrollment_id, last_synced_at, oldest_transaction_date')
    .eq('id', tellerAccountId)
    .maybeSingle();

  if (!source || source.user_id !== user.id) {
    return NextResponse.json({ error: 'Source Teller account not found' }, { status: 404 });
  }
  if (!source.teller_account_id) {
    return NextResponse.json({ error: 'Source account is not a Teller-connected account' }, { status: 400 });
  }

  // 1. Copy Teller fields from source → target
  const { error: updateErr } = await db
    .from('financial_accounts')
    .update({
      teller_enrollment_id: source.teller_enrollment_id,
      teller_account_id: source.teller_account_id,
      last_synced_at: source.last_synced_at,
      oldest_transaction_date: source.oldest_transaction_date,
    })
    .eq('id', targetId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 2. Migrate all transactions from source → target
  const { count: migratedCount, error: migrateErr } = await db
    .from('financial_transactions')
    .update({ account_id: targetId }, { count: 'exact' })
    .eq('account_id', source.id);

  if (migrateErr) {
    return NextResponse.json({ error: migrateErr.message }, { status: 500 });
  }

  // 3. Fuzzy dedup: find bank_sync transactions that match manual ones
  //    Keep the bank_sync version (has teller_transaction_id), delete the manual duplicate
  const { data: bankTxns } = await db
    .from('financial_transactions')
    .select('id, amount, transaction_date, vendor, description, teller_transaction_id')
    .eq('account_id', targetId)
    .eq('source', 'bank_sync')
    .not('teller_transaction_id', 'is', null);

  let dedupCount = 0;

  if (bankTxns?.length) {
    for (const bt of bankTxns) {
      const matchDateFrom = subtractDays(bt.transaction_date, 2);
      const matchDateTo = subtractDays(bt.transaction_date, -2);
      const merchantName = (bt.vendor ?? bt.description ?? '').toLowerCase();
      if (!merchantName) continue;

      const { data: candidates } = await db
        .from('financial_transactions')
        .select('id, vendor, description')
        .eq('account_id', targetId)
        .is('teller_transaction_id', null)
        .in('source', ['manual', 'scan'])
        .gte('amount', bt.amount - 0.01)
        .lte('amount', bt.amount + 0.01)
        .gte('transaction_date', matchDateFrom)
        .lte('transaction_date', matchDateTo);

      const match = (candidates ?? []).find((c) => {
        const cVendor = (c.vendor ?? '').toLowerCase();
        const cDesc = (c.description ?? '').toLowerCase();
        return (
          cVendor.includes(merchantName) ||
          merchantName.includes(cVendor) ||
          cDesc.includes(merchantName) ||
          merchantName.includes(cDesc)
        );
      });

      if (match) {
        await db.from('financial_transactions').delete().eq('id', match.id);
        dedupCount++;
      }
    }
  }

  // 4. Delete the now-empty source account
  await db.from('financial_accounts').delete().eq('id', source.id);

  return NextResponse.json({
    ok: true,
    migrated: migratedCount ?? 0,
    deduped: dedupCount,
  });
}
