// lib/finance/reconciliation/server.ts
// Database reads and writes for reconciling accounts
// (app/api/finance/reconciliations/*), the reconciled-period guard on
// transactions, and the monthly audit card. The rules are in ./logic.ts.
//
// Callers pass a client and the signed-in user's id; every query is also
// scoped with .eq('user_id', userId), and the account is checked with
// lib/auth/ownership.ts before anything is read or written.
//
// account_reconciliations, financial_accounts.opening_balance_date and
// financial_transactions.cleared_at arrive with migration 221. Before it:
// reads answer ready: false (nothing is reconciled), and finishing or
// unreconciling throws RECONCILE_NOT_READY (503) before anything is written.
//
// Finishing writes, in order: the Cleared ticks of the period's transactions,
// the adjustment transaction or the new opening balance (when chosen), then
// the reconciliation row. When the last write fails, the adjustment is
// deleted again and the opening balance put back, so a failed finish never
// changes a balance. (Cleared ticks are kept: they change no balance.)
//
// Imports only sibling files with .ts extensions (and types), so the tests run
// it against the in-memory fake (tests/unit/reconciliation.test.ts).

import type { SupabaseClient } from '@supabase/supabase-js';
import { checkOwned } from '../../auth/ownership.ts';
import { isMissingColumn } from '../transfers/schema.ts';
import type { DbErrorLike } from '../transfers/schema.ts';
import { isDebtAccount, startingBalanceDate } from '../balance/logic.ts';
import type { BalanceAccount } from '../balance/logic.ts';
import { loadBalanceRows } from '../balance/server.ts';
import {
  RECONCILE_ADJUSTMENT_TAG,
  RECONCILE_NOT_READY,
  ReconcileRuleError,
  auditState,
  auditsAccount,
  compareWithStatement,
  coveringReconciliation,
  decideOutcome,
  fromCents,
  openingAfterChange,
  parseReconcileInput,
  pickStatement,
  planReconcileAdjustment,
  previousReconciled,
  reconciledThrough,
  startingFromStatement,
  toCents,
} from './logic.ts';
import type {
  AuditState,
  PeriodTransactionRow,
  ReconcileComparison,
  ReconcileResolution,
  ReconcileStatus,
  ReconciliationRow,
  StatementFactsRow,
} from './logic.ts';

export { ReconcileRuleError, RECONCILE_NOT_READY };

const PAGE_SIZE = 1000;
const ID_CHUNK = 100;

export const RECONCILIATION_SELECT =
  'id, account_id, statement_id, statement_date, statement_balance, computed_balance, difference, currency, ' +
  'status, resolution, adjustment_transaction_id, cleared_count, note, reconciled_at, created_at, updated_at';
const TX_SELECT = 'id, account_id, type, amount, transaction_date, description, vendor, tags, source, cleared_at';
const TX_SELECT_NO_CLEARED = 'id, account_id, type, amount, transaction_date, description, vendor, tags, source';
const STATEMENT_SELECT = 'id, period_start, period_end, previous_balance, new_balance';

/** The account columns these rules read. */
export interface ReconcileAccount extends BalanceAccount {
  id: string;
  name: string;
  institution_name: string | null;
  last_four: string | null;
  is_active: boolean;
  currency: string;
}

const notReady = () => new ReconcileRuleError(RECONCILE_NOT_READY.error, 503, RECONCILE_NOT_READY.code);
const fail = (message: string) => new ReconcileRuleError(message, 500);

/** True when an error says account_reconciliations doesn't exist yet (Postgres 42P01, PostgREST PGRST205). */
export function isReconcileTableMissing(error: DbErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.code !== '42P01' && error.code !== 'PGRST205') return false;
  return (error.message ?? '').includes('account_reconciliations');
}

/** True when an error says a migration-221 column is missing. */
export function isReconcileColumnMissing(error: DbErrorLike | null | undefined): boolean {
  return isMissingColumn(error, 'opening_balance_date') || isMissingColumn(error, 'cleared_at');
}

function toRow(raw: Record<string, unknown>): ReconciliationRow {
  return {
    id: String(raw.id),
    account_id: String(raw.account_id),
    statement_id: (raw.statement_id as string | null) ?? null,
    statement_date: String(raw.statement_date ?? '').slice(0, 10),
    statement_balance: Number(raw.statement_balance ?? 0),
    computed_balance: Number(raw.computed_balance ?? 0),
    difference: Number(raw.difference ?? 0),
    currency: (raw.currency as string | null) ?? null,
    status: raw.status === 'reconciled' ? 'reconciled' : 'open',
    resolution: (raw.resolution as ReconcileResolution | null) ?? null,
    adjustment_transaction_id: (raw.adjustment_transaction_id as string | null) ?? null,
    cleared_count: Number(raw.cleared_count ?? 0),
    note: (raw.note as string | null) ?? null,
    reconciled_at: (raw.reconciled_at as string | null) ?? null,
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
  };
}

function toAccount(raw: Record<string, unknown>): ReconcileAccount {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    account_type: String(raw.account_type ?? ''),
    institution_name: (raw.institution_name as string | null) ?? null,
    last_four: (raw.last_four as string | null) ?? null,
    is_active: raw.is_active !== false,
    opening_balance: (raw.opening_balance as number | string | null) ?? 0,
    opening_balance_date: typeof raw.opening_balance_date === 'string' ? raw.opening_balance_date.slice(0, 10) : null,
    currency: typeof raw.currency === 'string' && raw.currency ? raw.currency : 'USD',
  };
}

// ── Reads ─────────────────────────────────────────────────────────────────

/** Reconciliations of the given accounts (all of them when `accountIds` is null), every page. */
export async function loadReconciliations(
  db: SupabaseClient,
  userId: string,
  accountIds: readonly string[] | null,
): Promise<{ rows: ReconciliationRow[]; ready: boolean; error: DbErrorLike | null }> {
  const rows: ReconciliationRow[] = [];
  if (accountIds && accountIds.length === 0) return { rows, ready: true, error: null };
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = db.from('account_reconciliations').select(RECONCILIATION_SELECT).eq('user_id', userId);
    if (accountIds) query = query.in('account_id', [...accountIds]);
    const res = await query.order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (isReconcileTableMissing(res.error)) return { rows: [], ready: false, error: null };
    if (res.error) return { rows, ready: true, error: res.error };
    const page = ((res.data ?? []) as unknown as Record<string, unknown>[]).map(toRow);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, ready: true, error: null };
  }
}

export interface AccountReconcileStatus {
  /** The latest reconciled statement date, or null. */
  reconciled_through: string | null;
  /** The newest reconciliation by statement date (reconciled or open), or null. */
  latest: Pick<ReconciliationRow, 'id' | 'statement_date' | 'status' | 'difference' | 'reconciled_at'> | null;
}

/** Per account: reconciled through and the latest reconciliation. Empty (ready false) before migration 221. Never throws. */
export async function loadReconcileStatus(
  db: SupabaseClient,
  userId: string,
  accountIds: readonly string[],
): Promise<{ ready: boolean; byAccount: Map<string, AccountReconcileStatus> }> {
  const byAccount = new Map<string, AccountReconcileStatus>();
  const { rows, ready, error } = await loadReconciliations(db, userId, accountIds);
  if (!ready || error) return { ready, byAccount };
  const grouped = new Map<string, ReconciliationRow[]>();
  for (const r of rows) grouped.set(r.account_id, [...(grouped.get(r.account_id) ?? []), r]);
  for (const [accountId, list] of grouped) {
    const latest = [...list].sort((a, b) => (a.statement_date < b.statement_date ? 1 : -1))[0] ?? null;
    byAccount.set(accountId, {
      reconciled_through: reconciledThrough(list),
      latest: latest
        ? { id: latest.id, statement_date: latest.statement_date, status: latest.status, difference: latest.difference, reconciled_at: latest.reconciled_at }
        : null,
    });
  }
  return { ready, byAccount };
}

/** The caller's account, or ReconcileRuleError 404 (also for someone else's). */
export async function loadOwnedAccount(db: SupabaseClient, userId: string, accountId: string): Promise<ReconcileAccount> {
  const owned = await checkOwned(db, userId, 'financial_accounts', accountId);
  if (owned.failed) throw fail('Could not check the account.');
  if (!owned.allowed) throw new ReconcileRuleError('That account was not found.', 404);
  const res = await db.from('financial_accounts').select('*').eq('user_id', userId).eq('id', accountId).maybeSingle();
  if (res.error) throw fail(res.error.message ?? 'Could not load the account.');
  if (!res.data) throw new ReconcileRuleError('That account was not found.', 404);
  return toAccount(res.data as unknown as Record<string, unknown>);
}

/** Every transaction on the account with its Cleared state (none before migration 221). */
async function loadAccountTransactions(
  db: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<{ rows: PeriodTransactionRow[]; clearedReady: boolean }> {
  const first = await loadBalanceRows<PeriodTransactionRow & { account_id: string | null }>(db, userId, [accountId], TX_SELECT);
  if (!first.error) return { rows: first.rows, clearedReady: true };
  if (!isMissingColumn(first.error, 'cleared_at')) throw fail(first.error.message ?? 'Could not load the transactions.');
  const second = await loadBalanceRows<PeriodTransactionRow & { account_id: string | null }>(db, userId, [accountId], TX_SELECT_NO_CLEARED);
  if (second.error) throw fail(second.error.message ?? 'Could not load the transactions.');
  return { rows: second.rows, clearedReady: false };
}

/** The account's imported statements (migration 209), newest first; [] before it. */
async function loadStatements(db: SupabaseClient, userId: string, accountId: string): Promise<StatementFactsRow[]> {
  const res = await db
    .from('account_statements')
    .select(STATEMENT_SELECT)
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .order('period_end', { ascending: false })
    .limit(240);
  if (res.error) return [];
  return ((res.data ?? []) as unknown as Record<string, unknown>[]).map((s) => ({
    id: String(s.id),
    period_start: s.period_start ? String(s.period_start).slice(0, 10) : null,
    period_end: String(s.period_end ?? '').slice(0, 10),
    previous_balance: (s.previous_balance as number | string | null) ?? null,
    new_balance: (s.new_balance as number | string | null) ?? null,
  }));
}

export interface ReconcileView {
  /** Migration 221 is applied. */
  ready: boolean;
  account: ReconcileAccount & { is_debt: boolean };
  statements: StatementFactsRow[];
  /** What the form starts with: the chosen (or latest) imported statement's closing date and new balance. */
  suggested: { statement_id: string; statement_date: string; statement_balance: number } | null;
  /** A starting balance taken from the earliest imported statement. */
  starting_suggestion: ReturnType<typeof startingFromStatement>;
  reconciliations: ReconciliationRow[];
  reconciled_through: string | null;
  check:
    | (ReconcileComparison & {
        existing: ReconciliationRow | null;
        before_start: boolean;
        earlier_reconciled: boolean;
      })
    | null;
}

/**
 * Everything the Reconcile page shows. With `statementDate`, also the
 * comparison for that date (and `statementBalance` when given).
 */
export async function loadReconcileView(
  db: SupabaseClient,
  userId: string,
  accountId: string,
  options: { statementDate?: string | null; statementBalance?: number | null; statementPeriodEnd?: string | null } = {},
): Promise<ReconcileView> {
  const account = await loadOwnedAccount(db, userId, accountId);
  const [recs, tx, statements] = await Promise.all([
    loadReconciliations(db, userId, [accountId]),
    loadAccountTransactions(db, userId, accountId),
    loadStatements(db, userId, accountId),
  ]);
  if (recs.error) throw fail(recs.error.message ?? 'Could not load the reconciliations.');
  const picked = pickStatement(statements, options.statementPeriodEnd ?? null);
  const reconciliations = [...recs.rows].sort((a, b) => (a.statement_date < b.statement_date ? 1 : -1));

  let check: ReconcileView['check'] = null;
  if (options.statementDate) {
    const comparison = compareWithStatement(account, tx.rows, reconciliations, options.statementDate, options.statementBalance ?? null);
    const start = startingBalanceDate(account);
    check = {
      ...comparison,
      existing: reconciliations.find((r) => r.statement_date === options.statementDate) ?? null,
      before_start: !!start && options.statementDate < start,
      earlier_reconciled: !!previousReconciled(reconciliations, options.statementDate),
    };
  }

  return {
    ready: recs.ready && tx.clearedReady,
    account: { ...account, is_debt: isDebtAccount(account.account_type) },
    statements,
    suggested: picked
      ? { statement_id: picked.id, statement_date: picked.period_end, statement_balance: fromCents(toCents(picked.new_balance)) }
      : null,
    starting_suggestion: startingFromStatement(statements),
    reconciliations,
    reconciled_through: reconciledThrough(reconciliations),
    check,
  };
}

// ── Finishing ─────────────────────────────────────────────────────────────

/** The FX columns for the adjustment on a foreign-currency account ({} for the home currency). */
export type FxFieldsFor = (currency: string, amount: number, date: string) => Promise<Record<string, unknown>>;

export interface FinishResult {
  reconciliation: ReconciliationRow;
  adjustment: { id: string; type: 'income' | 'expense'; amount: number } | null;
  starting_balance: { before: number; after: number } | null;
  cleared: { marked: number; unmarked: number };
}

async function updateCleared(
  db: SupabaseClient,
  userId: string,
  accountId: string,
  ids: readonly string[],
  value: string | null,
): Promise<number> {
  let changed = 0;
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const group = ids.slice(i, i + ID_CHUNK);
    const res = await db
      .from('financial_transactions')
      .update({ cleared_at: value })
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .in('id', group)
      .select('id');
    if (res.error) {
      if (isMissingColumn(res.error, 'cleared_at')) throw notReady();
      throw fail(`Couldn't save the Cleared ticks: ${res.error.message}`);
    }
    changed += ((res.data ?? []) as unknown[]).length;
  }
  return changed;
}

/**
 * Finishes a reconciliation (see the top of this file and the rules in
 * ./logic.ts). `today` bounds the statement date; `now` stamps cleared_at and
 * reconciled_at. Throws ReconcileRuleError for anything the person can fix,
 * and 503 / RECONCILE_NOT_READY before migration 221.
 */
export async function finishReconciliation(
  db: SupabaseClient,
  userId: string,
  body: unknown,
  today: string,
  fxFieldsFor: FxFieldsFor = async () => ({}),
  now: () => string = () => new Date().toISOString(),
): Promise<FinishResult> {
  const input = parseReconcileInput(body, today);
  const account = await loadOwnedAccount(db, userId, input.accountId);

  const recs = await loadReconciliations(db, userId, [account.id]);
  if (!recs.ready) throw notReady();
  if (recs.error) throw fail(recs.error.message ?? 'Could not load the reconciliations.');
  const tx = await loadAccountTransactions(db, userId, account.id);
  if (!tx.clearedReady) throw notReady();

  const start = startingBalanceDate(account);
  if (start && input.statementDate < start) {
    throw new ReconcileRuleError(
      `That date is before this account's starting balance date (${start}). Pick a later statement, or change the starting balance.`,
    );
  }

  const ticked = new Set(input.clearedIds);
  const comparison = compareWithStatement(account, tx.rows, recs.rows, input.statementDate, fromCents(input.statementCents), ticked);
  const differenceCents = toCents(comparison.difference);
  const earlier = previousReconciled(recs.rows, input.statementDate);
  const outcome = decideOutcome(differenceCents, input.choice, { earlierReconciled: !!earlier });

  // The imported statement it came from, only when it is this account's.
  let statementId: string | null = null;
  if (input.statementId) {
    const st = await db
      .from('account_statements')
      .select('id')
      .eq('user_id', userId)
      .eq('account_id', account.id)
      .eq('id', input.statementId)
      .maybeSingle();
    if (!st.error && st.data) statementId = input.statementId;
  }

  // 1. Cleared ticks: only the period's own transactions, and only those that change.
  const stamp = now();
  const periodIds = new Set(comparison.transactions.map((t) => t.id));
  const savedCleared = new Map(tx.rows.map((r) => [r.id, !!r.cleared_at]));
  const toMark = [...periodIds].filter((id) => ticked.has(id) && !savedCleared.get(id));
  const toUnmark = [...periodIds].filter((id) => !ticked.has(id) && savedCleared.get(id));
  const marked = await updateCleared(db, userId, account.id, toMark, stamp);
  const unmarked = await updateCleared(db, userId, account.id, toUnmark, null);

  // 2. The adjustment, or the new starting balance.
  let adjustment: FinishResult['adjustment'] = null;
  let startingChange: FinishResult['starting_balance'] = null;
  if (outcome.resolution === 'adjustment') {
    const plan = planReconcileAdjustment(account.account_type, differenceCents)!;
    const amount = fromCents(plan.amountCents);
    const fx = await fxFieldsFor(account.currency, amount, input.statementDate).catch(() => ({}));
    const inserted = await db
      .from('financial_transactions')
      .insert({
        ...fx,
        user_id: userId,
        account_id: account.id,
        amount,
        type: plan.type,
        description: plan.description,
        vendor: null,
        transaction_date: input.statementDate,
        category_id: null,
        tags: [RECONCILE_ADJUSTMENT_TAG],
        notes:
          `Reconciling to the statement of ${input.statementDate}: statement ${fromCents(input.statementCents).toFixed(2)}, ` +
          `recorded ${comparison.computed_balance.toFixed(2)} ${account.currency}` +
          (isDebtAccount(account.account_type) ? ' (amounts owed).' : '.'),
        source: 'manual',
        cleared_at: stamp,
      })
      .select('id');
    const id = ((inserted.data ?? []) as { id: string }[])[0]?.id ?? null;
    if (inserted.error || !id) {
      if (isMissingColumn(inserted.error, 'cleared_at')) throw notReady();
      throw fail(`Couldn't record the adjustment: ${inserted.error?.message ?? 'nothing was saved.'}`);
    }
    adjustment = { id, type: plan.type, amount };
  } else if (outcome.resolution === 'starting_balance') {
    const before = fromCents(toCents(account.opening_balance));
    const after = fromCents(openingAfterChange(account.opening_balance, differenceCents));
    const updated = await db
      .from('financial_accounts')
      .update({ opening_balance: after })
      .eq('user_id', userId)
      .eq('id', account.id)
      .select('id');
    if (updated.error || ((updated.data ?? []) as unknown[]).length === 0) {
      throw fail(`Couldn't change the starting balance: ${updated.error?.message ?? 'nothing was saved.'}`);
    }
    startingChange = { before, after };
  }

  // 3. The reconciliation row: one per account and statement date.
  const existing = recs.rows.find((r) => r.statement_date === input.statementDate) ?? null;
  const fields = {
    statement_id: statementId ?? existing?.statement_id ?? null,
    statement_balance: fromCents(input.statementCents),
    computed_balance: comparison.computed_balance,
    difference: comparison.difference,
    currency: account.currency,
    status: outcome.status as ReconcileStatus,
    resolution: outcome.resolution,
    adjustment_transaction_id: adjustment?.id ?? existing?.adjustment_transaction_id ?? null,
    cleared_count: comparison.cleared_count,
    note: input.note ?? existing?.note ?? null,
    reconciled_at: outcome.status === 'reconciled' ? stamp : null,
    updated_at: stamp,
  };
  const saved = existing
    ? await db
        .from('account_reconciliations')
        .update(fields)
        .eq('user_id', userId)
        .eq('id', existing.id)
        .select(RECONCILIATION_SELECT)
    : await db
        .from('account_reconciliations')
        .insert({ user_id: userId, account_id: account.id, statement_date: input.statementDate, ...fields })
        .select(RECONCILIATION_SELECT);
  const row = ((saved.data ?? []) as unknown as Record<string, unknown>[])[0];
  if (saved.error || !row) {
    // Never leave an adjustment or a moved starting balance without its reconciliation.
    if (adjustment) await db.from('financial_transactions').delete().eq('user_id', userId).eq('id', adjustment.id);
    if (startingChange) {
      await db.from('financial_accounts').update({ opening_balance: startingChange.before }).eq('user_id', userId).eq('id', account.id);
    }
    if (isReconcileTableMissing(saved.error)) throw notReady();
    throw fail(`Couldn't save the reconciliation: ${saved.error?.message ?? 'nothing was saved.'}`);
  }

  return {
    reconciliation: toRow(row),
    adjustment,
    starting_balance: startingChange,
    cleared: { marked, unmarked },
  };
}

// ── Unreconcile ───────────────────────────────────────────────────────────

/**
 * Marks a reconciliation open again. With `removeAdjustment`, its adjustment
 * transaction (when it is still on the account and still tagged) is deleted
 * too. A starting-balance change is not undone: edit the account for that.
 */
export async function unreconcile(
  db: SupabaseClient,
  userId: string,
  reconciliationId: string,
  options: { removeAdjustment?: boolean } = {},
  now: () => string = () => new Date().toISOString(),
): Promise<{ reconciliation: ReconciliationRow; adjustment_deleted: boolean }> {
  const found = await db
    .from('account_reconciliations')
    .select(RECONCILIATION_SELECT)
    .eq('user_id', userId)
    .eq('id', reconciliationId)
    .maybeSingle();
  if (isReconcileTableMissing(found.error)) throw notReady();
  if (found.error) throw fail(found.error.message ?? 'Could not load the reconciliation.');
  if (!found.data) throw new ReconcileRuleError('That reconciliation was not found.', 404);
  const rec = toRow(found.data as unknown as Record<string, unknown>);

  let adjustmentDeleted = false;
  if (options.removeAdjustment && rec.adjustment_transaction_id) {
    const adj = await db
      .from('financial_transactions')
      .select('id, tags')
      .eq('user_id', userId)
      .eq('account_id', rec.account_id)
      .eq('id', rec.adjustment_transaction_id)
      .maybeSingle();
    if (adj.error) throw fail(adj.error.message ?? 'Could not load the adjustment.');
    const tags = (adj.data as { tags?: string[] | null } | null)?.tags ?? [];
    if (adj.data && Array.isArray(tags) && tags.includes(RECONCILE_ADJUSTMENT_TAG)) {
      const removed = await db
        .from('financial_transactions')
        .delete()
        .eq('user_id', userId)
        .eq('id', rec.adjustment_transaction_id)
        .select('id');
      if (removed.error) throw fail(`Couldn't delete the adjustment: ${removed.error.message}`);
      adjustmentDeleted = ((removed.data ?? []) as unknown[]).length > 0;
    }
  }

  const updated = await db
    .from('account_reconciliations')
    .update({
      status: 'open',
      reconciled_at: null,
      updated_at: now(),
      ...(adjustmentDeleted ? { adjustment_transaction_id: null, resolution: 'left_open' } : {}),
    })
    .eq('user_id', userId)
    .eq('id', rec.id)
    .select(RECONCILIATION_SELECT);
  const row = ((updated.data ?? []) as unknown as Record<string, unknown>[])[0];
  if (updated.error || !row) throw fail(`Couldn't unreconcile: ${updated.error?.message ?? 'nothing was saved.'}`);
  return { reconciliation: toRow(row), adjustment_deleted: adjustmentDeleted };
}

// ── The guard on transactions ─────────────────────────────────────────────

export interface ReconciledPeriodFlag {
  /** The reconciled statement date whose period holds the transaction. */
  statement_date: string;
  reconciliation_id: string;
}

interface TxPlace {
  account_id?: string | null;
  transaction_date?: string | null;
}

/**
 * For each transaction (account + date), the reconciled statement whose
 * period holds it, or null. Answers all-null before migration 221 and when a
 * lookup fails: the guard is a warning, it must never break a list.
 */
export async function reconciledPeriods(
  db: SupabaseClient,
  userId: string,
  places: readonly TxPlace[],
): Promise<(ReconciledPeriodFlag | null)[]> {
  const none = places.map(() => null);
  const accountIds = [...new Set(places.map((p) => p.account_id).filter((id): id is string => typeof id === 'string' && !!id))];
  if (accountIds.length === 0) return none;
  const recs = await loadReconciliations(db, userId, accountIds);
  if (!recs.ready || recs.error) return none;
  const reconciled = recs.rows.filter((r) => r.status === 'reconciled');
  if (reconciled.length === 0) return none;
  const accRes = await db
    .from('financial_accounts')
    .select('id, opening_balance_date')
    .eq('user_id', userId)
    .in('id', [...new Set(reconciled.map((r) => r.account_id))]);
  if (accRes.error) return none;
  const starts = new Map(
    ((accRes.data ?? []) as { id: string; opening_balance_date: string | null }[]).map((a) => [a.id, a.opening_balance_date ?? null]),
  );
  return places.map((p) => {
    if (!p.account_id || !p.transaction_date || !starts.has(p.account_id)) return null;
    const own = reconciled.filter((r) => r.account_id === p.account_id);
    const hit = coveringReconciliation({ opening_balance_date: starts.get(p.account_id) ?? null }, p.transaction_date, own);
    return hit ? { statement_date: hit.statement_date, reconciliation_id: hit.id } : null;
  });
}

/** Adds `reconciled_period` (ReconciledPeriodFlag or null) to each transaction row, in place. */
export async function annotateReconciled<T extends TxPlace & Record<string, unknown>>(
  db: SupabaseClient,
  userId: string,
  rows: T[],
): Promise<T[]> {
  const flags = await reconciledPeriods(db, userId, rows);
  rows.forEach((row, i) => {
    (row as Record<string, unknown>).reconciled_period = flags[i];
  });
  return rows;
}

// ── Monthly audit ─────────────────────────────────────────────────────────

export interface AuditAccount {
  id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  last_four: string | null;
  currency: string;
  state: AuditState;
  /** Days since the reconciled-through date (null when never reconciled). */
  days: number | null;
  reconciled_through: string | null;
  /** The newest reconciliation when it is still open, with its difference. */
  open: { statement_date: string; difference: number } | null;
}

/**
 * Active non-cash accounts with how recently they were reconciled. `due` is
 * the ones the card lists: never reconciled or more than 30 days ago, or with
 * an open reconciliation. ready false before migration 221.
 */
export async function loadReconcileAudit(
  db: SupabaseClient,
  userId: string,
  today: string,
): Promise<{ ready: boolean; accounts: AuditAccount[]; due: AuditAccount[] }> {
  const accRes = await db.from('financial_accounts').select('*').eq('user_id', userId).order('created_at', { ascending: true });
  if (accRes.error) throw fail(accRes.error.message ?? 'Could not load the accounts.');
  const accounts = ((accRes.data ?? []) as unknown as Record<string, unknown>[])
    .map(toAccount)
    .filter((a) => auditsAccount(a));
  const status = await loadReconcileStatus(db, userId, accounts.map((a) => a.id));
  const views = accounts.map((a): AuditAccount => {
    const s = status.byAccount.get(a.id) ?? null;
    const audit = auditState(s?.reconciled_through ?? null, today);
    const latest = s?.latest ?? null;
    return {
      id: a.id,
      name: a.name,
      account_type: a.account_type,
      institution_name: a.institution_name,
      last_four: a.last_four,
      currency: a.currency,
      state: audit.state,
      days: audit.days,
      reconciled_through: s?.reconciled_through ?? null,
      open: latest && latest.status === 'open' ? { statement_date: latest.statement_date, difference: latest.difference } : null,
    };
  });
  const due = views
    .filter((v) => v.state !== 'fresh' || v.open)
    .sort((a, b) => (b.days ?? Number.MAX_SAFE_INTEGER) - (a.days ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name));
  return { ready: status.ready, accounts: views, due };
}
