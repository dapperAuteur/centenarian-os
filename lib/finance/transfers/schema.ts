// lib/finance/transfers/schema.ts
// Lets transfer-aware code run against a database that doesn't have the
// transfer columns yet.
//
// `financial_transactions.transfer_group_id` arrives with migration 202 and
// `transfer_kind` with migration 203. Migrations are applied by hand, so code
// can be deployed before either exists. Until then:
//   - reports must keep working (they just can't leave transfers out yet);
//   - the transfer routes must say plainly that the database isn't ready,
//     instead of passing a raw Postgres error to the screen.
//
// No imports on purpose: runs in API routes and under
// `node --test --experimental-strip-types` (tests/unit/transfer-detect.test.ts).

/** The part of a Supabase / PostgREST error this file reads. */
export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
}

export type TransferColumn = 'transfer_group_id' | 'transfer_kind';

/**
 * Which transfer column an error says is missing, or null when the error is
 * about something else.
 *
 * Postgres reports a missing column in a select or a filter as 42703
 * ("column financial_transactions.transfer_group_id does not exist");
 * PostgREST reports one in an insert or update body as PGRST204 ("Could not
 * find the 'transfer_kind' column of 'financial_transactions' in the schema
 * cache"). Any other missing column is a real bug and is not swallowed.
 */
export function missingTransferColumn(error: DbErrorLike | null | undefined): TransferColumn | null {
  if (!error) return null;
  if (error.code !== '42703' && error.code !== 'PGRST204') return null;
  const message = error.message ?? '';
  if (message.includes('transfer_group_id')) return 'transfer_group_id';
  if (message.includes('transfer_kind')) return 'transfer_kind';
  return null;
}

/** What the transfer routes answer when the database has no transfer columns yet. */
export const TRANSFERS_NOT_READY = {
  error:
    "Transfers can't be tracked yet because this database is missing an update (migration 202). " +
    'Nothing was changed. Try again after the update has been applied.',
  code: 'transfers_not_migrated',
} as const;

/** The two filters a report query needs. Supabase's query builders have both. */
interface TransferFilterable<Q> {
  or(filters: string): Q;
  is(column: string, value: null): Q;
}

/**
 * Narrows a `financial_transactions` query to rows that are real spending or
 * income: not one side of a linked transfer (`transfer_group_id` set) and not
 * an entry the transfer feature wrote (`source = 'transfer'`).
 *
 * Pass `groupColumnExists = false` to leave the `transfer_group_id` filter
 * out; excludingTransfers() does that for you when the column is missing.
 */
export function withoutTransfers<Q extends TransferFilterable<Q>>(query: Q, groupColumnExists: boolean): Q {
  // `source` may be null on old rows; a plain "not equal" would drop those too.
  const filtered = query.or('source.is.null,source.neq.transfer');
  return groupColumnExists ? filtered.is('transfer_group_id', null) : filtered;
}

/**
 * Runs a report query that leaves transfers out, and still works before
 * migration 202: when the database says `transfer_group_id` doesn't exist,
 * the query runs a second time without that filter.
 *
 *   const txRes = await excludingTransfers((groupColumnExists) =>
 *     withoutTransfers(
 *       db.from('financial_transactions').select('amount, type').eq('user_id', userId),
 *       groupColumnExists,
 *     ),
 *   );
 *
 * `run` must build a fresh query each time it is called. Any other error is
 * returned as is.
 */
export async function excludingTransfers<R extends { error: DbErrorLike | null }>(
  run: (groupColumnExists: boolean) => PromiseLike<R>,
): Promise<R> {
  const first = await run(true);
  if (missingTransferColumn(first.error) === 'transfer_group_id') return run(false);
  return first;
}

/**
 * Runs a write that sets `transfer_kind`, and still works between migrations
 * 202 and 203: when the database says `transfer_kind` doesn't exist, the write
 * runs a second time without it. The shared `transfer_group_id` is what makes
 * two rows a transfer; the kind is a label that can be worked out again from
 * the account the money reached.
 *
 * `run` must build a fresh query each time it is called.
 */
export async function withOptionalKind<R extends { error: DbErrorLike | null }>(
  run: (kindColumnExists: boolean) => PromiseLike<R>,
): Promise<R> {
  const first = await run(true);
  if (missingTransferColumn(first.error) === 'transfer_kind') return run(false);
  return first;
}

/**
 * The same rule as withoutTransfers(), for code that selected `*` and totals
 * in memory: true when a row is real spending or income. Works on rows from a
 * database without the column, where a missing `transfer_group_id` reads as
 * "not grouped".
 */
export function countsTowardTotals(row: { transfer_group_id?: string | null; source?: string | null }): boolean {
  return !row.transfer_group_id && row.source !== 'transfer';
}
