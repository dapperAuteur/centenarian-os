// lib/finance/budgets/months.ts
// Calendar-month helpers for budgets. A month is the string 'YYYY-MM'.
//
// No imports on purpose: runs in API routes, in the browser and under
// `node --test --experimental-strip-types` (tests/unit/budgets.test.ts).

/** A calendar month, 'YYYY-MM'. */
export type MonthKey = string;

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** True for a well-formed 'YYYY-MM'. */
export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === 'string' && MONTH_RE.test(value);
}

/** 'YYYY-MM' for a Date, in the Date's local time. */
export function monthOf(date: Date): MonthKey {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** 'YYYY-MM' from a 'YYYY-MM-DD' date string. */
export function monthOfDate(dateStr: string): MonthKey {
  return dateStr.slice(0, 7);
}

/** The month `n` months after `month` (negative goes back). */
export function addMonths(month: MonthKey, n: number): MonthKey {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1 + n;
  const y = year + Math.floor(index / 12);
  const m = ((index % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Every month from `start` to `end`, both included, oldest first. Empty when start > end. */
export function monthRange(start: MonthKey, end: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  for (let m = start; m <= end; m = addMonths(m, 1)) out.push(m);
  return out;
}

/** First day of the month, 'YYYY-MM-01' (the form budget_periods.month stores). */
export function firstDay(month: MonthKey): string {
  return `${month}-01`;
}

/** Last day of the month, 'YYYY-MM-DD'. */
export function lastDay(month: MonthKey): string {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${String(days).padStart(2, '0')}`;
}

/** "Oct 2026" for display. */
export function monthLabel(month: MonthKey, style: 'short' | 'long' = 'short'): string {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 15));
  return date.toLocaleDateString('en-US', { month: style, year: 'numeric', timeZone: 'UTC' });
}
