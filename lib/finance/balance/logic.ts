// lib/finance/balance/logic.ts
// THE account balance rule. Every balance in the app (the accounts API, the
// finance dashboard, savings envelopes, cash on hand, the debts overview, the
// interest calculation and reconciling) is worked out here, so they can't
// drift apart.
//
// RULES (the help article "Setting an account's starting balance" says the
// same in plain words)
//
//   Which transactions count
//     - Without a starting-balance date (opening_balance_date NULL): every
//       income and expense on the account.
//     - With one: only those dated AFTER it. The opening balance is the
//       balance at the end of that day, so a transaction dated on it is
//       already inside the opening balance.
//     - "Through" a date (the balance on a statement date): only those dated
//       on or before it.
//     - Other types (none today) are ignored.
//
//   Statement terms (what a bank or card statement prints)
//     - Checking, savings, cash: money in the account
//         = opening + income - expenses.
//     - Credit card, loan: money OWED (positive = owed, negative = a credit)
//         = opening + expenses - income.
//       The opening balance of a card or loan is entered as the amount owed.
//
//   Signed balance (what the accounts list shows)
//     - Asset accounts: the statement-terms balance.
//     - Cards and loans: minus the amount owed, so debts read negative.
//
//   Money is summed in integer cents. Amounts are in the account's own
//   currency (financial_transactions.amount); the home-currency amount is
//   never used for a balance.
//
// Pure, no imports, so it runs under `node --test --experimental-strip-types`
// (tests/unit/reconciliation.test.ts).

export const DEBT_ACCOUNT_TYPES = ['credit_card', 'loan'] as const;

export interface BalanceAccount {
  account_type: string;
  opening_balance: number | string | null | undefined;
  /** Migration 221. Missing or null: every transaction counts. */
  opening_balance_date?: string | null;
}

export interface BalanceRow {
  type: string;
  amount: number | string;
  /** Needed for the starting-balance date and "through". A row without one always counts. */
  transaction_date?: string | null;
}

export interface BalanceOptions {
  /** Count only transactions dated on or before this day (YYYY-MM-DD). */
  through?: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const cents = (value: number | string | null | undefined): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** True for the account types whose balance is money owed: credit cards and loans. */
export function isDebtAccount(accountType: string | null | undefined): boolean {
  return accountType === 'credit_card' || accountType === 'loan';
}

/** The account's starting-balance date (YYYY-MM-DD), or null when it has none. */
export function startingBalanceDate(account: Pick<BalanceAccount, 'opening_balance_date'>): string | null {
  const raw = account.opening_balance_date;
  if (typeof raw !== 'string') return null;
  const day = raw.slice(0, 10);
  return DATE_RE.test(day) ? day : null;
}

/** Does a transaction dated `date` count toward the balance (see the rules above)? */
export function countsInBalance(
  account: Pick<BalanceAccount, 'opening_balance_date'>,
  date: string | null | undefined,
  options: BalanceOptions = {},
): boolean {
  if (typeof date !== 'string' || !date) return true;
  const day = date.slice(0, 10);
  const start = startingBalanceDate(account);
  if (start && day <= start) return false;
  if (options.through && day > options.through) return false;
  return true;
}

/** The balance in statement terms, in cents: money in the account, or money owed on a card or loan. */
export function statementBalanceCents(
  account: BalanceAccount,
  rows: readonly BalanceRow[],
  options: BalanceOptions = {},
): number {
  let income = 0;
  let expenses = 0;
  for (const row of rows) {
    if (row.type !== 'income' && row.type !== 'expense') continue;
    if (!countsInBalance(account, row.transaction_date, options)) continue;
    if (row.type === 'income') income += cents(row.amount);
    else expenses += cents(row.amount);
  }
  const opening = cents(account.opening_balance);
  return isDebtAccount(account.account_type) ? opening + expenses - income : opening + income - expenses;
}

/** The balance in statement terms, in dollars (see statementBalanceCents). */
export function statementBalance(account: BalanceAccount, rows: readonly BalanceRow[], options: BalanceOptions = {}): number {
  return statementBalanceCents(account, rows, options) / 100;
}

/** Statement terms -> the signed balance the accounts list shows (debts negative). Cents in, cents out. */
export function signedFromStatementCents(accountType: string | null | undefined, statementCents: number): number {
  return isDebtAccount(accountType) ? -statementCents : statementCents;
}

/** The signed balance (debts negative), in dollars: what the accounts API returns as `balance`. */
export function accountBalance(account: BalanceAccount, rows: readonly BalanceRow[], options: BalanceOptions = {}): number {
  return signedFromStatementCents(account.account_type, statementBalanceCents(account, rows, options)) / 100;
}

/** What is owed on a card or loan, in dollars (positive = owed). Same as statementBalance for a debt. */
export function amountOwed(account: BalanceAccount, rows: readonly BalanceRow[], options: BalanceOptions = {}): number {
  return statementBalance(account, rows, options);
}
