// tests/unit/budgets.test.ts
// Unit tests for budgets from transaction history (lib/finance/budgets/):
// month helpers, the spending series (transfers, uncategorized, refunds),
// suggestions (window, method, zero months, months before the first
// transaction), the "varies a lot" flag, budget resolution with rollover, the
// report, and the database helpers against the in-memory fake.
// Run: npm run test:unit
//
// Every category, amount and id here is made up. Nothing touches a database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addMonths, firstDay, isMonthKey, lastDay, monthRange } from '../../lib/finance/budgets/months.ts';
import {
  buildBudgetReport,
  buildSpendingSeries,
  coefficientOfVariation,
  historyFreezeMonths,
  indexPeriods,
  parseMethod,
  parseWindow,
  resolveBudget,
  seriesFor,
  suggestBudget,
  UNCATEGORIZED,
  windowMonths,
} from '../../lib/finance/budgets/logic.ts';
import type { SeriesPoint, SpendingRow } from '../../lib/finance/budgets/logic.ts';
import { suggestionsToApply } from '../../lib/finance/budgets/apply.ts';
import {
  BUDGETS_NOT_READY,
  BudgetWriteError,
  isMissingTable,
  loadBudgetReport,
  loadSpendingRows,
  validateItem,
  writeBudgets,
} from '../../lib/finance/budgets/server.ts';
import { FakeDb } from './fake-supabase.ts';

const USER = 'user-1';
const OTHER = 'user-2';
const GROCERIES = 'cat-groceries';
const SALARY = 'cat-salary';
const TRAVEL = 'cat-travel';

const tx = (
  date: string,
  amount: number,
  type: 'expense' | 'income',
  category_id: string | null,
  extra: Partial<SpendingRow> = {},
): SpendingRow => ({ transaction_date: date, amount, type, category_id, source: 'manual', ...extra });

const series = (pairs: [string, number][]): SeriesPoint[] => pairs.map(([month, amount]) => ({ month, amount }));

// ── Months ──────────────────────────────────────────────────────────────────

test('month helpers wrap years and know month lengths', () => {
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-11', 3), '2027-02');
  assert.equal(addMonths('2026-10', -12), '2025-10');
  assert.deepEqual(monthRange('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02']);
  assert.deepEqual(monthRange('2026-03', '2026-02'), []);
  assert.equal(lastDay('2024-02'), '2024-02-29');
  assert.equal(lastDay('2026-02'), '2026-02-28');
  assert.equal(firstDay('2026-10'), '2026-10-01');
  assert.ok(isMonthKey('2026-10'));
  assert.ok(!isMonthKey('2026-13'));
  assert.ok(!isMonthKey('2026-1'));
});

test('window and method parse to the defaults: 6 months, average', () => {
  assert.equal(parseWindow(null), 6);
  assert.equal(parseWindow('12'), 12);
  assert.equal(parseWindow('5'), 6);
  assert.equal(parseMethod(undefined), 'average');
  assert.equal(parseMethod('median'), 'median');
  assert.deepEqual(windowMonths('2026-10', 3), ['2026-07', '2026-08', '2026-09']);
});

// ── Spending series ─────────────────────────────────────────────────────────

test('spending counts expenses only and leaves transfers out', () => {
  const s = buildSpendingSeries([
    tx('2026-09-02', 50, 'expense', GROCERIES),
    tx('2026-09-15', 25.5, 'expense', GROCERIES),
    tx('2026-09-20', 400, 'expense', GROCERIES, { transfer_group_id: 'grp-1' }),
    tx('2026-09-21', 300, 'expense', GROCERIES, { source: 'transfer' }),
    tx('2026-08-03', 10, 'expense', GROCERIES),
  ]);
  assert.equal(s.get(GROCERIES)?.get('2026-09'), 75.5);
  assert.equal(s.get(GROCERIES)?.get('2026-08'), 10);
});

test('uncategorized spending is its own bucket, and uncategorized income is ignored', () => {
  const s = buildSpendingSeries([
    tx('2026-09-02', 40, 'expense', null),
    tx('2026-09-03', 2000, 'income', null),
  ]);
  assert.equal(s.get(UNCATEGORIZED)?.get('2026-09'), 40);
});

test('a refund (income in an expense category) lowers that month, never below zero', () => {
  const s = buildSpendingSeries([
    tx('2026-08-02', 100, 'expense', GROCERIES),
    tx('2026-08-09', 30, 'income', GROCERIES),
    tx('2026-09-02', 20, 'expense', GROCERIES),
    tx('2026-09-05', 45, 'income', GROCERIES),
  ]);
  assert.equal(s.get(GROCERIES)?.get('2026-08'), 70);
  assert.equal(s.get(GROCERIES)?.get('2026-09'), 0);
});

test('income in an income category (more income than expense) is not a refund', () => {
  const s = buildSpendingSeries([
    tx('2026-09-01', 3000, 'income', SALARY),
    tx('2026-09-02', 15, 'expense', SALARY), // a bank fee filed under Salary
  ]);
  assert.equal(s.get(SALARY)?.get('2026-09'), 15);
});

test('amounts add in cents (no floating-point drift)', () => {
  const s = buildSpendingSeries([0.1, 0.2, 0.3].map((a) => tx('2026-09-01', a, 'expense', GROCERIES)));
  assert.equal(s.get(GROCERIES)?.get('2026-09'), 0.6);
});

// ── Suggestions ─────────────────────────────────────────────────────────────

const history = series([
  ['2026-04', 100],
  ['2026-05', 200],
  ['2026-06', 300],
  ['2026-07', 100],
  ['2026-08', 900],
  ['2026-09', 100],
]);

test('default suggestion: average of the 6 months before the budget month', () => {
  const s = suggestBudget(history, { window: 6, method: 'average', forMonth: '2026-10' });
  assert.equal(s.amount, 283); // 1700 / 6 = 283.33
  assert.equal(s.months.length, 6);
});

test('median ignores a one-off spike', () => {
  const s = suggestBudget(history, { window: 6, method: 'median', forMonth: '2026-10' });
  assert.equal(s.amount, 150); // sorted 100 100 100 200 300 900 -> (100 + 200) / 2
});

test('a 3-month window only looks at the last 3 months', () => {
  const s = suggestBudget(history, { window: 3, method: 'average', forMonth: '2026-10' });
  assert.deepEqual(s.months, ['2026-07', '2026-08', '2026-09']);
  assert.equal(s.amount, 367); // 1100 / 3
});

test('months with no spending count as zero inside the window', () => {
  const s = suggestBudget(series([['2026-09', 600]]), { window: 6, method: 'average', forMonth: '2026-10' });
  assert.equal(s.amount, 100);
});

test('months before the first transaction are left out', () => {
  const s = suggestBudget(series([['2026-09', 600]]), {
    window: 6,
    method: 'average',
    forMonth: '2026-10',
    firstMonth: '2026-08',
  });
  assert.deepEqual(s.months, ['2026-08', '2026-09']);
  assert.equal(s.amount, 300);
});

test('unfinished months are left out, and no usable month means no suggestion', () => {
  const future = suggestBudget(history, { window: 3, method: 'average', forMonth: '2026-12', currentMonth: '2026-10' });
  assert.deepEqual(future.months, ['2026-09']);
  assert.equal(future.amount, 100);
  const none = suggestBudget([], { window: 6, method: 'average', forMonth: '2026-10', firstMonth: '2026-10' });
  assert.equal(none.amount, null);
  assert.equal(none.variesALot, false);
});

test('"varies a lot" needs 3+ months and a coefficient of variation above 0.5', () => {
  assert.equal(suggestBudget(history, { window: 6, method: 'average', forMonth: '2026-10' }).variesALot, true);
  const steady = series(monthRange('2026-04', '2026-09').map((m) => [m, 100 + (m.endsWith('5') ? 10 : 0)]));
  assert.equal(suggestBudget(steady, { window: 6, method: 'average', forMonth: '2026-10' }).variesALot, false);
  const two = suggestBudget(series([['2026-08', 10], ['2026-09', 1000]]), {
    window: 6, method: 'average', forMonth: '2026-10', firstMonth: '2026-08',
  });
  assert.equal(two.cv, null);
  assert.equal(two.variesALot, false);
  assert.equal(coefficientOfVariation([0, 0, 0]), null);
});

// ── Budget for a month ──────────────────────────────────────────────────────

test('budget: the month row, else the default, else none', () => {
  const periods = indexPeriods([{ category_id: GROCERIES, month: '2026-10-01', amount: '450.00', rollover: false }]);
  const own = resolveBudget({ month: '2026-10', defaultBudget: 400, periods: periods.get(GROCERIES) });
  assert.deepEqual([own.amount, own.source], [450, 'period']);
  const fallback = resolveBudget({ month: '2026-09', defaultBudget: 400, periods: periods.get(GROCERIES) });
  assert.deepEqual([fallback.amount, fallback.source], [400, 'default']);
  const none = resolveBudget({ month: '2026-09', defaultBudget: null });
  assert.deepEqual([none.amount, none.source], [null, 'none']);
});

test('rollover passes a month\'s leftover or overspend to the next month, and stays on', () => {
  const periods = indexPeriods([{ category_id: GROCERIES, month: '2026-08-01', amount: 400, rollover: true }]);
  const spending = new Map([['2026-08', 350], ['2026-09', 500]]);
  // Aug: 400 own. Sep: default 400 + 50 left from Aug = 450, spent 500. Oct: 400 - 50 = 350.
  const sep = resolveBudget({ month: '2026-09', defaultBudget: 400, periods: periods.get(GROCERIES), spending });
  assert.deepEqual([sep.amount, sep.carried, sep.source], [450, 50, 'rollover']);
  const oct = resolveBudget({ month: '2026-10', defaultBudget: 400, periods: periods.get(GROCERIES), spending });
  assert.deepEqual([oct.amount, oct.carried], [350, -50]);
});

test('rollover stops at a row that turns it off and never reaches before the first transaction', () => {
  const periods = indexPeriods([
    { category_id: GROCERIES, month: '2026-08-01', amount: 400, rollover: true },
    { category_id: GROCERIES, month: '2026-09-01', amount: 400, rollover: false },
  ]);
  const spending = new Map([['2026-08', 100], ['2026-09', 100]]);
  // Aug passes 300 to Sep; Sep has rollover off, so Oct gets nothing.
  const sep = resolveBudget({ month: '2026-09', defaultBudget: 400, periods: periods.get(GROCERIES), spending });
  assert.deepEqual([sep.amount, sep.carried, sep.rollover, sep.source], [700, 300, false, 'period']);
  const oct = resolveBudget({ month: '2026-10', defaultBudget: 400, periods: periods.get(GROCERIES), spending });
  assert.deepEqual([oct.amount, oct.source], [400, 'default']);
  const first = resolveBudget({
    month: '2026-08', defaultBudget: 400, periods: periods.get(GROCERIES), spending, firstMonth: '2026-08',
  });
  assert.equal(first.carried, 0);
});

test('"from this month on" pins the old default on past months without a row', () => {
  assert.deepEqual(
    historyFreezeMonths(400, '2026-10', '2026-06', new Set(['2026-08'])),
    ['2026-06', '2026-07', '2026-09'],
  );
  assert.deepEqual(historyFreezeMonths(null, '2026-10', '2026-06', new Set()), []);
  assert.deepEqual(historyFreezeMonths(400, '2026-10', null, new Set()), []);
});

// ── Report ──────────────────────────────────────────────────────────────────

test('report: lines, uncategorized, totals, and suggestions to accept', () => {
  const rows: SpendingRow[] = [
    ...monthRange('2026-04', '2026-09').map((m) => tx(`${m}-05`, 300, 'expense', GROCERIES)),
    tx('2026-10-02', 120, 'expense', GROCERIES),
    tx('2026-10-03', 80, 'expense', null),
    tx('2026-10-04', 5000, 'income', SALARY),
    tx('2026-10-04', 999, 'expense', TRAVEL, { transfer_group_id: 'grp' }),
  ];
  const report = buildBudgetReport({
    month: '2026-10',
    window: 6,
    method: 'average',
    currentMonth: '2026-10',
    firstMonth: '2026-04',
    categories: [
      { id: GROCERIES, name: 'Groceries', color: '#0ea5e9', monthly_budget: '250.00' },
      { id: TRAVEL, name: 'Travel', color: null, monthly_budget: null },
    ],
    rows,
    periods: [],
  });
  const groceries = report.categories.find((c) => c.id === GROCERIES)!;
  assert.equal(groceries.budget, 250);
  assert.equal(groceries.spent, 120);
  assert.equal(groceries.remaining, 130);
  assert.equal(groceries.suggestion.amount, 300);
  assert.equal(groceries.series.length, 6);
  const travel = report.categories.find((c) => c.id === TRAVEL)!;
  assert.deepEqual([travel.budget, travel.spent, travel.suggestion.amount], [null, 0, 0]);
  assert.equal(report.uncategorized.spent, 80);
  assert.deepEqual(report.totals, {
    budget: 250,
    spent: 200,
    spent_categorized: 120,
    spent_uncategorized: 80,
    remaining: 50,
    suggested: 300,
  });
  assert.deepEqual(suggestionsToApply(report.categories, null), [
    { category_id: GROCERIES, amount: 300 },
    { category_id: TRAVEL, amount: 0 },
  ]);
  assert.deepEqual(suggestionsToApply(report.categories, [TRAVEL]), [{ category_id: TRAVEL, amount: 0 }]);
});

test('seriesFor fills empty months with zero', () => {
  assert.deepEqual(seriesFor(undefined, ['2026-09']), [{ month: '2026-09', amount: 0 }]);
});

// ── Database helpers (in-memory fake) ───────────────────────────────────────

const asDb = (db: FakeDb) => db as unknown as SupabaseClient;

function seededDb(): FakeDb {
  const db = new FakeDb();
  db.seed('budget_categories', [
    { id: GROCERIES, user_id: USER, name: 'Groceries', color: '#0ea5e9', monthly_budget: 400, sort_order: 0 },
    { id: TRAVEL, user_id: USER, name: 'Travel', color: '#a855f7', monthly_budget: null, sort_order: 1 },
    { id: 'cat-other', user_id: OTHER, name: 'Theirs', color: null, monthly_budget: 10, sort_order: 0 },
  ]);
  db.seed('financial_transactions', [
    { user_id: USER, amount: 100, type: 'expense', category_id: GROCERIES, transaction_date: '2026-06-10', source: 'manual', transfer_group_id: null },
    { user_id: USER, amount: 200, type: 'expense', category_id: GROCERIES, transaction_date: '2026-09-10', source: 'csv_import', transfer_group_id: null },
    { user_id: USER, amount: 50, type: 'expense', category_id: GROCERIES, transaction_date: '2026-10-01', source: null, transfer_group_id: null },
    { user_id: USER, amount: 700, type: 'expense', category_id: GROCERIES, transaction_date: '2026-10-02', source: 'manual', transfer_group_id: 'grp' },
    { user_id: OTHER, amount: 9999, type: 'expense', category_id: 'cat-other', transaction_date: '2026-10-02', source: 'manual', transfer_group_id: null },
  ]);
  return db;
}

test('loadSpendingRows pages past the row cap', async () => {
  const db = new FakeDb();
  db.maxRows = 1000;
  db.seed(
    'financial_transactions',
    Array.from({ length: 2345 }, (_, i) => ({
      user_id: USER, amount: 1, type: 'expense', category_id: GROCERIES,
      transaction_date: '2026-09-15', source: 'manual', transfer_group_id: null, n: i,
    })),
  );
  const { rows, error } = await loadSpendingRows(asDb(db), USER, '2026-09-01', '2026-09-30');
  assert.equal(error, null);
  assert.equal(rows.length, 2345);
});

test('loadBudgetReport works before migration 208 (budgets from monthly_budget)', async () => {
  const db = seededDb();
  db.missingTables = ['budget_periods'];
  const { report, error } = await loadBudgetReport(asDb(db), USER, {
    month: '2026-10', window: 6, method: 'average', currentMonth: '2026-10',
  });
  assert.equal(error, null);
  assert.equal(report!.periods_ready, false);
  assert.equal(report!.first_month, '2026-06');
  const groceries = report!.categories.find((c) => c.id === GROCERIES)!;
  assert.deepEqual([groceries.budget, groceries.budget_source, groceries.spent], [400, 'default', 50]);
  // Jun..Sep usable (first transaction in June): (100 + 0 + 0 + 200) / 4 = 75
  assert.equal(groceries.suggestion.amount, 75);
  assert.equal(report!.categories.some((c) => c.id === 'cat-other'), false);
  assert.equal(report!.totals.spent, 50);
});

test('writes before migration 208 refuse with a clear message and change nothing', async () => {
  const db = seededDb();
  db.missingTables = ['budget_periods'];
  await assert.rejects(
    writeBudgets(asDb(db), USER, { month: '2026-10', items: [{ category_id: GROCERIES, amount: 300 }] }),
    (err: unknown) => err instanceof BudgetWriteError && err.status === 503 && err.message === BUDGETS_NOT_READY.error,
  );
  assert.equal(db.writes().length, 0);
});

test('writeBudgets sets one month without touching the default or other months', async () => {
  const db = seededDb();
  db.tables.budget_periods = [];
  const result = await writeBudgets(asDb(db), USER, {
    month: '2026-10', items: [{ category_id: GROCERIES, amount: 320 }],
  });
  assert.equal(result.updated, 1);
  assert.deepEqual(
    db.rows('budget_periods').map((r) => [r.user_id, r.category_id, r.month, r.amount, r.rollover]),
    [[USER, GROCERIES, '2026-10-01', 320, false]],
  );
  assert.equal(db.rows('budget_categories').find((c) => c.id === GROCERIES)!.monthly_budget, 400);
});

test('"from this month on" freezes past months, updates later rows and the default', async () => {
  const db = seededDb();
  db.seed('budget_periods', [
    { user_id: USER, category_id: GROCERIES, month: '2026-12-01', amount: 999, rollover: false },
  ]);
  await writeBudgets(asDb(db), USER, {
    month: '2026-10', items: [{ category_id: GROCERIES, amount: 350 }], fromThisMonthOn: true,
  });
  const byMonth = Object.fromEntries(db.rows('budget_periods').map((r) => [r.month, r.amount]));
  assert.deepEqual(byMonth, {
    '2026-06-01': 400, '2026-07-01': 400, '2026-08-01': 400, '2026-09-01': 400,
    '2026-10-01': 350, '2026-12-01': 350,
  });
  assert.equal(db.rows('budget_categories').find((c) => c.id === GROCERIES)!.monthly_budget, 350);
});

test('rollover toggle keeps the amount, applies to later rows, and needs a budget', async () => {
  const db = seededDb();
  db.seed('budget_periods', [
    { user_id: USER, category_id: GROCERIES, month: '2026-11-01', amount: 410, rollover: false },
  ]);
  await writeBudgets(asDb(db), USER, { month: '2026-10', items: [{ category_id: GROCERIES, rollover: true }] });
  const rows = Object.fromEntries(db.rows('budget_periods').map((r) => [r.month, [r.amount, r.rollover]]));
  assert.deepEqual(rows, { '2026-10-01': [400, true], '2026-11-01': [410, true] });
  await assert.rejects(
    writeBudgets(asDb(db), USER, { month: '2026-10', items: [{ category_id: TRAVEL, rollover: true }] }),
    /Set a budget for Travel/,
  );
});

test('clearing a month\'s budget removes its row; another user\'s category is refused', async () => {
  const db = seededDb();
  db.seed('budget_periods', [
    { user_id: USER, category_id: GROCERIES, month: '2026-10-01', amount: 300, rollover: false },
  ]);
  await writeBudgets(asDb(db), USER, { month: '2026-10', items: [{ category_id: GROCERIES, amount: null }] });
  assert.equal(db.rows('budget_periods').length, 0);
  await assert.rejects(
    writeBudgets(asDb(db), USER, { month: '2026-10', items: [{ category_id: 'cat-other', amount: 5 }] }),
    (err: unknown) => err instanceof BudgetWriteError && err.status === 404,
  );
});

test('validateItem checks amounts and requires something to change', () => {
  assert.deepEqual(validateItem({ category_id: 'c', amount: '12.345' }), { category_id: 'c', amount: 12.35 });
  assert.deepEqual(validateItem({ category_id: 'c', amount: '' }), { category_id: 'c', amount: null });
  assert.throws(() => validateItem({ category_id: 'c', amount: -1 }), BudgetWriteError);
  assert.throws(() => validateItem({ category_id: 'c' }), /Nothing to change/);
  assert.throws(() => validateItem({ amount: 5 }), /category/);
  assert.ok(isMissingTable({ code: '42P01', message: 'relation "public.budget_periods" does not exist' }, 'budget_periods'));
  assert.ok(!isMissingTable({ code: '42P01', message: 'relation "x" does not exist' }, 'budget_periods'));
});
