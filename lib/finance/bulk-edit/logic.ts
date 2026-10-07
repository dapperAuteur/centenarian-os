// lib/finance/bulk-edit/logic.ts
// The rules of a bulk edit on transactions, and of undoing one, as pure
// functions: what a request may change, what each row becomes, and which rows
// an undo may put back.
//
// A bulk edit can set the category, the brand, the vendor name and the type;
// add or remove a life category; add or remove tags; and unlink transfers.
// Rules that protect the books:
//   - The type never changes on one side of a transfer: that row is skipped
//     (the other side would stop matching). Unlinking in the same edit frees it.
//   - Unlinking takes a whole transfer apart, both sides, even when only one
//     side was selected. Undo links both sides again or neither.
//   - Undo puts a row back only when every field the edit changed still holds
//     the value the edit wrote. Stored values are compared, never updated_at
//     (financial_transactions has a trigger that moves it on every update).
//
// No '@/' imports: runs in API routes, client components and under node --test
// (tests/unit/bulk-edit.test.ts).

/** POST /api/finance/transactions/bulk takes at most this many ids per request. */
export const BULK_BATCH_SIZE = 200;
/** How many bulk edits are kept for undo, per person. Older ones are deleted. */
export const KEEP_OPERATIONS = 10;
/** Rows an undo request puts back at most; the client repeats until done. */
export const UNDO_CHUNK = 400;
/** "Remember for future imports" saves at most this many vendors per request. */
export const MAX_REMEMBER = 25;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;
export const MAX_VENDOR_LENGTH = 200;
export const MAX_SUMMARY_LENGTH = 300;

export type TxType = 'expense' | 'income';

/** What one bulk edit changes. `undefined` leaves a field alone; null clears it. */
export interface BulkEditSpec {
  category_id?: string | null;
  brand_id?: string | null;
  vendor?: string | null;
  type?: TxType;
  life_add?: string;
  life_remove?: string;
  tags_add: string[];
  tags_remove: string[];
  unlink_transfers: boolean;
  remember: boolean;
  /** "type:vendorkey" pairs an earlier batch of the same edit already remembered. */
  remember_skip: string[];
}

export interface OperationRequest {
  /** Continue an operation an earlier batch started. */
  id?: string;
  summary?: string;
}

export type ParsedBulkBody =
  | { ok: true; ids: string[]; spec: BulkEditSpec; operation: OperationRequest | null }
  | { ok: false; error: string };

/** One tag as stored: trimmed, inner spaces collapsed, at most MAX_TAG_LENGTH. */
export function cleanTag(tag: string): string {
  return tag.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
}

/** A list of tags from an array or a comma-separated string; blanks and repeats (any case) dropped. */
export function parseTags(input: unknown): string[] | null {
  if (input === undefined || input === null) return [];
  const list = typeof input === 'string' ? input.split(',') : Array.isArray(input) ? input : null;
  if (!list || !list.every((tag) => typeof tag === 'string')) return null;
  const out: string[] = [];
  for (const raw of list as string[]) {
    const tag = cleanTag(raw);
    if (tag && !out.some((t) => t.toLowerCase() === tag.toLowerCase())) out.push(tag);
  }
  return out.length > MAX_TAGS ? null : out;
}

/**
 * The tags a row ends up with: the ones it had, minus `remove` (any case), plus
 * `add` it doesn't have yet (any case). A row with no tags that gains none
 * keeps null.
 */
export function nextTags(before: readonly string[] | null | undefined, add: readonly string[], remove: readonly string[]): string[] | null {
  const removing = new Set(remove.map((tag) => tag.toLowerCase()));
  const kept = (before ?? []).filter((tag) => !removing.has(tag.toLowerCase()));
  for (const tag of add) {
    if (!kept.some((t) => t.toLowerCase() === tag.toLowerCase())) kept.push(tag);
  }
  if (kept.length === 0 && (before === null || before === undefined)) return null;
  return kept;
}

const isString = (value: unknown): value is string => typeof value === 'string';

/**
 * Reads a bulk-edit request. Kept compatible with the original body
 * ({ ids, updates: { category_id, brand_id }, life_category_id }), where an
 * empty id clears the field.
 */
export function parseBulkBody(input: unknown): ParsedBulkBody {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'ids array required' };
  const body = input as Record<string, unknown>;
  const { ids } = body;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(isString)) return { ok: false, error: 'ids array required' };
  if (ids.length > BULK_BATCH_SIZE) return { ok: false, error: `Maximum ${BULK_BATCH_SIZE} IDs per bulk operation` };

  const updates = body.updates && typeof body.updates === 'object' && !Array.isArray(body.updates)
    ? (body.updates as Record<string, unknown>)
    : {};
  const spec: BulkEditSpec = { tags_add: [], tags_remove: [], unlink_transfers: false, remember: false, remember_skip: [] };

  for (const field of ['category_id', 'brand_id'] as const) {
    const value = updates[field];
    if (value === undefined) continue;
    if (value !== null && !isString(value)) return { ok: false, error: `${field} is not valid` };
    spec[field] = value || null;
  }

  if (updates.vendor !== undefined) {
    if (updates.vendor !== null && !isString(updates.vendor)) return { ok: false, error: 'vendor is not valid' };
    const vendor = (updates.vendor ?? '').trim().replace(/\s+/g, ' ');
    if (vendor.length > MAX_VENDOR_LENGTH) return { ok: false, error: `The vendor name is longer than ${MAX_VENDOR_LENGTH} characters` };
    spec.vendor = vendor || null;
  }

  if (updates.type !== undefined) {
    if (updates.type !== 'expense' && updates.type !== 'income') return { ok: false, error: 'type must be expense or income' };
    spec.type = updates.type;
  }

  for (const [field, key] of [['life_category_id', 'life_add'], ['remove_life_category_id', 'life_remove']] as const) {
    const value = body[field];
    if (value === undefined || value === null || value === '') continue;
    if (!isString(value)) return { ok: false, error: `${field} is not valid` };
    spec[key] = value;
  }
  if (spec.life_add && spec.life_add === spec.life_remove) {
    return { ok: false, error: 'The same life category cannot be added and removed' };
  }

  const tagsAdd = parseTags(body.tags_add);
  const tagsRemove = parseTags(body.tags_remove);
  if (!tagsAdd || !tagsRemove) return { ok: false, error: `Tags must be a list of at most ${MAX_TAGS}` };
  spec.tags_add = tagsAdd;
  spec.tags_remove = tagsRemove.filter((tag) => !tagsAdd.some((t) => t.toLowerCase() === tag.toLowerCase()));

  if (body.transfer !== undefined && body.transfer !== null) {
    if (body.transfer !== 'unlink') return { ok: false, error: "transfer must be 'unlink'" };
    spec.unlink_transfers = true;
  }

  spec.remember = body.remember === true;
  if (Array.isArray(body.remember_skip)) spec.remember_skip = body.remember_skip.filter(isString).slice(0, 500);

  const changes =
    spec.category_id !== undefined || spec.brand_id !== undefined || spec.vendor !== undefined ||
    spec.type !== undefined || spec.life_add || spec.life_remove ||
    spec.tags_add.length > 0 || spec.tags_remove.length > 0 || spec.unlink_transfers;
  if (!changes) return { ok: false, error: 'Nothing to change: choose at least one field' };

  let operation: OperationRequest | null = null;
  if (body.operation && typeof body.operation === 'object' && !Array.isArray(body.operation)) {
    const op = body.operation as Record<string, unknown>;
    operation = {};
    if (isString(op.id) && op.id) operation.id = op.id;
    if (isString(op.summary)) operation.summary = op.summary.trim().slice(0, MAX_SUMMARY_LENGTH);
  }

  return { ok: true, ids: [...new Set(ids)], spec, operation };
}

// ─── One row ──────────────────────────────────────────────────────────────────

/** The fields of a transaction a bulk edit reads and may write. */
export interface TxSnapshot {
  id: string;
  category_id: string | null;
  brand_id: string | null;
  vendor: string | null;
  type: TxType;
  tags: string[] | null;
  /** Absent before migration 202. */
  transfer_group_id?: string | null;
  /** Absent before migration 203. */
  transfer_kind?: string | null;
}

export type FieldValues = Record<string, unknown>;

export interface RowChange {
  /** Fields to write on this row (only the ones that actually change). */
  values: FieldValues;
  /** What those fields held before. */
  old: FieldValues;
  /** True when the type was asked for but the row is one side of a transfer. */
  typeSkipped: boolean;
}

/**
 * What one row becomes. Only fields whose value changes are written and
 * recorded, so an undo later checks nothing the edit didn't touch. Call it
 * after unlinking, with the row's transfer_group_id as it is then.
 */
export function planRowChange(row: TxSnapshot, spec: BulkEditSpec): RowChange {
  const values: FieldValues = {};
  const old: FieldValues = {};
  const set = (field: keyof TxSnapshot, value: unknown) => {
    if (sameValue(field, row[field], value)) return;
    values[field] = value;
    old[field] = row[field] ?? null;
  };
  if (spec.category_id !== undefined) set('category_id', spec.category_id);
  if (spec.brand_id !== undefined) set('brand_id', spec.brand_id);
  if (spec.vendor !== undefined) set('vendor', spec.vendor);
  let typeSkipped = false;
  if (spec.type !== undefined && spec.type !== row.type) {
    if (row.transfer_group_id) typeSkipped = true;
    else set('type', spec.type);
  }
  if (spec.tags_add.length > 0 || spec.tags_remove.length > 0) {
    set('tags', nextTags(row.tags, spec.tags_add, spec.tags_remove));
  }
  return { values, old, typeSkipped };
}

function tagKey(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return [...value].map((tag) => String(tag).toLowerCase()).sort().join('\u0000');
}

/**
 * Whether a field holds the same value. null and undefined are the same; tags
 * compare as sets (any order, any case, null = none).
 */
export function sameValue(field: string, a: unknown, b: unknown): boolean {
  if (field === 'tags') return tagKey(a) === tagKey(b);
  return (a ?? null) === (b ?? null);
}

// ─── Undo ─────────────────────────────────────────────────────────────────────

/** One row of an operation, as stored in bulk_edit_operation_rows. */
export interface OperationRow {
  id: string;
  entity_id: string;
  /** The transfer the row was taken out of, when the edit unlinked it. */
  group_key: string | null;
  old_values: FieldValues;
  new_values: FieldValues;
}

/** A row as it is now: its fields, and the life categories it is tagged with. */
export interface CurrentRow {
  values: FieldValues;
  lifeCategoryIds: ReadonlySet<string>;
}

/** Life-category presence is stored as `life:<life_category_id>` -> true / false. */
export const LIFE_PREFIX = 'life:';

export interface RestoreItem {
  operationRowId: string;
  entityId: string;
  /** Fields to write back. */
  values: FieldValues;
  /** The values the edit wrote, which the row must still hold when written back. */
  guard: FieldValues;
  lifeAdd: string[];
  lifeRemove: string[];
  /** The transfer this row is linked back into, when the edit unlinked it. */
  groupKey: string | null;
}

export type SkipReason = 'missing' | 'changed' | 'pair_changed';

export interface UndoPlan {
  restore: RestoreItem[];
  skipped: { operationRowId: string; entityId: string; reason: SkipReason }[];
}

/** Whether a row still holds everything the edit wrote. */
export function unchangedSince(row: OperationRow, current: CurrentRow): boolean {
  for (const [field, value] of Object.entries(row.new_values ?? {})) {
    if (field.startsWith(LIFE_PREFIX)) {
      if (current.lifeCategoryIds.has(field.slice(LIFE_PREFIX.length)) !== Boolean(value)) return false;
    } else if (!sameValue(field, current.values[field], value)) {
      return false;
    }
  }
  return true;
}

/**
 * Which rows of an operation can be put back. A row is put back when it still
 * exists and holds every value the edit wrote. A row the edit took out of a
 * transfer is put back only together with every other row of that transfer,
 * so a transfer is never left half linked.
 */
export function planUndo(rows: readonly OperationRow[], current: ReadonlyMap<string, CurrentRow>): UndoPlan {
  const verdict = new Map<string, 'ok' | SkipReason>();
  for (const row of rows) {
    const now = current.get(row.entity_id);
    let result: 'ok' | SkipReason = !now ? 'missing' : unchangedSince(row, now) ? 'ok' : 'changed';
    // A row linked into a transfer since the edit keeps its type: changing it
    // would break the pair. (A row this undo links back is not in that case.)
    if (result === 'ok' && 'type' in (row.old_values ?? {}) && !row.group_key && now?.values.transfer_group_id) {
      result = 'changed';
    }
    verdict.set(row.id, result);
  }

  // A transfer comes back whole or not at all.
  const groups = new Map<string, OperationRow[]>();
  for (const row of rows) {
    if (row.group_key) groups.set(row.group_key, [...(groups.get(row.group_key) ?? []), row]);
  }
  for (const members of groups.values()) {
    if (members.some((row) => verdict.get(row.id) !== 'ok')) {
      for (const row of members) if (verdict.get(row.id) === 'ok') verdict.set(row.id, 'pair_changed');
    }
  }

  const plan: UndoPlan = { restore: [], skipped: [] };
  for (const row of rows) {
    const result = verdict.get(row.id)!;
    if (result !== 'ok') {
      plan.skipped.push({ operationRowId: row.id, entityId: row.entity_id, reason: result });
      continue;
    }
    const values: FieldValues = {};
    const guard: FieldValues = {};
    const lifeAdd: string[] = [];
    const lifeRemove: string[] = [];
    for (const [field, value] of Object.entries(row.old_values ?? {})) {
      if (field.startsWith(LIFE_PREFIX)) {
        const lifeId = field.slice(LIFE_PREFIX.length);
        if (value) lifeAdd.push(lifeId);
        else lifeRemove.push(lifeId);
      } else {
        values[field] = value ?? null;
        guard[field] = row.new_values?.[field] ?? null;
      }
    }
    plan.restore.push({ operationRowId: row.id, entityId: row.entity_id, values, guard, lifeAdd, lifeRemove, groupKey: row.group_key });
  }
  return plan;
}

/** The request fields (all but ids, operation and remember_skip) that ask for `spec`. */
export function bodyFromSpec(spec: BulkEditSpec): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  for (const field of ['category_id', 'brand_id', 'vendor', 'type'] as const) {
    if (spec[field] !== undefined) updates[field] = spec[field];
  }
  const body: Record<string, unknown> = {};
  if (Object.keys(updates).length > 0) body.updates = updates;
  if (spec.life_add) body.life_category_id = spec.life_add;
  if (spec.life_remove) body.remove_life_category_id = spec.life_remove;
  if (spec.tags_add.length > 0) body.tags_add = spec.tags_add;
  if (spec.tags_remove.length > 0) body.tags_remove = spec.tags_remove;
  if (spec.unlink_transfers) body.transfer = 'unlink';
  if (spec.remember) body.remember = true;
  return body;
}

// ─── Words for people ────────────────────────────────────────────────────────

/** Names the page knows, for describing an edit. */
export interface EditNames {
  category?: string;
  brand?: string;
  lifeAdd?: string;
  lifeRemove?: string;
}

/** A one-line summary of an edit, stored with it and shown next to Undo. */
export function describeEdit(spec: BulkEditSpec, names: EditNames = {}): string {
  const parts: string[] = [];
  if (spec.category_id !== undefined) parts.push(spec.category_id ? `Category → ${names.category ?? 'a category'}` : 'Category cleared');
  if (spec.vendor !== undefined) parts.push(spec.vendor ? `Vendor → ${spec.vendor}` : 'Vendor cleared');
  if (spec.type) parts.push(`Type → ${spec.type === 'income' ? 'Income' : 'Expense'}`);
  if (spec.brand_id !== undefined) parts.push(spec.brand_id ? `Brand → ${names.brand ?? 'a brand'}` : 'Brand cleared');
  if (spec.life_add) parts.push(`Life category + ${names.lifeAdd ?? 'one'}`);
  if (spec.life_remove) parts.push(`Life category − ${names.lifeRemove ?? 'one'}`);
  if (spec.tags_add.length > 0) parts.push(`Tags + ${spec.tags_add.join(', ')}`);
  if (spec.tags_remove.length > 0) parts.push(`Tags − ${spec.tags_remove.join(', ')}`);
  if (spec.unlink_transfers) parts.push('Transfers unlinked');
  return parts.join('; ').slice(0, MAX_SUMMARY_LENGTH);
}
