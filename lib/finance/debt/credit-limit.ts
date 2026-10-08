// lib/finance/debt/credit-limit.ts
// THE credit limit rule for a card or a line of credit. The Debt page (overview.ts) and the
// Wallet (lib/finance/wallet/logic.ts) both use it, so they never disagree.
//
//   1. The account's own credit_limit, when it is set and above zero.
//   2. Else the credit limit printed on the latest imported statement that prints one
//      (account_statements.credit_limit, migration 209), when above zero.
//   3. Else none: the account has no known limit.
//
// "Latest" is the latest period_end among the statements passed for this account. Both amounts
// are in the account's own currency.
//
// No imports on purpose: runs in API routes, client components and under
// `node --test --experimental-strip-types` (tests/unit/wallet.test.ts).

export type CreditLimitSource = 'account' | 'statement';

export interface CreditLimit {
  limit: number | null;
  source: CreditLimitSource | null;
}

export interface CreditLimitStatement {
  account_id: string;
  period_end: string;
  credit_limit?: number | string | null;
}

function positive(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** The limit on the latest statement of `accountId` that prints one, or null. */
export function latestStatementLimit(accountId: string, statements: readonly CreditLimitStatement[]): number | null {
  let best: { period_end: string; limit: number } | null = null;
  for (const s of statements) {
    if (s.account_id !== accountId) continue;
    const limit = positive(s.credit_limit);
    if (limit === null) continue;
    if (!best || s.period_end > best.period_end) best = { period_end: s.period_end, limit };
  }
  return best ? best.limit : null;
}

/** The credit limit of an account (see the rule above). */
export function creditLimitFor(
  account: { id: string; credit_limit?: number | string | null },
  statements: readonly CreditLimitStatement[] = [],
): CreditLimit {
  const own = positive(account.credit_limit);
  if (own !== null) return { limit: own, source: 'account' };
  const fromStatement = latestStatementLimit(account.id, statements);
  if (fromStatement !== null) return { limit: fromStatement, source: 'statement' };
  return { limit: null, source: null };
}
