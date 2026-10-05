// lib/finance/pdf-import/statements.ts
// account_statements (migration 209) helpers that undo needs without loading
// the PDF reader: recognizing "the table isn't there yet" and deleting the
// statement facts an import saved.
//
// Relative imports end in `.ts` so the unit tests can load this file under
// `node --test --experimental-strip-types`.

import type { SupabaseClient } from '@supabase/supabase-js';
import { dbFailure, type DbError } from '../csv-import/errors.ts';

export const STATEMENTS_MIGRATION_MESSAGE =
  'Saving statement details is not set up in the database yet. Run migration 209 first (supabase/migrations/209_account_statements.sql).';

// The table from migration 209 is missing, or PostgREST hasn't seen it yet.
const MISSING_TABLE_CODES = new Set(['42P01', '42703', 'PGRST200', 'PGRST204', 'PGRST205']);

export function isStatementsTableMissing(error: DbError | null | undefined): boolean {
  if (!error) return false;
  return MISSING_TABLE_CODES.has(error.code ?? '') && /account_statements/i.test(error.message ?? '');
}

/** Deletes the statement facts an import saved. Used by undo; a missing table means there is nothing to delete. */
export async function deleteBatchStatements(db: SupabaseClient, userId: string, batchId: string): Promise<number> {
  const { data, error } = await db
    .from('account_statements')
    .delete()
    .eq('user_id', userId)
    .eq('import_batch_id', batchId)
    .select('id');
  if (error) {
    if (isStatementsTableMissing(error)) return 0;
    throw dbFailure(error, 'remove the statement summary');
  }
  return (data ?? []).length;
}
