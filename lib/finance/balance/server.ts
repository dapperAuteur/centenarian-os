// lib/finance/balance/server.ts
// Loads the transactions a balance needs, every page of them, so PostgREST's
// row cap (1000 by default) can never cut a balance short. The rule itself is
// in ./logic.ts.
//
// Callers pass a client and the signed-in user's id; every query is scoped
// with .eq('user_id', userId).
//
// Imports only sibling files with .ts extensions (and types), so the tests run
// it against the in-memory fake (tests/unit/reconciliation.test.ts).

import type { SupabaseClient } from '@supabase/supabase-js';
import { signedFromStatementCents, statementBalanceCents } from './logic.ts';
import type { BalanceAccount, BalanceOptions } from './logic.ts';

export const BALANCE_PAGE_SIZE = 1000;

/** The columns a balance reads. */
export const BALANCE_TX_SELECT = 'id, account_id, type, amount, transaction_date';

export interface BalanceTxRow {
  id: string;
  account_id: string | null;
  type: string;
  amount: number | string;
  transaction_date: string;
}

export interface DbErrorShape {
  code?: string | null;
  message?: string | null;
}

/**
 * Every transaction on the given accounts (all pages), ordered by id. `select`
 * may ask for more columns; it must include the BALANCE_TX_SELECT ones.
 */
export async function loadBalanceRows<T extends BalanceTxRow = BalanceTxRow>(
  db: SupabaseClient,
  userId: string,
  accountIds: readonly string[],
  select: string = BALANCE_TX_SELECT,
): Promise<{ rows: T[]; error: DbErrorShape | null }> {
  const rows: T[] = [];
  if (accountIds.length === 0) return { rows, error: null };
  for (let offset = 0; ; offset += BALANCE_PAGE_SIZE) {
    const res = await db
      .from('financial_transactions')
      .select(select)
      .eq('user_id', userId)
      .in('account_id', [...accountIds])
      .order('id', { ascending: true })
      .range(offset, offset + BALANCE_PAGE_SIZE - 1);
    if (res.error) return { rows, error: res.error as DbErrorShape };
    const page = (res.data ?? []) as unknown as T[];
    rows.push(...page);
    if (page.length < BALANCE_PAGE_SIZE) return { rows, error: null };
  }
}

/** account id -> its rows. */
export function rowsByAccount<T extends { account_id: string | null }>(rows: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.account_id) continue;
    const list = out.get(row.account_id) ?? [];
    list.push(row);
    out.set(row.account_id, list);
  }
  return out;
}

/** Signed balance (debts negative) of each account, in cents. */
export function signedBalancesCents<A extends BalanceAccount & { id: string }>(
  accounts: readonly A[],
  rows: readonly BalanceTxRow[],
  options: BalanceOptions = {},
): Map<string, number> {
  const byAccount = rowsByAccount(rows);
  const out = new Map<string, number>();
  for (const account of accounts) {
    const own = byAccount.get(account.id) ?? [];
    out.set(account.id, signedFromStatementCents(account.account_type, statementBalanceCents(account, own, options)));
  }
  return out;
}
