// lib/finance/debt/dates.ts
// Calendar-date helpers for the debt math. A date is the string 'YYYY-MM-DD'.
//
// Pure and time-zone free: every calculation goes through Date.UTC, so the
// same input gives the same answer on the server, in the browser and under
// `node --test --experimental-strip-types` (tests/unit/debt.test.ts).
// No imports on purpose.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** True for a well-formed 'YYYY-MM-DD'. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(Number(m[1]), month);
}

function parts(date: string): [number, number, number] {
  return [Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10))];
}

function fmt(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Days in a month (month is 1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The date `n` days after `date` (negative goes back). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = parts(date);
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY_MS);
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/**
 * The date `n` months after `date`. The day is kept, and clamped to the end of a shorter month
 * (Jan 31 + 1 month = Feb 28/29), the way card issuers move a due date.
 */
export function addMonthsToDate(date: string, n: number): string {
  const [y, m, d] = parts(date);
  const index = m - 1 + n;
  const ny = y + Math.floor(index / 12);
  const nm = (((index % 12) + 12) % 12) + 1;
  return fmt(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}

/**
 * How many monthly payments fall after `from` and on or before `deadline`, when the first one
 * is a month after `from`: the count of k >= 1 with addMonthsToDate(from, k) <= deadline.
 */
export function monthlyPaymentsUntil(from: string, deadline: string): number {
  if (deadline <= from) return 0;
  let k = 0;
  while (addMonthsToDate(from, k + 1) <= deadline) k += 1;
  return k;
}

/** 'YYYY-MM' of a date. */
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

/** The date with its day replaced, clamped to the month's length. */
export function withDay(date: string, day: number): string {
  const [y, m] = parts(date);
  return fmt(y, m, Math.min(Math.max(1, Math.round(day)), daysInMonth(y, m)));
}
