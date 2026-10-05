// lib/finance/debt/interest.ts
// Interest paid on cards and loans, per account, per month and per year. Pure.
//
// SOURCES, best first
//   1. account_statements.interest_charged (migration 209): exact, what the statement printed.
//      Counted in the month the statement period ENDS (the month it was charged).
//   2. financial_transactions with source = 'interest' on the account: used for any date no
//      statement covers. An expense row is interest charged; an income row is interest refunded
//      and is subtracted.
//   A transaction dated inside a statement's period (period_start..period_end) is skipped when
//   that statement has an interest figure, so the same charge is never counted twice. A statement
//   without period_start is taken to cover the month before period_end.

import { addDays, addMonthsToDate, monthKey } from './dates.ts';

export interface InterestStatement {
  accountId: string;
  periodStart: string | null;
  periodEnd: string;
  interestCharged: number | null;
}

export interface InterestTransaction {
  accountId: string;
  date: string;
  amount: number;
  type: 'income' | 'expense' | string;
}

export type InterestSource = 'statement' | 'transactions' | 'mixed';

export interface InterestMonth {
  month: string;
  amount: number;
  source: InterestSource;
}

export interface AccountInterest {
  accountId: string;
  total: number;
  months: InterestMonth[];
}

export interface InterestReport {
  year: number;
  total: number;
  accounts: AccountInterest[];
  /** Totals by month across accounts, Jan..Dec, for a chart. */
  byMonth: { month: string; amount: number }[];
}

const cents = (n: number): number => Math.round(Number(n) * 100);

function periodStartOf(s: InterestStatement): string {
  return s.periodStart ?? addDays(addMonthsToDate(s.periodEnd, -1), 1);
}

/** Interest paid in `year`, by account and month. */
export function interestPaid(
  statements: InterestStatement[],
  transactions: InterestTransaction[],
  year: number,
): InterestReport {
  const y = String(year);
  // account -> month -> { cents, sources }
  const table = new Map<string, Map<string, { cents: number; sources: Set<'statement' | 'transactions'> }>>();
  const add = (accountId: string, month: string, amount: number, source: 'statement' | 'transactions') => {
    if (!table.has(accountId)) table.set(accountId, new Map());
    const months = table.get(accountId)!;
    if (!months.has(month)) months.set(month, { cents: 0, sources: new Set() });
    const cell = months.get(month)!;
    cell.cents += amount;
    cell.sources.add(source);
  };

  const covered = new Map<string, { start: string; end: string }[]>();
  for (const s of statements) {
    if (s.interestCharged == null || !Number.isFinite(Number(s.interestCharged))) continue;
    if (!covered.has(s.accountId)) covered.set(s.accountId, []);
    covered.get(s.accountId)!.push({ start: periodStartOf(s), end: s.periodEnd });
    if (s.periodEnd.slice(0, 4) === y) add(s.accountId, monthKey(s.periodEnd), cents(s.interestCharged), 'statement');
  }

  for (const t of transactions) {
    if (t.date.slice(0, 4) !== y) continue;
    const ranges = covered.get(t.accountId) ?? [];
    if (ranges.some((r) => t.date >= r.start && t.date <= r.end)) continue;
    const sign = t.type === 'income' ? -1 : 1;
    add(t.accountId, monthKey(t.date), sign * cents(Math.abs(Number(t.amount))), 'transactions');
  }

  const accounts: AccountInterest[] = [];
  const monthTotals = new Map<string, number>();
  for (const [accountId, months] of table) {
    const list: InterestMonth[] = [...months.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cell]) => {
        monthTotals.set(month, (monthTotals.get(month) ?? 0) + cell.cents);
        return {
          month,
          amount: cell.cents / 100,
          source: cell.sources.size > 1 ? 'mixed' : [...cell.sources][0],
        };
      });
    accounts.push({ accountId, total: list.reduce((s, m) => s + cents(m.amount), 0) / 100, months: list });
  }
  accounts.sort((a, b) => b.total - a.total || a.accountId.localeCompare(b.accountId));

  const byMonth = Array.from({ length: 12 }, (_, i) => {
    const month = `${y}-${String(i + 1).padStart(2, '0')}`;
    return { month, amount: (monthTotals.get(month) ?? 0) / 100 };
  });
  return { year, total: accounts.reduce((s, a) => s + cents(a.total), 0) / 100, accounts, byMonth };
}
