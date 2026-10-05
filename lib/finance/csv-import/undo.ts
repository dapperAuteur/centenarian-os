// lib/finance/csv-import/undo.ts
// Undoes one statement import.
//
// Relative imports end in `.ts` so tests/unit/csv-import-plan.test.ts can load
// this file under `node --test --experimental-strip-types`.
//
// What happens to each transaction that carries the batch's id:
//   - inserted by the import (source 'csv_import') and untouched since:
//     deleted. "Untouched" means updated_at is within 2 seconds of created_at
//     (the table's trigger moves updated_at on every edit).
//   - inserted by the import and edited since: kept as it is, and reported.
//   - a manual or scanned entry the import only linked: the entry stays; its
//     external_id and import_batch_id are cleared. Its account stays too, even
//     when the import filled it in: the statement showed which account it was.
// The statement summary a PDF import saved (account_statements, migration 209)
// is deleted too. Then the batch is marked 'undone'. Undoing an undone batch
// changes nothing.

import type { SupabaseClient } from '@supabase/supabase-js';
import { ID_CHUNK, chunk, readAllPages } from './db.ts';
import type { PageResult } from './db.ts';
import { ImportError, dbFailure } from './errors.ts';
import { deleteBatchStatements } from '../pdf-import/statements.ts';
import type { KeptTransaction, UndoResult } from './types.ts';

/** How far updated_at may sit from created_at on a row nobody has edited. */
export const UNTOUCHED_TOLERANCE_MS = 2000;

/** A transaction of the batch, as undo reads it. */
export interface BatchTransaction {
  id: string;
  source: string | null;
  created_at: string;
  updated_at: string;
  transaction_date: string;
  amount: number | string;
  description: string | null;
  vendor: string | null;
}

export type UndoDisposition = 'delete' | 'unlink' | 'keep';

/**
 * What undo does with one transaction of the batch (see the top of this file).
 * A row whose timestamps can't be read is kept: when in doubt, don't delete.
 */
export function undoDisposition(
  row: Pick<BatchTransaction, 'source' | 'created_at' | 'updated_at'>,
): UndoDisposition {
  if (row.source !== 'csv_import') return 'unlink';
  const created = Date.parse(row.created_at);
  const updated = Date.parse(row.updated_at);
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return 'keep';
  return Math.abs(updated - created) <= UNTOUCHED_TOLERANCE_MS ? 'delete' : 'keep';
}

const BATCH_COLUMNS = 'id, source, created_at, updated_at, transaction_date, amount, description, vendor';

const toKept = (row: BatchTransaction): KeptTransaction => ({
  id: row.id,
  transaction_date: row.transaction_date,
  amount: Number(row.amount),
  description: row.description,
  vendor: row.vendor,
});

/**
 * Undoes a batch. Throws ImportError 404 when the batch isn't the user's.
 *
 * The batch is marked 'undone' last, so an undo that fails partway can simply
 * be run again: every step only acts on rows that still carry the batch id.
 */
export async function undoBatch(db: SupabaseClient, userId: string, batchId: string): Promise<UndoResult> {
  const found = await db
    .from('import_batches')
    .select('id, status')
    .eq('id', batchId)
    .eq('user_id', userId)
    .maybeSingle();
  if (found.error) throw dbFailure(found.error, 'read the import');
  const batch = found.data as { id: string; status: string } | null;
  if (!batch) throw new ImportError(404, 'batch_not_found', 'That import was not found.');
  if (batch.status === 'undone') {
    return { batchId, alreadyUndone: true, deleted: 0, unlinked: 0, kept: [] };
  }

  const rows = await readAllPages<BatchTransaction>('read the imported transactions', (from, to) =>
    db
      .from('financial_transactions')
      .select(BATCH_COLUMNS)
      .eq('user_id', userId)
      .eq('import_batch_id', batchId)
      .order('id')
      .range(from, to) as unknown as PageResult<BatchTransaction>,
  );

  const toDelete: BatchTransaction[] = [];
  const toUnlink: BatchTransaction[] = [];
  const kept: BatchTransaction[] = [];
  for (const row of rows) {
    const disposition = undoDisposition(row);
    if (disposition === 'delete') toDelete.push(row);
    else if (disposition === 'unlink') toUnlink.push(row);
    else kept.push(row);
  }

  let deleted = 0;
  for (const group of chunk(toDelete, ID_CHUNK)) {
    // The untouched test again, inside the delete itself: a row edited after
    // the read above has a newer updated_at and is left alone.
    const newestCreated = Math.max(...group.map((row) => Date.parse(row.created_at)));
    const cutoff = new Date(newestCreated + UNTOUCHED_TOLERANCE_MS).toISOString();
    const { data, error } = await db
      .from('financial_transactions')
      .delete()
      .eq('user_id', userId)
      .eq('import_batch_id', batchId)
      .eq('source', 'csv_import')
      .in('id', group.map((row) => row.id))
      .lte('updated_at', cutoff)
      .select('id');
    if (error) throw dbFailure(error, 'remove the imported transactions');
    const gone = new Set(((data ?? []) as { id: string }[]).map((row) => row.id));
    deleted += gone.size;
    for (const row of group) if (!gone.has(row.id)) kept.push(row);
  }

  let unlinked = 0;
  for (const group of chunk(toUnlink, ID_CHUNK)) {
    const { data, error } = await db
      .from('financial_transactions')
      .update({ external_id: null, import_batch_id: null })
      .eq('user_id', userId)
      .eq('import_batch_id', batchId)
      .in('id', group.map((row) => row.id))
      .select('id');
    if (error) throw dbFailure(error, 'unlink the matched transactions');
    unlinked += (data ?? []).length;
  }

  await deleteBatchStatements(db, userId, batchId);

  const marked = await db
    .from('import_batches')
    .update({ status: 'undone', undone_at: new Date().toISOString() })
    .eq('id', batchId)
    .eq('user_id', userId);
  if (marked.error) throw dbFailure(marked.error, 'mark the import as undone');

  kept.sort((a, b) => (a.transaction_date < b.transaction_date ? -1 : a.transaction_date > b.transaction_date ? 1 : 0));
  return { batchId, alreadyUndone: false, deleted, unlinked, kept: kept.map(toKept) };
}
