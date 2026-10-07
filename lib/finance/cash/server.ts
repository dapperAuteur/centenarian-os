// lib/finance/cash/server.ts
// Database reads and writes for cash on hand (app/api/finance/cash/*): the
// cash accounts with their balances and last count, counting cash, the count
// history, and undoing the latest count.
//
// Callers pass the RLS session client and the signed-in user's id; every query
// is also scoped with `.eq('user_id', userId)`. The rules live in ./logic.ts.
//
// cash_counts arrives with migration 213. Before it is applied the overview
// still lists cash accounts (with no counts), and counting answers 503 with
// CASH_NOT_READY before anything is written.
//
// A count writes two rows: the adjustment transaction (when the count differs
// from the recorded balance) and the cash_counts row that points at it. When
// the second insert fails the first is deleted again, so a failed count never
// changes a balance. Undo deletes the adjustment, then the count.
//
// Imports only sibling files with .ts extensions (and types), so the tests run
// it against the in-memory fake (tests/unit/cash.test.ts).

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingTable } from '../budgets/server.ts';
import { fromCents } from '../savings/logic.ts';
import { loadBalanceRows, signedBalancesCents } from '../balance/server.ts';
import type { DbErrorLike } from '../transfers/schema.ts';
import {
  CASH_COUNT_TAG,
  CashRuleError,
  countFreshness,
  parseCountInput,
  planAdjustment,
} from './logic.ts';
import type { CountFreshness } from './logic.ts';
import type { DenominationCounts } from './denominations.ts';

export { CashRuleError };

export const CASH_NOT_READY = {
  error:
    'Counting cash needs a database update first: run migration 213 (supabase/migrations/213_cash_counts.sql). ' +
    'Nothing was changed.',
  code: 'cash_counts_not_migrated',
} as const;

const PAGE_SIZE = 1000;

export const COUNT_SELECT =
  'id, account_id, counted_amount, recorded_balance, difference, currency, denominations, ' +
  'adjustment_transaction_id, category_id, note, counted_on, counted_at';

export interface CashAccountRow {
  id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  last_four: string | null;
  opening_balance: number | string | null;
  /** Migration 221: the day the opening balance is as of; null before it. */
  opening_balance_date: string | null;
  is_active: boolean;
  /** Migration 210; USD before it. */
  currency: string;
}

export interface CashCountRow {
  id: string;
  account_id: string;
  counted_amount: number;
  recorded_balance: number;
  difference: number;
  currency: string | null;
  denominations: DenominationCounts | null;
  adjustment_transaction_id: string | null;
  category_id: string | null;
  note: string | null;
  counted_on: string;
  counted_at: string;
}

export interface CashAccountView extends CashAccountRow {
  /** Recorded balance in the account's currency. */
  balance: number;
  last_count: CashCountRow | null;
  count_status: CountFreshness;
  days_since_count: number | null;
}

export interface CashOverview {
  /** False until migration 213: counts can't be saved, every account reads "never counted". */
  ready: boolean;
  accounts: CashAccountView[];
  /** The cash account most recently used (latest transaction), for forms to start on. */
  last_used_account_id: string | null;
}

function toCountRow(row: Record<string, unknown>): CashCountRow {
  return {
    id: String(row.id),
    account_id: String(row.account_id),
    counted_amount: Number(row.counted_amount),
    recorded_balance: Number(row.recorded_balance),
    difference: Number(row.difference),
    currency: (row.currency as string | null) ?? null,
    denominations: (row.denominations as DenominationCounts | null) ?? null,
    adjustment_transaction_id: (row.adjustment_transaction_id as string | null) ?? null,
    category_id: (row.category_id as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    counted_on: String(row.counted_on ?? ''),
    counted_at: String(row.counted_at ?? ''),
  };
}

// ── Reads ─────────────────────────────────────────────────────────────────

/**
 * The user's cash accounts (active only unless asked), oldest first. Selects '*', so it works
 * before migration 210 (no currency: USD) and 221 (no opening_balance_date: every transaction counts).
 */
export async function loadCashAccounts(
  db: SupabaseClient,
  userId: string,
  options: { includeInactive?: boolean; ids?: readonly string[] } = {},
): Promise<{ accounts: CashAccountRow[]; error: DbErrorLike | null }> {
  let query = db.from('financial_accounts').select('*').eq('user_id', userId).eq('account_type', 'cash');
  if (!options.includeInactive) query = query.eq('is_active', true);
  if (options.ids) query = query.in('id', [...options.ids]);
  const res = await query.order('created_at', { ascending: true });
  if (res.error) return { accounts: [], error: res.error };
  const accounts = ((res.data ?? []) as unknown as Record<string, unknown>[]).map((row): CashAccountRow => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    account_type: String(row.account_type ?? 'cash'),
    institution_name: (row.institution_name as string | null) ?? null,
    last_four: (row.last_four as string | null) ?? null,
    opening_balance: (row.opening_balance as number | string | null) ?? 0,
    opening_balance_date: typeof row.opening_balance_date === 'string' ? row.opening_balance_date : null,
    is_active: row.is_active !== false,
    currency: typeof row.currency === 'string' && row.currency ? row.currency : 'USD',
  }));
  return { accounts, error: null };
}

/** Recorded balance of each account, in cents (every page of its transactions; lib/finance/balance). */
export async function loadBalancesCents(
  db: SupabaseClient,
  userId: string,
  accounts: readonly Pick<CashAccountRow, 'id' | 'account_type' | 'opening_balance' | 'opening_balance_date'>[],
): Promise<{ balances: Map<string, number>; error: DbErrorLike | null }> {
  if (accounts.length === 0) return { balances: new Map(), error: null };
  const { rows, error } = await loadBalanceRows(db, userId, accounts.map((a) => a.id));
  if (error) return { balances: new Map(), error };
  return { balances: signedBalancesCents(accounts, rows), error: null };
}

/** True once migration 213 is applied (cash_counts answers a query). */
export async function cashCountsReady(db: SupabaseClient, userId: string): Promise<{ ready: boolean; error: DbErrorLike | null }> {
  const res = await db.from('cash_counts').select('id').eq('user_id', userId).limit(1);
  if (isMissingTable(res.error, 'cash_counts')) return { ready: false, error: null };
  if (res.error) return { ready: true, error: res.error };
  return { ready: true, error: null };
}

/** The latest count of each account (by counted_at). */
async function loadLatestCounts(
  db: SupabaseClient,
  userId: string,
  accountIds: readonly string[],
): Promise<{ latest: Map<string, CashCountRow>; ready: boolean; error: DbErrorLike | null }> {
  const latest = new Map<string, CashCountRow>();
  if (accountIds.length === 0) return { latest, ready: true, error: null };
  const res = await db
    .from('cash_counts')
    .select(COUNT_SELECT)
    .eq('user_id', userId)
    .in('account_id', [...accountIds])
    .order('counted_at', { ascending: false })
    .range(0, PAGE_SIZE - 1);
  if (isMissingTable(res.error, 'cash_counts')) return { latest, ready: false, error: null };
  if (res.error) return { latest, ready: true, error: res.error };
  for (const raw of (res.data ?? []) as unknown as Record<string, unknown>[]) {
    const row = toCountRow(raw);
    if (!latest.has(row.account_id)) latest.set(row.account_id, row);
  }
  return { latest, ready: true, error: null };
}

/** The cash account with the most recent transaction (by when it was entered), or null. */
export async function lastUsedCashAccount(
  db: SupabaseClient,
  userId: string,
  accountIds: readonly string[],
): Promise<string | null> {
  if (accountIds.length === 0) return null;
  const res = await db
    .from('financial_transactions')
    .select('account_id, created_at')
    .eq('user_id', userId)
    .in('account_id', [...accountIds])
    .order('created_at', { ascending: false })
    .limit(1);
  if (res.error) return null;
  return ((res.data ?? []) as { account_id: string | null }[])[0]?.account_id ?? null;
}

/** Every active cash account with its balance and last count, and the last used one. */
export async function loadCashOverview(
  db: SupabaseClient,
  userId: string,
  today: string,
): Promise<{ overview: CashOverview | null; error: DbErrorLike | null }> {
  const { accounts, error } = await loadCashAccounts(db, userId);
  if (error) return { overview: null, error };
  const ids = accounts.map((a) => a.id);
  const [balances, counts, lastUsed] = await Promise.all([
    loadBalancesCents(db, userId, accounts),
    loadLatestCounts(db, userId, ids),
    lastUsedCashAccount(db, userId, ids),
  ]);
  if (balances.error) return { overview: null, error: balances.error };
  if (counts.error) return { overview: null, error: counts.error };
  const views = accounts.map((account): CashAccountView => {
    const last = counts.latest.get(account.id) ?? null;
    const fresh = countFreshness(last?.counted_on || last?.counted_at || null, today);
    return {
      ...account,
      balance: fromCents(balances.balances.get(account.id) ?? 0),
      last_count: last,
      count_status: fresh.status,
      days_since_count: fresh.days,
    };
  });
  return { overview: { ready: counts.ready, accounts: views, last_used_account_id: lastUsed }, error: null };
}

/** One account's counts, newest first. */
export async function listCounts(
  db: SupabaseClient,
  userId: string,
  accountId: string,
  limit = 50,
): Promise<{ counts: CashCountRow[]; ready: boolean; error: DbErrorLike | null }> {
  const res = await db
    .from('cash_counts')
    .select(COUNT_SELECT)
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .order('counted_at', { ascending: false })
    .limit(limit);
  if (isMissingTable(res.error, 'cash_counts')) return { counts: [], ready: false, error: null };
  if (res.error) return { counts: [], ready: true, error: res.error };
  return { counts: ((res.data ?? []) as unknown as Record<string, unknown>[]).map(toCountRow), ready: true, error: null };
}

// ── Writes ────────────────────────────────────────────────────────────────

/** The FX columns for the adjustment on a foreign-currency account ({} for the home currency). */
export type FxFieldsFor = (currency: string, amount: number, date: string) => Promise<Record<string, unknown>>;

export interface RecordedCount {
  count: CashCountRow;
  /** The adjustment transaction's id, or null when the count matched. */
  adjustment_transaction_id: string | null;
  adjustment: { type: 'expense' | 'income'; amount: number; description: string } | null;
}

const fail = (message: string, status = 500, code?: string) => new CashRuleError(message, status, code);

/**
 * Records a count (see the top of this file). `today` dates the adjustment
 * when the request has no counted_on. Throws CashRuleError for anything the
 * person can fix, and with status 503 / CASH_NOT_READY before migration 213.
 */
export async function recordCashCount(
  db: SupabaseClient,
  userId: string,
  body: unknown,
  today: string,
  fxFieldsFor: FxFieldsFor = async () => ({}),
): Promise<RecordedCount> {
  const rawId = typeof (body as { account_id?: unknown } | null)?.account_id === 'string'
    ? ((body as { account_id: string }).account_id).trim()
    : '';
  if (!rawId) throw new CashRuleError('Choose the cash account you counted.');

  const { accounts, error: accountError } = await loadCashAccounts(db, userId, { includeInactive: true, ids: [rawId] });
  if (accountError) throw fail(accountError.message ?? 'Could not load the account.');
  const account = accounts[0];
  if (!account) throw new CashRuleError('That cash account was not found.', 404);
  if (!account.is_active) throw new CashRuleError(`"${account.name}" is inactive. Reactivate it to count it.`);

  const input = parseCountInput(body, account.currency, today);

  const probe = await cashCountsReady(db, userId);
  if (probe.error) throw fail(probe.error.message ?? 'Could not save the count.');
  if (!probe.ready) throw new CashRuleError(CASH_NOT_READY.error, 503, CASH_NOT_READY.code);

  if (input.categoryId) {
    const cat = await db
      .from('budget_categories')
      .select('id')
      .eq('user_id', userId)
      .eq('id', input.categoryId)
      .maybeSingle();
    if (cat.error) throw fail(cat.error.message ?? 'Could not check the category.');
    if (!cat.data) throw new CashRuleError('That category was not found. Choose another one.');
  }

  const { balances, error: balanceError } = await loadBalancesCents(db, userId, [account]);
  if (balanceError) throw fail(balanceError.message ?? 'Could not work out the balance.');
  const recordedCents = balances.get(account.id) ?? 0;
  const { differenceCents, adjustment } = planAdjustment(recordedCents, input.countedCents);

  let adjustmentId: string | null = null;
  if (adjustment) {
    const amount = fromCents(adjustment.amountCents);
    const fx = await fxFieldsFor(account.currency, amount, input.countedOn).catch(() => ({}));
    const inserted = await db
      .from('financial_transactions')
      .insert({
        ...fx,
        user_id: userId,
        account_id: account.id,
        amount,
        type: adjustment.type,
        description: adjustment.description,
        vendor: null,
        transaction_date: input.countedOn,
        category_id: input.categoryId,
        tags: [CASH_COUNT_TAG],
        notes: `Cash count: counted ${fromCents(input.countedCents).toFixed(2)}, recorded ${fromCents(recordedCents).toFixed(2)} ${account.currency}.`,
        source: 'manual',
      })
      .select('id');
    adjustmentId = ((inserted.data ?? []) as { id: string }[])[0]?.id ?? null;
    if (inserted.error || !adjustmentId) {
      throw fail(`Couldn't record the adjustment: ${inserted.error?.message ?? 'nothing was saved.'}`);
    }
  }

  const saved = await db
    .from('cash_counts')
    .insert({
      user_id: userId,
      account_id: account.id,
      counted_amount: fromCents(input.countedCents),
      recorded_balance: fromCents(recordedCents),
      difference: fromCents(differenceCents),
      currency: account.currency,
      denominations: input.denominations,
      adjustment_transaction_id: adjustmentId,
      category_id: input.categoryId,
      note: input.note,
      counted_on: input.countedOn,
    })
    .select(COUNT_SELECT);
  const countRow = ((saved.data ?? []) as unknown as Record<string, unknown>[])[0];
  if (saved.error || !countRow) {
    // Never leave an adjustment without its count.
    if (adjustmentId) {
      await db.from('financial_transactions').delete().eq('user_id', userId).eq('id', adjustmentId);
    }
    if (isMissingTable(saved.error, 'cash_counts')) {
      throw new CashRuleError(CASH_NOT_READY.error, 503, CASH_NOT_READY.code);
    }
    throw fail(`Couldn't save the count: ${saved.error?.message ?? 'nothing was saved.'}`);
  }

  return {
    count: toCountRow(countRow),
    adjustment_transaction_id: adjustmentId,
    adjustment: adjustment
      ? { type: adjustment.type, amount: fromCents(adjustment.amountCents), description: adjustment.description }
      : null,
  };
}

/**
 * Undoes a count: only the latest count of its account (an older one was the
 * starting point of the counts after it). Deletes its adjustment transaction
 * (when it is still on that account), then the count.
 */
export async function undoLatestCount(
  db: SupabaseClient,
  userId: string,
  countId: string,
): Promise<{ count: CashCountRow; adjustmentDeleted: boolean }> {
  const found = await db.from('cash_counts').select(COUNT_SELECT).eq('user_id', userId).eq('id', countId).maybeSingle();
  if (isMissingTable(found.error, 'cash_counts')) throw new CashRuleError(CASH_NOT_READY.error, 503, CASH_NOT_READY.code);
  if (found.error) throw fail(found.error.message ?? 'Could not load the count.');
  if (!found.data) throw new CashRuleError('That count was not found.', 404);
  const count = toCountRow(found.data as unknown as Record<string, unknown>);

  const { counts, error: listError } = await listCounts(db, userId, count.account_id, 1);
  if (listError) throw fail(listError.message ?? 'Could not load the counts.');
  if (counts[0]?.id !== count.id) {
    throw new CashRuleError('Only the latest count of an account can be undone.', 409, 'not_latest');
  }

  let adjustmentDeleted = false;
  if (count.adjustment_transaction_id) {
    const removed = await db
      .from('financial_transactions')
      .delete()
      .eq('user_id', userId)
      .eq('id', count.adjustment_transaction_id)
      .eq('account_id', count.account_id)
      .select('id');
    if (removed.error) throw fail(`Couldn't delete the adjustment: ${removed.error.message}`);
    adjustmentDeleted = ((removed.data ?? []) as unknown[]).length > 0;
  }

  const deleted = await db.from('cash_counts').delete().eq('user_id', userId).eq('id', count.id);
  if (deleted.error) throw fail(`Couldn't delete the count: ${deleted.error.message}`);
  return { count, adjustmentDeleted };
}
