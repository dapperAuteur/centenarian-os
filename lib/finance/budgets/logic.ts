// lib/finance/budgets/logic.ts
// Pure budget math for the Budgets page (plans/60, Phase A): monthly spending
// per category, suggested budgets from history, a "varies a lot" flag, and
// which budget applies to a month.
//
// RULES (the help article "How budgets work" says the same in plain words)
//
//   Spending
//     - Only expense rows count as spending. Transfers between the person's
//       own accounts never count (countsTowardTotals()).
//     - A row with no category goes to its own "Uncategorized" bucket.
//     - Refunds: an income row in an EXPENSE category is a refund and lowers
//       that category's spending in the month it happened. A category is an
//       expense category when, over the rows given, its expenses are at least
//       its income (so "Groceries" with a store refund is one; "Salary" or a
//       client-income category is not, and its income is ignored here).
//       Uncategorized income is ignored: it is usually pay, not a refund.
//       A month never goes below zero: a refund larger than that month's
//       spending counts as zero spending for the month.
//
//   Suggestions
//     - Window: the 3, 6 or 12 complete months before the budget month.
//     - A month with no spending in the window counts as $0, but months
//       before the person's first transaction are left out (no history yet,
//       not "spent nothing"). Months that haven't finished yet are left out.
//     - Method: average (default) or median of those months, rounded to the
//       nearest whole dollar. No usable months -> no suggestion.
//     - "Varies a lot": with at least 3 usable months and spending above
//       zero, the coefficient of variation (standard deviation / average) is
//       above VARIABILITY_THRESHOLD.
//
//   Budget for a month
//     - base = that month's budget_periods row, else the category's
//       monthly_budget (the default), else none.
//     - Rollover is on for a month when the latest budget_periods row at or
//       before it has rollover = true. A month with rollover on passes its
//       leftover (budget - spent, negative when overspent) to the NEXT month.
//       So turning it on in October first changes November. The chain looks
//       back at most MAX_CARRY_MONTHS and never before the first transaction.
//
// Imports only sibling files with .ts extensions, so it runs under
// `node --test --experimental-strip-types` (tests/unit/budgets.test.ts).

import { countsTowardTotals } from '../transfers/schema.ts';
import { addMonths, monthOfDate, monthRange } from './months.ts';
import type { MonthKey } from './months.ts';

export type BudgetWindow = 3 | 6 | 12;
export type BudgetMethod = 'average' | 'median';

export const BUDGET_WINDOWS: readonly BudgetWindow[] = [3, 6, 12];
export const DEFAULT_WINDOW: BudgetWindow = 6;
export const DEFAULT_METHOD: BudgetMethod = 'average';
/** Coefficient of variation above which a category "varies a lot". */
export const VARIABILITY_THRESHOLD = 0.5;
/** How far back a rollover chain looks. The API loads this much history. */
export const MAX_CARRY_MONTHS = 12;
/** Key of the bucket for rows with no category. */
export const UNCATEGORIZED = '__uncategorized__';

export function parseWindow(value: unknown): BudgetWindow {
  const n = Number(value);
  return n === 3 || n === 6 || n === 12 ? n : DEFAULT_WINDOW;
}

export function parseMethod(value: unknown): BudgetMethod {
  return value === 'median' ? 'median' : DEFAULT_METHOD;
}

/** The transaction columns this file reads. */
export interface SpendingRow {
  amount: number | string;
  type: string;
  transaction_date: string;
  category_id: string | null;
  source?: string | null;
  transfer_group_id?: string | null;
}

export interface SeriesPoint {
  month: MonthKey;
  amount: number;
}

const toCents = (value: number | string | null | undefined): number => Math.round(Number(value ?? 0) * 100);
const fromCents = (cents: number): number => cents / 100;
const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Spending per category per month: key (category id or UNCATEGORIZED) ->
 * month -> amount. See RULES above for transfers and refunds.
 */
export function buildSpendingSeries(rows: SpendingRow[]): Map<string, Map<MonthKey, number>> {
  const counted = rows.filter(countsTowardTotals);

  // Which categories are expense categories (for the refund rule).
  const expenseTotal = new Map<string, number>();
  const incomeTotal = new Map<string, number>();
  for (const row of counted) {
    if (!row.category_id) continue;
    const totals = row.type === 'expense' ? expenseTotal : row.type === 'income' ? incomeTotal : null;
    if (!totals) continue;
    totals.set(row.category_id, (totals.get(row.category_id) ?? 0) + toCents(row.amount));
  }
  const isExpenseCategory = (id: string): boolean => {
    const spent = expenseTotal.get(id) ?? 0;
    return spent > 0 && spent >= (incomeTotal.get(id) ?? 0);
  };

  const cents = new Map<string, Map<MonthKey, number>>();
  const add = (key: string, month: MonthKey, value: number) => {
    let months = cents.get(key);
    if (!months) cents.set(key, (months = new Map()));
    months.set(month, (months.get(month) ?? 0) + value);
  };

  for (const row of counted) {
    const month = monthOfDate(row.transaction_date);
    if (row.type === 'expense') {
      add(row.category_id ?? UNCATEGORIZED, month, toCents(row.amount));
    } else if (row.type === 'income' && row.category_id && isExpenseCategory(row.category_id)) {
      add(row.category_id, month, -toCents(row.amount));
    }
  }

  const out = new Map<string, Map<MonthKey, number>>();
  for (const [key, months] of cents) {
    out.set(key, new Map([...months].map(([m, c]) => [m, fromCents(Math.max(0, c))])));
  }
  return out;
}

/** One bucket's amounts for the given months, $0 where nothing was spent. */
export function seriesFor(spending: Map<MonthKey, number> | undefined, months: MonthKey[]): SeriesPoint[] {
  return months.map((month) => ({ month, amount: spending?.get(month) ?? 0 }));
}

/** The months a suggestion for `forMonth` is based on: the `window` months before it. */
export function windowMonths(forMonth: MonthKey, window: BudgetWindow): MonthKey[] {
  return monthRange(addMonths(forMonth, -window), addMonths(forMonth, -1));
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Standard deviation / average (population), or null when it means nothing. */
export function coefficientOfVariation(values: number[]): number | null {
  const mean = average(values);
  if (mean === null || mean <= 0) return null;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

export interface SuggestOptions {
  window: BudgetWindow;
  method: BudgetMethod;
  /** The month the budget is for; the window is the months before it. */
  forMonth: MonthKey;
  /** Month of the person's first transaction; earlier months are left out. */
  firstMonth?: MonthKey | null;
  /** The month it is now; it and later months haven't finished and are left out. */
  currentMonth?: MonthKey | null;
}

export interface Suggestion {
  /** Suggested monthly budget in whole dollars, or null with no usable months. */
  amount: number | null;
  /** The months the suggestion used. */
  months: MonthKey[];
  average: number | null;
  median: number | null;
  /** Coefficient of variation, when there are at least 3 usable months. */
  cv: number | null;
  variesALot: boolean;
}

/** A suggested budget from a bucket's monthly spending. See RULES above. */
export function suggestBudget(series: SeriesPoint[], options: SuggestOptions): Suggestion {
  const byMonth = new Map(series.map((p) => [p.month, p.amount]));
  const months = windowMonths(options.forMonth, options.window).filter(
    (m) =>
      (!options.firstMonth || m >= options.firstMonth) &&
      (!options.currentMonth || m < options.currentMonth),
  );
  const values = months.map((m) => byMonth.get(m) ?? 0);
  const avg = average(values);
  const med = median(values);
  const picked = options.method === 'median' ? med : avg;
  const cv = values.length >= 3 ? coefficientOfVariation(values) : null;
  return {
    amount: picked === null ? null : Math.round(picked),
    months,
    average: avg === null ? null : round2(avg),
    median: med === null ? null : round2(med),
    cv: cv === null ? null : Math.round(cv * 100) / 100,
    variesALot: cv !== null && cv > VARIABILITY_THRESHOLD,
  };
}

/** A budget_periods row, with `month` as 'YYYY-MM' (or the stored 'YYYY-MM-01'). */
export interface PeriodRow {
  category_id: string;
  month: string;
  amount: number | string;
  rollover: boolean | null;
}

export interface PeriodEntry {
  amount: number;
  rollover: boolean;
}

/** category id -> month -> its period row. */
export function indexPeriods(rows: PeriodRow[]): Map<string, Map<MonthKey, PeriodEntry>> {
  const out = new Map<string, Map<MonthKey, PeriodEntry>>();
  for (const row of rows) {
    let months = out.get(row.category_id);
    if (!months) out.set(row.category_id, (months = new Map()));
    months.set(row.month.slice(0, 7), { amount: Number(row.amount), rollover: row.rollover === true });
  }
  return out;
}

export type BudgetSource = 'period' | 'rollover' | 'default' | 'none';

export interface ResolveInput {
  month: MonthKey;
  /** budget_categories.monthly_budget. */
  defaultBudget: number | null;
  /** This category's period rows by month. */
  periods?: Map<MonthKey, PeriodEntry>;
  /** This category's spending by month (for the rollover leftover). */
  spending?: Map<MonthKey, number>;
  firstMonth?: MonthKey | null;
}

export interface ResolvedBudget {
  /** The budget for the month (base + carried), or null when there is none. */
  amount: number | null;
  /** The month's own budget before carry-over. */
  base: number | null;
  /** Leftover (+) or overspend (-) carried in from last month. */
  carried: number;
  /** This month's leftover carries into next month. */
  rollover: boolean;
  /**
   * period:   the month has its own budget_periods row
   * rollover: no own row, but last month's leftover was carried in (base is the default)
   * default:  budget_categories.monthly_budget
   * none:     no budget
   */
  source: BudgetSource;
}

/** True when the latest period row at or before `month` turned rollover on. */
export function rolloverOn(periods: Map<MonthKey, PeriodEntry> | undefined, month: MonthKey): boolean {
  if (!periods) return false;
  let latest: MonthKey | null = null;
  for (const m of periods.keys()) if (m <= month && (latest === null || m > latest)) latest = m;
  return latest !== null && periods.get(latest)!.rollover;
}

/** Which budget applies to a month. See RULES above. */
export function resolveBudget(input: ResolveInput): ResolvedBudget {
  const { periods, spending, firstMonth } = input;
  const baseOf = (m: MonthKey): number | null => periods?.get(m)?.amount ?? input.defaultBudget;

  // Budget in cents for month m, following the rollover chain back up to `depth` months.
  const budgetCents = (m: MonthKey, depth: number): { total: number | null; carried: number } => {
    const base = baseOf(m);
    let carried = 0;
    const prev = addMonths(m, -1);
    if (depth > 0 && rolloverOn(periods, prev) && (!firstMonth || prev >= firstMonth)) {
      const before = budgetCents(prev, depth - 1).total;
      if (before !== null) carried = before - toCents(spending?.get(prev) ?? 0);
    }
    if (base === null && carried === 0) return { total: null, carried: 0 };
    return { total: toCents(base ?? 0) + carried, carried };
  };

  const base = baseOf(input.month);
  const rollover = rolloverOn(periods, input.month);
  const { total, carried } = budgetCents(input.month, MAX_CARRY_MONTHS);
  const source: BudgetSource = periods?.has(input.month)
    ? 'period'
    : carried !== 0
      ? 'rollover'
      : input.defaultBudget !== null
        ? 'default'
        : 'none';
  return {
    amount: total === null ? null : fromCents(total),
    base,
    carried: fromCents(carried),
    rollover,
    source,
  };
}

/**
 * Rows that pin the OLD default on past months before "from this month on"
 * changes budget_categories.monthly_budget, so earlier months keep the budget
 * they had. One row per month from the first transaction month (at most
 * `maxMonths` back) up to the month before `fromMonth`, skipping months that
 * already have their own row. None when there was no old default.
 */
export function historyFreezeMonths(
  oldDefault: number | null,
  fromMonth: MonthKey,
  firstMonth: MonthKey | null,
  existingMonths: Set<MonthKey>,
  maxMonths = 120,
): MonthKey[] {
  if (oldDefault === null || !firstMonth) return [];
  const earliest = addMonths(fromMonth, -maxMonths);
  const start = firstMonth > earliest ? firstMonth : earliest;
  return monthRange(start, addMonths(fromMonth, -1)).filter((m) => !existingMonths.has(m));
}

// ── The whole report for one month ──────────────────────────────────────────

export interface ReportCategory {
  id: string;
  name: string;
  color: string | null;
  monthly_budget: number | string | null;
}

export interface ReportInput {
  month: MonthKey;
  window: BudgetWindow;
  method: BudgetMethod;
  currentMonth: MonthKey;
  firstMonth: MonthKey | null;
  categories: ReportCategory[];
  /** Transactions from at least MAX_CARRY_MONTHS before `month` to its end. */
  rows: SpendingRow[];
  periods: PeriodRow[];
}

export interface VariabilityInfo {
  cv: number | null;
  varies_a_lot: boolean;
}

export interface SuggestionInfo {
  amount: number | null;
  months_used: number;
  average: number | null;
  median: number | null;
}

export interface BudgetLine {
  id: string;
  name: string;
  color: string | null;
  budget: number | null;
  budget_source: BudgetSource;
  base_budget: number | null;
  carried: number;
  rollover: boolean;
  default_budget: number | null;
  spent: number;
  remaining: number | null;
  series: SeriesPoint[];
  suggestion: SuggestionInfo;
  variability: VariabilityInfo;
}

export interface UncategorizedLine {
  spent: number;
  series: SeriesPoint[];
  suggestion: SuggestionInfo;
  variability: VariabilityInfo;
}

export interface BudgetReport {
  month: MonthKey;
  window: BudgetWindow;
  method: BudgetMethod;
  window_months: MonthKey[];
  categories: BudgetLine[];
  uncategorized: UncategorizedLine;
  totals: {
    budget: number;
    spent: number;
    spent_categorized: number;
    spent_uncategorized: number;
    remaining: number;
    suggested: number;
  };
}

function suggestionInfo(s: Suggestion): { suggestion: SuggestionInfo; variability: VariabilityInfo } {
  return {
    suggestion: { amount: s.amount, months_used: s.months.length, average: s.average, median: s.median },
    variability: { cv: s.cv, varies_a_lot: s.variesALot },
  };
}

export function buildBudgetReport(input: ReportInput): BudgetReport {
  const spending = buildSpendingSeries(input.rows);
  const periods = indexPeriods(input.periods);
  const months = windowMonths(input.month, input.window);
  const suggestOptions: SuggestOptions = {
    window: input.window,
    method: input.method,
    forMonth: input.month,
    firstMonth: input.firstMonth,
    currentMonth: input.currentMonth,
  };

  const categories: BudgetLine[] = input.categories.map((cat) => {
    const catSpending = spending.get(cat.id);
    const defaultBudget = cat.monthly_budget === null || cat.monthly_budget === '' ? null : Number(cat.monthly_budget);
    const resolved = resolveBudget({
      month: input.month,
      defaultBudget: Number.isFinite(defaultBudget) ? defaultBudget : null,
      periods: periods.get(cat.id),
      spending: catSpending,
      firstMonth: input.firstMonth,
    });
    const spent = catSpending?.get(input.month) ?? 0;
    const series = seriesFor(catSpending, months);
    return {
      id: cat.id,
      name: cat.name,
      color: cat.color,
      budget: resolved.amount,
      budget_source: resolved.source,
      base_budget: resolved.base,
      carried: resolved.carried,
      rollover: resolved.rollover,
      default_budget: defaultBudget,
      spent,
      remaining: resolved.amount === null ? null : round2(resolved.amount - spent),
      series,
      ...suggestionInfo(suggestBudget(series, suggestOptions)),
    };
  });

  const uncSpending = spending.get(UNCATEGORIZED);
  const uncSeries = seriesFor(uncSpending, months);
  const uncategorized: UncategorizedLine = {
    spent: uncSpending?.get(input.month) ?? 0,
    series: uncSeries,
    ...suggestionInfo(suggestBudget(uncSeries, suggestOptions)),
  };

  // Spending in categories that no longer exist (deleted) still has a key; count it as categorized.
  let categorizedCents = 0;
  for (const [key, byMonth] of spending) {
    if (key !== UNCATEGORIZED) categorizedCents += toCents(byMonth.get(input.month) ?? 0);
  }
  const budgetCents = categories.reduce((sum, c) => sum + (c.budget === null ? 0 : toCents(c.budget)), 0);
  const suggestedCents = categories.reduce((sum, c) => sum + toCents(c.suggestion.amount ?? 0), 0);
  const uncCents = toCents(uncategorized.spent);

  return {
    month: input.month,
    window: input.window,
    method: input.method,
    window_months: months,
    categories,
    uncategorized,
    totals: {
      budget: fromCents(budgetCents),
      spent: fromCents(categorizedCents + uncCents),
      spent_categorized: fromCents(categorizedCents),
      spent_uncategorized: fromCents(uncCents),
      remaining: fromCents(budgetCents - categorizedCents - uncCents),
      suggested: fromCents(suggestedCents),
    },
  };
}
