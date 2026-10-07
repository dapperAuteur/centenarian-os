// tests/unit/bulk-edit.test.ts
// Bulk edit of transactions and its undo (lib/finance/bulk-edit/): what a
// request may change, that only the caller's own rows and references are
// used, that a transfer is unlinked and linked back as a pair, and that undo
// puts back only rows that still hold what the edit wrote.
// Run: npm run test:unit
//   (node --test --experimental-strip-types tests/unit/*.test.ts)
//
// Every transaction here is made up. No database: FakeDbPlus applies the same
// filters PostgREST would, and moves updated_at on every update of a
// financial_transactions row, like the table's trigger.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KEEP_OPERATIONS,
  UNDO_CHUNK,
  bodyFromSpec,
  describeEdit,
  nextTags,
  parseBulkBody,
  planRowChange,
  planUndo,
  type BulkEditSpec,
  type CurrentRow,
  type OperationRow,
  type TxSnapshot,
} from '../../lib/finance/bulk-edit/logic.ts';
import { applyBulkEdit, latestOperation, undoOperation } from '../../lib/finance/bulk-edit/server.ts';
import { FakeDbPlus } from './fake-supabase-plus.ts';
import type { Row } from './fake-supabase.ts';

const ME = '11111111-1111-4111-8111-111111111111';
const THEM = '22222222-2222-4222-8222-222222222222';
const CHECKING = 'aaaaaaaa-0000-4000-8000-000000000001';
const SAVINGS = 'aaaaaaaa-0000-4000-8000-000000000002';
const DINING = 'cccccccc-0000-4000-8000-000000000001';
const GROCERIES = 'cccccccc-0000-4000-8000-000000000002';
const THEIR_CATEGORY = 'cccccccc-0000-4000-8000-000000000009';
const HEALTH = 'dddddddd-0000-4000-8000-000000000001';
const BRAND = 'eeeeeeee-0000-4000-8000-000000000001';

function spec(overrides: Partial<BulkEditSpec> = {}): BulkEditSpec {
  return { tags_add: [], tags_remove: [], unlink_transfers: false, remember: false, remember_skip: [], ...overrides };
}

function snapshot(overrides: Partial<TxSnapshot> = {}): TxSnapshot {
  return {
    id: 'tx-1',
    category_id: null,
    brand_id: null,
    vendor: 'CHIPOTLE #12',
    type: 'expense',
    tags: null,
    transfer_group_id: null,
    transfer_kind: null,
    ...overrides,
  };
}

/** A database with the caller's categories, a brand, a life category, and someone else's category. */
function freshDb(): FakeDbPlus {
  const db = new FakeDbPlus();
  db.seed('budget_categories', [
    { id: DINING, user_id: ME, name: 'Dining' },
    { id: GROCERIES, user_id: ME, name: 'Groceries' },
    { id: THEIR_CATEGORY, user_id: THEM, name: 'Theirs' },
  ]);
  db.seed('user_brands', [{ id: BRAND, user_id: ME, name: 'Side gig' }]);
  db.seed('life_categories', [{ id: HEALTH, user_id: ME, name: 'Health' }]);
  return db;
}

function tx(db: FakeDbPlus, overrides: Row = {}): Row {
  return db.seed('financial_transactions', [{
    user_id: ME,
    amount: 12.4,
    type: 'expense',
    vendor: 'CHIPOTLE #12',
    description: 'POS CHIPOTLE',
    category_id: null,
    brand_id: null,
    tags: null,
    account_id: CHECKING,
    transaction_date: '2026-03-14',
    transfer_group_id: null,
    transfer_kind: null,
    ...overrides,
  }])[0];
}

const ids = (rows: Row[]) => rows.map((row) => String(row.id));
const get = (db: FakeDbPlus, id: unknown) => db.rows('financial_transactions').find((row) => row.id === id)!;

async function undoAll(db: FakeDbPlus, operationId: unknown) {
  const totals = { restored: 0, skipped: { changed: 0, missing: 0, pair_changed: 0, failed: 0 } as Record<string, number> };
  for (let i = 0; i < 20; i++) {
    const result = await undoOperation(db, ME, operationId);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    totals.restored += result.body.restored as number;
    for (const [reason, n] of Object.entries(result.body.skipped as Record<string, number>)) totals.skipped[reason] += n;
    if (result.body.done) return totals;
  }
  throw new Error('undo never finished');
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

test('parseBulkBody keeps the original body working', () => {
  const parsed = parseBulkBody({ ids: ['a', 'a', 'b'], updates: { category_id: DINING, brand_id: '' }, life_category_id: HEALTH });
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.ids, ['a', 'b']);
  assert.equal(parsed.spec.category_id, DINING);
  assert.equal(parsed.spec.brand_id, null);
  assert.equal(parsed.spec.life_add, HEALTH);
  assert.equal(parsed.operation, null);
});

test('parseBulkBody refuses what it cannot apply', () => {
  const cases: [unknown, RegExp][] = [
    [{}, /ids array required/],
    [{ ids: [] }, /ids array required/],
    [{ ids: [1] }, /ids array required/],
    [{ ids: Array.from({ length: 201 }, (_, i) => `id-${i}`), updates: { category_id: DINING } }, /Maximum 200/],
    [{ ids: ['a'] }, /Nothing to change/],
    [{ ids: ['a'], updates: { type: 'transfer' } }, /expense or income/],
    [{ ids: ['a'], updates: { vendor: 'x'.repeat(201) } }, /longer than 200/],
    [{ ids: ['a'], life_category_id: HEALTH, remove_life_category_id: HEALTH }, /added and removed/],
    [{ ids: ['a'], tags_add: [1] }, /Tags/],
    [{ ids: ['a'], transfer: 'link' }, /unlink/],
  ];
  for (const [body, message] of cases) {
    const parsed = parseBulkBody(body);
    assert.ok(!parsed.ok, JSON.stringify(body).slice(0, 80));
    assert.match(parsed.error, message);
  }
});

test('parseBulkBody reads tags, vendor, type, unlink, remember and the operation', () => {
  const parsed = parseBulkBody({
    ids: ['a'],
    updates: { vendor: '  Chipotle   Mexican Grill ', type: 'income' },
    tags_add: 'lunch, Work ,lunch',
    tags_remove: ['WORK', 'old'],
    transfer: 'unlink',
    remember: true,
    remember_skip: ['expense:chipotle', 7],
    operation: { id: 'op-1', summary: '  Category → Dining  ' },
  });
  assert.ok(parsed.ok);
  assert.equal(parsed.spec.vendor, 'Chipotle Mexican Grill');
  assert.equal(parsed.spec.type, 'income');
  assert.deepEqual(parsed.spec.tags_add, ['lunch', 'Work']);
  // A tag both added and removed is added.
  assert.deepEqual(parsed.spec.tags_remove, ['old']);
  assert.equal(parsed.spec.unlink_transfers, true);
  assert.equal(parsed.spec.remember, true);
  assert.deepEqual(parsed.spec.remember_skip, ['expense:chipotle']);
  assert.deepEqual(parsed.operation, { id: 'op-1', summary: 'Category → Dining' });
});

// ─── One row ──────────────────────────────────────────────────────────────────

test('nextTags adds and removes in any case and keeps null when nothing is added', () => {
  assert.deepEqual(nextTags(['Lunch', 'work'], ['lunch', 'team'], ['WORK']), ['Lunch', 'team']);
  assert.equal(nextTags(null, [], ['x']), null);
  assert.deepEqual(nextTags(['x'], [], ['X']), []);
});

test('planRowChange writes only fields that change, and never the type of a transfer side', () => {
  const plain = planRowChange(snapshot({ category_id: DINING }), spec({ category_id: DINING, vendor: 'Chipotle', type: 'income' }));
  assert.deepEqual(plain.values, { vendor: 'Chipotle', type: 'income' });
  assert.deepEqual(plain.old, { vendor: 'CHIPOTLE #12', type: 'expense' });
  assert.equal(plain.typeSkipped, false);

  const transfer = planRowChange(snapshot({ transfer_group_id: 'g1' }), spec({ type: 'income', category_id: GROCERIES }));
  assert.deepEqual(transfer.values, { category_id: GROCERIES });
  assert.equal(transfer.typeSkipped, true);

  const tags = planRowChange(snapshot({ tags: ['Lunch'] }), spec({ tags_add: ['lunch'] }));
  assert.deepEqual(tags.values, {});
});

test('bodyFromSpec is what parseBulkBody reads back', () => {
  const original = spec({
    category_id: null,
    brand_id: BRAND,
    vendor: 'Chipotle',
    type: 'income',
    life_add: HEALTH,
    tags_add: ['lunch'],
    tags_remove: ['old'],
    unlink_transfers: true,
    remember: true,
  });
  const parsed = parseBulkBody({ ids: ['a'], ...bodyFromSpec(original) });
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.spec, original);
});

test('describeEdit names each change', () => {
  assert.equal(
    describeEdit(spec({ category_id: DINING, vendor: 'Chipotle', tags_add: ['lunch'], unlink_transfers: true }), { category: 'Dining' }),
    'Category → Dining; Vendor → Chipotle; Tags + lunch; Transfers unlinked',
  );
});

// ─── Ownership ────────────────────────────────────────────────────────────────

test('a batch writes only the caller’s own rows; other ids are counted as not found', async () => {
  const db = freshDb();
  const mine = tx(db);
  const theirs = tx(db, { user_id: THEM, category_id: null });
  const result = await applyBulkEdit(db, ME, { ids: [mine.id, theirs.id, 'not-a-uuid'], updates: { category_id: DINING } });
  assert.equal(result.status, 200);
  assert.equal(result.body.not_found, 2);
  assert.equal(result.body.changed, 1);
  assert.equal(get(db, mine.id).category_id, DINING);
  assert.equal(get(db, theirs.id).category_id, null);
});

test('someone else’s category, brand or life category refuses the whole batch before any write', async () => {
  for (const body of [
    { updates: { category_id: THEIR_CATEGORY } },
    { updates: { brand_id: THEIR_CATEGORY } },
    { life_category_id: THEIR_CATEGORY },
    { remove_life_category_id: 'not-a-uuid' },
  ]) {
    const db = freshDb();
    const mine = tx(db);
    const before = db.writes().length;
    const result = await applyBulkEdit(db, ME, { ids: [mine.id], ...body, operation: {} });
    assert.equal(result.status, 400, JSON.stringify(body));
    assert.match(String(result.body.error), /Invalid reference/);
    assert.equal(db.writes().length, before);
  }
});

test('an operation id that is not the caller’s refuses the batch before any write', async () => {
  const db = freshDb();
  const mine = tx(db);
  const [op] = db.seed('bulk_edit_operations', [{ user_id: THEM, status: 'applied', row_count: 0 }]);
  const result = await applyBulkEdit(db, ME, { ids: [mine.id], updates: { category_id: DINING }, operation: { id: op.id } });
  assert.equal(result.status, 409);
  assert.equal(get(db, mine.id).category_id, null);
});

// ─── Transfers ────────────────────────────────────────────────────────────────

function transferPair(db: FakeDbPlus, group = 'group-1') {
  const out = tx(db, { vendor: null, description: 'Online transfer to savings', transfer_group_id: group, transfer_kind: 'transfer' });
  const into = tx(db, { vendor: null, description: 'Online transfer from checking', type: 'income', account_id: SAVINGS, transfer_group_id: group, transfer_kind: 'transfer' });
  return { out, into };
}

test('the type is not changed on one side of a transfer', async () => {
  const db = freshDb();
  const { out, into } = transferPair(db);
  const plain = tx(db);
  const result = await applyBulkEdit(db, ME, { ids: [out.id, plain.id], updates: { type: 'income' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.type_skipped, 1);
  assert.equal(get(db, out.id).type, 'expense');
  assert.equal(get(db, out.id).transfer_group_id, 'group-1');
  assert.equal(get(db, into.id).type, 'income');
  assert.equal(get(db, plain.id).type, 'income');
});

test('unlinking one selected side unlinks the whole transfer, and undo links both back', async () => {
  const db = freshDb();
  const { out, into } = transferPair(db);
  const result = await applyBulkEdit(db, ME, { ids: [out.id], transfer: 'unlink', operation: { summary: 'Transfers unlinked' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.unlinked, 2);
  for (const row of [out, into]) {
    assert.equal(get(db, row.id).transfer_group_id, null);
    assert.equal(get(db, row.id).transfer_kind, null);
  }
  const recorded = db.rows('bulk_edit_operation_rows');
  assert.equal(recorded.length, 2);
  assert.ok(recorded.every((row) => row.group_key === 'group-1'));

  const undo = await undoAll(db, result.body.operation_id);
  assert.equal(undo.restored, 2);
  for (const row of [out, into]) {
    assert.equal(get(db, row.id).transfer_group_id, 'group-1');
    assert.equal(get(db, row.id).transfer_kind, 'transfer');
  }
});

test('undo links neither side when one side changed since', async () => {
  const db = freshDb();
  const { out, into } = transferPair(db);
  const result = await applyBulkEdit(db, ME, { ids: [out.id, into.id], transfer: 'unlink', operation: {} });
  // The income side was linked to another transfer afterwards.
  get(db, into.id).transfer_group_id = 'group-2';
  const undo = await undoAll(db, result.body.operation_id);
  assert.equal(undo.restored, 0);
  assert.equal(undo.skipped.changed, 1);
  assert.equal(undo.skipped.pair_changed, 1);
  assert.equal(get(db, out.id).transfer_group_id, null);
  assert.equal(get(db, into.id).transfer_group_id, 'group-2');
});

test('undo links neither side when one side was deleted since', async () => {
  const db = freshDb();
  const { out, into } = transferPair(db);
  const result = await applyBulkEdit(db, ME, { ids: [out.id], transfer: 'unlink', operation: {} });
  db.tables.financial_transactions = db.rows('financial_transactions').filter((row) => row.id !== into.id);
  const undo = await undoAll(db, result.body.operation_id);
  assert.equal(undo.restored, 0);
  assert.equal(undo.skipped.missing, 1);
  assert.equal(undo.skipped.pair_changed, 1);
  assert.equal(get(db, out.id).transfer_group_id, null);
});

test('unlink and change type in one edit: the freed side gets the type, the other side keeps its own', async () => {
  const db = freshDb();
  const { out, into } = transferPair(db);
  const result = await applyBulkEdit(db, ME, { ids: [out.id], transfer: 'unlink', updates: { type: 'income' }, operation: {} });
  assert.equal(result.body.type_skipped, 0);
  assert.equal(get(db, out.id).type, 'income');
  assert.equal(get(db, into.id).type, 'income');
  assert.equal(get(db, into.id).transfer_group_id, null);
  const undo = await undoAll(db, result.body.operation_id);
  assert.equal(undo.restored, 2);
  assert.equal(get(db, out.id).type, 'expense');
  assert.equal(get(db, out.id).transfer_group_id, 'group-1');
  assert.equal(get(db, into.id).transfer_group_id, 'group-1');
});

// ─── Undo ─────────────────────────────────────────────────────────────────────

test('undo puts back category, vendor, brand and tags, comparing values, not updated_at', async () => {
  const db = freshDb();
  const a = tx(db, { category_id: GROCERIES, tags: ['old'] });
  const b = tx(db, { vendor: 'Chipotle' });
  const c = tx(db, { brand_id: BRAND });
  const result = await applyBulkEdit(db, ME, {
    ids: ids([a, b, c]),
    updates: { category_id: DINING, vendor: 'Chipotle Mexican Grill', brand_id: '' },
    tags_add: ['lunch'],
    tags_remove: ['old'],
    operation: { summary: 'test' },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.undo_recorded, true);
  assert.deepEqual(get(db, a.id).tags, ['lunch']);

  // a: saved again with the same values (updated_at moves, values don't) -> still put back.
  db.tick(60_000);
  await db.from('financial_transactions').update({ category_id: DINING }).eq('id', a.id);
  assert.notEqual(get(db, a.id).updated_at, get(db, a.id).created_at);
  // b: its category was changed by hand since -> left alone.
  await db.from('financial_transactions').update({ category_id: GROCERIES }).eq('id', b.id);

  const undo = await undoAll(db, result.body.operation_id);
  assert.equal(undo.restored, 2);
  assert.equal(undo.skipped.changed, 1);
  assert.equal(get(db, a.id).category_id, GROCERIES);
  assert.deepEqual(get(db, a.id).tags, ['old']);
  assert.equal(get(db, a.id).vendor, 'CHIPOTLE #12');
  assert.equal(get(db, c.id).brand_id, BRAND);
  assert.equal(get(db, b.id).category_id, GROCERIES);
  assert.equal(get(db, b.id).vendor, 'Chipotle Mexican Grill');

  const latest = await latestOperation(db, ME);
  assert.equal(latest.body.operation, null);
  const again = await undoOperation(db, ME, result.body.operation_id);
  assert.equal(again.status, 409);
});

test('undo leaves the type alone on a row linked into a transfer since the edit', async () => {
  const db = freshDb();
  const row = tx(db);
  const result = await applyBulkEdit(db, ME, { ids: [row.id], updates: { type: 'income' }, operation: {} });
  assert.equal(get(db, row.id).type, 'income');
  // Linked as the income side of a transfer afterwards: going back to expense would break the pair.
  get(db, row.id).transfer_group_id = 'group-9';
  const undo = await undoAll(db, result.body.operation_id);
  assert.equal(undo.restored, 0);
  assert.equal(undo.skipped.changed, 1);
  assert.equal(get(db, row.id).type, 'income');
});

test('undo is refused for someone else’s operation', async () => {
  const db = freshDb();
  const mine = tx(db);
  const result = await applyBulkEdit(db, ME, { ids: [mine.id], updates: { category_id: DINING }, operation: {} });
  const theirs = await undoOperation(db, THEM, result.body.operation_id);
  assert.equal(theirs.status, 404);
  assert.equal(get(db, mine.id).category_id, DINING);
});

test('life categories are added and removed, and undo reverses both', async () => {
  const db = freshDb();
  const tagged = tx(db);
  const untagged = tx(db);
  db.seed('entity_life_categories', [{ user_id: ME, life_category_id: HEALTH, entity_type: 'transaction', entity_id: tagged.id }]);

  const add = await applyBulkEdit(db, ME, { ids: ids([tagged, untagged]), life_category_id: HEALTH, operation: {} });
  assert.equal(add.body.life_added, 1);
  assert.equal(db.rows('entity_life_categories').length, 2);
  await undoAll(db, add.body.operation_id);
  assert.deepEqual(db.rows('entity_life_categories').map((r) => r.entity_id), [tagged.id]);

  const remove = await applyBulkEdit(db, ME, { ids: ids([tagged, untagged]), remove_life_category_id: HEALTH, operation: {} });
  assert.equal(remove.body.life_removed, 1);
  assert.equal(db.rows('entity_life_categories').length, 0);
  await undoAll(db, remove.body.operation_id);
  assert.deepEqual(db.rows('entity_life_categories').map((r) => r.entity_id), [tagged.id]);
});

test('one operation across batches is undone in chunks, every row once', async () => {
  const db = freshDb();
  const rows = Array.from({ length: UNDO_CHUNK + 50 }, () => tx(db));
  let operationId: unknown;
  for (let i = 0; i < rows.length; i += 200) {
    const result = await applyBulkEdit(db, ME, {
      ids: ids(rows.slice(i, i + 200)),
      updates: { category_id: DINING },
      operation: operationId ? { id: operationId } : { summary: 'Category → Dining' },
    });
    assert.equal(result.status, 200);
    operationId = result.body.operation_id;
  }
  assert.equal(db.rows('bulk_edit_operations').length, 1);
  assert.equal(db.rows('bulk_edit_operations')[0].row_count, rows.length);

  const first = await undoOperation(db, ME, operationId);
  assert.equal(first.body.restored, UNDO_CHUNK);
  assert.equal(first.body.done, false);
  const second = await undoOperation(db, ME, operationId);
  assert.equal(second.body.restored, 50);
  assert.equal(second.body.done, true);
  assert.ok(rows.every((row) => get(db, row.id).category_id === null));
  assert.equal(db.rows('bulk_edit_operations')[0].status, 'undone');
});

test(`only the ${KEEP_OPERATIONS} most recent operations are kept`, async () => {
  const db = freshDb();
  const row = tx(db);
  for (let i = 0; i < KEEP_OPERATIONS + 2; i++) {
    db.tick(1000);
    await applyBulkEdit(db, ME, { ids: [row.id], updates: { category_id: i % 2 ? DINING : GROCERIES }, operation: {} });
  }
  assert.equal(db.rows('bulk_edit_operations').length, KEEP_OPERATIONS);
});

test('before migration 220 the edit still applies and says undo is not available', async () => {
  const db = freshDb();
  db.missingTables = ['bulk_edit_operations', 'bulk_edit_operation_rows'];
  const row = tx(db);
  const result = await applyBulkEdit(db, ME, { ids: [row.id], updates: { category_id: DINING }, operation: {} });
  assert.equal(result.status, 200);
  assert.equal(result.body.code, 'bulk_edit_not_migrated');
  assert.match(String(result.body.notice), /Run migration 220 first/);
  assert.equal(get(db, row.id).category_id, DINING);

  const latest = await latestOperation(db, ME);
  assert.equal(latest.body.available, false);
  assert.match(String(latest.body.message), /Run migration 220 first/);
  const undo = await undoOperation(db, ME, '33333333-3333-4333-8333-333333333333');
  assert.equal(undo.status, 503);
});

test('planUndo: a row comes back only when every field still holds the new value', () => {
  const row: OperationRow = {
    id: 'op-row-1',
    entity_id: 'tx-1',
    group_key: null,
    old_values: { category_id: null, tags: ['a'], 'life:L1': false },
    new_values: { category_id: DINING, tags: ['a', 'b'], 'life:L1': true },
  };
  const now = (values: Record<string, unknown>, life: string[]): Map<string, CurrentRow> =>
    new Map([['tx-1', { values, lifeCategoryIds: new Set(life) }]]);

  const ok = planUndo([row], now({ category_id: DINING, tags: ['B', 'a'] }, ['L1']));
  assert.equal(ok.restore.length, 1);
  assert.deepEqual(ok.restore[0].values, { category_id: null, tags: ['a'] });
  assert.deepEqual(ok.restore[0].guard, { category_id: DINING, tags: ['a', 'b'] });
  assert.deepEqual(ok.restore[0].lifeRemove, ['L1']);

  assert.equal(planUndo([row], now({ category_id: DINING, tags: ['a'] }, ['L1'])).skipped[0].reason, 'changed');
  assert.equal(planUndo([row], now({ category_id: DINING, tags: ['a', 'b'] }, [])).skipped[0].reason, 'changed');
  assert.equal(planUndo([row], new Map()).skipped[0].reason, 'missing');
});

// ─── Remember for future imports ──────────────────────────────────────────────

test('remember saves a learned category for the old vendor name and the new one, once per edit', async () => {
  const db = freshDb();
  const a = tx(db, { vendor: 'SQ *BLUE BOTTLE 0042' });
  const b = tx(db, { vendor: 'Blue Bottle' });
  const c = tx(db, { vendor: null });
  const result = await applyBulkEdit(db, ME, {
    ids: ids([a, b, c]),
    updates: { category_id: DINING, vendor: 'Blue Bottle Coffee' },
    remember: true,
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.remembered, ['expense:bluebottle', 'expense:bluebottlecoffee']);
  const contacts = db.rows('user_contacts');
  assert.equal(contacts.length, 2);
  assert.ok(contacts.every((contact) => contact.default_category_id === DINING && contact.contact_type === 'vendor'));

  // A later batch of the same edit skips what an earlier batch remembered.
  const later = await applyBulkEdit(db, ME, {
    ids: ids([a]),
    updates: { category_id: DINING },
    remember: true,
    remember_skip: ['expense:bluebottle', 'expense:bluebottlecoffee'],
  });
  assert.deepEqual(later.body.remembered, []);
});
