// lib/finance/insurance/logic.ts
// Pure rules for life insurance policies (plans/61 §4): premium schedules, matching premium
// payments to transactions, paid to date and next due, term-end warnings, and totals.
//
// RULES (the help article "Life insurance policies" says the same in plain words)
//
//   Schedule
//     - Due dates run from the start date every 1 / 3 / 6 / 12 months (monthly, quarterly,
//       semiannual, annual), on the start date's day of month (the last day in shorter months).
//     - No start date or no premium amount -> no schedule.
//
//   Matching payments
//     - A transaction is a premium payment when it is an expense, dated on or after the start date
//       (30 days of slack before it), and either in the policy's premium category or its vendor /
//       description contains the policy's premium vendor (case-insensitive), AND its amount is within
//       2% (at least $1) of the premium. A policy with neither a category nor a vendor matches nothing.
//     - Paid to date = sum of matched payments. Paid this year = those dated in today's calendar year.
//
//   Next due and paid status
//     - Next due = the first scheduled date on or after today.
//     - That date counts as paid when a matched payment falls after the previous due date and on or
//       before it (paying early covers the coming due date).
//
//   Term end (term life)
//     - Ended: term end date before today. Ending soon (amber): within TERM_WARNING_DAYS (365).
//
//   Totals
//     - Coverage = sum of active policies' coverage. Cash value = active permanent policies
//       (whole / universal life). Yearly premiums = premium x payments per year, active policies.
//
// Imports nothing at runtime (tests/unit/retirement.test.ts covers it too).

export const POLICY_KINDS = ['term_life', 'whole_life', 'universal_life', 'other'] as const;
export type PolicyKind = (typeof POLICY_KINDS)[number];
export const POLICY_KIND_LABEL: Record<PolicyKind, string> = {
  term_life: 'Term life',
  whole_life: 'Whole life',
  universal_life: 'Universal life',
  other: 'Other',
};
export const PERMANENT_KINDS: readonly PolicyKind[] = ['whole_life', 'universal_life'];

export const PREMIUM_MONTHS = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 } as const;
export type PremiumFrequency = keyof typeof PREMIUM_MONTHS;
export const PREMIUM_FREQUENCIES = Object.keys(PREMIUM_MONTHS) as PremiumFrequency[];
export const PREMIUM_FREQUENCY_LABEL: Record<PremiumFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Twice a year',
  annual: 'Yearly',
};

export const TERM_WARNING_DAYS = 365;
const MATCH_TOLERANCE_PCT = 0.02;
const MATCH_TOLERANCE_MIN = 1;
const START_SLACK_DAYS = 30;

export interface PolicyRow {
  id: string;
  kind: string;
  insurer: string;
  coverage_amount: number | string | null;
  premium_amount: number | string | null;
  premium_frequency: string;
  start_date: string | null;
  term_end_date: string | null;
  cash_value: number | string | null;
  premium_category_id: string | null;
  premium_vendor: string | null;
  is_active: boolean;
}

export interface PremiumTxn {
  id: string;
  type: string;
  amount: number | string;
  transaction_date: string;
  category_id: string | null;
  vendor: string | null;
  description: string | null;
}

function n(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

function frequencyMonths(freq: string): number {
  return (PREMIUM_MONTHS as Record<string, number>)[freq] ?? 1;
}

export function paymentsPerYear(freq: string): number {
  return 12 / frequencyMonths(freq);
}

export function isPermanent(kind: string): boolean {
  return (PERMANENT_KINDS as readonly string[]).includes(kind);
}

// ── Dates (UTC, 'YYYY-MM-DD') ────────────────────────────────────────────────

function parts(date: string): [number, number, number] {
  return [Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10))];
}

function pad(x: number): string {
  return String(x).padStart(2, '0');
}

/** `date` + `months`, on the same day of month or the month's last day. */
export function addMonthsClamped(date: string, months: number): string {
  const [y, m, d] = parts(date);
  const index = y * 12 + (m - 1) + months;
  const ny = Math.floor(index / 12);
  const nm = (index % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${pad(nm)}-${pad(Math.min(d, last))}`;
}

export function addDaysTo(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** The scheduled due date on or after `onOrAfter`, and the one before it (null before the first). */
export function dueAround(start: string, freq: string, onOrAfter: string): { previous: string | null; next: string } {
  const step = frequencyMonths(freq);
  if (onOrAfter <= start) return { previous: null, next: start };
  // Jump close, then walk.
  const [sy, sm] = parts(start);
  const [ty, tm] = parts(onOrAfter);
  let k = Math.max(0, Math.floor(((ty - sy) * 12 + (tm - sm)) / step) - 1);
  let next = addMonthsClamped(start, k * step);
  while (next < onOrAfter) {
    k += 1;
    next = addMonthsClamped(start, k * step);
  }
  return { previous: k > 0 ? addMonthsClamped(start, (k - 1) * step) : null, next };
}

// ── Matching ─────────────────────────────────────────────────────────────────

export function isPremiumPayment(policy: PolicyRow, tx: PremiumTxn): boolean {
  if (tx.type !== 'expense') return false;
  const premium = n(policy.premium_amount);
  if (premium === null || premium <= 0) return false;
  const vendor = (policy.premium_vendor ?? '').trim().toLowerCase();
  if (!policy.premium_category_id && !vendor) return false;
  if (policy.start_date && tx.transaction_date < addDaysTo(policy.start_date, -START_SLACK_DAYS)) return false;
  const byCategory = !!policy.premium_category_id && tx.category_id === policy.premium_category_id;
  const text = `${tx.vendor ?? ''} ${tx.description ?? ''}`.toLowerCase();
  const byVendor = !!vendor && text.includes(vendor);
  if (!byCategory && !byVendor) return false;
  const amount = Math.abs(n(tx.amount) ?? 0);
  const tolerance = Math.max(MATCH_TOLERANCE_MIN, premium * MATCH_TOLERANCE_PCT);
  return Math.abs(amount - premium) <= tolerance;
}

export interface PremiumStatus {
  payments: { id: string; date: string; amount: number }[];
  paid_to_date: number;
  paid_this_year: number;
  last_paid: string | null;
  next_due: string | null;
  next_due_paid: boolean;
  yearly_premium: number;
}

export function premiumStatus(policy: PolicyRow, txns: readonly PremiumTxn[], today: string): PremiumStatus {
  const payments = txns
    .filter((tx) => isPremiumPayment(policy, tx))
    .map((tx) => ({ id: tx.id, date: tx.transaction_date, amount: round2(Math.abs(n(tx.amount) ?? 0)) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const year = today.slice(0, 4);
  const paid_to_date = round2(payments.reduce((s, p) => s + p.amount, 0));
  const paid_this_year = round2(payments.filter((p) => p.date.startsWith(year)).reduce((s, p) => s + p.amount, 0));
  const premium = n(policy.premium_amount);
  const yearly_premium = premium === null ? 0 : round2(premium * paymentsPerYear(policy.premium_frequency));

  let next_due: string | null = null;
  let next_due_paid = false;
  const ended = policy.term_end_date !== null && policy.term_end_date < today;
  if (policy.start_date && premium !== null && premium > 0 && !ended) {
    const { previous, next } = dueAround(policy.start_date, policy.premium_frequency, today);
    if (!policy.term_end_date || next <= policy.term_end_date) {
      next_due = next;
      next_due_paid = payments.some((p) => (previous === null || p.date > previous) && p.date <= next);
    }
  }
  return {
    payments,
    paid_to_date,
    paid_this_year,
    last_paid: payments.length ? payments[payments.length - 1].date : null,
    next_due,
    next_due_paid,
    yearly_premium,
  };
}

// ── Term end and totals ──────────────────────────────────────────────────────

export type TermStatus = 'none' | 'active' | 'ending_soon' | 'ended';

export function termStatus(policy: Pick<PolicyRow, 'term_end_date'>, today: string): { status: TermStatus; days_left: number | null } {
  if (!policy.term_end_date) return { status: 'none', days_left: null };
  const days = daysBetween(today, policy.term_end_date);
  if (days < 0) return { status: 'ended', days_left: days };
  if (days <= TERM_WARNING_DAYS) return { status: 'ending_soon', days_left: days };
  return { status: 'active', days_left: days };
}

export interface PolicyTotals {
  coverage: number;
  cash_value: number;
  yearly_premiums: number;
  active: number;
}

export function policyTotals(policies: readonly PolicyRow[]): PolicyTotals {
  const active = policies.filter((p) => p.is_active);
  return {
    coverage: round2(active.reduce((s, p) => s + (n(p.coverage_amount) ?? 0), 0)),
    cash_value: round2(active.filter((p) => isPermanent(p.kind)).reduce((s, p) => s + (n(p.cash_value) ?? 0), 0)),
    yearly_premiums: round2(active.reduce((s, p) => s + (n(p.premium_amount) ?? 0) * paymentsPerYear(p.premium_frequency), 0)),
    active: active.length,
  };
}
