// tests/unit/ownership.test.ts
// Run: npm run test:unit
//   (node --test --experimental-strip-types tests/unit/*.test.ts)
//
// The rules that decide which records a signed-in user may reference when a
// route takes an id from the browser (lib/auth/ownership.ts). No database: the
// client is a small fake that applies the same filters PostgREST would.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OwnershipError,
  TABLE_ACCESS_RULES,
  assertOwned,
  canAccessRow,
  checkOwned,
  checkReferences,
  getTableRule,
  invalidReferenceMessage,
  isUuid,
  ownedIds,
  usableReferences,
  withoutFields,
  type AccessRow,
  type OwnershipDb,
  type OwnershipQuery,
  type OwnershipQueryResult,
} from '../../lib/auth/ownership.ts';

const ME = '11111111-1111-4111-8111-111111111111';
const THEM = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-10-04T12:00:00Z');
const PAST = '2026-10-01T00:00:00Z';
const FUTURE = '2026-11-01T00:00:00Z';

/** A distinct, well-formed id per number. */
const id = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;

// ─── A fake client ───────────────────────────────────────────────────────────

interface Call {
  table: string;
  columns: string;
  filters: { op: 'in' | 'eq'; column: string; value: unknown }[];
}

/** Follow "goals.roadmaps.user_id" through embedded objects (or one-element arrays). */
function valueAt(row: AccessRow, path: string): unknown {
  let current: unknown = row;
  for (const key of path.split('.')) {
    if (Array.isArray(current)) current = current[0];
    if (!current || typeof current !== 'object') return undefined;
    current = (current as AccessRow)[key];
  }
  return current;
}

/**
 * { table: rows }. Applies .in() and .eq() like PostgREST (including a filter
 * on an embedded column) unless `ignoreEq` is set, which models a server that
 * silently did not apply the owner filter.
 */
function fakeDb(
  store: Record<string, AccessRow[]>,
  opts: { failTables?: string[]; ignoreEq?: boolean } = {},
) {
  const calls: Call[] = [];
  const db: OwnershipDb = {
    from(table) {
      return {
        select(columns) {
          const call: Call = { table, columns, filters: [] };
          calls.push(call);
          const run = (): OwnershipQueryResult => {
            if (opts.failTables?.includes(table)) return { data: null, error: { message: 'boom' } };
            const rows = (store[table] ?? []).filter((row) =>
              call.filters.every((filter) => {
                if (filter.op === 'in') return (filter.value as string[]).includes(String(valueAt(row, filter.column)));
                return opts.ignoreEq ? true : valueAt(row, filter.column) === filter.value;
              }),
            );
            return { data: rows, error: null };
          };
          const query: OwnershipQuery = {
            in(column, values) {
              call.filters.push({ op: 'in', column, value: [...values] });
              return query;
            },
            eq(column, value) {
              call.filters.push({ op: 'eq', column, value });
              return query;
            },
            then(onfulfilled, onrejected) {
              return Promise.resolve().then(run).then(onfulfilled, onrejected);
            },
          };
          return query;
        },
      };
    },
  };
  return { db, calls };
}

const milestone = (rowId: string, owner: string | null): AccessRow => ({
  id: rowId,
  goals: { roadmaps: owner ? { user_id: owner } : null },
});

// ─── The rule table ──────────────────────────────────────────────────────────

test('every table has a select and an owner rule', () => {
  for (const [table, rule] of Object.entries(TABLE_ACCESS_RULES)) {
    assert.ok(rule.select.length > 0, table);
    assert.equal(typeof rule.ownerId, 'function', table);
  }
});

test('the tables routes check references against are all listed', () => {
  for (const table of [
    'milestones', 'tasks', 'schedule_templates', 'life_categories',
    'financial_accounts', 'financial_transactions', 'budget_categories', 'user_brands',
    'invoices', 'invoice_templates', 'contractor_jobs', 'scan_images',
    'user_contacts', 'contact_locations',
    'vehicles', 'trips', 'trip_routes', 'trip_templates',
    'workout_logs', 'workout_templates', 'workout_categories', 'exercises', 'equipment',
  ]) {
    assert.ok(getTableRule(table), table);
  }
});

test('only tables with a public-read policy have a public rule', () => {
  const withPublicRule = Object.entries(TABLE_ACCESS_RULES)
    .filter(([, rule]) => typeof rule.isPublic === 'function')
    .map(([table]) => table)
    .sort();
  assert.deepEqual(withPublicRule, [
    'blog_posts', 'contractor_jobs', 'equipment', 'exercises', 'media_items', 'recipes',
    'vehicles', 'workout_categories', 'workout_templates',
  ]);
});

test('tables without a user_id are owned through their parent', () => {
  assert.equal(TABLE_ACCESS_RULES.milestones.select, 'goals!inner(roadmaps!inner(user_id))');
  assert.equal(TABLE_ACCESS_RULES.milestones.ownerColumn, 'goals.roadmaps.user_id');
  assert.equal(TABLE_ACCESS_RULES.tasks.select, 'milestones!inner(goals!inner(roadmaps!inner(user_id)))');
  assert.equal(TABLE_ACCESS_RULES.contact_locations.select, 'user_contacts!inner(user_id)');
  assert.equal(TABLE_ACCESS_RULES.contact_locations.ownerColumn, 'user_contacts.user_id');
});

test('unknown tables, prototype keys and non-strings have no rule', () => {
  for (const table of ['profiles', 'auth.users', 'courses', '', 'constructor', '__proto__', 'toString', null, undefined, 7, {}]) {
    assert.equal(getTableRule(table), null);
    assert.equal(canAccessRow(table, { user_id: ME }, ME), false);
  }
});

test('isUuid accepts UUIDs only', () => {
  assert.equal(isUuid(id(1)), true);
  assert.equal(isUuid(id(1).toUpperCase()), true);
  for (const bad of ['', 'abc', `${id(1)}x`, "' or 1=1 --", 'id.eq.1,user_id.neq.0', null, undefined, 7, {}, [id(1)]]) {
    assert.equal(isUuid(bad), false);
  }
});

// ─── canAccessRow ────────────────────────────────────────────────────────────

const OWNER_ONLY_TABLES = [
  'financial_accounts', 'financial_transactions', 'budget_categories', 'user_brands', 'invoices',
  'invoice_templates', 'scan_images', 'user_contacts', 'trips',
  'trip_routes', 'trip_templates', 'workout_logs', 'life_categories', 'schedule_templates',
  'exercise_categories', 'equipment_categories',
];

test('owner-only tables: own row yes, anyone else\'s no, whatever allowPublic says', () => {
  for (const table of OWNER_ONLY_TABLES) {
    assert.equal(canAccessRow(table, { user_id: ME }, ME), true, table);
    assert.equal(canAccessRow(table, { user_id: THEM }, ME), false, table);
    assert.equal(
      canAccessRow(table, { user_id: THEM, visibility: 'public', is_active: true, is_global: true }, ME, { allowPublic: true }),
      false,
      `${table} with allowPublic`,
    );
  }
});

test('a missing row, a row with no owner, and no caller are refused', () => {
  for (const table of OWNER_ONLY_TABLES) {
    assert.equal(canAccessRow(table, null, ME), false, table);
    assert.equal(canAccessRow(table, undefined, ME), false, table);
    assert.equal(canAccessRow(table, {}, ME), false, table);
    assert.equal(canAccessRow(table, { user_id: null }, ME), false, table);
    assert.equal(canAccessRow(table, { user_id: ME }, ''), false, table);
  }
});

test('milestones: owned through goal and roadmap', () => {
  assert.equal(canAccessRow('milestones', milestone(id(1), ME), ME), true);
  assert.equal(canAccessRow('milestones', milestone(id(1), THEM), ME), false);
  assert.equal(canAccessRow('milestones', milestone(id(1), null), ME), false);
  assert.equal(canAccessRow('milestones', { goals: null }, ME), false);
  // array-shaped embeds
  assert.equal(canAccessRow('milestones', { goals: [{ roadmaps: [{ user_id: ME }] }] }, ME), true);
  // a user_id on the milestone itself is not ownership
  assert.equal(canAccessRow('milestones', { user_id: ME }, ME), false);
});

test('tasks: owned through milestone, goal and roadmap', () => {
  const task = (owner: string) => ({ milestones: { goals: { roadmaps: { user_id: owner } } } });
  assert.equal(canAccessRow('tasks', task(ME), ME), true);
  assert.equal(canAccessRow('tasks', task(THEM), ME), false);
  assert.equal(canAccessRow('tasks', { milestones: null }, ME), false);
});

test('contact_locations: owned through the contact', () => {
  assert.equal(canAccessRow('contact_locations', { user_contacts: { user_id: ME } }, ME), true);
  assert.equal(canAccessRow('contact_locations', { user_contacts: { user_id: THEM } }, ME), false);
  assert.equal(canAccessRow('contact_locations', { user_contacts: null }, ME), false);
});

test('public rows are admitted only when the call site allows them', () => {
  const exercise = { user_id: THEM, visibility: 'public', is_active: true };
  assert.equal(canAccessRow('exercises', exercise, ME), false, 'default is owner-only');
  assert.equal(canAccessRow('exercises', exercise, ME, { allowPublic: false }), false);
  assert.equal(canAccessRow('exercises', exercise, ME, { allowPublic: true }), true);
});

test('exercises and equipment: public AND active', () => {
  for (const table of ['exercises', 'equipment', 'media_items']) {
    const allow = { allowPublic: true, now: NOW };
    assert.equal(canAccessRow(table, { user_id: THEM, visibility: 'public', is_active: true }, ME, allow), true, table);
    assert.equal(canAccessRow(table, { user_id: THEM, visibility: 'private', is_active: true }, ME, allow), false, table);
    assert.equal(canAccessRow(table, { user_id: THEM, visibility: 'public', is_active: false }, ME, allow), false, table);
    assert.equal(canAccessRow(table, { user_id: THEM, visibility: 'public' }, ME, allow), false, `${table} (is_active missing)`);
    assert.equal(canAccessRow(table, { user_id: ME, visibility: 'private', is_active: false }, ME, allow), true, `${table} (own)`);
  }
});

test('workout_templates: own, or visibility public', () => {
  const allow = { allowPublic: true };
  assert.equal(canAccessRow('workout_templates', { user_id: ME, visibility: 'private' }, ME), true);
  assert.equal(canAccessRow('workout_templates', { user_id: THEM, visibility: 'public' }, ME, allow), true);
  assert.equal(canAccessRow('workout_templates', { user_id: THEM, visibility: 'private' }, ME, allow), false);
  assert.equal(canAccessRow('workout_templates', { user_id: THEM }, ME, allow), false);
  assert.equal(canAccessRow('workout_templates', { user_id: THEM, visibility: 'public' }, ME), false, 'owner-only by default');
});

test('workout_categories: own, or a global one', () => {
  const allow = { allowPublic: true };
  assert.equal(canAccessRow('workout_categories', { user_id: ME, is_global: false }, ME), true);
  assert.equal(canAccessRow('workout_categories', { user_id: null, is_global: true }, ME, allow), true);
  assert.equal(canAccessRow('workout_categories', { user_id: THEM, is_global: false }, ME, allow), false);
  assert.equal(canAccessRow('workout_categories', { user_id: null, is_global: 'true' }, ME, allow), false);
});

test('recipes and blog posts: scheduled rows open at scheduled_at', () => {
  const allow = { allowPublic: true, now: NOW };
  assert.equal(canAccessRow('recipes', { user_id: THEM, visibility: 'scheduled', scheduled_at: PAST }, ME, allow), true);
  assert.equal(canAccessRow('recipes', { user_id: THEM, visibility: 'scheduled', scheduled_at: FUTURE }, ME, allow), false);
  assert.equal(canAccessRow('recipes', { user_id: THEM, visibility: 'authenticated_only' }, ME, allow), false);
  assert.equal(canAccessRow('blog_posts', { user_id: THEM, visibility: 'authenticated_only' }, ME, allow), true);
  assert.equal(canAccessRow('blog_posts', { user_id: THEM, visibility: 'draft' }, ME, allow), false);
});

// ─── ownedIds ────────────────────────────────────────────────────────────────

test('ownedIds: returns the caller\'s ids and drops everyone else\'s', async () => {
  const { db, calls } = fakeDb({
    financial_accounts: [
      { id: id(1), user_id: ME },
      { id: id(2), user_id: THEM },
    ],
  });
  const owned = await ownedIds(db, ME, 'financial_accounts', [id(1), id(2), id(3)]);
  assert.deepEqual([...owned.ids], [id(1)]);
  assert.equal(owned.failed, false);
  assert.equal(owned.has(id(1)), true);
  assert.equal(owned.has(id(2)), false, "someone else's");
  assert.equal(owned.has(id(3)), false, 'does not exist');
  // The owner filter is part of the query, not only a check afterwards.
  assert.deepEqual(calls, [{
    table: 'financial_accounts',
    columns: 'id, user_id',
    filters: [
      { op: 'in', column: 'id', value: [id(1), id(2), id(3)] },
      { op: 'eq', column: 'user_id', value: ME },
    ],
  }]);
});

test('ownedIds: still refuses someone else\'s row when the server ignores the owner filter', async () => {
  const { db } = fakeDb(
    { financial_accounts: [{ id: id(1), user_id: ME }, { id: id(2), user_id: THEM }] },
    { ignoreEq: true },
  );
  const owned = await ownedIds(db, ME, 'financial_accounts', [id(1), id(2)]);
  assert.deepEqual([...owned.ids], [id(1)]);
});

test('ownedIds: milestones are filtered through the roadmap owner', async () => {
  const { db, calls } = fakeDb({
    milestones: [milestone(id(1), ME), milestone(id(2), THEM), milestone(id(3), null)],
  });
  const owned = await ownedIds(db, ME, 'milestones', [id(1), id(2), id(3)]);
  assert.deepEqual([...owned.ids], [id(1)]);
  assert.equal(calls[0].columns, 'id, goals!inner(roadmaps!inner(user_id))');
  assert.deepEqual(calls[0].filters[1], { op: 'eq', column: 'goals.roadmaps.user_id', value: ME });
});

test('ownedIds: tasks have no owner filter in the query and are decided from the row', async () => {
  const task = (rowId: string, owner: string) => ({ id: rowId, milestones: { goals: { roadmaps: { user_id: owner } } } });
  const { db, calls } = fakeDb({ tasks: [task(id(1), ME), task(id(2), THEM)] });
  const owned = await ownedIds(db, ME, 'tasks', [id(1), id(2)]);
  assert.deepEqual([...owned.ids], [id(1)]);
  assert.equal(calls[0].filters.length, 1, 'only the id filter');
});

test('ownedIds: allowPublic admits public rows, and does not filter them out in the query', async () => {
  const store = {
    exercises: [
      { id: id(1), user_id: ME, visibility: 'private', is_active: true },
      { id: id(2), user_id: THEM, visibility: 'public', is_active: true },
      { id: id(3), user_id: THEM, visibility: 'private', is_active: true },
      { id: id(4), user_id: THEM, visibility: 'public', is_active: false },
    ],
  };
  const all = [id(1), id(2), id(3), id(4)];

  const withPublic = fakeDb(store);
  const allowed = await ownedIds(withPublic.db, ME, 'exercises', all, { allowPublic: true, now: NOW });
  assert.deepEqual([...allowed.ids].sort(), [id(1), id(2)]);
  assert.equal(withPublic.calls[0].filters.length, 1, 'no owner filter when public rows count');

  const ownOnly = fakeDb(store);
  const strict = await ownedIds(ownOnly.db, ME, 'exercises', all);
  assert.deepEqual([...strict.ids], [id(1)]);
  assert.deepEqual(ownOnly.calls[0].filters[1], { op: 'eq', column: 'user_id', value: ME });
});

test('ownedIds: allowPublic changes nothing for a table with no public rule', async () => {
  const { db, calls } = fakeDb({ trips: [{ id: id(1), user_id: THEM, visibility: 'public', is_active: true }] });
  const owned = await ownedIds(db, ME, 'trips', [id(1)], { allowPublic: true });
  assert.equal(owned.ids.size, 0);
  assert.deepEqual(calls[0].filters[1], { op: 'eq', column: 'user_id', value: ME });
});

test('ownedIds: malformed ids, an unknown table and no caller never reach the database', async () => {
  const { db, calls } = fakeDb({ vehicles: [{ id: id(1), user_id: ME }] });
  const bad = await ownedIds(db, ME, 'vehicles', ['', 'abc', "' or 1=1 --", 'id.eq.1,user_id.neq.0', null, undefined, 7, {}]);
  const unknown = await ownedIds(db, ME, 'profiles', [id(1)]);
  const nobody = await ownedIds(db, '', 'vehicles', [id(1)]);
  for (const result of [bad, unknown, nobody]) {
    assert.equal(result.ids.size, 0);
    assert.equal(result.failed, false);
  }
  assert.equal(calls.length, 0);
});

test('ownedIds: ids match whatever their case, and duplicates are asked for once', async () => {
  const { db, calls } = fakeDb({ vehicles: [{ id: id(1), user_id: ME }] });
  const upper = id(1).toUpperCase();
  const owned = await ownedIds(db, ME, 'vehicles', [upper, id(1), upper]);
  assert.equal(owned.has(upper), true);
  assert.equal(owned.has(id(1)), true);
  assert.deepEqual(calls[0].filters[0], { op: 'in', column: 'id', value: [id(1)] });
});

test('ownedIds: a long list is split into several requests', async () => {
  const ids = Array.from({ length: 250 }, (_, i) => id(i + 1));
  const { db, calls } = fakeDb({ financial_transactions: ids.map((rowId) => ({ id: rowId, user_id: ME })) });
  const owned = await ownedIds(db, ME, 'financial_transactions', ids);
  assert.equal(owned.ids.size, 250);
  assert.deepEqual(calls.map((call) => (call.filters[0].value as string[]).length), [100, 100, 50]);
});

test('ownedIds: a failed lookup is reported as failed and admits nothing', async () => {
  const { db } = fakeDb({ vehicles: [{ id: id(1), user_id: ME }] }, { failTables: ['vehicles'] });
  const owned = await ownedIds(db, ME, 'vehicles', [id(1)]);
  assert.equal(owned.failed, true);
  assert.equal(owned.ids.size, 0);
  assert.equal(owned.has(id(1)), false);
});

// ─── checkOwned / assertOwned ────────────────────────────────────────────────

test('checkOwned: "not yours", "does not exist" and "malformed" are indistinguishable', async () => {
  const { db } = fakeDb({ schedule_templates: [{ id: id(1), user_id: ME }, { id: id(2), user_id: THEM }] });
  assert.deepEqual(await checkOwned(db, ME, 'schedule_templates', id(1)), { allowed: true, failed: false });
  const notMine = await checkOwned(db, ME, 'schedule_templates', id(2));
  const missing = await checkOwned(db, ME, 'schedule_templates', id(3));
  const malformed = await checkOwned(db, ME, 'schedule_templates', 'nope');
  assert.deepEqual(notMine, { allowed: false, failed: false });
  assert.deepEqual(notMine, missing);
  assert.deepEqual(notMine, malformed);
});

test('assertOwned: resolves for the owner, throws 404 otherwise and 500 when the lookup fails', async () => {
  const { db } = fakeDb({ workout_logs: [{ id: id(1), user_id: ME }, { id: id(2), user_id: THEM }] });
  await assertOwned(db, ME, 'workout_logs', id(1));
  await assert.rejects(
    () => assertOwned(db, ME, 'workout_logs', id(2)),
    (err: unknown) => err instanceof OwnershipError && err.status === 404 && err.reason === 'not_found',
  );
  await assert.rejects(
    () => assertOwned(db, ME, 'workout_logs', id(9)),
    (err: unknown) => err instanceof OwnershipError && err.status === 404,
  );
  const broken = fakeDb({}, { failTables: ['workout_logs'] });
  await assert.rejects(
    () => assertOwned(broken.db, ME, 'workout_logs', id(1)),
    (err: unknown) => err instanceof OwnershipError && err.status === 500 && err.reason === 'lookup_failed',
  );
});

// ─── checkReferences ─────────────────────────────────────────────────────────

const FINANCE_STORE = {
  financial_accounts: [{ id: id(1), user_id: ME }, { id: id(2), user_id: THEM }],
  budget_categories: [{ id: id(3), user_id: ME }, { id: id(4), user_id: THEM }],
  user_contacts: [{ id: id(5), user_id: ME }],
};

test('checkReferences: every reference the caller owns passes', async () => {
  const { db, calls } = fakeDb(FINANCE_STORE);
  const result = await checkReferences(db, ME, [
    { field: 'account_id', table: 'financial_accounts', id: id(1) },
    { field: 'category_id', table: 'budget_categories', id: id(3) },
    { field: 'contact_id', table: 'user_contacts', id: id(5) },
  ]);
  assert.deepEqual(result, { ok: true, invalid: [], failed: false });
  assert.equal(calls.length, 3, 'one query per table');
});

test('checkReferences: blank ids are not references', async () => {
  const { db, calls } = fakeDb(FINANCE_STORE);
  const result = await checkReferences(db, ME, [
    { field: 'account_id', table: 'financial_accounts', id: null },
    { field: 'category_id', table: 'budget_categories', id: undefined },
    { field: 'contact_id', table: 'user_contacts', id: '' },
  ]);
  assert.deepEqual(result, { ok: true, invalid: [], failed: false });
  assert.equal(calls.length, 0);
});

test('checkReferences: names each refused field once, in order, whatever the reason', async () => {
  const { db } = fakeDb(FINANCE_STORE);
  const result = await checkReferences(db, ME, [
    { field: 'account_id', table: 'financial_accounts', id: id(2) }, // someone else's
    { field: 'category_id', table: 'budget_categories', id: id(99) }, // does not exist
    { field: 'contact_id', table: 'user_contacts', id: 'not-a-uuid' }, // malformed
    { field: 'brand_id', table: 'no_such_table', id: id(1) }, // no rule
    { field: 'job_id', table: 'contractor_jobs', id: 12 }, // not a string
    { field: 'pay_account_id', table: 'financial_accounts', id: id(1) }, // fine
    { field: 'legs.vehicle_id', table: 'vehicles', id: id(7) },
    { field: 'legs.vehicle_id', table: 'vehicles', id: id(8) },
  ]);
  assert.deepEqual(result, {
    ok: false,
    invalid: ['account_id', 'category_id', 'contact_id', 'brand_id', 'job_id', 'legs.vehicle_id'],
    failed: false,
  });
});

test("checkReferences: someone else's id and a made-up id get the same answer", async () => {
  const { db } = fakeDb(FINANCE_STORE);
  const theirs = await checkReferences(db, ME, [{ field: 'account_id', table: 'financial_accounts', id: id(2) }]);
  const madeUp = await checkReferences(db, ME, [{ field: 'account_id', table: 'financial_accounts', id: id(99) }]);
  assert.deepEqual(theirs, madeUp);
  assert.equal(invalidReferenceMessage(theirs.invalid), 'Invalid reference: account_id');
});

test('checkReferences: the same table with and without allowPublic is checked separately', async () => {
  const { db } = fakeDb({
    exercises: [{ id: id(1), user_id: THEM, visibility: 'public', is_active: true }],
  });
  const result = await checkReferences(db, ME, [
    { field: 'strict', table: 'exercises', id: id(1) },
    { field: 'loose', table: 'exercises', id: id(1), allowPublic: true },
  ], NOW);
  assert.deepEqual(result, { ok: false, invalid: ['strict'], failed: false });
});

test('checkReferences: a failed lookup is a failure, not a list of invalid fields', async () => {
  const { db } = fakeDb(FINANCE_STORE, { failTables: ['budget_categories'] });
  const result = await checkReferences(db, ME, [
    { field: 'account_id', table: 'financial_accounts', id: id(2) },
    { field: 'category_id', table: 'budget_categories', id: id(3) },
  ]);
  assert.deepEqual(result, { ok: false, invalid: [], failed: true });
});

// ─── usableReferences ────────────────────────────────────────────────────────

test('usableReferences: keeps what the caller owns and nulls the rest', async () => {
  const { db } = fakeDb({
    ...FINANCE_STORE,
    milestones: [milestone(id(10), ME), milestone(id(11), THEM)],
  });
  const result = await usableReferences(db, ME, [
    { field: 'pay_account_id', table: 'financial_accounts', id: id(1) },
    { field: 'pay_category_id', table: 'budget_categories', id: id(4) }, // someone else's
    { field: 'invoice_contact_id', table: 'user_contacts', id: null },
    { field: 'milestone_id', table: 'milestones', id: id(11) }, // someone else's planner
    { field: 'own_milestone_id', table: 'milestones', id: id(10) },
  ]);
  assert.deepEqual(result, {
    values: {
      pay_account_id: id(1),
      pay_category_id: null,
      invoice_contact_id: null,
      milestone_id: null,
      own_milestone_id: id(10),
    },
    failed: false,
  });
});

test('usableReferences: when a lookup fails nothing is usable', async () => {
  const { db } = fakeDb(FINANCE_STORE, { failTables: ['financial_accounts'] });
  const result = await usableReferences(db, ME, [
    { field: 'pay_account_id', table: 'financial_accounts', id: id(1) },
    { field: 'pay_category_id', table: 'budget_categories', id: id(3) },
  ]);
  assert.deepEqual(result, { values: { pay_account_id: null, pay_category_id: null }, failed: true });
});

// ─── vehicles: the public-transport library ─────────────────────────────────

test('vehicles: own vehicle yes; a system vehicle only with allowPublic; another user\'s never', () => {
  assert.equal(canAccessRow('vehicles', { user_id: ME, is_system: false }, ME), true);
  assert.equal(canAccessRow('vehicles', { user_id: null, is_system: true }, ME), false);
  assert.equal(canAccessRow('vehicles', { user_id: null, is_system: true }, ME, { allowPublic: true }), true);
  assert.equal(canAccessRow('vehicles', { user_id: THEM, is_system: false }, ME, { allowPublic: true }), false);
  assert.equal(canAccessRow('vehicles', { user_id: THEM, visibility: 'public', is_active: true }, ME, { allowPublic: true }), false);
});

test('checkReferences: a trip may name a system vehicle but not someone else\'s car', async () => {
  const { db } = fakeDb({
    vehicles: [
      { id: id(1), user_id: null, is_system: true },
      { id: id(2), user_id: THEM, is_system: false },
      { id: id(3), user_id: ME, is_system: false },
    ],
  });
  const system = await checkReferences(db, ME, [{ field: 'vehicle_id', table: 'vehicles', id: id(1), allowPublic: true }]);
  const theirs = await checkReferences(db, ME, [{ field: 'vehicle_id', table: 'vehicles', id: id(2), allowPublic: true }]);
  const mine = await checkReferences(db, ME, [{ field: 'vehicle_id', table: 'vehicles', id: id(3) }]);
  assert.equal(system.ok, true);
  assert.deepEqual(theirs.invalid, ['vehicle_id']);
  assert.equal(mine.ok, true);
});

// ─── withoutFields ───────────────────────────────────────────────────────────

test('withoutFields drops the named fields and keeps the rest', () => {
  const body = { id: id(1), user_id: THEM, transaction_id: id(2), cost: 12, notes: 'x' };
  assert.deepEqual(withoutFields(body, ['id', 'user_id', 'transaction_id']), { cost: 12, notes: 'x' });
  assert.equal(body.user_id, THEM, 'the input is not changed');
});

test('withoutFields: non-objects give an empty object; prototype keys never pass', () => {
  for (const bad of [null, undefined, 'x', 7, [1, 2]]) assert.deepEqual(withoutFields(bad, []), {});
  const hostile = JSON.parse('{"__proto__": {"user_id": "x"}, "cost": 1}');
  const out = withoutFields(hostile, []);
  assert.deepEqual(Object.keys(out), ['cost']);
  assert.equal(out.user_id, undefined);
});
