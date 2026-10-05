// lib/finance/debt/amortize.ts
// Payoff math for ONE debt: a credit card or a loan. Pure, no imports beyond ./dates.ts.
//
// ALL RESULTS ARE ESTIMATES. They are shown to people as "estimate", never as what a lender will
// charge. The rules, in one place:
//
//   Money is worked in integer cents and rounded to the cent every month, like a statement.
//
//   Monthly interest = balance x APR / 12.
//     Cards really charge the average daily balance x (APR / 365) x days in the cycle. For a
//     balance that only changes on the payment date that comes to balance x APR x days / 365,
//     which averages out to APR / 12 over a year (30.42 days per cycle). The monthly form is used
//     so a schedule reads month by month; the difference is a few cents a month.
//     Installment loans (simple interest) charge the same thing on the principal still owed.
//
//   Each month: interest is added, then the payment is taken (never more than what is owed).
//
//   A payment that does not cover the first month's interest never pays the debt off; the result
//   says so (neverPaysOff) instead of running for ever.
//
//   Paying early: amount x APR / 365 x days early. On a card this is interest avoided on the
//   average daily balance; on a simple-interest loan it is the interest that stops accruing.

import { addMonthsToDate, monthlyPaymentsUntil } from './dates.ts';

/** Longest schedule computed: 50 years. Anything longer is reported as never paying off. */
export const MAX_MONTHS = 600;

export const toCents = (dollars: number): number => Math.round(dollars * 100);
export const toDollars = (cents: number): number => Math.round(cents) / 100;

/** Monthly periodic rate for an APR given in percent (23.99 -> 0.019991...). */
export function monthlyRate(aprPercent: number | null | undefined): number {
  const apr = Number(aprPercent);
  if (!Number.isFinite(apr) || apr <= 0) return 0;
  return apr / 100 / 12;
}

/** One month's interest in cents on a balance in cents. */
export function monthlyInterestCents(balanceCents: number, aprPercent: number | null | undefined): number {
  if (balanceCents <= 0) return 0;
  return Math.round(balanceCents * monthlyRate(aprPercent));
}

export interface ScheduleRow {
  /** 1 for the first payment. */
  month: number;
  /** Payment date, 'YYYY-MM-DD'. */
  date: string;
  payment: number;
  interest: number;
  principal: number;
  /** What is still owed after this payment. */
  balance: number;
}

export interface PayoffResult {
  /** Number of payments, or null when the payment never pays the debt off. */
  months: number | null;
  /** Date of the last payment, or null when it never pays off. */
  payoffDate: string | null;
  totalInterest: number;
  totalPaid: number;
  neverPaysOff: boolean;
  schedule: ScheduleRow[];
}

/**
 * Pay a fixed amount every month: how long, what it costs.
 *
 * The first payment is one month after `startDate` (pass the day before the next due date to
 * start on that due date).
 */
export function payoffSchedule(
  balance: number,
  aprPercent: number | null | undefined,
  payment: number,
  startDate: string,
  maxMonths = MAX_MONTHS,
): PayoffResult {
  let owed = toCents(balance);
  const pay = toCents(payment);
  const schedule: ScheduleRow[] = [];
  let interestTotal = 0;
  let paidTotal = 0;

  if (owed <= 0) {
    return { months: 0, payoffDate: startDate, totalInterest: 0, totalPaid: 0, neverPaysOff: false, schedule };
  }
  if (pay <= monthlyInterestCents(owed, aprPercent)) {
    return { months: null, payoffDate: null, totalInterest: 0, totalPaid: 0, neverPaysOff: true, schedule };
  }

  for (let month = 1; month <= maxMonths && owed > 0; month += 1) {
    const interest = monthlyInterestCents(owed, aprPercent);
    owed += interest;
    const thisPayment = Math.min(pay, owed);
    owed -= thisPayment;
    interestTotal += interest;
    paidTotal += thisPayment;
    schedule.push({
      month,
      date: addMonthsToDate(startDate, month),
      payment: toDollars(thisPayment),
      interest: toDollars(interest),
      principal: toDollars(thisPayment - interest),
      balance: toDollars(owed),
    });
  }

  if (owed > 0) {
    return {
      months: null,
      payoffDate: null,
      totalInterest: toDollars(interestTotal),
      totalPaid: toDollars(paidTotal),
      neverPaysOff: true,
      schedule,
    };
  }
  return {
    months: schedule.length,
    payoffDate: schedule[schedule.length - 1].date,
    totalInterest: toDollars(interestTotal),
    totalPaid: toDollars(paidTotal),
    neverPaysOff: false,
    schedule,
  };
}

/**
 * The fixed monthly payment that pays `balance` off in exactly `months` payments (the standard
 * amortization formula, rounded UP to the cent so the last payment is never short).
 */
export function paymentForMonths(balance: number, aprPercent: number | null | undefined, months: number): number {
  if (balance <= 0) return 0;
  const n = Math.max(1, Math.floor(months));
  const r = monthlyRate(aprPercent);
  const raw = r === 0 ? balance / n : (balance * r) / (1 - Math.pow(1 + r, -n));
  // Round up to the cent, then step up a cent at a time if month-by-month rounding left a remainder.
  let cents = Math.ceil(raw * 100 - 1e-9);
  for (let guard = 0; guard < 100; guard += 1) {
    const result = payoffSchedule(balance, aprPercent, cents / 100, '2000-01-01', n);
    if (!result.neverPaysOff && result.months !== null && result.months <= n) break;
    cents += 1;
  }
  return cents / 100;
}

export interface PayByDateResult {
  /** Payments that fit between startDate and the target date. */
  months: number;
  payment: number;
  totalInterest: number;
  /** The target date is not even a month away: pay the whole balance now. */
  payInFull: boolean;
}

/** "Pay it off by `targetDate`": the monthly payment needed, first payment a month after startDate. */
export function paymentByDate(
  balance: number,
  aprPercent: number | null | undefined,
  startDate: string,
  targetDate: string,
): PayByDateResult {
  const months = monthlyPaymentsUntil(startDate, targetDate);
  if (months < 1) {
    return { months: 0, payment: Math.max(0, balance), totalInterest: 0, payInFull: true };
  }
  const payment = paymentForMonths(balance, aprPercent, months);
  const result = payoffSchedule(balance, aprPercent, payment, startDate, months);
  return { months, payment, totalInterest: result.totalInterest, payInFull: false };
}

/**
 * Estimated interest saved by paying `amount` `daysEarly` days sooner:
 * amount x APR / 365 x days. Rounded to the cent. An estimate, labeled as one wherever it shows.
 * Example: $500 ten days early at 23.99% -> $3.29.
 */
export function earlyPaymentSavings(amount: number, aprPercent: number | null | undefined, daysEarly: number): number {
  const apr = Number(aprPercent);
  if (!(amount > 0) || !(daysEarly > 0) || !Number.isFinite(apr) || apr <= 0) return 0;
  return Math.round(((amount * (apr / 100)) / 365) * daysEarly * 100) / 100;
}

/**
 * A minimum payment to use when the statement didn't give one: the larger of $25 and 1% of the
 * balance plus a month's interest (the common card formula), never more than the balance.
 * Marked as an estimate wherever it is used.
 */
export function estimatedMinimumPayment(balance: number, aprPercent: number | null | undefined): number {
  const owed = toCents(balance);
  if (owed <= 0) return 0;
  const formula = Math.round(owed * 0.01) + monthlyInterestCents(owed, aprPercent);
  return toDollars(Math.min(owed + monthlyInterestCents(owed, aprPercent), Math.max(2500, formula)));
}

// ── Deferred-interest promotions ────────────────────────────────────────────────────────────────

export interface PromoPace {
  /** Payments left before the promo expires (at least 1 while it hasn't expired). */
  paymentsLeft: number;
  /** Monthly amount that clears the promo balance by its expiry. */
  monthly: number;
  /** The expiry date has passed. */
  expired: boolean;
}

/**
 * The monthly payment that clears a deferred-interest promo balance before it expires.
 * Promo balances charge no interest while the promo lasts, so this is balance / payments left,
 * rounded up to the cent. When the expiry is less than a month away the whole balance is due.
 */
export function promoRequiredMonthly(promoBalance: number, today: string, expiresOn: string): PromoPace {
  if (expiresOn < today) return { paymentsLeft: 0, monthly: Math.max(0, promoBalance), expired: true };
  const paymentsLeft = Math.max(1, monthlyPaymentsUntil(today, expiresOn));
  const monthly = promoBalance > 0 ? Math.ceil((promoBalance * 100) / paymentsLeft - 1e-9) / 100 : 0;
  return { paymentsLeft, monthly, expired: false };
}

/**
 * The interest charged all at once if a deferred-interest promo is not paid off in time.
 * The statement's own figure when it printed one (exact); otherwise an estimate: the promo
 * balance x APR / 12 for every month since the promo started. Null when neither is known.
 */
export function backInterestAtRisk(input: {
  deferredInterest?: number | null;
  balance: number;
  aprPercent?: number | null;
  startedOn?: string | null;
  today: string;
}): { amount: number; estimated: boolean } | null {
  if (input.deferredInterest != null && Number.isFinite(Number(input.deferredInterest))) {
    return { amount: Math.round(Number(input.deferredInterest) * 100) / 100, estimated: false };
  }
  const r = monthlyRate(input.aprPercent);
  if (!input.startedOn || r === 0 || !(input.balance > 0)) return null;
  const months = monthlyPaymentsUntil(input.startedOn, input.today);
  if (months < 1) return null;
  return { amount: Math.round(input.balance * r * months * 100) / 100, estimated: true };
}
