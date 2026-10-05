// lib/finance/budgets/server.ts
// Database reads and writes for the budget routes (app/api/finance/budgets/*).
//
// Callers pass the RLS session client and the signed-in user's id; every
// query is also scoped with `.eq('user_id', userId)`. Transfers are left out
// with excludingTransfers()/withoutTransfers(), and the transaction query is
// paged so PostgREST's row cap can't cut history short.
//
// budget_periods arrives with migration 208. Before it is applied, reads fall
// back to each category's monthly_budget and writes answer BUDGETS_NOT_READY.

import type { SupabaseClient } from '@supabase/supabase-js';
import { excludingTransfers, withoutTransfers } from '../transfers/schema.ts';
import type { DbErrorLike } from '../transfers/schema.ts';
import { totalsRole } from '../refunds.ts';
import { addMonths, firstDay, lastDay, monthOfDate } from './months.ts';
import type { MonthKey } from './months.ts';
import {
  buildBudgetReport,
  historyFreezeMonths,
  indexPeriods,
  MAX_CARRY_MONTHS,
  rolloverOn,
} from './logic.ts';
import type { BudgetMethod, BudgetReport, BudgetWindow, PeriodRow, SpendingRow } from './logic.ts';

/** Rows per request when paging transactions (PostgREST's default max-rows). */
export const PAGE_SIZE = 1000;

export const BUDGETS_NOT_READY = {
  error:
    "Budgets by month can't be saved yet because this database is missing an update (migration 208). " +
    "Nothing was changed. Each category's monthly budget still applies until the update is applied.",
  code: 'budget_periods_not_migrated',
} as const;

/** True when an error says the named table doesn't exist (Postgres 42P01 or PostgREST PGRST205). */
export function isMissingTable(error: DbErrorLike | null | undefined, table: string): boolean {
  if (!error) return false;
  if (error.code !== '42P01' && error.code !== 'PGRST205') return false;
  return (error.message ?? '').includes(table);
}

export class BudgetWriteError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const SPENDING_SELECT = 'id, amount, type, transaction_date, category_id, source, account_id, description';

/** The user's credit card and loan account ids: money back on one of them is a refund, not income. */
export async function loadDebtAccountIds(
  db: SupabaseClient,
  userId: string,
): Promise<{ ids: Set<string>; error: DbErrorLike | null }> {
  const { data, error } = await db
    .from('financial_accounts')
    .select('id')
    .eq('user_id', userId)
    .in('account_type', ['credit_card', 'loan']);
  return { ids: new Set(((data ?? []) as { id: string }[]).map((row) => row.id)), error };
}

/** Every non-transfer transaction of the user between two dates, all pages. */
export async function loadSpendingRows(
  db: SupabaseClient,
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<{ rows: SpendingRow[]; error: DbErrorLike | null }> {
  const rows: SpendingRow[] = [];
  const debt = await loadDebtAccountIds(db, userId);
  if (debt.error) return { rows, error: debt.error };
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await excludingTransfers((groupColumnExists) =>
      withoutTransfers(
        db
          .from('financial_transactions')
          .select(SPENDING_SELECT)
          .eq('user_id', userId)
          .gte('transaction_date', fromDate)
          .lte('transaction_date', toDate),
        groupColumnExists,
      )
        .order('transaction_date', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1),
    );
    if (res.error) return { rows, error: res.error };
    const page = (res.data ?? []) as (SpendingRow & { account_id?: string | null; description?: string | null })[];
    for (const row of page) {
      // Money back on a card or loan: a refund lowers spending; an unlinked
      // payment is a transfer and counts nowhere (lib/finance/refunds.ts).
      const role = totalsRole(row, debt.ids);
      if (role === 'unlinked_payment') continue;
      rows.push(role === 'refund' ? { ...row, refund: true } : row);
    }
    if (page.length < PAGE_SIZE) return { rows, error: null };
  }
}

/** Month of the user's first non-transfer transaction, or null with none. */
export async function loadFirstMonth(
  db: SupabaseClient,
  userId: string,
): Promise<{ month: MonthKey | null; error: DbErrorLike | null }> {
  const res = await excludingTransfers((groupColumnExists) =>
    withoutTransfers(
      db.from('financial_transactions').select('transaction_date').eq('user_id', userId),
      groupColumnExists,
    )
      .order('transaction_date', { ascending: true })
      .limit(1),
  );
  if (res.error) return { month: null, error: res.error };
  const first = (res.data as { transaction_date: string }[] | null)?.[0];
  return { month: first ? monthOfDate(first.transaction_date) : null, error: null };
}

/** The user's budget_periods rows (optionally only some categories / months). */
export async function loadPeriods(
  db: SupabaseClient,
  userId: string,
  options: { categoryIds?: string[]; fromMonth?: MonthKey; toMonth?: MonthKey } = {},
): Promise<{ rows: PeriodRow[]; ready: boolean; error: DbErrorLike | null }> {
  let query = db
    .from('budget_periods')
    .select('category_id, month, amount, rollover')
    .eq('user_id', userId);
  if (options.categoryIds) query = query.in('category_id', options.categoryIds);
  if (options.fromMonth) query = query.gte('month', firstDay(options.fromMonth));
  if (options.toMonth) query = query.lte('month', firstDay(options.toMonth));
  const res = await query;
  if (isMissingTable(res.error, 'budget_periods')) return { rows: [], ready: false, error: null };
  if (res.error) return { rows: [], ready: true, error: res.error };
  return { rows: (res.data ?? []) as PeriodRow[], ready: true, error: null };
}

export interface CategoryRecord {
  id: string;
  name: string;
  color: string | null;
  monthly_budget: number | string | null;
}

export interface LoadedReport extends BudgetReport {
  current_month: MonthKey;
  first_month: MonthKey | null;
  /** False until migration 208 is applied: budgets come from monthly_budget only. */
  periods_ready: boolean;
}

export async function loadBudgetReport(
  db: SupabaseClient,
  userId: string,
  options: { month: MonthKey; window: BudgetWindow; method: BudgetMethod; currentMonth: MonthKey },
): Promise<{ report: LoadedReport | null; error: DbErrorLike | null }> {
  const { month, window, method, currentMonth } = options;
  // Enough history for the largest window and the rollover chain.
  const fromMonth = addMonths(month, -Math.max(window, MAX_CARRY_MONTHS));

  const [catRes, txRes, firstRes, periodRes] = await Promise.all([
    db
      .from('budget_categories')
      .select('id, name, color, monthly_budget')
      .eq('user_id', userId)
      .order('sort_order')
      .order('name'),
    loadSpendingRows(db, userId, firstDay(fromMonth), lastDay(month)),
    loadFirstMonth(db, userId),
    loadPeriods(db, userId, { fromMonth, toMonth: month }),
  ]);
  const error = catRes.error ?? txRes.error ?? firstRes.error ?? periodRes.error;
  if (error) return { report: null, error };

  // Rollover is sticky: a row before the loaded range can still turn it on.
  let periods = periodRes.rows;
  if (periodRes.ready) {
    const earlier = await loadPeriods(db, userId, { toMonth: addMonths(fromMonth, -1) });
    if (earlier.error) return { report: null, error: earlier.error };
    const latestBefore = new Map<string, PeriodRow>();
    for (const row of earlier.rows) {
      const seen = latestBefore.get(row.category_id);
      if (!seen || row.month > seen.month) latestBefore.set(row.category_id, row);
    }
    // Those rows sit before the range, so they only supply the rollover flag, never an amount.
    periods = [...latestBefore.values(), ...periods];
  }

  const report = buildBudgetReport({
    month,
    window,
    method,
    currentMonth,
    firstMonth: firstRes.month,
    categories: (catRes.data ?? []) as CategoryRecord[],
    rows: txRes.rows,
    periods,
  });
  return {
    report: { ...report, current_month: currentMonth, first_month: firstRes.month, periods_ready: periodRes.ready },
    error: null,
  };
}

// ── Writes ──────────────────────────────────────────────────────────────────

export interface BudgetWriteItem {
  category_id: string;
  /** New budget for the month; null clears the month's own budget (back to the default). */
  amount?: number | null;
  /** Turn carry-over on or off from this month on. */
  rollover?: boolean;
}

export interface BudgetWriteResult {
  updated: number;
}

const MAX_AMOUNT = 9_999_999_999.99; // numeric(12,2)

/** Checks one request item; throws BudgetWriteError with a message for the screen. */
export function validateItem(raw: unknown): BudgetWriteItem {
  if (!raw || typeof raw !== 'object') throw new BudgetWriteError('Each budget needs a category.');
  const item = raw as Record<string, unknown>;
  if (typeof item.category_id !== 'string' || !item.category_id) {
    throw new BudgetWriteError('Each budget needs a category.');
  }
  const out: BudgetWriteItem = { category_id: item.category_id };
  if (item.amount !== undefined) {
    if (item.amount === null || item.amount === '') {
      out.amount = null;
    } else {
      const amount = Number(item.amount);
      if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
        throw new BudgetWriteError('A budget must be a number of zero or more.');
      }
      out.amount = Math.round(amount * 100) / 100;
    }
  }
  if (item.rollover !== undefined) {
    if (typeof item.rollover !== 'boolean') throw new BudgetWriteError('Rollover must be on or off.');
    out.rollover = item.rollover;
  }
  if (out.amount === undefined && out.rollover === undefined) {
    throw new BudgetWriteError('Nothing to change: send an amount or a rollover setting.');
  }
  return out;
}

function notReadyOrThrow(error: DbErrorLike | null): void {
  if (!error) return;
  if (isMissingTable(error, 'budget_periods')) {
    throw new BudgetWriteError(BUDGETS_NOT_READY.error, 503, BUDGETS_NOT_READY.code);
  }
  throw new BudgetWriteError(error.message ?? 'The budget could not be saved.', 500);
}

/**
 * Sets budgets for one month.
 *
 *   amount (number)    the month's own budget (a budget_periods row).
 *   amount (null)      removes the month's own budget; the default applies again.
 *   rollover           carry-over on/off for this month and every later month that has a row.
 *   fromThisMonthOn    also: later months' rows get the same amount, and the category's
 *                      monthly_budget (the default) becomes it. Past months without their own
 *                      row first get one with the OLD default, so their budget doesn't change.
 */
export async function writeBudgets(
  db: SupabaseClient,
  userId: string,
  input: { month: MonthKey; items: BudgetWriteItem[]; fromThisMonthOn?: boolean },
): Promise<BudgetWriteResult> {
  const { month, items } = input;
  if (items.length === 0) return { updated: 0 };
  const ids = [...new Set(items.map((i) => i.category_id))];

  const catRes = await db
    .from('budget_categories')
    .select('id, name, monthly_budget')
    .eq('user_id', userId)
    .in('id', ids);
  if (catRes.error) throw new BudgetWriteError(catRes.error.message, 500);
  const cats = new Map(
    ((catRes.data ?? []) as { id: string; name: string; monthly_budget: number | string | null }[]).map((c) => [c.id, c]),
  );
  const unknown = ids.filter((id) => !cats.has(id));
  if (unknown.length) throw new BudgetWriteError('One of those categories was not found.', 404);

  const periodRes = await loadPeriods(db, userId, { categoryIds: ids });
  if (!periodRes.ready) throw new BudgetWriteError(BUDGETS_NOT_READY.error, 503, BUDGETS_NOT_READY.code);
  if (periodRes.error) throw new BudgetWriteError(periodRes.error.message ?? 'Could not read budgets.', 500);
  const periods = indexPeriods(periodRes.rows);

  let firstMonth: MonthKey | null = null;
  if (input.fromThisMonthOn && items.some((i) => i.amount !== undefined)) {
    const first = await loadFirstMonth(db, userId);
    if (first.error) throw new BudgetWriteError(first.error.message ?? 'Could not read transactions.', 500);
    firstMonth = first.month;
  }

  const monthDate = firstDay(month);
  let updated = 0;

  for (const item of items) {
    const cat = cats.get(item.category_id)!;
    const catPeriods = periods.get(item.category_id);
    const own = catPeriods?.get(month);
    const oldDefault = cat.monthly_budget === null || cat.monthly_budget === '' ? null : Number(cat.monthly_budget);

    if (input.fromThisMonthOn && item.amount !== undefined) {
      // Pin the old default on past months first, so changing the default rewrites no history.
      const freeze = historyFreezeMonths(oldDefault, month, firstMonth, new Set(catPeriods?.keys() ?? []));
      if (freeze.length) {
        const res = await db.from('budget_periods').upsert(
          freeze.map((m) => ({
            user_id: userId,
            category_id: item.category_id,
            month: firstDay(m),
            amount: oldDefault,
            rollover: rolloverOn(catPeriods, m),
          })),
          { onConflict: 'user_id,category_id,month', ignoreDuplicates: true },
        );
        notReadyOrThrow(res.error);
      }
    }

    if (item.amount === null) {
      const res = await db
        .from('budget_periods')
        .delete()
        .eq('user_id', userId)
        .eq('category_id', item.category_id)
        .eq('month', monthDate);
      notReadyOrThrow(res.error);
    } else {
      let amount = item.amount;
      if (amount === undefined) {
        amount = own?.amount ?? oldDefault ?? undefined;
        if (amount === undefined) {
          throw new BudgetWriteError(`Set a budget for ${cat.name} before turning on rollover.`);
        }
      }
      const res = await db.from('budget_periods').upsert(
        {
          user_id: userId,
          category_id: item.category_id,
          month: monthDate,
          amount,
          rollover: item.rollover ?? own?.rollover ?? rolloverOn(catPeriods, month),
        },
        { onConflict: 'user_id,category_id,month' },
      );
      notReadyOrThrow(res.error);
    }

    // Later months: same rollover setting, and with "from this month on" the same amount.
    const later: Record<string, unknown> = {};
    if (item.rollover !== undefined) later.rollover = item.rollover;
    if (input.fromThisMonthOn && item.amount !== undefined) {
      if (item.amount === null) {
        const res = await db
          .from('budget_periods')
          .delete()
          .eq('user_id', userId)
          .eq('category_id', item.category_id)
          .gt('month', monthDate);
        notReadyOrThrow(res.error);
      } else {
        later.amount = item.amount;
      }
    }
    if (Object.keys(later).length) {
      const res = await db
        .from('budget_periods')
        .update(later)
        .eq('user_id', userId)
        .eq('category_id', item.category_id)
        .gt('month', monthDate);
      notReadyOrThrow(res.error);
    }

    if (input.fromThisMonthOn && item.amount !== undefined) {
      const res = await db
        .from('budget_categories')
        .update({ monthly_budget: item.amount })
        .eq('user_id', userId)
        .eq('id', item.category_id);
      if (res.error) throw new BudgetWriteError(res.error.message, 500);
    }
    updated += 1;
  }
  return { updated };
}
