// lib/finance/teller-sync.ts
// Writes one account's worth of Teller transactions into financial_transactions.
// Used by the manual sync (/api/teller/sync) and the first sync after
// connecting (/api/teller/connect).
//
// For each transaction Teller returned:
// 1. Already imported (same teller_transaction_id): refresh the bank-owned
//    fields if Teller changed them and nobody has edited the row. Otherwise skip.
// 2. New ID, but a row on this account holds a Teller ID that Teller no longer
//    returns, with the same amount and a date within 7 days: Teller re-created
//    a pending transaction under a new ID. Move that row to the new ID.
// 3. New ID that matches a manual or scanned entry (see findBestMatch): link
//    the entry to the bank transaction and fill in its account if it had none.
// 4. Otherwise insert it, with the vendor's learned category when there is one.
//
// The matching and reconcile rules are pure functions in transaction-matching.ts.

import type { SupabaseClient } from '@supabase/supabase-js';
import { mapTellerTransaction, type TellerTransaction } from '@/lib/teller';
import {
  bankDetailChanges,
  findBestMatch,
  findVanishedRow,
  lookupLearnedCategory,
  shiftDate,
  MATCH_WINDOW_DAYS,
  type BankDetailPatch,
  type LearnedCategoryIndex,
  type ManualCandidate,
  type StoredTellerRow,
  type TellerFields,
} from './transaction-matching';

const STORED_COLUMNS =
  'id, teller_transaction_id, source, amount, transaction_date, description, vendor, category_id, created_at, updated_at';

/** PostgREST returns at most this many rows per request by default. */
const PAGE_SIZE = 1000;

/** Teller IDs per "already imported?" query, keeping the request URL short. */
const ID_CHUNK = 200;

export interface TellerSyncCounts {
  /** Inserted as new bank rows. */
  new: number;
  /** Linked to an existing manual or scanned entry. */
  matched: number;
  /** Existing rows refreshed with Teller's changes, or moved to a re-created ID. */
  updated: number;
  /** Already imported and unchanged (or protected because someone edited them). */
  skipped: number;
}

export function emptySyncCounts(): TellerSyncCounts {
  return { new: 0, matched: 0, updated: 0, skipped: 0 };
}

export function addSyncCounts(total: TellerSyncCounts, add: TellerSyncCounts): void {
  total.new += add.new;
  total.matched += add.matched;
  total.updated += add.updated;
  total.skipped += add.skipped;
}

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Reads every page of a query. Throws on a read error so a partial read can't cause duplicates. */
async function readAllPages<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export interface ReconcileOptions {
  userId: string;
  /** financial_accounts.id the transactions belong to. */
  accountId: string;
  txns: TellerTransaction[];
  /** The start_date Teller was asked for, or undefined when all history was fetched. */
  windowStart?: string;
  learned: LearnedCategoryIndex;
  /**
   * Manual entries already linked during this request. Shared across accounts,
   * because an entry with no account is a candidate for every account.
   */
  claimedManualIds: Set<string>;
}

export async function reconcileTellerTransactions(
  db: SupabaseClient,
  opts: ReconcileOptions,
): Promise<TellerSyncCounts> {
  const { userId, accountId, txns, windowStart, learned, claimedManualIds } = opts;
  const counts = emptySyncCounts();
  if (txns.length === 0) return counts;

  const entries = txns.map((txn) => {
    const mapped = mapTellerTransaction(txn, accountId, userId);
    const fields: TellerFields = {
      id: txn.id,
      amount: mapped.amount,
      date: mapped.transaction_date,
      description: mapped.description ?? null,
      vendor: mapped.vendor ?? null,
    };
    return { txn, mapped, fields };
  });
  const returnedIds = new Set(txns.map((t) => t.id));

  // 1. Which of these are already imported? One query per ID_CHUNK IDs.
  const existing = new Map<string, StoredTellerRow>();
  const ids = [...returnedIds];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await db
      .from('financial_transactions')
      .select(STORED_COLUMNS)
      .eq('user_id', userId)
      .in('teller_transaction_id', ids.slice(i, i + ID_CHUNK));
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as StoredTellerRow[]) existing.set(row.teller_transaction_id, row);
  }

  const fresh = entries.filter((e) => !existing.has(e.txn.id));
  let vanishedPool: StoredTellerRow[] = [];
  let manualPool: ManualCandidate[] = [];

  if (fresh.length > 0) {
    // 2. Rows on this account holding a Teller ID that Teller didn't return,
    //    dated inside the window Teller was asked for.
    vanishedPool = (
      await readAllPages<StoredTellerRow>((from, to) => {
        let q = db
          .from('financial_transactions')
          .select(STORED_COLUMNS)
          .eq('user_id', userId)
          .eq('account_id', accountId)
          .not('teller_transaction_id', 'is', null);
        if (windowStart) q = q.gte('transaction_date', windowStart);
        return q.order('id').range(from, to) as unknown as PageResult<StoredTellerRow>;
      })
    ).filter((row) => !returnedIds.has(row.teller_transaction_id));

    // 3. Manual and scanned entries not yet linked to the bank, with no account
    //    or this account, dated within the match window of a new transaction.
    const dates = fresh.map((e) => e.fields.date).sort();
    const from = shiftDate(dates[0], -MATCH_WINDOW_DAYS);
    const to = shiftDate(dates[dates.length - 1], MATCH_WINDOW_DAYS);
    manualPool = await readAllPages<ManualCandidate>((start, end) =>
      db
        .from('financial_transactions')
        .select('id, amount, transaction_date, vendor, description, account_id')
        .eq('user_id', userId)
        .is('teller_transaction_id', null)
        .in('source', ['manual', 'scan'])
        .or(`account_id.is.null,account_id.eq.${accountId}`)
        .gte('transaction_date', from)
        .lte('transaction_date', to)
        .order('id')
        .range(start, end) as unknown as PageResult<ManualCandidate>,
    );
  }

  const claimedVanished = new Set<string>();

  for (const { txn, mapped, fields } of entries) {
    // 1. Already imported: refresh if Teller changed it and nobody edited it.
    const row = existing.get(txn.id);
    if (row) {
      const patch = bankDetailChanges(row, fields);
      if (patch && (await updateRow(db, row.id, withLearnedCategory(patch, row, learned, mapped.type), {
        updated_at: row.updated_at,
      }))) {
        counts.updated++;
      } else {
        counts.skipped++;
      }
      continue;
    }

    // 2. Teller re-created a pending transaction under a new ID.
    const vanished = findVanishedRow(fields, vanishedPool, returnedIds, {
      windowStart,
      claimed: claimedVanished,
    });
    if (vanished) {
      claimedVanished.add(vanished.id);
      const patch = bankDetailChanges(vanished, fields);
      const relinked =
        (patch &&
          (await updateRow(
            db,
            vanished.id,
            { teller_transaction_id: txn.id, ...withLearnedCategory(patch, vanished, learned, mapped.type) },
            { teller_transaction_id: vanished.teller_transaction_id, updated_at: vanished.updated_at },
          ))) ||
        (await updateRow(db, vanished.id, { teller_transaction_id: txn.id }, {
          teller_transaction_id: vanished.teller_transaction_id,
        }));
      if (relinked) {
        counts.updated++;
        continue;
      }
    }

    // 3. Link to a manual or scanned entry of the same purchase.
    const match = findBestMatch(
      {
        amount: fields.amount,
        date: fields.date,
        merchant: txn.details?.counterparty?.name ?? null,
        description: txn.description ?? null,
        accountId,
      },
      manualPool,
      claimedManualIds,
    );
    if (match) {
      claimedManualIds.add(match.id);
      const values: Record<string, unknown> = { teller_transaction_id: txn.id };
      if (!match.account_id) values.account_id = accountId;
      const { data } = await db
        .from('financial_transactions')
        .update(values)
        .eq('id', match.id)
        .eq('user_id', userId)
        .is('teller_transaction_id', null)
        .select('id');
      if (data?.length) {
        counts.matched++;
        continue;
      }
    }

    // 4. New bank transaction.
    const categoryId = lookupLearnedCategory(learned, mapped.vendor, mapped.type);
    const { error } = await db
      .from('financial_transactions')
      .insert(categoryId ? { ...mapped, category_id: categoryId } : mapped);
    if (error) counts.skipped++;
    else counts.new++;
  }

  return counts;
}

/**
 * Adds the vendor's learned category to a refresh when the row has no
 * category and the vendor changed. Never replaces an existing category.
 */
function withLearnedCategory(
  patch: BankDetailPatch,
  row: StoredTellerRow,
  learned: LearnedCategoryIndex,
  type: string,
): BankDetailPatch & { category_id?: string } {
  if (row.category_id || typeof patch.vendor !== 'string') return patch;
  const categoryId = lookupLearnedCategory(learned, patch.vendor, type);
  return categoryId ? { ...patch, category_id: categoryId } : patch;
}

/**
 * Updates one row only if the guard columns still hold the values read at the
 * start of the sync, so an edit made mid-sync is not overwritten. Returns true
 * when a row was updated.
 */
async function updateRow(
  db: SupabaseClient,
  id: string,
  values: BankDetailPatch & { teller_transaction_id?: string; category_id?: string },
  guard: Record<string, string>,
): Promise<boolean> {
  let q = db.from('financial_transactions').update(values).eq('id', id);
  for (const [column, value] of Object.entries(guard)) q = q.eq(column, value);
  const { data, error } = await q.select('id');
  return !error && (data?.length ?? 0) > 0;
}
