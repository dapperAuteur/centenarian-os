// lib/finance/transfers/server.ts
// Database helpers shared by the transfer routes (app/api/finance/transfers/*)
// and by the transaction routes that have to treat a transfer's two rows as a
// pair. Server only: it reads SUPABASE_SERVICE_ROLE_KEY.
//
// Every query here is scoped to one user with `.eq('user_id', ...)`. Callers
// authenticate the user first and pass that user's id.

import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accountLabel } from './pairing.ts';
import type { TransferKind } from './pairing.ts';
import { withOptionalKind } from './schema.ts';
import type { DbErrorLike } from './schema.ts';

export function getServiceDb(): SupabaseClient {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** The columns the transfer routes read from a transaction. */
export const TRANSFER_ROW_SELECT =
  'id, account_id, amount, type, transaction_date, description, vendor, source, transfer_group_id';

export interface TransferRowRecord {
  id: string;
  account_id: string | null;
  amount: number | string;
  type: 'expense' | 'income';
  transaction_date: string;
  description: string | null;
  vendor: string | null;
  source: string | null;
  transfer_group_id: string | null;
}

/** The account columns labels and the pairing rules need. */
export const ACCOUNT_SELECT = 'id, name, account_type, institution_name, last_four, is_active';

export interface AccountRecord {
  id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  last_four: string | null;
  is_active: boolean;
}

/** The other side of a transfer, as the transaction pages show it. */
export interface TransferPartner {
  id: string;
  account_id: string | null;
  /** Institution, name and last four: see accountLabel(). */
  account_label: string;
  account_type: string | null;
  amount: number;
  type: 'expense' | 'income';
  transaction_date: string;
  description: string | null;
  source: string | null;
}

export interface GroupRow extends TransferPartner {
  transfer_group_id: string;
}

/** Supabase returns a to-one embed as an object, or as a one-item array when it can't tell. */
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Every row of the given transfer groups, with its account's label. A caller
 * that has one row of a group finds its partner by dropping its own id.
 */
export async function loadGroupRows(
  db: SupabaseClient,
  userId: string,
  groupIds: readonly string[],
): Promise<{ rows: GroupRow[]; error: DbErrorLike | null }> {
  const ids = [...new Set(groupIds.filter(Boolean))];
  if (ids.length === 0) return { rows: [], error: null };

  const { data, error } = await db
    .from('financial_transactions')
    .select(
      'id, account_id, amount, type, transaction_date, description, source, transfer_group_id, ' +
        'financial_accounts(id, name, account_type, institution_name, last_four)',
    )
    .eq('user_id', userId)
    .in('transfer_group_id', ids);
  if (error) return { rows: [], error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((data ?? []) as any[]).map((row): GroupRow => {
    const account = firstOf<AccountRecord>(row.financial_accounts);
    return {
      id: row.id,
      account_id: row.account_id ?? null,
      account_label: row.account_id ? accountLabel(account) : 'no account',
      account_type: account?.account_type ?? null,
      amount: Number(row.amount),
      type: row.type,
      transaction_date: row.transaction_date,
      description: row.description ?? null,
      source: row.source ?? null,
      transfer_group_id: row.transfer_group_id,
    };
  });
  return { rows, error: null };
}

/** Takes rows out of their transfer group. Deletes nothing. */
export async function clearTransferGroup(
  db: SupabaseClient,
  userId: string,
  rowIds: readonly string[],
): Promise<{ error: DbErrorLike | null }> {
  if (rowIds.length === 0) return { error: null };
  const { error } = await withOptionalKind((kindColumnExists) =>
    db
      .from('financial_transactions')
      .update(
        kindColumnExists
          ? { transfer_group_id: null, transfer_kind: null }
          : { transfer_group_id: null },
      )
      .eq('user_id', userId)
      .in('id', [...rowIds]),
  );
  return { error };
}

export interface TransferEntryInput {
  userId: string;
  accountId: string;
  /** Dollars; stored as a positive amount. */
  amount: number;
  type: 'expense' | 'income';
  /** YYYY-MM-DD. */
  date: string;
  description: string;
  groupId: string;
}

/**
 * Inserts the rows the transfer feature writes itself: both sides of a manual
 * transfer, or the one counter-entry of a payment. They carry
 * `source = 'transfer'`, the shared group id, and the kind when the database
 * has that column. One statement, so either every row is saved or none is.
 */
export async function insertTransferEntries(
  db: SupabaseClient,
  entries: readonly TransferEntryInput[],
  kind: TransferKind,
) {
  return withOptionalKind((kindColumnExists) =>
    db
      .from('financial_transactions')
      .insert(
        entries.map((entry) => ({
          user_id: entry.userId,
          amount: Math.abs(entry.amount),
          type: entry.type,
          description: entry.description,
          transaction_date: entry.date,
          account_id: entry.accountId,
          source: 'transfer',
          transfer_group_id: entry.groupId,
          ...(kindColumnExists ? { transfer_kind: kind } : {}),
        })),
      )
      .select(),
  );
}
