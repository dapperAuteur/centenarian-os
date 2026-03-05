// app/api/teller/sync/route.ts
// POST: Sync transactions from Teller for user's connected accounts.
// - Deduplicates by teller_transaction_id
// - Fuzzy-matches against existing manual/scan entries (amount + date ±2d + merchant)
// - Tracks oldest_transaction_date per account

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { decryptToken, listTransactions, mapTellerTransaction } from '@/lib/teller';

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

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const enrollmentFilter = body.enrollment_id ?? null;

  const db = getDb();

  // Fetch user's connected enrollments
  let query = db
    .from('teller_enrollments')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'connected');

  if (enrollmentFilter) {
    query = query.eq('id', enrollmentFilter);
  }

  const { data: enrollments, error: enrollErr } = await query;
  if (enrollErr) return NextResponse.json({ error: enrollErr.message }, { status: 500 });
  if (!enrollments?.length) {
    return NextResponse.json({ error: 'No connected enrollments' }, { status: 404 });
  }

  let totalNew = 0;
  let totalMatched = 0;
  let totalSkipped = 0;
  const errors: string[] = [];
  let globalOldest: string | null = null;

  for (const enrollment of enrollments) {
    let accessToken: string;
    try {
      accessToken = decryptToken(enrollment.access_token);
    } catch {
      errors.push(`Failed to decrypt token for enrollment ${enrollment.enrollment_id}`);
      await db
        .from('teller_enrollments')
        .update({ status: 'error' })
        .eq('id', enrollment.id);
      continue;
    }

    // Get all accounts linked to this enrollment
    const { data: accounts } = await db
      .from('financial_accounts')
      .select('id, teller_account_id, last_synced_at, oldest_transaction_date')
      .eq('user_id', user.id)
      .eq('teller_enrollment_id', enrollment.id)
      .not('teller_account_id', 'is', null);

    if (!accounts?.length) continue;

    for (const acct of accounts) {
      try {
        // Determine sync window
        // Initial sync: no startDate → fetch all available history
        // Subsequent: last_synced date minus 10 days (catch pending→posted drift)
        const startDate = acct.last_synced_at
          ? subtractDays(new Date(acct.last_synced_at).toISOString().slice(0, 10), 10)
          : undefined;

        const txns = await listTransactions(accessToken, acct.teller_account_id!, {
          startDate,
        });

        if (!txns.length) continue;

        // Track oldest transaction date
        const dates = txns.map((t) => t.date).sort();
        const acctOldest = dates[0];
        if (!globalOldest || acctOldest < globalOldest) globalOldest = acctOldest;

        for (const txn of txns) {
          // Skip if already imported (dedup by teller_transaction_id)
          const { data: existing } = await db
            .from('financial_transactions')
            .select('id')
            .eq('teller_transaction_id', txn.id)
            .maybeSingle();

          if (existing) {
            totalSkipped++;
            continue;
          }

          // Fuzzy match against manual/scan entries
          const numAmount = Math.abs(parseFloat(txn.amount));
          const merchantName = txn.details?.counterparty?.name ?? txn.description;

          // Look for manual/scan transactions with:
          // - Same amount (±$0.01)
          // - Same date (±2 days)
          // - Similar vendor/description
          const matchDateFrom = subtractDays(txn.date, 2);
          const matchDateTo = subtractDays(txn.date, -2);

          const { data: candidates } = await db
            .from('financial_transactions')
            .select('id, vendor, description')
            .eq('user_id', user.id)
            .eq('account_id', acct.id)
            .is('teller_transaction_id', null)
            .in('source', ['manual', 'scan'])
            .gte('amount', numAmount - 0.01)
            .lte('amount', numAmount + 0.01)
            .gte('transaction_date', matchDateFrom)
            .lte('transaction_date', matchDateTo);

          // Check merchant name similarity
          const match = (candidates ?? []).find((c) => {
            const cVendor = (c.vendor ?? '').toLowerCase();
            const cDesc = (c.description ?? '').toLowerCase();
            const mLower = merchantName.toLowerCase();
            return (
              cVendor.includes(mLower) ||
              mLower.includes(cVendor) ||
              cDesc.includes(mLower) ||
              mLower.includes(cDesc)
            );
          });

          if (match) {
            // Link existing transaction to bank data instead of creating duplicate
            await db
              .from('financial_transactions')
              .update({ teller_transaction_id: txn.id })
              .eq('id', match.id);
            totalMatched++;
          } else {
            // Insert as new bank_sync transaction
            const mapped = mapTellerTransaction(txn, acct.id, user.id);
            const { error } = await db
              .from('financial_transactions')
              .insert(mapped);
            if (!error) totalNew++;
          }
        }

        // Update account sync metadata
        const updateData: Record<string, unknown> = {
          last_synced_at: new Date().toISOString(),
        };
        // Update oldest_transaction_date if we found older data
        if (!acct.oldest_transaction_date || acctOldest < acct.oldest_transaction_date) {
          updateData.oldest_transaction_date = acctOldest;
        }
        await db
          .from('financial_accounts')
          .update(updateData)
          .eq('id', acct.id);
      } catch (err) {
        errors.push(
          `Sync failed for account ${acct.teller_account_id}: ${err instanceof Error ? err.message : 'Unknown'}`,
        );
      }
    }

    // Update enrollment sync timestamp
    await db
      .from('teller_enrollments')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', enrollment.id);
  }

  return NextResponse.json({
    new: totalNew,
    matched: totalMatched,
    skipped: totalSkipped,
    oldestTransactionDate: globalOldest,
    errors: errors.length ? errors : undefined,
  });
}
