// lib/finance/csv-import/commit.ts
// Writes a planned statement import: records the batch, inserts the new rows,
// and links matched rows to the manual or scanned entries they belong to.
//
// Relative imports end in `.ts` so tests/unit/csv-import-plan.test.ts can load
// this file under `node --test --experimental-strip-types`.
//
// Safe to run twice. PostgREST can't aim `on_conflict` at a partial unique
// index, so there is no upsert: rows go in as plain inserts, 200 at a time,
// and when a chunk hits the unique index on (user_id, account_id, external_id)
// that chunk is retried one row at a time, counting each collision as a
// duplicate. A replayed request therefore inserts nothing new.
//
// Cost of that fallback: one request per row of the colliding chunk. Through
// the route it is rare, because the route re-plans first and rows already in
// the account are skipped before any insert; it takes two requests racing, or
// a plan made from stale data, to reach it.

import type { SupabaseClient } from '@supabase/supabase-js';
import { loadLearnedCategoryIndex } from '../learned-categories.ts';
import type { LearnedCategoryIndex } from '../transaction-matching.ts';
import { chunk } from './db.ts';
import { ImportError, dbFailure, isMissingSchemaError, isUniqueViolation } from './errors.ts';
import { LINKABLE_SOURCES, allowedActions, loadCategories, suggestCategory } from './plan.ts';
import type {
  CommitResult,
  DecidedRow,
  PlannedRow,
  RejectedRow,
  RowAction,
  TransactionType,
} from './types.ts';

/** The most rows one import takes. */
export const MAX_IMPORT_ROWS = 5000;

/** Rows per insert request. */
export const INSERT_CHUNK = 200;

export function tooManyRowsMessage(count: number): string {
  return `This file has ${count.toLocaleString('en-US')} rows. One import takes up to ${MAX_IMPORT_ROWS.toLocaleString('en-US')}: split the file into shorter date ranges.`;
}

/**
 * Combines the server's plan with the actions the person chose in the review
 * step. `actions` are matched to rows by spreadsheet row number; a row with no
 * action gets its default (new -> insert, matches -> link, the rest -> skip).
 *
 * - An action counts only when the row allows it (PlannedRow.allowedActions);
 *   otherwise the row's default applies. So `link` only holds on a row the
 *   server itself matched (the entry may have been linked or deleted since
 *   the preview), and an invalid row is always skipped.
 * - `insert` is allowed on a same-transaction duplicate ("import it anyway"),
 *   but not on a row already imported from this statement: the unique index
 *   would refuse it, one slow row at a time.
 * - `type` and `categoryId` are kept only when well formed.
 */
export function resolveActions(
  planned: readonly PlannedRow[],
  actions: readonly RowAction[],
): DecidedRow[] {
  const byRow = new Map<number, RowAction>();
  for (const action of actions) byRow.set(action.row, action);

  return planned.map((row) => {
    const decided: DecidedRow = { ...row, action: row.defaultAction };
    if (row.status === 'invalid') {
      decided.action = 'skip';
      return decided;
    }
    const requested = byRow.get(row.rowNumber);
    if (!requested) return decided;

    // Worked out again here rather than read from the row, so the rule holds
    // whatever the caller put in `allowedActions`.
    if (requested.action && allowedActions(row).includes(requested.action)) {
      decided.action = requested.action;
    }
    if (requested.type === 'expense' || requested.type === 'income') {
      decided.typeOverride = requested.type;
    }
    if (requested.categoryId === null || typeof requested.categoryId === 'string') {
      decided.categoryOverride = requested.categoryId;
    }
    return decided;
  });
}

interface CategoryContext {
  learned: LearnedCategoryIndex;
  categoryIdByName: ReadonlyMap<string, string>;
  /** The person's own category ids: an override outside this set is ignored. */
  categoryIds: ReadonlySet<string>;
}

/**
 * The category a row is saved with, in order: the person's choice (null means
 * "none"), the vendor's learned category, the file's category matched by name.
 */
export function resolveCategory(row: DecidedRow, type: TransactionType, context: CategoryContext): string | null {
  if (row.categoryOverride === null) return null;
  if (typeof row.categoryOverride === 'string' && context.categoryIds.has(row.categoryOverride)) {
    return row.categoryOverride;
  }
  return suggestCategory(row, type, context).id;
}

/** The financial_transactions row a statement row becomes. */
export function toInsertPayload(
  row: DecidedRow,
  ids: { userId: string; accountId: string; batchId: string },
  context: CategoryContext,
): Record<string, unknown> {
  const type = row.typeOverride ?? row.type;
  return {
    user_id: ids.userId,
    account_id: ids.accountId,
    transaction_date: row.date,
    amount: row.amountCents / 100,
    type,
    description: row.description,
    vendor: row.vendor || null,
    category_id: resolveCategory(row, type, context),
    // Provenance only. The shared source CHECK already allows this value.
    source: 'csv_import',
    external_id: row.externalId,
    import_batch_id: ids.batchId,
  };
}

export interface CommitInput {
  /** The account the statement belongs to. The caller has checked it is the user's. */
  accountId: string;
  fileName?: string | null;
  preset?: string | null;
  /** import_batches.source: 'csv_import' (the default) or 'pdf_import'. Transactions keep source 'csv_import' either way. */
  source?: 'csv_import' | 'pdf_import';
  /** Stored on the batch as given: { mapping, sign, dateOrder, includePending }. */
  mapping?: unknown;
  rows: readonly DecidedRow[];
  /** Rows the parser could not read. Counted as invalid and returned in `rejected`. */
  rejected?: readonly RejectedRow[];
}

const clip = (text: string | null | undefined, max: number): string | null => {
  const value = text?.trim();
  return value ? value.slice(0, max) : null;
};

/**
 * Commits an import. Order of work:
 *   1. read the learned categories and budget categories (nothing is written if this fails);
 *   2. insert the import_batches row;
 *   3. link `link` rows: set external_id and import_batch_id on the matched
 *      entry, and its account when it had none. The update only applies while
 *      the entry is still unlinked, so two imports can't claim one entry; a
 *      row that loses that race is inserted as new instead;
 *   4. insert `insert` rows in chunks (see the top of this file);
 *   5. write the counts onto the batch.
 *
 * Throws ImportError before writing when there are too many rows or the batch
 * can't be created ("Run migration 203 first" when its table is missing). A
 * row the database refuses for any other reason is returned in `rejected`
 * and the rest of the import carries on.
 */
export async function commitImport(
  db: SupabaseClient,
  userId: string,
  input: CommitInput,
): Promise<CommitResult> {
  const rejected: RejectedRow[] = [...(input.rejected ?? [])];
  const rowCount = input.rows.length + rejected.length;
  if (input.rows.length > MAX_IMPORT_ROWS) {
    throw new ImportError(400, 'too_many_rows', tooManyRowsMessage(input.rows.length));
  }

  const [learned, categories] = await Promise.all([
    loadLearnedCategoryIndex(db, userId),
    loadCategories(db, userId),
  ]);
  const categoryIdByName = new Map<string, string>();
  for (const category of categories) {
    const name = category.name?.trim().toLowerCase();
    if (name && !categoryIdByName.has(name)) categoryIdByName.set(name, category.id);
  }
  const context: CategoryContext = {
    learned,
    categoryIdByName,
    categoryIds: new Set(categories.map((category) => category.id)),
  };

  let duplicates = 0;
  let skipped = 0;
  const toLink: DecidedRow[] = [];
  const toInsert: DecidedRow[] = [];
  for (const row of input.rows) {
    if (row.status === 'invalid' || !row.externalId) {
      rejected.push({ row: row.rowNumber, reason: row.reason ?? 'The row could not be read' });
    } else if (row.action === 'link' && row.match) {
      toLink.push(row);
    } else if (row.action === 'insert' || row.action === 'link') {
      toInsert.push(row);
    } else if (row.status === 'duplicate' || row.status === 'duplicate_in_file') {
      duplicates += 1;
    } else {
      skipped += 1;
    }
  }

  const created = await db
    .from('import_batches')
    .insert({
      user_id: userId,
      account_id: input.accountId,
      source: input.source ?? 'csv_import',
      file_name: clip(input.fileName, 255),
      preset: clip(input.preset, 60),
      mapping: input.mapping ?? null,
      row_count: rowCount,
    })
    .select('id');
  const batchId = (created.data as { id: string }[] | null)?.[0]?.id;
  if (created.error || !batchId) throw dbFailure(created.error, 'start the import');

  const ids = { userId, accountId: input.accountId, batchId };
  let inserted = 0;
  let linked = 0;

  try {
    for (const row of toLink) {
      const entry = row.match!;
      const values: Record<string, unknown> = { external_id: row.externalId, import_batch_id: batchId };
      if (!entry.account_id) values.account_id = input.accountId;

      let update = db
        .from('financial_transactions')
        .update(values)
        .eq('id', entry.id)
        .eq('user_id', userId)
        // Only while nobody else has linked it, and only an entry a person made.
        .is('external_id', null)
        .in('source', [...LINKABLE_SOURCES]);
      update = entry.account_id ? update.eq('account_id', input.accountId) : update.is('account_id', null);
      const { data, error } = await update.select('id');

      if (error) {
        if (isMissingSchemaError(error)) throw dbFailure(error, 'link a transaction');
        if (isUniqueViolation(error)) duplicates += 1;
        else rejected.push({ row: row.rowNumber, reason: `Could not be linked: ${error.message}` });
      } else if (data && data.length > 0) {
        linked += 1;
      } else {
        // The entry was linked, moved or deleted since the plan was made.
        toInsert.push(row);
      }
    }

    for (const group of chunk(toInsert, INSERT_CHUNK)) {
      const payloads = group.map((row) => toInsertPayload(row, ids, context));
      const { error } = await db.from('financial_transactions').insert(payloads);
      if (!error) {
        inserted += group.length;
        continue;
      }
      if (isMissingSchemaError(error)) throw dbFailure(error, 'save the transactions');

      // One bad row fails the whole chunk. Go row by row so the others still land.
      for (let i = 0; i < group.length; i++) {
        const single = await db.from('financial_transactions').insert(payloads[i]);
        if (!single.error) inserted += 1;
        else if (isUniqueViolation(single.error)) duplicates += 1;
        else if (isMissingSchemaError(single.error)) throw dbFailure(single.error, 'save the transactions');
        else rejected.push({ row: group[i].rowNumber, reason: `Could not be saved: ${single.error.message}` });
      }
    }
  } finally {
    // Best effort: the rows are already in, with or without the counts.
    await db
      .from('import_batches')
      .update({
        inserted_count: inserted,
        linked_count: linked,
        duplicate_count: duplicates,
        invalid_count: rejected.length,
      })
      .eq('id', batchId)
      .eq('user_id', userId);
  }

  rejected.sort((a, b) => a.row - b.row);
  return { batchId, inserted, linked, duplicates, invalid: rejected.length, skipped, rejected };
}
