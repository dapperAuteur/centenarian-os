// lib/finance/debt/plan.ts
// The debt-free plan: one monthly budget (every debt's minimum + an extra amount) spread across
// all debts by a strategy, simulated month by month. Pure; estimates only.
//
// STRATEGIES
//   avalanche   (default) highest APR first; ties go to the smaller balance. This pays the least
//               interest. BAM's rule (plans/61, 2026-10-05): balances under a deferred-interest
//               promo are cleared before their deadline first. That is the "promo guard" below,
//               on by default for every strategy except promo_first (which already does it).
//   snowball    smallest balance first; ties go to the higher APR.
//   promo_first every promo balance first, earliest expiry first, then avalanche.
//   custom      the order the person chose; debts left out of it follow, in avalanche order.
//
// EACH MONTH
//   1. A promo whose expiry is before this month's payment date and still has a balance is
//      missed: that balance moves to the regular (interest-bearing) part and the deferred
//      interest is added on top (the statement's figure, else an estimate, see backInterest()).
//   2. Interest: regular part x APR / 12 (see amortize.ts). Promo parts charge none while the
//      promo lasts (deferred interest).
//   3. Budget = sum of every debt's starting minimum + extra. The amount stays the same when a
//      debt is paid off, so its minimum rolls over to the next target (how avalanche and
//      snowball work). With rollover off (the "minimums only" comparison) each debt just pays its
//      own minimum and nothing moves.
//   4. Every debt with a balance gets its minimum (or what it owes, if less).
//   5. Promo guard: for each promo still open, earliest expiry first, enough of what is left is
//      put on that promo balance to clear it one payment BEFORE it expires (a cycle of margin:
//      card payments post a few days late, and statements close before the expiry date).
//   6. Whatever is left goes to the strategy's targets, in order, until it runs out.
//
// WHERE A PAYMENT LANDS INSIDE ONE CARD
//   Money the plan puts on a promo goes to that promo balance. Every other payment goes to the
//   regular (interest-bearing) part first, then to promo balances by earliest expiry. Under the
//   CARD Act the issuer applies the amount above the minimum to the highest-APR balance, and to a
//   deferred-interest balance in the last two cycles before it expires, or when you ask; the
//   schedule assumes you ask. Issuers may apply the minimum itself to the lowest-rate balance.

import {
  estimatedMinimumPayment,
  MAX_MONTHS,
  monthlyInterestCents,
  monthlyRate,
  toCents,
  toDollars,
} from './amortize.ts';
import { addMonthsToDate, monthlyPaymentsUntil } from './dates.ts';

export const STRATEGIES = ['avalanche', 'snowball', 'promo_first', 'custom'] as const;
export type Strategy = (typeof STRATEGIES)[number];
export const DEFAULT_STRATEGY: Strategy = 'avalanche';

export const STRATEGY_LABELS: Record<Strategy, string> = {
  avalanche: 'Highest interest first (avalanche), promo deadlines protected',
  snowball: 'Smallest balance first (snowball)',
  promo_first: 'Promo deadlines first',
  custom: 'My own order',
};

export function isStrategy(value: unknown): value is Strategy {
  return typeof value === 'string' && (STRATEGIES as readonly string[]).includes(value);
}

export interface PlanPromo {
  /** Stable key within the debt (lib/finance/debt/overview.ts promoKey()). */
  id: string;
  description?: string;
  /** Part of the debt's balance under the promo, dollars. */
  balance: number;
  /** 'YYYY-MM-DD'. */
  expiresOn: string;
  /** From the statement (exact) when printed; null to estimate. */
  deferredInterest?: number | null;
  startedOn?: string | null;
}

export interface PlanDebt {
  id: string;
  name: string;
  /** Total owed, dollars, promo balances included. */
  balance: number;
  /** APR in percent on the regular part. */
  apr: number | null;
  /** Minimum monthly payment; null or 0 to use estimatedMinimumPayment(). */
  minPayment: number | null;
  promos?: PlanPromo[];
}

export interface PlanOptions {
  strategy?: Strategy;
  extraMonthly?: number;
  /** Debt ids, first paid first. Only used by 'custom'. */
  customOrder?: string[];
  /** Day before the first payment; the first payment is a month after. 'YYYY-MM-DD'. */
  startDate: string;
  /** Clear promo balances before their deadline first. Default true. */
  protectPromos?: boolean;
  /** Freed-up minimums roll to the next debt. Default true; false is the "minimums only" baseline. */
  rollover?: boolean;
  maxMonths?: number;
}

export interface PlanDebtMonth {
  payment: number;
  interest: number;
  balance: number;
}

export interface PlanMonth {
  month: number;
  date: string;
  payment: number;
  interest: number;
  balance: number;
  debts: Record<string, PlanDebtMonth>;
}

export interface MissedPromo {
  debtId: string;
  promoId: string;
  date: string;
  balance: number;
  backInterest: number;
  backInterestEstimated: boolean;
}

export interface PlanResult {
  strategy: Strategy;
  /** Months to debt-free, or null when the budget never gets there. */
  months: number | null;
  debtFreeDate: string | null;
  totalInterest: number;
  totalPaid: number;
  neverPaysOff: boolean;
  monthlyBudget: number;
  /** Debts whose minimum was estimated because none was given. */
  estimatedMinimums: string[];
  payoffDates: Record<string, string | null>;
  /** Order debts were targeted in the first month (after the promo guard). */
  firstMonthOrder: string[];
  missedPromos: MissedPromo[];
  schedule: PlanMonth[];
}

interface SimPromo {
  id: string;
  owed: number; // cents
  expiresOn: string;
  deferredInterest: number | null; // cents, exact
  startedOn: string | null;
  missed: boolean;
}

interface SimDebt {
  id: string;
  name: string;
  apr: number;
  min: number; // cents
  regular: number; // cents
  promos: SimPromo[];
  paidOffOn: string | null;
}

const owedOf = (d: SimDebt): number => d.regular + d.promos.reduce((s, p) => s + (p.missed ? 0 : p.owed), 0);

/**
 * The rate the debt is charging right now: its APR while any regular (interest-bearing) balance
 * is left, 0 when everything left is under a deferred-interest promo. Avalanche ranks by this, so
 * a promo-only card isn't paid ahead of debts that are charging interest; the promo guard is what
 * makes sure it is still cleared before its deadline.
 */
const effectiveApr = (d: SimDebt): number => (d.regular > 0 ? d.apr : 0);

function compareAvalanche(a: SimDebt, b: SimDebt): number {
  return effectiveApr(b) - effectiveApr(a) || owedOf(a) - owedOf(b) || a.id.localeCompare(b.id);
}

function compareSnowball(a: SimDebt, b: SimDebt): number {
  return owedOf(a) - owedOf(b) || b.apr - a.apr || a.id.localeCompare(b.id);
}

/** The order debts get the left-over money in, for one month. */
function targetOrder(debts: SimDebt[], strategy: Strategy, customOrder: string[] = []): SimDebt[] {
  const open = debts.filter((d) => owedOf(d) > 0);
  if (strategy === 'snowball') return [...open].sort(compareSnowball);
  if (strategy === 'custom') {
    const rank = new Map(customOrder.map((id, i) => [id, i]));
    return [...open].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : Number.POSITIVE_INFINITY;
      const rb = rank.has(b.id) ? rank.get(b.id)! : Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
      return compareAvalanche(a, b);
    });
  }
  // avalanche and promo_first (promo_first handles promos before this order applies)
  return [...open].sort(compareAvalanche);
}

/**
 * Deferred interest charged when a promo is missed: the statement's figure when given, else
 * balance x APR / 12 for each month since the promo started, else 12 months of it (a typical
 * 12-month promo). Always an estimate unless the statement printed it.
 */
function backInterest(promo: SimPromo, apr: number, date: string): { cents: number; estimated: boolean } {
  if (promo.deferredInterest != null) return { cents: promo.deferredInterest, estimated: false };
  const months = promo.startedOn ? Math.max(1, monthlyPaymentsUntil(promo.startedOn, date)) : 12;
  return { cents: Math.round(promo.owed * monthlyRate(apr) * months), estimated: true };
}

/** Pay `amount` cents into a debt: regular part first, then promos by earliest expiry. */
function applyGeneral(debt: SimDebt, amount: number): number {
  let left = amount;
  const toRegular = Math.min(left, debt.regular);
  debt.regular -= toRegular;
  left -= toRegular;
  const open = debt.promos.filter((p) => !p.missed && p.owed > 0).sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
  for (const promo of open) {
    if (left <= 0) break;
    const x = Math.min(left, promo.owed);
    promo.owed -= x;
    left -= x;
  }
  return amount - left;
}

/** Pay `amount` cents into one promo balance. Returns what was used. */
function applyToPromo(promo: SimPromo, amount: number): number {
  const x = Math.min(amount, promo.owed);
  promo.owed -= x;
  return x;
}

export function buildPlan(input: PlanDebt[], options: PlanOptions): PlanResult {
  const strategy: Strategy = isStrategy(options.strategy) ? options.strategy : DEFAULT_STRATEGY;
  const extra = Math.max(0, toCents(options.extraMonthly ?? 0));
  const protectPromos = options.protectPromos ?? true;
  const rollover = options.rollover ?? true;
  const maxMonths = options.maxMonths ?? MAX_MONTHS;
  const estimatedMinimums: string[] = [];

  const debts: SimDebt[] = input
    .filter((d) => toCents(d.balance) > 0)
    .map((d) => {
      const total = toCents(d.balance);
      const promos: SimPromo[] = (d.promos ?? [])
        .filter((p) => toCents(p.balance) > 0 && p.expiresOn)
        .map((p) => ({
          id: p.id,
          owed: toCents(p.balance),
          expiresOn: p.expiresOn,
          deferredInterest: p.deferredInterest != null && Number.isFinite(Number(p.deferredInterest)) ? toCents(Number(p.deferredInterest)) : null,
          startedOn: p.startedOn ?? null,
          missed: false,
        }));
      // Promo balances can't exceed the total owed; trim the latest-expiring first if they do.
      let promoSum = promos.reduce((s, p) => s + p.owed, 0);
      for (const p of [...promos].sort((a, b) => b.expiresOn.localeCompare(a.expiresOn))) {
        if (promoSum <= total) break;
        const cut = Math.min(p.owed, promoSum - total);
        p.owed -= cut;
        promoSum -= cut;
      }
      let min = toCents(d.minPayment ?? 0);
      if (!(min > 0)) {
        min = toCents(estimatedMinimumPayment(d.balance, d.apr));
        estimatedMinimums.push(d.id);
      }
      return {
        id: d.id,
        name: d.name,
        apr: Number(d.apr) > 0 ? Number(d.apr) : 0,
        min,
        regular: total - promoSum,
        promos: promos.filter((p) => p.owed > 0),
        paidOffOn: null,
      };
    });

  const budget = debts.reduce((s, d) => s + d.min, 0) + extra;
  const schedule: PlanMonth[] = [];
  const missedPromos: MissedPromo[] = [];
  let interestTotal = 0;
  let paidTotal = 0;
  let firstMonthOrder: string[] = [];
  let finished = debts.length === 0;

  for (let month = 1; month <= maxMonths && !finished; month += 1) {
    const date = addMonthsToDate(options.startDate, month);
    const row: PlanMonth = { month, date, payment: 0, interest: 0, balance: 0, debts: {} };
    const paid = new Map<string, number>();
    const interestOf = new Map<string, number>();

    // 1. Missed promos.
    for (const d of debts) {
      for (const p of d.promos) {
        if (p.missed || p.owed <= 0 || p.expiresOn >= date) continue;
        const back = backInterest(p, d.apr, date);
        missedPromos.push({
          debtId: d.id,
          promoId: p.id,
          date: p.expiresOn,
          balance: toDollars(p.owed),
          backInterest: toDollars(back.cents),
          backInterestEstimated: back.estimated,
        });
        d.regular += p.owed + back.cents;
        interestTotal += back.cents;
        interestOf.set(d.id, (interestOf.get(d.id) ?? 0) + back.cents);
        p.owed = 0;
        p.missed = true;
      }
    }

    // 2. Interest on the regular part.
    for (const d of debts) {
      const i = monthlyInterestCents(d.regular, d.apr);
      d.regular += i;
      interestTotal += i;
      interestOf.set(d.id, (interestOf.get(d.id) ?? 0) + i);
    }

    // What each promo owed before this month's payments (the guard's pace counts the minimum).
    const promoStart = new Map<SimPromo, number>();
    for (const d of debts) for (const p of d.promos) promoStart.set(p, p.owed);

    // 3-4. Minimums.
    const monthBudget = rollover ? budget : debts.reduce((s, d) => s + (owedOf(d) > 0 ? d.min : 0), 0);
    let pool = monthBudget;
    for (const d of debts) {
      const owed = owedOf(d);
      if (owed <= 0) continue;
      const x = applyGeneral(d, Math.min(d.min, owed, pool));
      pool -= x;
      paid.set(d.id, (paid.get(d.id) ?? 0) + x);
    }

    if (rollover) {
      // 5. Promo guard / promo_first.
      if (protectPromos || strategy === 'promo_first') {
        const open = debts
          .flatMap((d) => d.promos.filter((p) => !p.missed && p.owed > 0).map((p) => ({ d, p })))
          .sort((a, b) => a.p.expiresOn.localeCompare(b.p.expiresOn) || a.d.id.localeCompare(b.d.id));
        for (const { d, p } of open) {
          if (pool <= 0) break;
          let want: number;
          if (strategy === 'promo_first') {
            want = p.owed;
          } else {
            // Clear it one payment before expiry: payments left on or before the expiry, minus one.
            // Whatever the minimum already put on this promo this month counts toward the pace.
            const left = Math.max(1, monthlyPaymentsUntil(addMonthsToDate(date, -1), p.expiresOn) - 1);
            const start = promoStart.get(p) ?? p.owed;
            want = Math.max(0, Math.ceil(start / left) - (start - p.owed));
          }
          const x = applyToPromo(p, Math.min(want, pool));
          pool -= x;
          paid.set(d.id, (paid.get(d.id) ?? 0) + x);
        }
      }

      // 6. Strategy order.
      const order = targetOrder(debts, strategy, options.customOrder);
      if (month === 1) firstMonthOrder = order.map((d) => d.id);
      for (const d of order) {
        if (pool <= 0) break;
        const x = applyGeneral(d, Math.min(pool, owedOf(d)));
        pool -= x;
        paid.set(d.id, (paid.get(d.id) ?? 0) + x);
      }
    }

    for (const d of debts) {
      const p = paid.get(d.id) ?? 0;
      const i = interestOf.get(d.id) ?? 0;
      const owed = owedOf(d);
      paidTotal += p;
      if (owed <= 0 && d.paidOffOn === null && (p > 0 || i > 0)) d.paidOffOn = date;
      row.debts[d.id] = { payment: toDollars(p), interest: toDollars(i), balance: toDollars(owed) };
      row.payment += p;
      row.interest += i;
      row.balance += owed;
    }
    row.payment = toDollars(row.payment);
    row.interest = toDollars(row.interest);
    const balanceCents = row.balance;
    row.balance = toDollars(row.balance);
    schedule.push(row);

    if (balanceCents <= 0) finished = true;
    // Stuck: no lower than a year ago and no promo left to change things. The payments don't cover
    // the interest, so stop instead of running all 600 months.
    if (!finished && month > 24 && !promosStillOpen(debts) && balanceCents >= toCents(schedule[month - 13].balance)) break;
  }

  const neverPaysOff = !finished;
  return {
    strategy,
    months: neverPaysOff ? null : schedule.length,
    debtFreeDate: neverPaysOff ? null : schedule.length ? schedule[schedule.length - 1].date : options.startDate,
    totalInterest: toDollars(interestTotal),
    totalPaid: toDollars(paidTotal),
    neverPaysOff,
    monthlyBudget: toDollars(budget),
    estimatedMinimums,
    payoffDates: Object.fromEntries(debts.map((d) => [d.id, d.paidOffOn])),
    firstMonthOrder,
    missedPromos,
    schedule,
  };
}

/** True while some promo still has a balance (its expiry can still change the totals). */
function promosStillOpen(debts: SimDebt[]): boolean {
  return debts.some((d) => d.promos.some((p) => !p.missed && p.owed > 0));
}

export interface PlanComparison {
  plan: PlanResult;
  minimumsOnly: PlanResult;
  /** Interest the plan saves versus paying only the minimums. Null when minimums never pay off. */
  interestSaved: number | null;
  /** Months sooner than minimums only. Null when minimums never pay off. */
  monthsSooner: number | null;
}

/** The plan, and the same debts paid with minimums only, for "interest saved". */
export function comparePlan(debts: PlanDebt[], options: PlanOptions): PlanComparison {
  const plan = buildPlan(debts, options);
  const minimumsOnly = buildPlan(debts, {
    ...options,
    extraMonthly: 0,
    rollover: false,
    protectPromos: false,
    strategy: 'avalanche',
  });
  const comparable = !minimumsOnly.neverPaysOff && !plan.neverPaysOff;
  return {
    plan,
    minimumsOnly,
    interestSaved: comparable ? Math.round((minimumsOnly.totalInterest - plan.totalInterest) * 100) / 100 : null,
    monthsSooner: comparable && plan.months !== null && minimumsOnly.months !== null ? minimumsOnly.months - plan.months : null,
  };
}
