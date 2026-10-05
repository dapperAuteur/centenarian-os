// lib/finance/fx/totals.ts
// The one rule every total uses for a transaction's amount in the user's home currency.
//
//   amount_home set                         -> amount_home (converted at save, rate of that date)
//   row currency (row.currency, else the
//   account's currency, else home) == home  -> amount
//   otherwise                               -> null: a foreign amount with no rate yet. Totals
//                                              leave it out and count it, rather than adding
//                                              1,000 yen as $1,000.
//
// Rows from before migration 210 have no currency anywhere, so they read as home currency, which
// is what they always were.
//
// No imports on purpose: runs in API routes and under node --test (tests/unit/fx.test.ts).

export interface FxAmountRow {
  amount: number | string;
  amount_home?: number | string | null;
  currency?: string | null;
  /** The embedded account, when the query selected financial_accounts(currency). */
  financial_accounts?: { currency?: string | null } | { currency?: string | null }[] | null;
}

function accountCurrency(row: FxAmountRow): string | null {
  const acct = row.financial_accounts;
  if (!acct) return null;
  const one = Array.isArray(acct) ? acct[0] : acct;
  return one?.currency ?? null;
}

/** The currency `amount` is in. */
export function rowCurrency(row: FxAmountRow, homeCurrency: string): string {
  return row.currency || accountCurrency(row) || homeCurrency;
}

/** The row's amount in the home currency, or null when it is foreign and not converted yet. */
export function amountForTotals(row: FxAmountRow, homeCurrency: string): number | null {
  if (row.amount_home !== null && row.amount_home !== undefined && row.amount_home !== '') {
    const home = Number(row.amount_home);
    if (Number.isFinite(home)) return home;
  }
  if (rowCurrency(row, homeCurrency) !== homeCurrency) return null;
  const amount = Number(row.amount);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Rows with their amount replaced by the home-currency amount; foreign rows with no rate yet are
 * dropped and counted in `unconverted`.
 */
export function toHomeAmounts<T extends FxAmountRow>(rows: readonly T[], homeCurrency: string): { rows: (T & { amount: number })[]; unconverted: number } {
  const out: (T & { amount: number })[] = [];
  let unconverted = 0;
  for (const row of rows) {
    const amount = amountForTotals(row, homeCurrency);
    if (amount === null) {
      unconverted += 1;
      continue;
    }
    out.push({ ...row, amount });
  }
  return { rows: out, unconverted };
}

/** The extra columns a totals query selects once migration 210 is applied. */
export const FX_TOTALS_COLUMNS = 'amount_home, currency, financial_accounts(currency)';

interface ErrLike {
  code?: string | null;
  message?: string | null;
}

/**
 * Runs a totals query with the FX columns, and again without them when the database doesn't have
 * them yet (before migration 210): every row then reads as home currency.
 * `run` must build a fresh query each time.
 */
export async function withOptionalFx<R extends { error: ErrLike | null }>(
  run: (fxColumnsExist: boolean) => PromiseLike<R>,
): Promise<R> {
  const first = await run(true);
  const err = first.error;
  if (
    err &&
    (err.code === '42703' || err.code === 'PGRST204' || err.code === 'PGRST200') &&
    /currency|amount_home/.test(err.message ?? '')
  ) {
    return run(false);
  }
  return first;
}
