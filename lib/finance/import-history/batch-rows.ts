// lib/finance/import-history/batch-rows.ts
// One past statement import, opened from Import history
// (/dashboard/finance/import/history/[id]): its rows, edits to them, and
// "Re-run transfer matching for this import". Undo stays in
// lib/finance/csv-import/undo.ts.
//
// Every read and write checks the import is the user's first, and every row
// write is scoped to the user AND to the import (`import_batch_id`), so an id
// from another import, or another person, changes nothing.
//
// Editing a row moves its updated_at (the table's trigger), so a later Undo of
// the import keeps that row and lists it, as it always has for edited rows.
//
// Relative imports end in `.ts` for `node --test --experimental-strip-types`.

import type { SupabaseClient } from '@supabase/supabase-js';
import { ownedIds } from '../../auth/ownership.ts';
import { ID_CHUNK, chunk } from '../csv-import/db.ts';
import { ImportError, dbFailure } from '../csv-import/errors.ts';
import { isUuid } from '../csv-import/service.ts';
import { suggestTransferPairs, TRANSFER_WINDOW_DAYS, type DetectRow } from '../transfers/detect.ts';
import { accountLabel, toCents, transferEditConflict } from '../transfers/pairing.ts';
import { withOptionalKind } from '../transfers/schema.ts';
import { shiftDate } from '../transaction-matching.ts';
import { MAX_REVIEW_BATCH, linkTransferPairs, type ActionFailure } from '../review/actions.ts';
import { dismissalKey } from '../review/sections.ts';
import { loadDismissals } from '../review/server.ts';

export const MAX_BATCH_ROWS_PAGE = 200;
export const MAX_BATCH_EDIT = 200;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const bad = (message: string): ImportError => new ImportError(400, 'bad_request', message);

export interface BatchInfo {
  id: string;
  account_id: string | null;
  source: string;
  file_name: string | null;
  preset: string | null;
  row_count: number;
  inserted_count: number;
  linked_count: number;
  duplicate_count: number;
  invalid_count: number;
  status: 'committed' | 'undone';
  undone_at: string | null;
  created_at: string;
  financial_accounts: { id: string; name: string; institution_name: string | null; last_four: string | null } | null;
}

const BATCH_COLUMNS =
  'id, account_id, source, file_name, preset, row_count, inserted_count, linked_count, duplicate_count, invalid_count, status, undone_at, created_at, financial_accounts!import_batches_account_id_fkey(id, name, institution_name, last_four)';

/** The import, if it is the user's. Throws ImportError 404 otherwise ("not yours" and "doesn't exist" read the same). */
export async function loadOwnedBatch(db: SupabaseClient, userId: string, batchId: string): Promise<BatchInfo> {
  if (!isUuid(batchId)) throw new ImportError(404, 'batch_not_found', 'That import was not found.');
  const { data, error } = await db
    .from('import_batches')
    .select(BATCH_COLUMNS)
    .eq('id', batchId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw dbFailure(error, 'read the import');
  if (!data) throw new ImportError(404, 'batch_not_found', 'That import was not found.');
  const batch = data as unknown as BatchInfo;
  const account = batch.financial_accounts as unknown;
  return { ...batch, financial_accounts: Array.isArray(account) ? (account[0] ?? null) : (batch.financial_accounts ?? null) };
}

/** One row of the import, as the history page shows it. */
export interface BatchRow {
  id: string;
  transaction_date: string;
  amount: number;
  type: 'expense' | 'income';
  description: string | null;
  vendor: string | null;
  category_id: string | null;
  account_id: string | null;
  /** 'csv_import' when the import added it; 'manual' / 'scan' when it linked the person's own entry. */
  source: string | null;
  transfer_group_id: string | null;
  /** The other side of its transfer, when it is one. */
  transfer_partner: { id: string; account_label: string; transaction_date: string } | null;
  /** True when the row changed after the import (Undo keeps it). */
  edited: boolean;
}

interface StoredRow {
  id: string;
  transaction_date: string;
  amount: number | string;
  type: 'expense' | 'income';
  description: string | null;
  vendor: string | null;
  category_id: string | null;
  account_id: string | null;
  source: string | null;
  transfer_group_id: string | null;
  created_at: string;
  updated_at: string;
}

const ROW_COLUMNS =
  'id, transaction_date, amount, type, description, vendor, category_id, account_id, source, transfer_group_id, created_at, updated_at';

/** Edited after the import: the same 2-second rule Undo uses (lib/finance/csv-import/undo.ts). */
function wasEdited(row: Pick<StoredRow, 'created_at' | 'updated_at'>): boolean {
  const created = Date.parse(row.created_at);
  const updated = Date.parse(row.updated_at);
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return false;
  return Math.abs(updated - created) > 2000;
}

/** A page of the import's rows, oldest date first (statement order), with each transfer's other side. */
export async function listBatchRows(
  db: SupabaseClient,
  userId: string,
  batchId: string,
  options: { offset?: number; limit?: number } = {},
): Promise<{ batch: BatchInfo; rows: BatchRow[]; total: number; offset: number }> {
  const batch = await loadOwnedBatch(db, userId, batchId);
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 100) || 100, 1), MAX_BATCH_ROWS_PAGE);
  const offset = Math.max(0, Math.trunc(options.offset ?? 0) || 0);
  const { data, error, count } = await db
    .from('financial_transactions')
    .select(ROW_COLUMNS, { count: 'exact' })
    .eq('user_id', userId)
    .eq('import_batch_id', batchId)
    .order('transaction_date', { ascending: true })
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw dbFailure(error, 'read the imported transactions');
  const stored = (data ?? []) as unknown as StoredRow[];

  // The other side of each transfer, with its account's label.
  const groups = [...new Set(stored.map((row) => row.transfer_group_id).filter((id): id is string => Boolean(id)))];
  const partners = new Map<string, { id: string; account_id: string | null; transaction_date: string; transfer_group_id: string }[]>();
  const partnerAccounts = new Map<string, { name: string; institution_name: string | null; last_four: string | null }>();
  for (const group of chunk(groups, ID_CHUNK)) {
    const found = await db
      .from('financial_transactions')
      .select('id, account_id, transaction_date, transfer_group_id')
      .eq('user_id', userId)
      .in('transfer_group_id', group);
    if (found.error) break; // Only the "Transfer with ..." label is lost.
    for (const row of (found.data ?? []) as { id: string; account_id: string | null; transaction_date: string; transfer_group_id: string }[]) {
      const list = partners.get(row.transfer_group_id) ?? [];
      list.push(row);
      partners.set(row.transfer_group_id, list);
    }
  }
  const accountIds = [...new Set([...partners.values()].flat().map((row) => row.account_id).filter((id): id is string => Boolean(id)))];
  if (accountIds.length > 0) {
    const { data: accounts } = await db
      .from('financial_accounts')
      .select('id, name, institution_name, last_four')
      .eq('user_id', userId)
      .in('id', accountIds);
    for (const account of (accounts ?? []) as { id: string; name: string; institution_name: string | null; last_four: string | null }[]) {
      partnerAccounts.set(account.id, account);
    }
  }

  const rows: BatchRow[] = stored.map((row) => {
    const partner = row.transfer_group_id
      ? (partners.get(row.transfer_group_id) ?? []).find((other) => other.id !== row.id) ?? null
      : null;
    return {
      id: row.id,
      transaction_date: row.transaction_date,
      amount: toCents(row.amount) / 100,
      type: row.type,
      description: row.description,
      vendor: row.vendor,
      category_id: row.category_id,
      account_id: row.account_id,
      source: row.source,
      transfer_group_id: row.transfer_group_id,
      transfer_partner: partner
        ? {
            id: partner.id,
            account_label: partner.account_id ? accountLabel(partnerAccounts.get(partner.account_id) ?? null) : 'No account',
            transaction_date: partner.transaction_date,
          }
        : null,
      edited: wasEdited(row),
    };
  });
  return { batch, rows, total: count ?? rows.length, offset };
}

// ── Edits ─────────────────────────────────────────────────────────────────

export interface BatchEdit {
  /** A budget category id of the user's, or null for none. */
  category_id?: string | null;
  type?: 'expense' | 'income';
  /** The vendor name; '' or null clears it. */
  vendor?: string | null;
  description?: string;
}

/** Checks `{ ids, changes }`. Throws ImportError 400 on anything else. Pure. */
export function readBatchEdit(body: unknown): { ids: string[]; changes: BatchEdit } {
  const fields = isRecord(body) ? body : {};
  const ids = Array.isArray(fields.ids) ? [...new Set(fields.ids.filter(isUuid).map((id) => id.toLowerCase()))] : [];
  if (ids.length === 0) throw bad('Choose at least one row.');
  if (ids.length > MAX_BATCH_EDIT) throw bad(`Up to ${MAX_BATCH_EDIT} rows at a time.`);
  const raw = isRecord(fields.changes) ? fields.changes : {};
  const changes: BatchEdit = {};
  if (raw.category_id !== undefined) {
    if (raw.category_id !== null && !isUuid(raw.category_id)) throw bad('category_id must be one of your categories, or null.');
    changes.category_id = raw.category_id as string | null;
  }
  if (raw.type !== undefined) {
    if (raw.type !== 'expense' && raw.type !== 'income') throw bad('type must be expense or income.');
    changes.type = raw.type;
  }
  if (raw.vendor !== undefined) {
    if (raw.vendor !== null && typeof raw.vendor !== 'string') throw bad('vendor must be text.');
    const vendor = typeof raw.vendor === 'string' ? raw.vendor.trim().slice(0, 200) : '';
    changes.vendor = vendor || null;
  }
  if (raw.description !== undefined) {
    if (typeof raw.description !== 'string' || !raw.description.trim()) throw bad('description must be text.');
    changes.description = raw.description.trim().slice(0, 500);
  }
  if (Object.keys(changes).length === 0) throw bad('Nothing to change: send category_id, type, vendor or description.');
  return { ids, changes };
}

export interface EditResult {
  updated: number;
  /** Rows left as they were, with why (one side of a transfer can't change its type alone). */
  skipped: ActionFailure[];
}

/**
 * Applies the same change to the chosen rows of one import. Rows that aren't
 * in this import (or aren't the user's) are not touched; a type change on one
 * side of a transfer is refused for that row, as the transactions page does.
 */
export async function editBatchRows(db: SupabaseClient, userId: string, batchId: string, body: unknown): Promise<EditResult> {
  await loadOwnedBatch(db, userId, batchId);
  const { ids, changes } = readBatchEdit(body);
  if (changes.category_id) {
    const owned = await ownedIds(db, userId, 'budget_categories', [changes.category_id]);
    if (owned.failed) throw new ImportError(500, 'database_error', 'Could not check the category.');
    if (!owned.has(changes.category_id)) throw new ImportError(400, 'bad_reference', 'Invalid reference: category_id');
  }

  const rows = await readBatchRows(db, userId, batchId, ids);
  const skipped: ActionFailure[] = [];
  const editable: string[] = [];
  for (const id of ids) {
    const row = rows.get(id);
    if (!row) {
      skipped.push({ id, reason: 'This row is not part of this import.' });
      continue;
    }
    if (changes.type && row.transfer_group_id) {
      const conflict = transferEditConflict(row, { type: changes.type });
      if (conflict) {
        skipped.push({ id, reason: conflict });
        continue;
      }
    }
    editable.push(id);
  }

  let updated = 0;
  for (const group of chunk(editable, ID_CHUNK)) {
    const { data, error } = await db
      .from('financial_transactions')
      .update(changes)
      .eq('user_id', userId)
      .eq('import_batch_id', batchId)
      .in('id', group)
      .select('id');
    if (error) throw dbFailure(error, 'save the changes');
    updated += (data ?? []).length;
  }
  return { updated, skipped };
}

interface EditableRow {
  id: string;
  source: string | null;
  amount: number | string;
  type: string;
  transfer_group_id: string | null;
}

/** The import's rows among `ids` that are the user's, by id. */
async function readBatchRows(
  db: SupabaseClient,
  userId: string,
  batchId: string,
  ids: readonly string[],
): Promise<Map<string, EditableRow>> {
  const rows = new Map<string, EditableRow>();
  for (const group of chunk([...ids], ID_CHUNK)) {
    const { data, error } = await db
      .from('financial_transactions')
      .select('id, source, amount, type, transfer_group_id')
      .eq('user_id', userId)
      .eq('import_batch_id', batchId)
      .in('id', group);
    if (error) throw dbFailure(error, 'read the imported transactions');
    for (const row of (data ?? []) as EditableRow[]) rows.set(row.id, row);
  }
  return rows;
}

// ── Deleting rows ─────────────────────────────────────────────────────────

export interface DeleteResult {
  deleted: number;
  /** Payments a transfer recorded on another account that went with them. */
  counterEntriesRemoved: number;
  skipped: ActionFailure[];
}

/**
 * Deletes rows the import added (source 'csv_import'). An entry the person
 * made that the import only linked is never deleted here: open it to delete
 * it. When a deleted row was one side of a transfer, the other side is taken
 * apart the way Undo does it: an entry a transfer recorded (source 'transfer',
 * never matched to a statement row) is deleted, anything else is just unlinked.
 */
export async function deleteBatchRows(db: SupabaseClient, userId: string, batchId: string, body: unknown): Promise<DeleteResult> {
  await loadOwnedBatch(db, userId, batchId);
  const fields = isRecord(body) ? body : {};
  const ids = Array.isArray(fields.ids) ? [...new Set(fields.ids.filter(isUuid).map((id) => id.toLowerCase()))] : [];
  if (ids.length === 0) throw bad('Choose at least one row.');
  if (ids.length > MAX_BATCH_EDIT) throw bad(`Up to ${MAX_BATCH_EDIT} rows at a time.`);

  const rows = await readBatchRows(db, userId, batchId, ids);
  const skipped: ActionFailure[] = [];
  const deletable: string[] = [];
  const groups = new Set<string>();
  for (const id of ids) {
    const row = rows.get(id);
    if (!row) {
      skipped.push({ id, reason: 'This row is not part of this import.' });
    } else if (row.source !== 'csv_import') {
      skipped.push({ id, reason: 'This is an entry you made that the import linked. Open it to delete it.' });
    } else {
      deletable.push(id);
      if (row.transfer_group_id) groups.add(row.transfer_group_id);
    }
  }

  let counterEntriesRemoved = 0;
  for (const group of chunk([...groups], ID_CHUNK)) {
    const removed = await db
      .from('financial_transactions')
      .delete()
      .eq('user_id', userId)
      .eq('source', 'transfer')
      .is('external_id', null)
      .in('transfer_group_id', group)
      .select('id');
    if (removed.error) throw dbFailure(removed.error, 'remove the payments recorded with these rows');
    counterEntriesRemoved += (removed.data ?? []).length;
    const { error } = await withOptionalKind((kindColumnExists) =>
      db
        .from('financial_transactions')
        .update(kindColumnExists ? { transfer_group_id: null, transfer_kind: null } : { transfer_group_id: null })
        .eq('user_id', userId)
        .in('transfer_group_id', group),
    );
    if (error) throw dbFailure(error, 'unlink the transfers of these rows');
  }

  let deleted = 0;
  for (const group of chunk(deletable, ID_CHUNK)) {
    const { data, error } = await db
      .from('financial_transactions')
      .delete()
      .eq('user_id', userId)
      .eq('import_batch_id', batchId)
      .eq('source', 'csv_import')
      .in('id', group)
      .select('id');
    if (error) throw dbFailure(error, 'delete the rows');
    deleted += (data ?? []).length;
  }
  return { deleted, counterEntriesRemoved, skipped };
}

// ── Re-run transfer matching ──────────────────────────────────────────────

export interface RematchResult {
  /** Pairs linked now (high confidence only). */
  linked: number;
  /** Possible pairs that need a person to look: listed on the Review page. */
  toReview: number;
  /** The import's rows that were looked at (those not already in a transfer). */
  checked: number;
  failed: ActionFailure[];
}

interface MatchRow {
  id: string;
  account_id: string | null;
  amount: number | string;
  type: 'expense' | 'income';
  transaction_date: string;
  description: string | null;
  vendor: string | null;
  import_batch_id: string | null;
}

const MATCH_COLUMNS = 'id, account_id, amount, type, transaction_date, description, vendor, import_batch_id';
const MAX_MATCH_ROWS = 5000;

const toDetect = (row: MatchRow): DetectRow => ({
  id: row.id,
  account_id: row.account_id,
  date: row.transaction_date,
  amountCents: toCents(row.amount),
  type: row.type,
  description: row.description,
  vendor: row.vendor,
});

/**
 * Runs the transfer detector again for one import: its rows that aren't in a
 * transfer, against every unlinked row on the person's accounts in the same
 * dates (5 days either side). High-confidence pairs that touch the import are
 * linked; the rest are counted for the Review page; pairs the person turned
 * down are left alone. Safe to run again: linked rows are no longer looked
 * at, so a second run links nothing new.
 */
export async function rematchBatchTransfers(db: SupabaseClient, userId: string, batchId: string): Promise<RematchResult> {
  const batch = await loadOwnedBatch(db, userId, batchId);
  if (batch.status === 'undone') throw new ImportError(409, 'batch_undone', 'This import was undone, so it has no rows to match.');

  const own = await db
    .from('financial_transactions')
    .select(MATCH_COLUMNS)
    .eq('user_id', userId)
    .eq('import_batch_id', batchId)
    .is('transfer_group_id', null)
    .not('account_id', 'is', null)
    .order('transaction_date', { ascending: true })
    .limit(MAX_MATCH_ROWS);
  if (own.error) throw dbFailure(own.error, 'read the imported transactions');
  const batchRows = (own.data ?? []) as MatchRow[];
  if (batchRows.length === 0) return { linked: 0, toReview: 0, checked: 0, failed: [] };

  const dates = batchRows.map((row) => row.transaction_date).sort();
  const from = shiftDate(dates[0], -TRANSFER_WINDOW_DAYS);
  const to = shiftDate(dates[dates.length - 1], TRANSFER_WINDOW_DAYS);
  const nearby = await db
    .from('financial_transactions')
    .select(MATCH_COLUMNS)
    .eq('user_id', userId)
    .is('transfer_group_id', null)
    .not('account_id', 'is', null)
    .gte('transaction_date', from)
    .lte('transaction_date', to)
    .order('transaction_date', { ascending: true })
    .limit(MAX_MATCH_ROWS);
  if (nearby.error) throw dbFailure(nearby.error, 'read your other transactions');

  const rows = new Map<string, MatchRow>();
  for (const row of [...batchRows, ...((nearby.data ?? []) as MatchRow[])]) rows.set(row.id, row);
  const accounts = await db
    .from('financial_accounts')
    .select('id, name, account_type, institution_name, last_four')
    .eq('user_id', userId);
  if (accounts.error) throw dbFailure(accounts.error, 'read your accounts');

  const inBatch = new Set(batchRows.map((row) => row.id));
  const dismissals = await loadDismissals(db, userId);
  const suggestions = suggestTransferPairs(
    [...rows.values()].map(toDetect),
    (accounts.data ?? []) as { id: string; name: string; account_type: string; institution_name: string | null; last_four: string | null }[],
  );
  const touching = suggestions.pairs.filter(
    (pair) =>
      (inBatch.has(pair.fromId) || inBatch.has(pair.toId)) &&
      !dismissals.keys.has(dismissalKey('transfer_pair', pair.fromId, pair.toId)),
  );
  const high = touching.filter((pair) => pair.confidence === 'high');
  const result: RematchResult = { linked: 0, toReview: touching.length - high.length, checked: batchRows.length, failed: [] };
  if (high.length === 0) return result;

  for (const group of chunk(high, MAX_REVIEW_BATCH)) {
    const linked = await linkTransferPairs(
      db,
      userId,
      group.map((pair) => ({ from_id: pair.fromId, to_id: pair.toId })),
    );
    result.linked += linked.linked;
    result.failed.push(...linked.failed);
  }
  return result;
}
