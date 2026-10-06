// lib/equipment/depreciation.ts
// Pure depreciation math for equipment items and vehicles (plans/61, section 3).
//
// ESTIMATES, NOT TAX ADVICE. These figures show roughly how much value an item
// loses and what each use costs. Tax depreciation (MACRS, section 179, bonus
// depreciation, conventions) follows different rules; the help article
// "Equipment depreciation" says the same.
//
// RULES (the help article explains the same in plain words)
//
//   Depreciable amount = cost - salvage value, never below 0. Book value =
//   cost - accumulated depreciation, never below the salvage value (the
//   salvage floor). Nothing depreciates before the in-service date.
//
//   Straight line: the depreciable amount spread evenly over the expected
//   life in years, by day: a service year runs from one in-service
//   anniversary to the next, and inside a year the share is days elapsed /
//   days in that service year.
//
//   Declining balance: each service year loses book value x (factor / life
//   years) (factor 2 = double declining balance). When even straight line
//   over the remaining life would lose more, it switches to that, so the
//   item reaches its salvage value at the end of its life. Inside a service
//   year the year's amount is spread by day, like straight line.
//
//   Units of use: rate per use (or per mile) = depreciable / expected uses.
//   Accumulated = rate x uses so far, capped at the depreciable amount. A use
//   with no date (uses logged outside the app) counts on the as-of date.
//
//   Schedules are differences of accumulated depreciation at period starts:
//   a calendar year's depreciation = accumulated on 1 Jan of the next year -
//   accumulated on 1 Jan of that year (same for months).
//
//   Work share = work uses / all uses, or the override percent when one is
//   set. Work-share depreciation = depreciation x work share.

export type DepreciationMethod = 'straight_line' | 'declining_balance' | 'units_of_use';

export const DEPRECIATION_METHODS: readonly DepreciationMethod[] = [
  'straight_line',
  'declining_balance',
  'units_of_use',
];

export const METHOD_LABELS: Record<DepreciationMethod, string> = {
  straight_line: 'Straight line',
  declining_balance: 'Declining balance',
  units_of_use: 'Units of use',
};

/** One use of an item. units = 1 for a use, or the miles of a trip. date = YYYY-MM-DD or null. */
export interface UseEvent {
  date: string | null;
  units: number;
  work?: boolean;
}

export interface DepreciationInput {
  cost: number;
  salvage: number;
  /** YYYY-MM-DD */
  inServiceDate: string;
  method: DepreciationMethod;
  lifeYears: number | null;
  /** Expected uses or miles over the item's life. */
  lifeUnits: number | null;
  /** Declining balance factor; default 2. */
  dbFactor?: number;
  /** Uses (units_of_use only). */
  uses?: UseEvent[];
  /** YYYY-MM-DD the undated uses count on; default today (UTC). */
  asOf?: string;
}

export interface ScheduleRow {
  /** '2026' for a year row, '2026-03' for a month row. */
  period: string;
  depreciation: number;
  accumulated: number;
  bookValue: number;
}

export interface DepreciationSummary {
  depreciable: number;
  accumulated: number;
  bookValue: number;
  /** Depreciation from 1 Jan of the as-of year through the as-of date. */
  thisYearToDate: number;
  /** Scheduled for the whole as-of calendar year (uses so far, for units of use). */
  thisYearScheduled: number;
  /** Date the item reaches its salvage value (years methods only). */
  fullyDepreciatedOn: string | null;
  /** Depreciation per use or per mile, for units of use. */
  ratePerUnit: number | null;
}

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  return fromUtc(toUtc(value)) === value;
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** Same month/day n years later; 29 Feb becomes 28 Feb in a non-leap year. */
export function addYears(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const ty = y + n;
  const lastDay = new Date(Date.UTC(ty, m, 0)).getUTCDate();
  return fromUtc(Date.UTC(ty, m - 1, Math.min(d, lastDay)));
}

function addDays(date: string, n: number): string {
  return fromUtc(toUtc(date) + n * DAY_MS);
}

/** Why the input can't produce a schedule, or null when it can. */
export function checkInput(input: DepreciationInput): string | null {
  if (!Number.isFinite(input.cost) || input.cost <= 0) return 'Add a cost (purchase price) above 0.';
  if (!Number.isFinite(input.salvage) || input.salvage < 0) return 'Salvage value must be 0 or more.';
  if (!isIsoDate(input.inServiceDate)) return 'Add an in-service date (or a purchase date).';
  if (input.method === 'units_of_use') {
    if (!input.lifeUnits || input.lifeUnits <= 0) return 'Units of use needs the expected number of uses (or miles).';
  } else if (!input.lifeYears || input.lifeYears <= 0) {
    return 'Add an expected life in years.';
  }
  if (input.dbFactor !== undefined && !(input.dbFactor > 0)) return 'The declining balance factor must be above 0.';
  return null;
}

export function depreciableAmount(input: DepreciationInput): number {
  return Math.max(0, input.cost - Math.max(0, input.salvage));
}

/** Whole service years completed by `date`, and the fraction of the current one. */
function serviceYears(inService: string, date: string): { whole: number; fraction: number } {
  if (date <= inService) return { whole: 0, fraction: 0 };
  let whole = Math.max(0, new Date(toUtc(date)).getUTCFullYear() - new Date(toUtc(inService)).getUTCFullYear() - 1);
  while (addYears(inService, whole + 1) <= date) whole += 1;
  const start = addYears(inService, whole);
  const end = addYears(inService, whole + 1);
  return { whole, fraction: daysBetween(start, date) / daysBetween(start, end) };
}

/** Declining balance amount for each service year (with the switch to straight line). */
export function decliningBalanceYears(input: DepreciationInput): number[] {
  const life = input.lifeYears ?? 0;
  if (life <= 0) return [];
  const salvage = Math.max(0, input.salvage);
  const rate = (input.dbFactor ?? 2) / life;
  const years = Math.ceil(life);
  const out: number[] = [];
  let book = input.cost;
  for (let i = 0; i < years; i++) {
    const left = book - salvage;
    if (left <= 0) {
      out.push(0);
      continue;
    }
    const remainingLife = life - i;
    const db = book * rate;
    const sl = remainingLife <= 1 ? left : left / remainingLife;
    const amount = Math.min(Math.max(db, sl), left);
    out.push(amount);
    book -= amount;
  }
  return out;
}

function unitsThrough(input: DepreciationInput, date: string, inclusive: boolean): number {
  const asOf = input.asOf ?? todayUtc();
  let total = 0;
  for (const use of input.uses ?? []) {
    const d = use.date && isIsoDate(use.date) ? use.date : asOf;
    if (d < input.inServiceDate) continue;
    if (inclusive ? d <= date : d < date) total += Math.max(0, Number(use.units) || 0);
  }
  return total;
}

/**
 * Accumulated depreciation at the START of `date` (so a use on `date` is not
 * yet counted). Use accumulatedThrough() for "as of the end of that day".
 */
export function accumulatedAt(input: DepreciationInput, date: string): number {
  if (checkInput(input)) return 0;
  const depreciable = depreciableAmount(input);
  if (depreciable === 0 || (date <= input.inServiceDate && input.method !== 'units_of_use')) return 0;

  if (input.method === 'units_of_use') {
    const rate = depreciable / (input.lifeUnits as number);
    return Math.min(depreciable, rate * unitsThrough(input, date, false));
  }

  const { whole, fraction } = serviceYears(input.inServiceDate, date);
  if (input.method === 'straight_line') {
    const life = input.lifeYears as number;
    return Math.min(depreciable, (depreciable * (whole + fraction)) / life);
  }

  const years = decliningBalanceYears(input);
  let acc = 0;
  for (let i = 0; i < Math.min(whole, years.length); i++) acc += years[i];
  if (whole < years.length) {
    // A fractional final year is shorter than a full service year.
    const life = input.lifeYears as number;
    const yearLength = whole + 1 > life ? life - whole : 1;
    acc += years[whole] * Math.min(1, fraction / yearLength);
  }
  return Math.min(depreciable, acc);
}

/** Accumulated depreciation at the end of `date` (counts that day's uses and time). */
export function accumulatedThrough(input: DepreciationInput, date: string): number {
  if (input.method === 'units_of_use') {
    if (checkInput(input)) return 0;
    const depreciable = depreciableAmount(input);
    const rate = depreciable / (input.lifeUnits as number);
    return Math.min(depreciable, rate * unitsThrough(input, date, true));
  }
  return accumulatedAt(input, addDays(date, 1));
}

/** The date the item reaches its salvage value, or null (units of use, or invalid input). */
export function fullyDepreciatedOn(input: DepreciationInput): string | null {
  if (checkInput(input) || input.method === 'units_of_use') return null;
  const life = input.lifeYears as number;
  const whole = Math.floor(life);
  const start = addYears(input.inServiceDate, whole);
  const frac = life - whole;
  if (frac === 0) return start;
  const yearDays = daysBetween(start, addYears(input.inServiceDate, whole + 1));
  return addDays(start, Math.round(frac * yearDays));
}

function lastYear(input: DepreciationInput): number {
  const asOf = input.asOf ?? todayUtc();
  const end = fullyDepreciatedOn(input);
  if (end) return Number(end.slice(0, 4));
  let last = Number(asOf.slice(0, 4));
  for (const use of input.uses ?? []) {
    if (use.date && isIsoDate(use.date)) last = Math.max(last, Number(use.date.slice(0, 4)));
  }
  return last;
}

/** Calendar-year schedule from the in-service year to the end of life (or the as-of year). */
export function yearlySchedule(input: DepreciationInput): ScheduleRow[] {
  if (checkInput(input)) return [];
  const first = Number(input.inServiceDate.slice(0, 4));
  const last = Math.max(first, lastYear(input));
  const rows: ScheduleRow[] = [];
  for (let y = first; y <= last; y++) {
    const start = accumulatedAt(input, `${y}-01-01`);
    const end = accumulatedAt(input, `${y + 1}-01-01`);
    rows.push({
      period: String(y),
      depreciation: round2(round2(end) - round2(start)),
      accumulated: round2(end),
      bookValue: round2(input.cost - end),
    });
  }
  return rows;
}

/** Month-by-month schedule between two YYYY-MM months (inclusive). */
export function monthlySchedule(input: DepreciationInput, fromMonth: string, toMonth: string): ScheduleRow[] {
  if (checkInput(input)) return [];
  const rows: ScheduleRow[] = [];
  let [y, m] = fromMonth.split('-').map(Number);
  const [ty, tm] = toMonth.split('-').map(Number);
  let guard = 0;
  while ((y < ty || (y === ty && m <= tm)) && guard < 1200) {
    const period = `${y}-${String(m).padStart(2, '0')}`;
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    const start = accumulatedAt(input, `${period}-01`);
    const end = accumulatedAt(input, `${ny}-${String(nm).padStart(2, '0')}-01`);
    rows.push({
      period,
      depreciation: round2(round2(end) - round2(start)),
      accumulated: round2(end),
      bookValue: round2(input.cost - end),
    });
    y = ny;
    m = nm;
    guard += 1;
  }
  return rows;
}

export function summarize(input: DepreciationInput): DepreciationSummary | null {
  if (checkInput(input)) return null;
  const asOf = input.asOf ?? todayUtc();
  const year = Number(asOf.slice(0, 4));
  const accumulated = accumulatedThrough(input, asOf);
  const yearStart = accumulatedAt(input, `${year}-01-01`);
  const depreciable = depreciableAmount(input);
  return {
    depreciable: round2(depreciable),
    accumulated: round2(accumulated),
    bookValue: round2(input.cost - accumulated),
    thisYearToDate: round2(accumulated - yearStart),
    thisYearScheduled: round2(accumulatedAt(input, `${year + 1}-01-01`) - yearStart),
    fullyDepreciatedOn: fullyDepreciatedOn(input),
    ratePerUnit: input.method === 'units_of_use' ? depreciable / (input.lifeUnits as number) : null,
  };
}

// ── Uses and work share ─────────────────────────────────────────────────────

export interface UseCounts {
  all: number;
  work: number;
}

/** Uses (or miles) in [from, to) by date; undated uses count only when no range is given. */
export function countUses(uses: UseEvent[], from?: string, to?: string): UseCounts {
  let all = 0;
  let work = 0;
  for (const use of uses) {
    const units = Math.max(0, Number(use.units) || 0);
    if (from || to) {
      if (!use.date || !isIsoDate(use.date)) continue;
      if (from && use.date < from) continue;
      if (to && use.date >= to) continue;
    }
    all += units;
    if (use.work) work += units;
  }
  return { all, work };
}

/** Work share 0..1: the override percent when set, else work / all; null with no uses. */
export function workShare(counts: UseCounts, overridePercent: number | null | undefined): number | null {
  if (overridePercent !== null && overridePercent !== undefined && Number.isFinite(overridePercent)) {
    return Math.min(1, Math.max(0, overridePercent / 100));
  }
  if (counts.all <= 0) return null;
  return Math.min(1, counts.work / counts.all);
}

export function workShareAmount(amount: number, share: number | null): number {
  return share === null ? 0 : round2(amount * share);
}

/**
 * Depreciation per use: the rate per unit for units of use, otherwise
 * accumulated depreciation so far / uses so far. null with no uses.
 */
export function costPerUse(summary: DepreciationSummary, totalUses: number): number | null {
  if (summary.ratePerUnit !== null) return round2(summary.ratePerUnit);
  if (totalUses <= 0) return null;
  return round2(summary.accumulated / totalUses);
}
