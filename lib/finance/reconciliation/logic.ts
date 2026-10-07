// lib/finance/reconciliation/logic.ts
// Rules for reconciling an account to a bank or card statement (plans/63 C).
// Pure: no React, no network. The database side is ./server.ts. Balances come
// from the one balance rule in ../balance/logic.ts.
//
// RULES (the help articles "How do I reconcile an account each month?" and
// "My account doesn't match the statement: what now?" say the same in plain
// words)
//
//   Balances are in statement terms: money in the account for checking,
//   savings and cash; money OWED for credit cards and loans (positive = owed,
//   negative = a credit balance). That is how statements print them, so the
//   person types the statement's number as it is.
//
//   Computed balance on a statement date = the balance rule counting only
//   transactions dated on or before that date (and after the starting-balance
//   date, when there is one).
//
//   Difference = statement balance - computed balance.
//
//   The statement's period = the days after the previous reconciled statement
//   date (or after the starting-balance date, whichever is later; from the very
//   first transaction when there is neither) through the statement date. Its
//   transactions are listed with Cleared checkboxes.
//
//   Finishing:
//     - difference 0  -> reconciled ('matched').
//     - otherwise the person chooses:
//         'adjustment'        one transaction dated on the statement date, tag
//                             reconcile-adjustment, that closes the gap:
//                               checking/savings/cash: more on the statement ->
//                                 income, less -> expense;
//                               card/loan: more owed on the statement ->
//                                 expense (a charge), less owed -> income (a
//                                 credit). Then reconciled.
//         'starting_balance'  the opening balance moves by the difference (in
//                             statement terms both are the same kind of number,
//                             so opening + difference). Refused when an earlier
//                             statement is reconciled, because it would move
//                             that one too. Then reconciled.
//         'left_open'         nothing changes; the record stays open with its
//                             difference.
//
//   Reconciled through = the latest statement date with status 'reconciled'.
//
//   Guard: a transaction is "inside a reconciled period" when it counts toward
//   the balance (after the starting-balance date) and is dated on or before a
//   reconciled statement date of its account. The warning names the earliest
//   such statement date (the statement whose period holds it).
//
//   Monthly audit: an account whose reconciled-through date is more than
//   RECONCILE_STALE_DAYS days ago, or that was never reconciled, is shown in
//   amber. Cash accounts are left out: counting cash is their check.
//
// Relative imports end in `.ts` for `node --test --experimental-strip-types`
// (tests/unit/reconciliation.test.ts).

import { countsInBalance, isDebtAccount, startingBalanceDate, statementBalanceCents } from '../balance/logic.ts';
import type { BalanceAccount, BalanceRow } from '../balance/logic.ts';

export const RECONCILE_ADJUSTMENT_TAG = 'reconcile-adjustment';
export const RECONCILE_ADJUSTMENT_DESCRIPTION = 'Reconciliation adjustment';

/** A reconciled-through date older than this many days is shown in amber. */
export const RECONCILE_STALE_DAYS = 30;

/** numeric(12,2) */
const MAX_CENTS = 999_999_999_999;
/** Most Cleared ticks one request may send. */
export const MAX_CLEARED_IDS = 5000;

export const RECONCILE_NOT_READY = {
  error:
    'Reconciling needs a database update first: run migration 221 (supabase/migrations/221_account_reconciliation.sql). ' +
    'Nothing was changed.',
  startingDateError:
    'A starting balance date needs a database update first: run migration 221 ' +
    '(supabase/migrations/221_account_reconciliation.sql). Nothing was changed.',
  code: 'reconcile_not_migrated',
} as const;

export class ReconcileRuleError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type ReconcileStatus = 'reconciled' | 'open';
export type ReconcileResolution = 'matched' | 'adjustment' | 'starting_balance' | 'left_open';
export type DifferenceChoice = 'adjustment' | 'starting_balance' | 'left_open';
export const DIFFERENCE_CHOICES: readonly DifferenceChoice[] = ['adjustment', 'starting_balance', 'left_open'];

export interface ReconciliationRow {
  id: string;
  account_id: string;
  statement_id: string | null;
  statement_date: string;
  statement_balance: number;
  computed_balance: number;
  difference: number;
  currency: string | null;
  status: ReconcileStatus;
  resolution: ReconcileResolution | null;
  adjustment_transaction_id: string | null;
  cleared_count: number;
  note: string | null;
  reconciled_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Dates and money ─────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** The day before a YYYY-MM-DD date. */
export function dayBefore(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (YYYY-MM-DD or timestamps), never negative. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export const toCents = (value: number | string | null | undefined): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
export const fromCents = (cents: number): number => cents / 100;

// ── Reconciled periods ─────────────────────────────────────────────────────

type RecLike = Pick<ReconciliationRow, 'status' | 'statement_date'>;

/** The latest reconciled statement date, or null. */
export function reconciledThrough(recs: readonly RecLike[]): string | null {
  let through: string | null = null;
  for (const r of recs) {
    if (r.status !== 'reconciled') continue;
    if (!through || r.statement_date > through) through = r.statement_date;
  }
  return through;
}

/**
 * The reconciled statement whose period holds a transaction dated `date` on
 * this account (the earliest reconciled statement date on or after it), or
 * null. A transaction on or before the starting-balance date counts toward no
 * balance, so nothing covers it.
 */
export function coveringReconciliation<R extends RecLike>(
  account: Pick<BalanceAccount, 'opening_balance_date'>,
  date: string | null | undefined,
  recs: readonly R[],
): R | null {
  if (!date || !countsInBalance(account, date)) return null;
  const day = date.slice(0, 10);
  let best: R | null = null;
  for (const r of recs) {
    if (r.status !== 'reconciled' || r.statement_date < day) continue;
    if (!best || r.statement_date < best.statement_date) best = r;
  }
  return best;
}

export interface ReconcilePeriod {
  /** Transactions dated after this day (exclusive); null = from the first one. */
  after: string | null;
  /** ... through this day (inclusive): the statement date. */
  through: string;
}

/** The latest reconciled reconciliation before `statementDate`, or null. */
export function previousReconciled<R extends RecLike>(recs: readonly R[], statementDate: string): R | null {
  let best: R | null = null;
  for (const r of recs) {
    if (r.status !== 'reconciled' || r.statement_date >= statementDate) continue;
    if (!best || r.statement_date > best.statement_date) best = r;
  }
  return best;
}

/** The statement's period (see the rules at the top). */
export function reconcilePeriod(
  account: Pick<BalanceAccount, 'opening_balance_date'>,
  recs: readonly RecLike[],
  statementDate: string,
): ReconcilePeriod {
  const previous = previousReconciled(recs, statementDate)?.statement_date ?? null;
  const start = startingBalanceDate(account);
  let after: string | null = previous;
  if (start && (!after || start > after)) after = start;
  return { after, through: statementDate };
}

export function inPeriod(date: string, period: ReconcilePeriod): boolean {
  const day = date.slice(0, 10);
  return (!period.after || day > period.after) && day <= period.through;
}

/**
 * How a transaction moves the balance in statement terms, in cents:
 * checking/savings/cash income +, expense -; card/loan expense + (more owed),
 * income - (less owed). 0 for any other type.
 */
export function effectCents(accountType: string, row: Pick<BalanceRow, 'type' | 'amount'>): number {
  const c = toCents(row.amount);
  if (row.type !== 'income' && row.type !== 'expense') return 0;
  const raises = isDebtAccount(accountType) ? row.type === 'expense' : row.type === 'income';
  return raises ? c : -c;
}

// ── The comparison ─────────────────────────────────────────────────────────

export interface PeriodTransactionRow extends BalanceRow {
  id: string;
  transaction_date: string;
  account_id?: string | null;
  description?: string | null;
  vendor?: string | null;
  tags?: string[] | null;
  source?: string | null;
  cleared_at?: string | null;
}

export interface PeriodTransaction {
  id: string;
  transaction_date: string;
  type: string;
  amount: number;
  /** In statement terms (see effectCents), in dollars. */
  effect: number;
  description: string | null;
  vendor: string | null;
  cleared: boolean;
  /** An earlier reconciliation's adjustment. */
  is_adjustment: boolean;
}

export interface ReconcileComparison {
  statement_date: string;
  period: ReconcilePeriod;
  /** The balance worked out for the statement date, in statement terms. */
  computed_balance: number;
  statement_balance: number | null;
  /** statement - computed; null without a statement balance. */
  difference: number | null;
  transactions: PeriodTransaction[];
  cleared_count: number;
  /** Net effect of the period's transactions not ticked Cleared. */
  uncleared_effect: number;
}

/** The period's transactions, oldest first. */
export function periodTransactions(
  account: BalanceAccount,
  rows: readonly PeriodTransactionRow[],
  period: ReconcilePeriod,
): PeriodTransaction[] {
  return rows
    .filter((r) => (r.type === 'income' || r.type === 'expense') && countsInBalance(account, r.transaction_date) && inPeriod(r.transaction_date, period))
    .map((r) => ({
      id: r.id,
      transaction_date: r.transaction_date.slice(0, 10),
      type: r.type,
      amount: fromCents(toCents(r.amount)),
      effect: fromCents(effectCents(account.account_type, r)),
      description: r.description ?? null,
      vendor: r.vendor ?? null,
      cleared: !!r.cleared_at,
      is_adjustment: Array.isArray(r.tags) && r.tags.includes(RECONCILE_ADJUSTMENT_TAG),
    }))
    .sort((a, b) => (a.transaction_date < b.transaction_date ? -1 : a.transaction_date > b.transaction_date ? 1 : a.id < b.id ? -1 : 1));
}

/**
 * Compares the statement with the books. `cleared` overrides which of the
 * period's transactions count as ticked (the page's checkboxes); without it
 * the saved cleared_at is used.
 */
export function compareWithStatement(
  account: BalanceAccount,
  rows: readonly PeriodTransactionRow[],
  recs: readonly RecLike[],
  statementDate: string,
  statementBalance: number | null,
  cleared?: ReadonlySet<string>,
): ReconcileComparison {
  const period = reconcilePeriod(account, recs, statementDate);
  const computedCents = statementBalanceCents(account, rows, { through: statementDate });
  const transactions = periodTransactions(account, rows, period).map((t) =>
    cleared ? { ...t, cleared: cleared.has(t.id) } : t,
  );
  let clearedCount = 0;
  let unclearedCents = 0;
  for (const t of transactions) {
    if (t.cleared) clearedCount += 1;
    else unclearedCents += toCents(t.effect);
  }
  const statementCents = statementBalance === null ? null : toCents(statementBalance);
  return {
    statement_date: statementDate,
    period,
    computed_balance: fromCents(computedCents),
    statement_balance: statementCents === null ? null : fromCents(statementCents),
    difference: statementCents === null ? null : fromCents(statementCents - computedCents),
    transactions,
    cleared_count: clearedCount,
    uncleared_effect: fromCents(unclearedCents),
  };
}

// ── Handling a difference ──────────────────────────────────────────────────

export interface ReconcileAdjustment {
  type: 'income' | 'expense';
  /** Always positive. */
  amountCents: number;
  description: string;
}

/** The one transaction that makes the books match the statement (null when they already do). */
export function planReconcileAdjustment(accountType: string, differenceCents: number): ReconcileAdjustment | null {
  if (differenceCents === 0) return null;
  // A positive difference: the statement is higher (more money, or more owed).
  const raise = differenceCents > 0;
  const type: 'income' | 'expense' = isDebtAccount(accountType) ? (raise ? 'expense' : 'income') : raise ? 'income' : 'expense';
  return { type, amountCents: Math.abs(differenceCents), description: RECONCILE_ADJUSTMENT_DESCRIPTION };
}

/** The opening balance after moving it by the difference (both in statement terms), in cents. */
export function openingAfterChange(openingBalance: number | string | null | undefined, differenceCents: number): number {
  return toCents(openingBalance) + differenceCents;
}

export interface ReconcileOutcome {
  status: ReconcileStatus;
  resolution: ReconcileResolution;
}

const money = (cents: number): string =>
  (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** What finishing does with the difference. Throws ReconcileRuleError when the choice isn't allowed. */
export function decideOutcome(
  differenceCents: number,
  choice: DifferenceChoice | null,
  context: { earlierReconciled: boolean },
): ReconcileOutcome {
  if (differenceCents === 0) return { status: 'reconciled', resolution: 'matched' };
  if (!choice) {
    throw new ReconcileRuleError(
      `There's a difference of ${money(differenceCents)}. Choose what to do with it: add an adjustment, change the starting balance, or leave it open.`,
      400,
      'choice_required',
    );
  }
  if (choice === 'adjustment') return { status: 'reconciled', resolution: 'adjustment' };
  if (choice === 'starting_balance') {
    if (context.earlierReconciled) {
      throw new ReconcileRuleError(
        'An earlier statement on this account is reconciled. Changing the starting balance would put it out of balance, so add an adjustment or leave this one open instead.',
        409,
        'earlier_reconciled',
      );
    }
    return { status: 'reconciled', resolution: 'starting_balance' };
  }
  return { status: 'open', resolution: 'left_open' };
}

// ── Starting balance from an imported statement ────────────────────────────

export interface StatementFactsRow {
  id: string;
  period_start: string | null;
  period_end: string;
  previous_balance: number | string | null;
  new_balance: number | string | null;
}

/**
 * The statement to reconcile to: the one closing on `periodEnd` when given and
 * found, else the latest with a new balance. Null when there is none.
 */
export function pickStatement<S extends StatementFactsRow>(statements: readonly S[], periodEnd?: string | null): S | null {
  const usable = statements.filter((s) => s.new_balance !== null && s.new_balance !== undefined && s.new_balance !== '');
  if (periodEnd) {
    const exact = usable.find((s) => s.period_end === periodEnd);
    if (exact) return exact;
  }
  return [...usable].sort((a, b) => (a.period_end < b.period_end ? 1 : a.period_end > b.period_end ? -1 : 0))[0] ?? null;
}

/**
 * A starting balance taken from the earliest imported statement: its previous
 * (beginning) balance, as of the day before its period starts. Null when the
 * statement didn't print both.
 */
export function startingFromStatement(
  statements: readonly StatementFactsRow[],
): { opening_balance: number; opening_balance_date: string; statement_id: string; period_start: string } | null {
  const usable = statements
    .filter((s) => isDateString(s.period_start) && s.previous_balance !== null && s.previous_balance !== undefined && s.previous_balance !== '')
    .sort((a, b) => ((a.period_start as string) < (b.period_start as string) ? -1 : 1));
  const first = usable[0];
  if (!first) return null;
  return {
    opening_balance: fromCents(toCents(first.previous_balance)),
    opening_balance_date: dayBefore(first.period_start as string),
    statement_id: first.id,
    period_start: first.period_start as string,
  };
}

// ── Monthly audit ──────────────────────────────────────────────────────────

export type AuditState = 'never' | 'stale' | 'fresh';

export function auditState(
  reconciledThroughDate: string | null,
  today: string,
): { state: AuditState; days: number | null } {
  if (!reconciledThroughDate) return { state: 'never', days: null };
  const days = daysBetween(reconciledThroughDate, today);
  return { state: days > RECONCILE_STALE_DAYS ? 'stale' : 'fresh', days };
}

/** Accounts the monthly audit looks at: active, and not cash (cash is counted instead). */
export function auditsAccount(account: { account_type: string; is_active?: boolean | null }): boolean {
  return account.is_active !== false && account.account_type !== 'cash';
}

// ── Reading a request ──────────────────────────────────────────────────────

export interface ReconcileInput {
  accountId: string;
  statementDate: string;
  statementCents: number;
  clearedIds: string[];
  choice: DifferenceChoice | null;
  note: string | null;
  statementId: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads POST /api/finance/reconciliations. `today` bounds the statement date. */
export function parseReconcileInput(body: unknown, today: string): ReconcileInput {
  if (!isRecord(body)) throw new ReconcileRuleError('The request body must be a JSON object.');
  const accountId = typeof body.account_id === 'string' ? body.account_id.trim() : '';
  if (!accountId) throw new ReconcileRuleError('Choose the account to reconcile.');

  if (!isDateString(body.statement_date)) throw new ReconcileRuleError("Enter the statement's closing date.");
  const statementDate = body.statement_date;
  if (statementDate > today) throw new ReconcileRuleError("The statement's closing date can't be in the future.");

  const raw = body.statement_balance;
  const amount = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw.replace(/[,$\s]/g, '')) : NaN;
  if (!Number.isFinite(amount)) throw new ReconcileRuleError("Enter the statement's ending balance, like 1234.56.");
  const statementCents = toCents(amount);
  if (Math.abs(statementCents) > MAX_CENTS) throw new ReconcileRuleError('That balance is too large.');

  let clearedIds: string[] = [];
  if (body.cleared_ids !== undefined && body.cleared_ids !== null) {
    if (!Array.isArray(body.cleared_ids)) throw new ReconcileRuleError('cleared_ids must be a list.');
    if (body.cleared_ids.length > MAX_CLEARED_IDS) throw new ReconcileRuleError(`At most ${MAX_CLEARED_IDS} transactions can be ticked at once.`);
    clearedIds = [...new Set(body.cleared_ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  }

  const rawChoice = body.difference_choice;
  const choice = typeof rawChoice === 'string' && (DIFFERENCE_CHOICES as readonly string[]).includes(rawChoice)
    ? (rawChoice as DifferenceChoice)
    : null;
  if (rawChoice !== undefined && rawChoice !== null && rawChoice !== '' && !choice) {
    throw new ReconcileRuleError('Choose adjustment, starting_balance or left_open for the difference.');
  }

  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  const statementId = typeof body.statement_id === 'string' && body.statement_id.trim() ? body.statement_id.trim() : null;
  return { accountId, statementDate, statementCents, clearedIds, choice, note, statementId };
}
