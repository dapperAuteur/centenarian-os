// lib/finance/brands/logic.ts
// Pure rules for business (brand) figures: which business a transaction belongs to, money in and
// out per month / quarter / year, profit and loss, and open invoices. The Wallet's business rows
// and the business page (/dashboard/finance/brands/[id]) both use them.
//
// RULES (the help article "Business pages: cash flow, profit and loss" says the same)
//
//   Which business a transaction belongs to
//     - Its own brand tag (financial_transactions.brand_id).
//     - Else, when its account is tagged to a business, that business (plans/66 W4). Accounts can
//       be tagged once migration 227 adds financial_accounts.brand_id; until then the map of
//       account tags is empty and only a transaction's own tag counts.
//     - Else none: personal.
//
//   What counts
//     - Income is money in, expense is money out; transfers between your own accounts (and card or
//       loan payments) are neither and are left out (countsTowardTotals).
//     - Amounts are in your home currency (lib/finance/fx/totals.ts). A foreign amount with no
//       rate yet is left out and counted in `unconverted`, never added at face value.
//
//   Periods
//     - Monthly: the last 12 calendar months, this one included. Quarterly: the last 8 calendar
//       quarters (Jan-Mar is Q1). Yearly: the last 5 calendar years. Newest first. A period with no
//       rows still shows, as zeros. "This year" is Jan 1 through today.
//
//   Open invoices
//     - Owed to you = sum of (total - amount paid) over receivables that are sent or overdue.
//       You owe = the same over payables. Invoices have no currency column: home currency.
//
// Relative imports end in .ts for `node --test --experimental-strip-types` (tests/unit/wallet.test.ts).

import { amountForTotals } from '../fx/totals.ts';
import type { FxAmountRow } from '../fx/totals.ts';
import { countsTowardTotals } from '../transfers/schema.ts';

export type CashFlowGranularity = 'month' | 'quarter' | 'year';
export const CASH_FLOW_GRANULARITIES: readonly CashFlowGranularity[] = ['month', 'quarter', 'year'];
export const CASH_FLOW_PERIODS: Record<CashFlowGranularity, number> = { month: 12, quarter: 8, year: 5 };
export const CASH_FLOW_LABEL: Record<CashFlowGranularity, string> = { month: 'Monthly', quarter: 'Quarterly', year: 'Yearly' };

/** Expected income is counted this many days ahead. */
export const EXPECTED_INCOME_DAYS = 90;

/** Invoice statuses that are still open. */
export const OPEN_INVOICE_STATUSES = ['sent', 'overdue'] as const;

export interface BrandTxnRow extends FxAmountRow {
  id?: string;
  type: string;
  transaction_date: string;
  brand_id?: string | null;
  account_id?: string | null;
  transfer_group_id?: string | null;
  source?: string | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const round2 = (n: number): number => Math.round(n * 100) / 100;
const pad = (n: number): string => String(n).padStart(2, '0');

/** The business a transaction belongs to: its own tag, else its account's tag, else null. */
export function brandOfRow(
  row: Pick<BrandTxnRow, 'brand_id' | 'account_id'>,
  accountBrands: ReadonlyMap<string, string> = new Map(),
): string | null {
  if (row.brand_id) return row.brand_id;
  if (row.account_id) return accountBrands.get(row.account_id) ?? null;
  return null;
}

export interface Period {
  key: string;
  label: string;
  /** First day, YYYY-MM-DD. */
  from: string;
  /** Last day, YYYY-MM-DD. */
  to: string;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The period a date falls in. */
export function periodOf(date: string, granularity: CashFlowGranularity): Period {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  if (granularity === 'year') return { key: `${year}`, label: `${year}`, from: `${year}-01-01`, to: `${year}-12-31` };
  if (granularity === 'quarter') {
    const q = Math.floor((month - 1) / 3) + 1;
    const first = (q - 1) * 3 + 1;
    const last = first + 2;
    return {
      key: `${year}-Q${q}`,
      label: `Q${q} ${year}`,
      from: `${year}-${pad(first)}-01`,
      to: `${year}-${pad(last)}-${pad(lastDayOfMonth(year, last))}`,
    };
  }
  return {
    key: `${year}-${pad(month)}`,
    label: `${MONTHS[month - 1]} ${year}`,
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}`,
  };
}

/** The day before a period's first day (to step back one period). */
function dayBefore(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** The last `count` periods up to and including today's, newest first. */
export function periodsBack(today: string, granularity: CashFlowGranularity, count = CASH_FLOW_PERIODS[granularity]): Period[] {
  const out: Period[] = [];
  let cursor = today;
  for (let i = 0; i < count; i += 1) {
    const p = periodOf(cursor, granularity);
    out.push(p);
    cursor = dayBefore(p.from);
  }
  return out;
}

/** The first day any cash flow table needs: the start of the oldest period of every granularity. */
export function cashFlowStart(today: string): string {
  return CASH_FLOW_GRANULARITIES.map((g) => {
    const periods = periodsBack(today, g);
    return periods[periods.length - 1].from;
  }).sort()[0];
}

export interface CashFlowRow extends Period {
  money_in: number;
  money_out: number;
  net: number;
}

export interface CashFlowTable {
  granularity: CashFlowGranularity;
  rows: CashFlowRow[];
  totals: { money_in: number; money_out: number; net: number };
  /** Rows in these periods left out because they are foreign with no rate yet. */
  unconverted: number;
}

/** A row's amount in the home currency, or null (a transfer, a foreign amount with no rate, a bad row). */
function homeAmount(row: BrandTxnRow, home: string): number | null {
  if (!countsTowardTotals(row)) return null;
  if (row.type !== 'income' && row.type !== 'expense') return null;
  const amount = amountForTotals(row, home);
  return amount === null ? null : Math.abs(amount);
}

export interface MoneyInOut {
  money_in: number;
  money_out: number;
  net: number;
  /** Rows left out because they are foreign with no rate yet. */
  unconverted: number;
  /** Rows left out because they are transfers. */
  transfers: number;
}

/** Money in, out and net over rows dated from..to (inclusive; either may be null for open-ended). */
export function moneyInOut(rows: readonly BrandTxnRow[], home: string, from: string | null = null, to: string | null = null): MoneyInOut {
  let inCents = 0;
  let outCents = 0;
  let unconverted = 0;
  let transfers = 0;
  for (const row of rows) {
    const day = row.transaction_date.slice(0, 10);
    if (from && day < from) continue;
    if (to && day > to) continue;
    if (!countsTowardTotals(row)) {
      transfers += 1;
      continue;
    }
    if (row.type !== 'income' && row.type !== 'expense') continue;
    const amount = homeAmount(row, home);
    if (amount === null) {
      unconverted += 1;
      continue;
    }
    if (row.type === 'income') inCents += Math.round(amount * 100);
    else outCents += Math.round(amount * 100);
  }
  return { money_in: inCents / 100, money_out: outCents / 100, net: (inCents - outCents) / 100, unconverted, transfers };
}

/** Money in, out and net per period (the last N, newest first), with totals across them. */
export function cashFlowTable(
  rows: readonly BrandTxnRow[],
  home: string,
  today: string,
  granularity: CashFlowGranularity,
): CashFlowTable {
  const periods = periodsBack(today, granularity);
  const sums = new Map(periods.map((p) => [p.key, { inCents: 0, outCents: 0 }]));
  let unconverted = 0;
  for (const row of rows) {
    const day = row.transaction_date.slice(0, 10);
    if (day > today) continue;
    const sum = sums.get(periodOf(day, granularity).key);
    if (!sum) continue;
    const amount = homeAmount(row, home);
    if (amount === null) {
      // Only a foreign income or expense with no rate is "left out"; transfers never count.
      if (countsTowardTotals(row) && (row.type === 'income' || row.type === 'expense')) unconverted += 1;
      continue;
    }
    if (row.type === 'income') sum.inCents += Math.round(amount * 100);
    else sum.outCents += Math.round(amount * 100);
  }
  const out: CashFlowRow[] = periods.map((p) => {
    const s = sums.get(p.key)!;
    return { ...p, money_in: s.inCents / 100, money_out: s.outCents / 100, net: (s.inCents - s.outCents) / 100 };
  });
  const totals = out.reduce(
    (t, r) => ({ money_in: round2(t.money_in + r.money_in), money_out: round2(t.money_out + r.money_out), net: round2(t.net + r.net) }),
    { money_in: 0, money_out: 0, net: 0 },
  );
  return { granularity, rows: out, totals, unconverted };
}

export interface InvoiceRow {
  brand_id?: string | null;
  direction: string;
  status: string;
  total: number | string | null;
  amount_paid?: number | string | null;
}

export interface OpenInvoices {
  owed_to_you: number;
  owed_to_you_count: number;
  you_owe: number;
  you_owe_count: number;
}

/** Open receivables and payables (see the rule above). */
export function openInvoices(invoices: readonly InvoiceRow[]): OpenInvoices {
  let toYou = 0;
  let toYouCount = 0;
  let youOwe = 0;
  let youOweCount = 0;
  for (const inv of invoices) {
    if (!(OPEN_INVOICE_STATUSES as readonly string[]).includes(inv.status)) continue;
    const due = Math.round((Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0)) * 100);
    if (!Number.isFinite(due) || due <= 0) continue;
    if (inv.direction === 'receivable') {
      toYou += due;
      toYouCount += 1;
    } else if (inv.direction === 'payable') {
      youOwe += due;
      youOweCount += 1;
    }
  }
  return { owed_to_you: toYou / 100, owed_to_you_count: toYouCount, you_owe: youOwe / 100, you_owe_count: youOweCount };
}

/** Sum of expected income rows (home currency; the projection has no currency column). */
export function expectedIncomeTotal(rows: readonly { expected_amount: number | string | null }[]): number {
  return rows.reduce((sum, r) => sum + Math.round(Number(r.expected_amount ?? 0) * 100), 0) / 100;
}

/** Jan 1 of today's year. */
export function yearStart(today: string): string {
  return `${today.slice(0, 4)}-01-01`;
}

/** today + n days, YYYY-MM-DD. */
export function daysAhead(today: string, n: number): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
