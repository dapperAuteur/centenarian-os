// lib/finance/refunds.ts
// Money back on a credit card or loan. On those accounts an income row lowers
// what is owed. It is one of two things, and neither is earnings:
//   - a payment: money moved from another of the person's accounts. Once it
//     is linked as a transfer it is already left out of totals; an unlinked
//     one is left out here too (its wording says payment);
//   - a refund or credit from a merchant: negative spending.
// Used by the finance summary (app/api/finance/summary/route.ts); budgets
// apply the same rule through SpendingRow.refund (lib/finance/budgets/server.ts).
//
// Relative imports end in `.ts` for `node --test --experimental-strip-types`.

import { cardKindFor } from './csv-import/card-terms.ts';
import { transferHints } from './csv-import/parse.ts';

export interface SpendingLike {
  amount: number | string;
  type: string;
  account_id?: string | null;
  description?: string | null;
}

/** How a (non-transfer) row counts in spending and income totals. */
export type TotalsRole = 'expense' | 'refund' | 'income' | 'unlinked_payment';

export function totalsRole(row: SpendingLike, debtAccountIds: ReadonlySet<string>): TotalsRole {
  if (row.type === 'expense') return 'expense';
  if (row.type !== 'income' || !row.account_id || !debtAccountIds.has(row.account_id)) return 'income';
  const description = row.description ?? '';
  const kind = cardKindFor({ type: 'income', description, hints: transferHints(description) });
  return kind === 'payment' ? 'unlinked_payment' : 'refund';
}

/**
 * What a row adds to spending, in dollars: the amount for an expense, minus
 * the amount for a refund on a card or loan, 0 for an unlinked card or loan
 * payment, and null for income (it isn't spending at all). Transfers must
 * already be filtered out.
 */
export function signedSpending(row: SpendingLike, debtAccountIds: ReadonlySet<string>): number | null {
  const amount = Math.abs(Number(row.amount));
  if (!Number.isFinite(amount)) return null;
  const role = totalsRole(row, debtAccountIds);
  if (role === 'expense') return amount;
  if (role === 'refund') return -amount;
  if (role === 'unlinked_payment') return 0;
  return null;
}
