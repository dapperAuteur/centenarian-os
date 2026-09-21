// app/api/teller/sync/route.ts
// POST: Sync transactions from Teller for user's connected accounts.
// - Fetches from 10 days before the last sync, per Teller's advice to overlap
//   7-10 days so pending-to-posted date shifts are caught
// - Reconciles by teller_transaction_id: refreshes rows Teller changed (when
//   nobody edited them), moves a row to its re-created ID, links manual/scan
//   entries of the same purchase, inserts the rest with learned categories.
//   See lib/finance/teller-sync.ts.
// - Tracks oldest_transaction_date per account

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { decryptToken, listTransactions } from '@/lib/teller';
import { logInfo, logError } from '@/lib/logging';
import { shiftDate } from '@/lib/finance/transaction-matching';
import { loadLearnedCategoryIndex } from '@/lib/finance/learned-categories';
import { addSyncCounts, emptySyncCounts, reconcileTellerTransactions } from '@/lib/finance/teller-sync';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * Days before the last sync to start fetching. Teller: "Expand the window 7-10
 * days beyond your last sync to capture transactions that shift dates when
 * moving from pending to posted." (plans/58-teller-auto-sync-research.md §4)
 */
const RESYNC_OVERLAP_DAYS = 10;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const enrollmentFilter = body.enrollment_id ?? null;
  const fullResync = body.full_resync === true;

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

  const totals = emptySyncCounts();
  const errors: string[] = [];
  let globalOldest: string | null = null;
  const learned = await loadLearnedCategoryIndex(db, user.id);
  const claimedManualIds = new Set<string>();

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
        // full_resync or initial sync: no startDate → fetch all available history
        // Subsequent: last_synced date minus RESYNC_OVERLAP_DAYS (catch pending→posted drift)
        const startDate = fullResync
          ? undefined
          : acct.last_synced_at
            ? shiftDate(new Date(acct.last_synced_at).toISOString().slice(0, 10), -RESYNC_OVERLAP_DAYS)
            : undefined;

        const txns = await listTransactions(accessToken, acct.teller_account_id!, {
          startDate,
        });

        if (!txns.length) continue;

        // Track oldest transaction date
        const dates = txns.map((t) => t.date).sort();
        const acctOldest = dates[0];
        if (!globalOldest || acctOldest < globalOldest) globalOldest = acctOldest;

        const counts = await reconcileTellerTransactions(db, {
          userId: user.id,
          accountId: acct.id,
          txns,
          windowStart: startDate,
          learned,
          claimedManualIds,
        });
        addSyncCounts(totals, counts);

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
        logError({ source: 'sync', module: 'finance', message: 'Teller sync failed for account', metadata: { accountId: acct.teller_account_id, error: err instanceof Error ? err.message : 'Unknown' } });
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

  logInfo({ source: 'sync', module: 'finance', message: 'Teller sync completed', metadata: { newTransactions: totals.new, matched: totals.matched, updated: totals.updated, skipped: totals.skipped, errors: errors.length } });

  return NextResponse.json({
    new: totals.new,
    matched: totals.matched,
    updated: totals.updated,
    skipped: totals.skipped,
    oldestTransactionDate: globalOldest,
    errors: errors.length ? errors : undefined,
  });
}
