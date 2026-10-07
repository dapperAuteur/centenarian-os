// lib/finance/bulk-edit/server.ts
// Applies a bulk edit to a person's transactions and undoes one, for
// POST /api/finance/transactions/bulk and /api/finance/transactions/bulk/undo.
// The rules are in logic.ts; this file reads and writes.
//
// Ownership: every id in the request is looked up with the caller's user_id
// and decided again from the returned row, so someone else's transaction (or
// one that is gone) is never written and is counted as `not_found`. Every
// reference (category, brand, life categories) must be the caller's own, or
// the request is refused before anything is written.
//
// Undo needs migration 220 (bulk_edit_operations, bulk_edit_operation_rows).
// Without it a bulk edit still works; the answer says undo is not available.
//
// No '@/' imports: runs under node --test (tests/unit/bulk-edit.test.ts).

import { checkReferences, invalidReferenceMessage, isUuid } from '../../auth/ownership.ts';
import { missingTransferColumn } from '../transfers/schema.ts';
import { vendorKey } from '../transaction-matching.ts';
import {
  KEEP_OPERATIONS,
  LIFE_PREFIX,
  MAX_REMEMBER,
  UNDO_CHUNK,
  parseBulkBody,
  planRowChange,
  planUndo,
  type BulkEditSpec,
  type CurrentRow,
  type FieldValues,
  type OperationRequest,
  type OperationRow,
  type RestoreItem,
  type TxSnapshot,
} from './logic.ts';
import { rememberVendorCategory } from './remember.ts';

/** The client this file needs (see OwnershipDb for why `from` returns any). */
export interface BulkDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

interface DbError {
  code?: string | null;
  message?: string | null;
}

export interface BulkResult {
  status: number;
  body: Record<string, unknown>;
}

/** Ids per `in (...)` filter, keeping request URLs short. */
const ID_CHUNK = 100;
/** Operation rows written per insert. */
const INSERT_CHUNK = 500;

export const BULK_UNDO_NOT_MIGRATED = {
  code: 'bulk_edit_not_migrated',
  message:
    'Undo for bulk edits is not set up in this database yet. Run migration 220 first ' +
    '(supabase/migrations/220_bulk_edit_operations.sql). Bulk edits still work, but they cannot be undone.',
} as const;

/** True when an error says a table doesn't exist (Postgres 42P01, PostgREST PGRST205). */
export function isMissingTable(error: DbError | null | undefined, table: string): boolean {
  if (!error) return false;
  if (error.code !== '42P01' && error.code !== 'PGRST205') return false;
  return !error.message || error.message.includes(table);
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const SNAPSHOT_BASE = 'id, user_id, category_id, brand_id, vendor, type, tags';

interface TransferColumns {
  group: boolean;
  kind: boolean;
}

function snapshotColumns(cols: TransferColumns): string {
  return `${SNAPSHOT_BASE}${cols.group ? ', transfer_group_id' : ''}${cols.kind ? ', transfer_kind' : ''}`;
}

/**
 * Reads rows with whatever transfer columns this database has: without
 * transfer_kind before migration 203, without both before migration 202.
 * `query(columns, chunk)` builds the read for one chunk of keys.
 */
async function readWithTransferColumns(
  keys: readonly string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: (columns: string, chunk: string[]) => PromiseLike<{ data: any; error: DbError | null }>,
  userId: string,
): Promise<{ rows: TxSnapshot[]; cols: TransferColumns; error: DbError | null }> {
  let cols: TransferColumns = { group: true, kind: true };
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows: TxSnapshot[] = [];
    let error: DbError | null = null;
    for (const chunk of chunks(keys, ID_CHUNK)) {
      const result = await query(snapshotColumns(cols), chunk);
      if (result.error) {
        error = result.error;
        break;
      }
      for (const row of (result.data ?? []) as (TxSnapshot & { user_id?: string })[]) {
        // Decided again from the row: a filter that was not applied can never admit another user's row.
        if (row.user_id === userId) rows.push(row);
      }
    }
    const missing = missingTransferColumn(error);
    if (missing === 'transfer_kind' && cols.kind) {
      cols = { group: cols.group, kind: false };
      continue;
    }
    if (missing === 'transfer_group_id' && cols.group) {
      cols = { group: false, kind: false };
      continue;
    }
    return { rows, cols, error };
  }
  return { rows: [], cols, error: { message: 'Could not read the transactions' } };
}

function loadTransactions(db: BulkDb, userId: string, ids: readonly string[]) {
  return readWithTransferColumns(
    ids,
    (columns, chunk) => db.from('financial_transactions').select(columns).eq('user_id', userId).in('id', chunk),
    userId,
  );
}

function loadGroups(db: BulkDb, userId: string, groupIds: readonly string[]) {
  return readWithTransferColumns(
    groupIds,
    (columns, chunk) => db.from('financial_transactions').select(columns).eq('user_id', userId).in('transfer_group_id', chunk),
    userId,
  );
}

/** entity_id -> the life categories (of `lifeIds`, or all) each transaction is tagged with. */
async function loadLifeTags(
  db: BulkDb,
  userId: string,
  entityIds: readonly string[],
  lifeIds?: readonly string[],
): Promise<{ tags: Map<string, Set<string>>; error: DbError | null }> {
  const tags = new Map<string, Set<string>>();
  for (const chunk of chunks(entityIds, ID_CHUNK)) {
    let query = db
      .from('entity_life_categories')
      .select('entity_id, life_category_id')
      .eq('user_id', userId)
      .eq('entity_type', 'transaction')
      .in('entity_id', chunk);
    if (lifeIds) query = query.in('life_category_id', [...lifeIds]);
    const { data, error } = await query;
    if (error) return { tags, error };
    for (const row of (data ?? []) as { entity_id: string; life_category_id: string }[]) {
      const set = tags.get(row.entity_id) ?? new Set<string>();
      set.add(row.life_category_id);
      tags.set(row.entity_id, set);
    }
  }
  return { tags, error: null };
}

async function addLifeTags(db: BulkDb, userId: string, lifeId: string, entityIds: readonly string[]): Promise<DbError | null> {
  for (const chunk of chunks(entityIds, INSERT_CHUNK)) {
    const { error } = await db.from('entity_life_categories').upsert(
      chunk.map((entity_id) => ({ user_id: userId, life_category_id: lifeId, entity_type: 'transaction', entity_id })),
      { onConflict: 'user_id,entity_type,entity_id,life_category_id', ignoreDuplicates: true },
    );
    if (error) return error;
  }
  return null;
}

async function removeLifeTags(db: BulkDb, userId: string, lifeId: string, entityIds: readonly string[]): Promise<DbError | null> {
  for (const chunk of chunks(entityIds, ID_CHUNK)) {
    const { error } = await db
      .from('entity_life_categories')
      .delete()
      .eq('user_id', userId)
      .eq('entity_type', 'transaction')
      .eq('life_category_id', lifeId)
      .in('entity_id', chunk);
    if (error) return error;
  }
  return null;
}

// ─── Operations (undo records) ────────────────────────────────────────────────

type OpenedOperation =
  | { ok: true; id: string | null; available: boolean }
  | { ok: false; status: number; error: string };

/** The spec as stored with the operation (what was asked for, not per-row values). */
function storedChanges(spec: BulkEditSpec): Record<string, unknown> {
  const { remember_skip: _skip, ...rest } = spec;
  void _skip;
  return rest;
}

async function openOperation(
  db: BulkDb,
  userId: string,
  request: OperationRequest | null,
  spec: BulkEditSpec,
): Promise<OpenedOperation> {
  if (!request) return { ok: true, id: null, available: true };

  if (request.id) {
    if (!isUuid(request.id)) return { ok: false, status: 404, error: 'That bulk edit was not found. Nothing in this batch was changed.' };
    const { data, error } = await db
      .from('bulk_edit_operations')
      .select('id, status')
      .eq('id', request.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (isMissingTable(error, 'bulk_edit_operations')) return { ok: true, id: null, available: false };
    if (error) return { ok: false, status: 500, error: error.message ?? 'Could not read the bulk edit' };
    if (!data || data.status !== 'applied') {
      return { ok: false, status: 409, error: 'That bulk edit was not found or was already undone. Nothing in this batch was changed.' };
    }
    return { ok: true, id: data.id as string, available: true };
  }

  const { data, error } = await db
    .from('bulk_edit_operations')
    .insert({
      user_id: userId,
      entity_type: 'transaction',
      summary: request.summary || null,
      changes: storedChanges(spec),
      row_count: 0,
      status: 'applied',
    })
    .select('id')
    .maybeSingle();
  if (isMissingTable(error, 'bulk_edit_operations')) return { ok: true, id: null, available: false };
  if (error || !data) return { ok: false, status: 500, error: error?.message ?? 'Could not start the bulk edit. Nothing was changed.' };

  // Keep the most recent KEEP_OPERATIONS; their rows go with them (ON DELETE CASCADE).
  const { data: older } = await db
    .from('bulk_edit_operations')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(KEEP_OPERATIONS, KEEP_OPERATIONS + 49);
  const olderIds = ((older ?? []) as { id: string }[]).map((row) => row.id).filter((id) => id !== data.id);
  if (olderIds.length > 0) await db.from('bulk_edit_operations').delete().eq('user_id', userId).in('id', olderIds);

  return { ok: true, id: data.id as string, available: true };
}

interface RowRecord {
  group_key: string | null;
  old: FieldValues;
  new: FieldValues;
}

async function recordRows(
  db: BulkDb,
  userId: string,
  operationId: string,
  records: Map<string, RowRecord>,
): Promise<boolean> {
  const rows = [...records].map(([entityId, record]) => ({
    operation_id: operationId,
    user_id: userId,
    entity_id: entityId,
    group_key: record.group_key,
    old_values: record.old,
    new_values: record.new,
    state: 'applied',
  }));
  for (const chunk of chunks(rows, INSERT_CHUNK)) {
    const { error } = await db.from('bulk_edit_operation_rows').insert(chunk);
    if (error) return false;
  }
  const { data: op } = await db
    .from('bulk_edit_operations')
    .select('row_count')
    .eq('id', operationId)
    .eq('user_id', userId)
    .maybeSingle();
  await db
    .from('bulk_edit_operations')
    .update({ row_count: Number(op?.row_count ?? 0) + rows.length })
    .eq('id', operationId)
    .eq('user_id', userId);
  return true;
}

// ─── Apply ────────────────────────────────────────────────────────────────────

/**
 * Applies one batch (at most BULK_BATCH_SIZE ids) of a bulk edit. With
 * `operation: {}` it starts an undo record and answers its id; later batches
 * of the same edit pass `operation: { id }`.
 */
export async function applyBulkEdit(db: BulkDb, userId: string, input: unknown): Promise<BulkResult> {
  const parsed = parseBulkBody(input);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
  const { spec, operation } = parsed;

  // Category, brand and life categories must be the caller's own.
  const refs = await checkReferences(db, userId, [
    { field: 'category_id', table: 'budget_categories', id: spec.category_id },
    { field: 'brand_id', table: 'user_brands', id: spec.brand_id },
    { field: 'life_category_id', table: 'life_categories', id: spec.life_add },
    { field: 'remove_life_category_id', table: 'life_categories', id: spec.life_remove },
  ]);
  if (refs.failed) return { status: 500, body: { error: 'Could not verify references' } };
  if (!refs.ok) return { status: 400, body: { error: invalidReferenceMessage(refs.invalid) } };

  // Every id: only the caller's own transactions are read, and so only they are written.
  const wanted = [...new Set(parsed.ids.filter(isUuid).map((id) => id.toLowerCase()))];
  const loaded = await loadTransactions(db, userId, wanted);
  if (loaded.error) return { status: 500, body: { error: loaded.error.message ?? 'Could not read the transactions' } };
  const owned = new Map(loaded.rows.map((row) => [row.id.toLowerCase(), row]));
  const ownedIds = [...owned.keys()];
  const notFound = parsed.ids.length - ownedIds.length;

  // Partners of selected transfers, so a transfer is unlinked as a pair.
  let groupRows: TxSnapshot[] = [];
  if (spec.unlink_transfers && loaded.cols.group) {
    const groupIds = [...new Set(loaded.rows.map((row) => row.transfer_group_id).filter((g): g is string => Boolean(g)))];
    if (groupIds.length > 0) {
      const groups = await loadGroups(db, userId, groupIds);
      if (groups.error) return { status: 500, body: { error: groups.error.message ?? 'Could not load the transfers' } };
      groupRows = groups.rows;
    }
  }

  // Life categories each row has now, for the ones this edit adds or removes.
  const lifeIds = [spec.life_add, spec.life_remove].filter((id): id is string => Boolean(id));
  let lifeNow = new Map<string, Set<string>>();
  if (lifeIds.length > 0 && ownedIds.length > 0) {
    const life = await loadLifeTags(db, userId, ownedIds, lifeIds);
    if (life.error) return { status: 500, body: { error: life.error.message ?? 'Could not read life categories' } };
    lifeNow = life.tags;
  }

  const op = await openOperation(db, userId, operation, spec);
  if (!op.ok) return { status: op.status, body: { error: op.error } };

  // What has been written so far, row by row. Recorded for undo even when a
  // later step fails, so nothing written is ever left without its undo record.
  const records = new Map<string, RowRecord>();
  const recordFor = (id: string): RowRecord => {
    const existing = records.get(id);
    if (existing) return existing;
    const created: RowRecord = { group_key: null, old: {}, new: {} };
    records.set(id, created);
    return created;
  };
  const record = async () => (op.id && records.size > 0 ? recordRows(db, userId, op.id, records) : false);
  const fail = async (message: string): Promise<BulkResult> => {
    const undoRecorded = await record();
    return {
      status: 500,
      body: { error: message, partial: records.size > 0, changed: records.size, operation_id: op.id, undo_recorded: undoRecorded },
    };
  };

  // 1. Unlink every row of each selected transfer: both sides, never one.
  const unlinkIds = groupRows.map((row) => row.id);
  for (const chunk of chunks(unlinkIds, ID_CHUNK)) {
    const { error } = await db
      .from('financial_transactions')
      .update(loaded.cols.kind ? { transfer_group_id: null, transfer_kind: null } : { transfer_group_id: null })
      .eq('user_id', userId)
      .in('id', chunk);
    if (error) return fail(error.message ?? 'Could not unlink the transfers');
    for (const row of groupRows.filter((r) => chunk.includes(r.id))) {
      const entry = recordFor(row.id);
      entry.group_key = row.transfer_group_id ?? null;
      entry.old.transfer_group_id = row.transfer_group_id ?? null;
      entry.new.transfer_group_id = null;
      if (loaded.cols.kind) {
        entry.old.transfer_kind = row.transfer_kind ?? null;
        entry.new.transfer_kind = null;
      }
      const mine = owned.get(row.id.toLowerCase());
      if (mine) {
        mine.transfer_group_id = null;
        mine.transfer_kind = null;
      }
    }
  }

  // 2. Field changes, one update per distinct set of new values. Only the rows
  //    the database says it wrote are recorded.
  const byValues = new Map<string, { values: FieldValues; rows: { id: string; old: FieldValues }[] }>();
  let typeSkipped = 0;
  for (const row of owned.values()) {
    const change = planRowChange(row, spec);
    if (change.typeSkipped) typeSkipped += 1;
    if (Object.keys(change.values).length === 0) continue;
    const key = JSON.stringify(change.values);
    const group = byValues.get(key) ?? { values: change.values, rows: [] };
    group.rows.push({ id: row.id, old: change.old });
    byValues.set(key, group);
  }
  for (const { values, rows } of byValues.values()) {
    for (const chunk of chunks(rows, ID_CHUNK)) {
      let query = db.from('financial_transactions').update(values).eq('user_id', userId).in('id', chunk.map((r) => r.id));
      // A row that became one side of a transfer since it was read keeps its type.
      if ('type' in values && loaded.cols.group) query = query.is('transfer_group_id', null);
      const { data, error } = await query.select('id');
      if (error) return fail(error.message ?? 'Could not save the changes');
      const written = new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
      for (const row of chunk) {
        if (!written.has(row.id)) {
          if ('type' in values) typeSkipped += 1;
          continue;
        }
        const entry = recordFor(row.id);
        Object.assign(entry.old, row.old);
        Object.assign(entry.new, values);
      }
    }
  }

  // 3. Life categories.
  let lifeAdded = 0;
  let lifeRemoved = 0;
  if (spec.life_add) {
    const lifeKey = `${LIFE_PREFIX}${spec.life_add}`;
    const adding = ownedIds.filter((id) => !lifeNow.get(id)?.has(spec.life_add!));
    const error = await addLifeTags(db, userId, spec.life_add, adding);
    if (error) return fail(error.message ?? 'Could not add the life category');
    lifeAdded = adding.length;
    for (const id of adding) {
      const entry = recordFor(id);
      entry.old[lifeKey] = false;
      entry.new[lifeKey] = true;
    }
  }
  if (spec.life_remove) {
    const lifeKey = `${LIFE_PREFIX}${spec.life_remove}`;
    const removing = ownedIds.filter((id) => lifeNow.get(id)?.has(spec.life_remove!));
    const error = await removeLifeTags(db, userId, spec.life_remove, removing);
    if (error) return fail(error.message ?? 'Could not remove the life category');
    lifeRemoved = removing.length;
    for (const id of removing) {
      const entry = recordFor(id);
      entry.old[lifeKey] = true;
      entry.new[lifeKey] = false;
    }
  }

  // 4. The undo record.
  const undoRecorded = await record();

  // 5. "Remember for future imports": each vendor's learned category, under
  //    the name imports bring (the row's vendor before this edit) and, after a
  //    rename, under the new name too. Per type, as learned categories are.
  const remembered: string[] = [];
  let rememberFailed = 0;
  if (spec.remember && spec.category_id) {
    const pairs = new Map<string, { vendor: string; type: 'expense' | 'income' }>();
    const add = (vendor: string | null | undefined, type: 'expense' | 'income') => {
      const key = vendorKey(vendor);
      const pairKey = `${type}:${key}`;
      if (!key || pairs.has(pairKey) || spec.remember_skip.includes(pairKey)) return;
      pairs.set(pairKey, { vendor: (vendor ?? '').trim(), type });
    };
    for (const row of owned.values()) {
      const type = (records.get(row.id)?.new.type as 'expense' | 'income' | undefined) ?? row.type;
      add(row.vendor, type);
      if (spec.vendor) add(spec.vendor, type);
    }
    for (const [pairKey, pair] of [...pairs].slice(0, MAX_REMEMBER)) {
      const saved = await rememberVendorCategory(db, userId, pair.vendor, pair.type, spec.category_id);
      if (saved.ok) remembered.push(pairKey);
      else rememberFailed += 1;
    }
  }

  const fieldUpdate = spec.category_id !== undefined || spec.brand_id !== undefined || spec.vendor !== undefined || spec.type !== undefined;
  return {
    status: 200,
    body: {
      // `updated` and `tagged` keep their original meaning: rows the update or the tag applied to.
      updated: fieldUpdate ? ownedIds.length : 0,
      tagged: spec.life_add ? ownedIds.length : 0,
      changed: records.size,
      life_added: lifeAdded,
      life_removed: lifeRemoved,
      unlinked: unlinkIds.length,
      type_skipped: typeSkipped,
      not_found: notFound,
      remembered,
      remember_failed: rememberFailed,
      operation_id: op.id,
      undo_recorded: undoRecorded,
      ...(op.available ? {} : { code: BULK_UNDO_NOT_MIGRATED.code, notice: BULK_UNDO_NOT_MIGRATED.message }),
    },
  };
}

// ─── Undo ─────────────────────────────────────────────────────────────────────

/** The most recent bulk edit that can still be undone, or null. */
export async function latestOperation(db: BulkDb, userId: string): Promise<BulkResult> {
  const { data, error } = await db
    .from('bulk_edit_operations')
    .select('id, summary, row_count, status, created_at')
    .eq('user_id', userId)
    .eq('status', 'applied')
    .order('created_at', { ascending: false })
    .limit(1);
  if (isMissingTable(error, 'bulk_edit_operations')) {
    return { status: 200, body: { available: false, ...BULK_UNDO_NOT_MIGRATED, operation: null } };
  }
  if (error) return { status: 500, body: { error: error.message ?? 'Could not read bulk edits' } };
  const operation = ((data ?? []) as Record<string, unknown>[])[0] ?? null;
  return { status: 200, body: { available: true, operation } };
}

function applyGuard(query: ReturnType<BulkDb['from']>, guard: FieldValues) {
  let q = query;
  for (const [field, value] of Object.entries(guard)) {
    if (field === 'tags') continue; // checked from the row just read; arrays are not compared in a filter
    q = value === null ? q.is(field, null) : q.eq(field, value);
  }
  return q;
}

const TRANSFER_FIELDS = ['transfer_group_id', 'transfer_kind'];

function pick(values: FieldValues, fields: readonly string[], keep: boolean): FieldValues {
  return Object.fromEntries(Object.entries(values).filter(([field]) => fields.includes(field) === keep));
}

/**
 * Undoes up to UNDO_CHUNK rows of an operation; the client repeats while
 * `done` is false. A row is put back only when it still holds every value the
 * edit wrote (compared field by field, never by updated_at); a transfer the
 * edit unlinked is linked again only when both sides can be.
 */
export async function undoOperation(db: BulkDb, userId: string, operationId: unknown): Promise<BulkResult> {
  if (!isUuid(operationId)) return { status: 404, body: { error: 'That bulk edit was not found' } };

  const { data: op, error: opError } = await db
    .from('bulk_edit_operations')
    .select('id, status')
    .eq('id', operationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (isMissingTable(opError, 'bulk_edit_operations')) {
    return { status: 503, body: { error: BULK_UNDO_NOT_MIGRATED.message, code: BULK_UNDO_NOT_MIGRATED.code } };
  }
  if (opError) return { status: 500, body: { error: opError.message ?? 'Could not read the bulk edit' } };
  if (!op) return { status: 404, body: { error: 'That bulk edit was not found' } };
  if (op.status !== 'applied') return { status: 409, body: { error: 'That bulk edit was already undone' } };

  const rowColumns = 'id, entity_id, group_key, old_values, new_values';
  const { data: chunkData, error: chunkError } = await db
    .from('bulk_edit_operation_rows')
    .select(rowColumns)
    .eq('operation_id', operationId)
    .eq('user_id', userId)
    .eq('state', 'applied')
    .order('id', { ascending: true })
    .limit(UNDO_CHUNK);
  if (chunkError) return { status: 500, body: { error: chunkError.message ?? 'Could not read the bulk edit' } };
  const opRows = new Map<string, OperationRow>(((chunkData ?? []) as OperationRow[]).map((row) => [row.id, row]));

  // Both sides of an unlinked transfer are decided together, even across chunks.
  const groupKeys = [...new Set([...opRows.values()].map((row) => row.group_key).filter((g): g is string => Boolean(g)))];
  for (const chunk of chunks(groupKeys, ID_CHUNK)) {
    const { data, error } = await db
      .from('bulk_edit_operation_rows')
      .select(rowColumns)
      .eq('operation_id', operationId)
      .eq('user_id', userId)
      .eq('state', 'applied')
      .in('group_key', chunk);
    if (error) return { status: 500, body: { error: error.message ?? 'Could not read the bulk edit' } };
    for (const row of (data ?? []) as OperationRow[]) opRows.set(row.id, row);
  }

  const rows = [...opRows.values()];
  const entityIds = [...new Set(rows.map((row) => row.entity_id))];
  const loaded = await loadTransactions(db, userId, entityIds);
  if (loaded.error) return { status: 500, body: { error: loaded.error.message ?? 'Could not read the transactions' } };
  const needsLife = rows.some((row) => Object.keys(row.new_values ?? {}).some((field) => field.startsWith(LIFE_PREFIX)));
  const life = needsLife ? await loadLifeTags(db, userId, entityIds) : { tags: new Map<string, Set<string>>(), error: null };
  if (life.error) return { status: 500, body: { error: life.error.message ?? 'Could not read life categories' } };

  const current = new Map<string, CurrentRow>();
  for (const row of loaded.rows) {
    current.set(row.id, { values: row as unknown as FieldValues, lifeCategoryIds: life.tags.get(row.id) ?? new Set() });
  }

  const plan = planUndo(rows, current);
  const restored = new Set<string>();
  const skipped = new Map<string, string>(plan.skipped.map((s) => [s.operationRowId, s.reason]));
  const skip = (item: RestoreItem, reason: string) => skipped.set(item.operationRowId, reason);

  // 1. Link each transfer again, both sides in one statement, only where both are still unlinked.
  const byGroup = new Map<string, RestoreItem[]>();
  for (const item of plan.restore) {
    if (item.groupKey && 'transfer_group_id' in item.values) {
      byGroup.set(item.groupKey, [...(byGroup.get(item.groupKey) ?? []), item]);
    }
  }
  const pairFailed = new Set<string>();
  for (const [groupKey, items] of byGroup) {
    const kinds = new Map<string, RestoreItem[]>();
    for (const item of items) {
      const key = JSON.stringify(pick(item.values, TRANSFER_FIELDS, true));
      kinds.set(key, [...(kinds.get(key) ?? []), item]);
    }
    const relinked: string[] = [];
    let ok = true;
    for (const group of kinds.values()) {
      const values = pick(group[0].values, TRANSFER_FIELDS, true);
      const { data, error } = await db
        .from('financial_transactions')
        .update(values)
        .eq('user_id', userId)
        .in('id', group.map((item) => item.entityId))
        .is('transfer_group_id', null)
        .select('id');
      const ids = ((data ?? []) as { id: string }[]).map((row) => row.id);
      relinked.push(...ids);
      if (error || ids.length < group.length) {
        ok = false;
        break;
      }
    }
    if (!ok) {
      // Never half a transfer: take the sides that did link back out again.
      if (relinked.length > 0) {
        await db
          .from('financial_transactions')
          .update(loaded.cols.kind ? { transfer_group_id: null, transfer_kind: null } : { transfer_group_id: null })
          .eq('user_id', userId)
          .eq('transfer_group_id', groupKey)
          .in('id', relinked);
      }
      pairFailed.add(groupKey);
      for (const item of items) skip(item, 'pair_changed');
    }
  }

  // 2. The other fields, one guarded update per distinct (values, guard).
  const byValues = new Map<string, { values: FieldValues; guard: FieldValues; notInTransfer: boolean; items: RestoreItem[] }>();
  for (const item of plan.restore) {
    if (item.groupKey && pairFailed.has(item.groupKey)) continue;
    const values = pick(item.values, TRANSFER_FIELDS, false);
    if (Object.keys(values).length === 0) {
      restored.add(item.operationRowId);
      continue;
    }
    const guard = pick(item.guard, TRANSFER_FIELDS, false);
    // The type goes back only on a row that is not one side of a transfer now
    // (a row this undo just linked back is: its type belongs to that pair).
    const notInTransfer = 'type' in values && !item.groupKey && loaded.cols.group;
    const key = JSON.stringify([values, guard, notInTransfer]);
    const group = byValues.get(key) ?? { values, guard, notInTransfer, items: [] };
    group.items.push(item);
    byValues.set(key, group);
  }
  for (const { values, guard, notInTransfer, items } of byValues.values()) {
    for (const chunk of chunks(items, ID_CHUNK)) {
      let query = db
        .from('financial_transactions')
        .update(values)
        .eq('user_id', userId)
        .in('id', chunk.map((item) => item.entityId));
      if (notInTransfer) query = query.is('transfer_group_id', null);
      const { data, error } = await applyGuard(query, guard).select('id');
      const written = new Set(((data ?? []) as { id: string }[]).map((row) => row.id));
      for (const item of chunk) {
        if (error) skip(item, 'failed');
        else if (written.has(item.entityId)) restored.add(item.operationRowId);
        else skip(item, 'changed');
      }
    }
  }

  // 3. Life categories, for the rows put back.
  const lifeAdd = new Map<string, string[]>();
  const lifeRemove = new Map<string, string[]>();
  for (const item of plan.restore) {
    if (!restored.has(item.operationRowId)) continue;
    for (const id of item.lifeAdd) lifeAdd.set(id, [...(lifeAdd.get(id) ?? []), item.entityId]);
    for (const id of item.lifeRemove) lifeRemove.set(id, [...(lifeRemove.get(id) ?? []), item.entityId]);
  }
  for (const [lifeId, ids] of lifeAdd) await addLifeTags(db, userId, lifeId, ids);
  for (const [lifeId, ids] of lifeRemove) await removeLifeTags(db, userId, lifeId, ids);

  // 4. Mark the rows, then the operation once nothing is left.
  const restoredIds = [...restored];
  const skippedIds = [...skipped.keys()].filter((id) => !restored.has(id));
  for (const [state, ids] of [['restored', restoredIds], ['skipped', skippedIds]] as const) {
    for (const chunk of chunks(ids, ID_CHUNK)) {
      await db.from('bulk_edit_operation_rows').update({ state }).eq('user_id', userId).eq('operation_id', operationId).in('id', chunk);
    }
  }
  const { data: left } = await db
    .from('bulk_edit_operation_rows')
    .select('id')
    .eq('operation_id', operationId)
    .eq('user_id', userId)
    .eq('state', 'applied')
    .limit(1);
  const done = ((left ?? []) as unknown[]).length === 0;
  if (done) {
    await db
      .from('bulk_edit_operations')
      .update({ status: 'undone', undone_at: new Date().toISOString() })
      .eq('id', operationId)
      .eq('user_id', userId);
  }

  const reasons = { changed: 0, missing: 0, pair_changed: 0, failed: 0 } as Record<string, number>;
  for (const id of skippedIds) {
    const reason = skipped.get(id) ?? 'changed';
    reasons[reason] = (reasons[reason] ?? 0) + 1;
  }
  return { status: 200, body: { restored: restoredIds.length, skipped: reasons, done } };
}
