// lib/finance/debt/server.ts
// Database reads for the debt routes (app/api/finance/debt/*) and the bill-due cron.
//
// Callers pass a service-role client and the signed-in user's id (or, in the cron, the user being
// processed); every query is scoped with .eq('user_id', userId). Transactions are paged so
// PostgREST's row cap can't cut a balance short.
//
// Before migration 209 (account_statements) the overview still works from account rates and
// transactions; before migration 211 plans, planner tasks and reminder settings answer
// DEBT_NOT_READY ("Run migration 211 first").

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbErrorLike } from '../transfers/schema.ts';
import { isMissingColumn } from '../transfers/schema.ts';
import { dueSoon, isItemPaid, upcomingDueItems } from './due.ts';
import type { DueItem, DueSoonEntry } from './due.ts';
import { interestPaid } from './interest.ts';
import type { InterestReport } from './interest.ts';
import { addDays, isIsoDate } from './dates.ts';
import { buildDebtSummary, DEBT_ACCOUNT_TYPES } from './overview.ts';
import type { DebtAccountRow, DebtSummary, StatementRow, TxnRow } from './overview.ts';

export const PAGE_SIZE = 1000;

export const DEBT_NOT_READY = {
  error:
    'Saved plans, due-date planner tasks and email reminders need a database update. ' +
    'Run migration 211 first (supabase/migrations/211_debt_plans_bill_due.sql). Nothing was changed.',
  code: 'migration_required',
} as const;

/** True when an error says the named table doesn't exist (Postgres 42P01, PostgREST PGRST205). */
export function isMissingTable(error: DbErrorLike | null | undefined, table: string): boolean {
  if (!error) return false;
  if (error.code !== '42P01' && error.code !== 'PGRST205') return false;
  return (error.message ?? '').includes(table);
}

export class DebtDbError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export interface DebtData {
  accounts: DebtAccountRow[];
  statements: StatementRow[];
  /** account_statements exists (migration 209). */
  statementsReady: boolean;
  /** Every transaction on the debt accounts. */
  txns: TxnRow[];
}

const ACCOUNT_SELECT = '*';
const STATEMENT_SELECT =
  'id, account_id, period_start, period_end, new_balance, minimum_payment, due_date, interest_charged, aprs, promos, credit_limit';
const TXN_SELECT = 'id, account_id, amount, type, transaction_date, source, transfer_group_id, transfer_kind';
const TXN_SELECT_NO_KIND = 'id, account_id, amount, type, transaction_date, source, transfer_group_id';

/** Active credit_card and loan accounts, their statements, and every transaction on them. */
export async function loadDebtData(db: SupabaseClient, userId: string): Promise<DebtData> {
  const { data: accountRows, error: accErr } = await db
    .from('financial_accounts')
    .select(ACCOUNT_SELECT)
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('account_type', [...DEBT_ACCOUNT_TYPES])
    .order('created_at', { ascending: true });
  if (accErr) throw new DebtDbError(`Could not load accounts: ${accErr.message}`);
  const accounts = (accountRows ?? []) as DebtAccountRow[];
  if (!accounts.length) return { accounts, statements: [], statementsReady: true, txns: [] };
  const ids = accounts.map((a) => a.id);

  let statements: StatementRow[] = [];
  let statementsReady = true;
  const { data: stRows, error: stErr } = await db
    .from('account_statements')
    .select(STATEMENT_SELECT)
    .eq('user_id', userId)
    .in('account_id', ids)
    .order('period_end', { ascending: false });
  if (stErr) {
    if (!isMissingTable(stErr, 'account_statements')) throw new DebtDbError(`Could not load statements: ${stErr.message}`);
    statementsReady = false;
  } else {
    statements = (stRows ?? []) as StatementRow[];
  }

  const txns: TxnRow[] = [];
  let select = TXN_SELECT;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await db
      .from('financial_transactions')
      .select(select)
      .eq('user_id', userId)
      .in('account_id', ids)
      .order('transaction_date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (res.error) {
      // Before migration 203 there is no transfer_kind; transfer_group_id still links payments.
      if (select === TXN_SELECT && isMissingColumn(res.error, 'transfer_kind')) {
        select = TXN_SELECT_NO_KIND;
        offset -= PAGE_SIZE;
        continue;
      }
      throw new DebtDbError(`Could not load transactions: ${res.error.message}`);
    }
    const page = (res.data ?? []) as unknown as TxnRow[];
    txns.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return { accounts, statements, statementsReady, txns };
}

export interface DebtOverview {
  today: string;
  statementsReady: boolean;
  debts: (DebtSummary & {
    interestYtd: number;
    nextDue: { date: string; minimum: number | null; statementBalance: number | null; paid: boolean } | null;
  })[];
  totals: { balance: number; minimums: number; interestYtd: number };
  dueSoon: DueSoonEntry[];
  dueItems: DueItem[];
  interest: InterestReport;
}

/** The debts overview for one user, from loadDebtData()'s rows. */
export function buildOverview(data: DebtData, today: string): DebtOverview {
  const year = Number(today.slice(0, 4));
  const summaries = data.accounts.map((a) => buildDebtSummary(a, data.statements, data.txns, today));
  const interest = interestPaidFor(data, year);
  const dueItems = summaries.flatMap((d) => upcomingDueItems(d, today));

  const debts = summaries.map((d) => {
    const next = dueItems
      .filter((i) => i.accountId === d.id && i.kind === 'payment_due' && i.deadline >= today)
      .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
    return {
      ...d,
      interestYtd: interest.accounts.find((a) => a.accountId === d.id)?.total ?? 0,
      nextDue: next
        ? { date: next.deadline, minimum: next.minimum, statementBalance: next.statementBalance, paid: isItemPaid(next, data.txns) }
        : null,
    };
  });

  const cents = (n: number) => Math.round(n * 100);
  return {
    today,
    statementsReady: data.statementsReady,
    debts,
    totals: {
      balance: debts.reduce((s, d) => s + cents(Math.max(0, d.balance)), 0) / 100,
      minimums: debts.reduce((s, d) => s + (d.balance > 0 ? cents(d.minimumPayment) : 0), 0) / 100,
      interestYtd: interest.total,
    },
    dueSoon: dueSoon(dueItems, data.txns, today),
    dueItems,
    interest,
  };
}

/** Interest paid in `year` on these accounts (statements exact, else source='interest' rows). */
export function interestPaidFor(data: DebtData, year: number): InterestReport {
  return interestPaid(
    data.statements.map((s) => ({
      accountId: s.account_id,
      periodStart: s.period_start,
      periodEnd: s.period_end,
      interestCharged: s.interest_charged === null || s.interest_charged === undefined ? null : Number(s.interest_charged),
    })),
    data.txns
      .filter((t) => t.source === 'interest' && t.account_id)
      .map((t) => ({ accountId: t.account_id!, date: t.transaction_date, amount: Number(t.amount), type: t.type })),
    year,
  );
}

/** Today's date (YYYY-MM-DD) for server code: UTC, like the other crons. */
export function serverToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The person's own today, sent by the page (`?today=YYYY-MM-DD` from lib/dates/local), accepted
 * when it is within a day of the server's UTC date (time zones); otherwise the UTC date.
 */
export function requestToday(value: string | null | undefined): string {
  const utc = serverToday();
  if (!isIsoDate(value)) return utc;
  return value >= addDays(utc, -1) && value <= addDays(utc, 1) ? value : utc;
}
