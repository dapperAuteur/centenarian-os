// lib/finance/debt/overview.ts
// Turns database rows (financial_accounts, account_statements, financial_transactions) into the
// debts overview: balance, APR, minimum, due date, promos. Pure; the reads are in server.ts.
//
// RULES
//   Balance owed  = opening_balance + expenses - income on the account, counting only the
//                   transactions after the starting-balance date when one is set: the one balance
//                   rule in ../balance/logic.ts (the accounts API shows it negated for debts).
//   APR           = the latest statement's purchase APR (a balance type with "purchase" in it and
//                   not a promo), else the highest APR the statement lists, else the account's own
//                   interest_rate. Null when none is known.
//   Minimum       = the latest statement's minimum_payment, else an estimate
//                   (amortize.ts estimatedMinimumPayment), marked as one.
//   Promos        = the latest statement's promos with a balance and an expiry date.
//   Credit limit  = the account's credit_limit, else the latest statement's that prints one
//                   (credit-limit.ts creditLimitFor, shared with the Wallet).
//   Currency      = the account's currency (migration 210), else USD. The limit is in it.
//   Linked payment = an income row on the card or loan that transfer tracking linked
//                   (transfer_kind 'card_payment' / 'loan_payment', or any transfer_group_id).
//                   latestLinkedPayment() = the latest day's linked payments, added up.

import {
  backInterestAtRisk,
  estimatedMinimumPayment,
  promoRequiredMonthly,
} from './amortize.ts';
import { daysBetween, isIsoDate } from './dates.ts';
import { amountOwed } from '../balance/logic.ts';
import { isCurrencyCode } from '../fx/math.ts';
import { creditLimitFor } from './credit-limit.ts';
import type { CreditLimitSource } from './credit-limit.ts';
import type { PlanDebt } from './plan.ts';

export const DEBT_ACCOUNT_TYPES = ['credit_card', 'loan'] as const;

/** Promo deadlines this close are flagged (amber). */
export const PROMO_ATTENTION_DAYS = 60;

export interface DebtAccountRow {
  id: string;
  name: string;
  account_type: string;
  institution_name?: string | null;
  last_four?: string | null;
  interest_rate?: number | string | null;
  credit_limit?: number | string | null;
  due_date?: number | string | null;
  opening_balance?: number | string | null;
  /** Migration 221: the day the opening balance is as of. */
  opening_balance_date?: string | null;
  /** Migration 210: the account's currency. */
  currency?: string | null;
  is_active?: boolean | null;
}

export interface StatementApr {
  balance_type?: string;
  apr?: number;
  balance?: number;
  interest?: number;
}

export interface StatementPromo {
  description?: string;
  balance?: number;
  expires_on?: string;
  deferred_interest?: number | null;
  original_amount?: number | null;
  minimum_payment?: number | null;
  started_on?: string | null;
}

export interface StatementRow {
  id: string;
  account_id: string;
  period_start: string | null;
  period_end: string;
  new_balance: number | string | null;
  minimum_payment: number | string | null;
  due_date: string | null;
  interest_charged: number | string | null;
  aprs: StatementApr[] | null;
  promos: StatementPromo[] | null;
  /** Migration 209: the limit the statement prints; optional so older callers still type-check. */
  credit_limit?: number | string | null;
}

export interface TxnRow {
  id: string;
  account_id: string | null;
  amount: number | string;
  type: string;
  transaction_date: string;
  source?: string | null;
  transfer_group_id?: string | null;
  transfer_kind?: string | null;
}

export interface DebtPromo {
  id: string;
  description: string;
  balance: number;
  expiresOn: string;
  daysLeft: number;
  expired: boolean;
  paymentsLeft: number;
  requiredMonthly: number;
  backInterest: number | null;
  backInterestEstimated: boolean;
  needsAttention: boolean;
  startedOn: string | null;
  deferredInterest: number | null;
}

export interface DebtSummary {
  id: string;
  name: string;
  type: 'credit_card' | 'loan';
  institution: string | null;
  lastFour: string | null;
  /** The account's currency (USD before migration 210); the balance and limit are in it. */
  currency: string;
  balance: number;
  creditLimit: number | null;
  /** Where creditLimit came from: the account, or its latest statement (null when unknown). */
  creditLimitSource: CreditLimitSource | null;
  apr: number | null;
  aprSource: 'statement' | 'account' | null;
  aprs: { balanceType: string; apr: number; balance: number | null }[];
  minimumPayment: number;
  minimumEstimated: boolean;
  /** Day of month from the account, or the latest statement's due date's day. */
  dueDay: number | null;
  latestStatement: {
    id: string;
    periodStart: string | null;
    periodEnd: string;
    newBalance: number | null;
    minimumPayment: number | null;
    dueDate: string | null;
    interestCharged: number | null;
  } | null;
  promos: DebtPromo[];
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round2 = (n: number): number => Math.round(n * 100) / 100;

export function isDebtAccountType(t: string): t is 'credit_card' | 'loan' {
  return t === 'credit_card' || t === 'loan';
}

/** opening_balance + expenses - income (after the starting-balance date), in dollars. Positive = owed. */
export function owedFromTransactions(account: DebtAccountRow, txns: TxnRow[]): number {
  return amountOwed(
    { account_type: account.account_type, opening_balance: account.opening_balance, opening_balance_date: account.opening_balance_date },
    txns.filter((t) => t.account_id === account.id),
  );
}

/** A payment into a card or loan that transfer tracking linked. */
export function isLinkedPayment(t: TxnRow): boolean {
  if (t.type !== 'income') return false;
  if (t.transfer_kind === 'card_payment' || t.transfer_kind === 'loan_payment') return true;
  return !!t.transfer_group_id;
}

/**
 * The latest linked payment into one card or loan, dated on or before `today`: the sum of the
 * linked payments on the latest such day (a payment split in two on one day is one payment).
 * Null when nothing was ever linked. The Wallet uses it as a loan's monthly payment when no
 * statement gives one.
 */
export function latestLinkedPayment(
  accountId: string,
  txns: readonly TxnRow[],
  today: string,
): { amount: number; date: string } | null {
  let date: string | null = null;
  let cents = 0;
  for (const t of txns) {
    if (t.account_id !== accountId || !isLinkedPayment(t) || !t.transaction_date) continue;
    const day = t.transaction_date.slice(0, 10);
    if (day > today) continue;
    const amount = Math.round(Math.abs(Number(t.amount)) * 100);
    if (!Number.isFinite(amount)) continue;
    if (date === null || day > date) {
      date = day;
      cents = amount;
    } else if (day === date) {
      cents += amount;
    }
  }
  return date === null || cents <= 0 ? null : { amount: cents / 100, date };
}

/** Stable identity of a promo within an account: expiry + description, lower-cased. */
export function promoKey(p: { expires_on?: string; expiresOn?: string; description?: string }): string {
  const expires = p.expires_on ?? p.expiresOn ?? '';
  const desc = (p.description ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  return `${expires}|${desc}`;
}

export function pickApr(
  aprs: StatementApr[] | null | undefined,
  accountRate: unknown,
): { apr: number | null; source: 'statement' | 'account' | null } {
  const list = (aprs ?? []).filter((a) => num(a.apr) !== null && Number(a.apr) > 0);
  const purchase = list.find((a) => /purchase/i.test(a.balance_type ?? '') && !/promo/i.test(a.balance_type ?? ''));
  if (purchase) return { apr: Number(purchase.apr), source: 'statement' };
  if (list.length) return { apr: Math.max(...list.map((a) => Number(a.apr))), source: 'statement' };
  const rate = num(accountRate);
  if (rate !== null && rate > 0) return { apr: rate, source: 'account' };
  return { apr: null, source: null };
}

export function normalizePromos(
  promos: StatementPromo[] | null | undefined,
  today: string,
  apr: number | null,
): DebtPromo[] {
  return (promos ?? [])
    .filter((p) => isIsoDate(p.expires_on) && (num(p.balance) ?? 0) > 0)
    .map((p) => {
      const balance = num(p.balance)!;
      const expiresOn = p.expires_on!;
      const pace = promoRequiredMonthly(balance, today, expiresOn);
      const back = backInterestAtRisk({
        deferredInterest: num(p.deferred_interest),
        balance,
        aprPercent: apr,
        startedOn: isIsoDate(p.started_on) ? p.started_on : null,
        today,
      });
      const daysLeft = daysBetween(today, expiresOn);
      return {
        id: promoKey(p),
        description: p.description?.trim() || 'Promotional balance',
        balance,
        expiresOn,
        daysLeft,
        expired: pace.expired,
        paymentsLeft: pace.paymentsLeft,
        requiredMonthly: pace.monthly,
        backInterest: back?.amount ?? null,
        backInterestEstimated: back?.estimated ?? false,
        needsAttention: daysLeft <= PROMO_ATTENTION_DAYS,
        startedOn: isIsoDate(p.started_on) ? p.started_on : null,
        deferredInterest: num(p.deferred_interest),
      };
    })
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
}

/** One debt's summary. `statements` may hold any account's rows; the latest of this one's is used. */
export function buildDebtSummary(
  account: DebtAccountRow,
  statements: StatementRow[],
  txns: TxnRow[],
  today: string,
): DebtSummary {
  const own = statements
    .filter((s) => s.account_id === account.id)
    .sort((a, b) => b.period_end.localeCompare(a.period_end));
  const latest = own[0] ?? null;
  const { apr, source } = pickApr(latest?.aprs, account.interest_rate);
  const balance = owedFromTransactions(account, txns);
  const statementMin = num(latest?.minimum_payment);
  const minimumEstimated = !(statementMin !== null && statementMin > 0);
  const accountDay = num(account.due_date);
  const statementDay = latest?.due_date && isIsoDate(latest.due_date) ? Number(latest.due_date.slice(8, 10)) : null;
  const limit = creditLimitFor(account, own);

  return {
    id: account.id,
    name: account.name,
    type: account.account_type === 'loan' ? 'loan' : 'credit_card',
    institution: account.institution_name ?? null,
    lastFour: account.last_four ?? null,
    currency: isCurrencyCode(account.currency) ? account.currency : 'USD',
    balance,
    creditLimit: limit.limit,
    creditLimitSource: limit.source,
    apr,
    aprSource: source,
    aprs: (latest?.aprs ?? [])
      .filter((a) => num(a.apr) !== null)
      .map((a) => ({ balanceType: a.balance_type ?? 'APR', apr: Number(a.apr), balance: num(a.balance) })),
    minimumPayment: minimumEstimated ? estimatedMinimumPayment(Math.max(0, balance), apr) : round2(statementMin!),
    minimumEstimated,
    dueDay: accountDay ?? statementDay,
    latestStatement: latest
      ? {
          id: latest.id,
          periodStart: latest.period_start,
          periodEnd: latest.period_end,
          newBalance: num(latest.new_balance),
          minimumPayment: statementMin,
          dueDate: latest.due_date,
          interestCharged: num(latest.interest_charged),
        }
      : null,
    promos: normalizePromos(latest?.promos, today, apr),
  };
}

/** The plan's input for these debts. Expired promos are folded into the regular balance. */
export function toPlanDebts(debts: DebtSummary[]): PlanDebt[] {
  return debts
    .filter((d) => d.balance > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      apr: d.apr,
      minPayment: d.minimumEstimated ? null : d.minimumPayment,
      promos: d.promos
        .filter((p) => !p.expired)
        .map((p) => ({
          id: p.id,
          description: p.description,
          balance: p.balance,
          expiresOn: p.expiresOn,
          deferredInterest: p.deferredInterest,
          startedOn: p.startedOn,
        })),
    }));
}
