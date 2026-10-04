// tests/unit/activity-link-ownership.test.ts
// Run: npm run test:unit
//   (node --test --experimental-strip-types tests/unit/*.test.ts)
//
// The rules that decide which records a user may reference in an activity
// link. No database: rows are plain objects and the row loader is a fake.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENTITY_ACCESS_RULES,
  canReference,
  getEntityRule,
  loadReferencedRow,
  type AccessRow,
  type FetchRow,
} from '../../lib/activity-links/ownership.ts';

const ME = '11111111-1111-4111-8111-111111111111';
const THEM = '22222222-2222-4222-8222-222222222222';
const ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-10-04T12:00:00Z');
const PAST = '2026-10-01T00:00:00Z';
const FUTURE = '2026-11-01T00:00:00Z';

/** A task row as PostgREST returns it for the rule's select. */
function taskRow(ownerId: string | null, asArrays = false): AccessRow {
  const roadmaps = ownerId ? { user_id: ownerId } : null;
  const goals = { roadmaps: asArrays && roadmaps ? [roadmaps] : roadmaps };
  const milestones = { goals: asArrays ? [goals] : goals };
  return { milestones: asArrays ? [milestones] : milestones };
}

// ─── The table itself ────────────────────────────────────────────────────────

test('every type the links API accepts has a rule, on the right table', () => {
  const tables = Object.fromEntries(
    Object.entries(ENTITY_ACCESS_RULES).map(([type, rule]) => [type, rule.table]),
  );
  assert.deepEqual(tables, {
    task: 'tasks',
    trip: 'trips',
    route: 'trip_routes',
    transaction: 'financial_transactions',
    fuel_log: 'fuel_logs',
    maintenance: 'vehicle_maintenance',
    invoice: 'invoices',
    workout: 'workout_logs',
    focus_session: 'focus_sessions',
    daily_log: 'daily_logs',
    podcast_episode: 'podcast_episodes',
    exercise: 'exercises',
    equipment: 'equipment',
    media_item: 'media_items',
    recipe: 'recipes',
    blog_post: 'blog_posts',
  });
});

test('only the five types with a public-read policy have a public rule', () => {
  const withPublicRule = Object.entries(ENTITY_ACCESS_RULES)
    .filter(([, rule]) => typeof rule.isPublic === 'function')
    .map(([type]) => type)
    .sort();
  assert.deepEqual(withPublicRule, ['blog_post', 'equipment', 'exercise', 'media_item', 'recipe']);
});

test('types without a rule are refused, including ones the DB CHECK allows', () => {
  for (const type of ['job', 'schedule', 'user', 'profiles', '', 'TASK']) {
    assert.equal(getEntityRule(type), null, `type "${type}"`);
    assert.equal(canReference(type, { user_id: ME }, ME, NOW), false, `type "${type}"`);
  }
});

test('prototype keys and non-strings are not treated as types', () => {
  for (const type of ['constructor', '__proto__', 'toString', 'hasOwnProperty', null, undefined, 42, {}]) {
    assert.equal(getEntityRule(type), null);
    assert.equal(canReference(type, { user_id: ME }, ME, NOW), false);
  }
});

// ─── Owner-only types ────────────────────────────────────────────────────────

const OWNER_ONLY_TYPES = [
  'trip', 'route', 'transaction', 'fuel_log', 'maintenance',
  'invoice', 'workout', 'focus_session', 'daily_log', 'podcast_episode',
];

test('owner-only types: the caller owns the row', () => {
  for (const type of OWNER_ONLY_TYPES) {
    assert.equal(canReference(type, { user_id: ME }, ME, NOW), true, type);
  }
});

test("owner-only types: someone else's row is refused", () => {
  for (const type of OWNER_ONLY_TYPES) {
    assert.equal(canReference(type, { user_id: THEM }, ME, NOW), false, type);
  }
});

test('owner-only types: a missing row, a row with no owner, and no caller are refused', () => {
  for (const type of OWNER_ONLY_TYPES) {
    assert.equal(canReference(type, null, ME, NOW), false, type);
    assert.equal(canReference(type, undefined, ME, NOW), false, type);
    assert.equal(canReference(type, {}, ME, NOW), false, type);
    assert.equal(canReference(type, { user_id: null }, ME, NOW), false, type);
    assert.equal(canReference(type, { user_id: ME }, '', NOW), false, type);
  }
});

test('trips and routes are owner-only even when visibility says public', () => {
  // The column exists (migration 124) but there is no public-read policy;
  // trips are only ever shared by token.
  for (const type of ['trip', 'route']) {
    assert.equal(canReference(type, { user_id: THEM, visibility: 'public' }, ME, NOW), false, type);
    assert.equal(canReference(type, { user_id: THEM, visibility: 'shared' }, ME, NOW), false, type);
  }
});

// ─── Tasks: milestone → goal → roadmap.user_id ───────────────────────────────

test('task: owned through milestone, goal and roadmap', () => {
  assert.equal(canReference('task', taskRow(ME), ME, NOW), true);
  assert.equal(canReference('task', taskRow(ME, true), ME, NOW), true, 'array-shaped embeds');
});

test("task: someone else's roadmap is refused", () => {
  assert.equal(canReference('task', taskRow(THEM), ME, NOW), false);
  assert.equal(canReference('task', taskRow(THEM, true), ME, NOW), false);
});

test('task: a broken chain is refused, and a user_id on the task itself is ignored', () => {
  assert.equal(canReference('task', taskRow(null), ME, NOW), false);
  assert.equal(canReference('task', { milestones: null }, ME, NOW), false);
  assert.equal(canReference('task', { milestones: { goals: null } }, ME, NOW), false);
  assert.equal(canReference('task', { user_id: ME }, ME, NOW), false);
});

test('task rule joins through to roadmaps.user_id', () => {
  assert.equal(
    ENTITY_ACCESS_RULES.task.select,
    'milestones!inner(goals!inner(roadmaps!inner(user_id)))',
  );
});

// ─── Public and active: exercise, equipment, media_item ─────────────────────

const PUBLIC_ACTIVE_TYPES = ['exercise', 'equipment', 'media_item'];

test("public-and-active types: someone else's public, active row is allowed", () => {
  for (const type of PUBLIC_ACTIVE_TYPES) {
    const row = { user_id: THEM, visibility: 'public', is_active: true };
    assert.equal(canReference(type, row, ME, NOW), true, type);
  }
});

test("public-and-active types: someone else's private or inactive row is refused", () => {
  for (const type of PUBLIC_ACTIVE_TYPES) {
    assert.equal(canReference(type, { user_id: THEM, visibility: 'private', is_active: true }, ME, NOW), false, type);
    assert.equal(canReference(type, { user_id: THEM, visibility: 'public', is_active: false }, ME, NOW), false, type);
    assert.equal(canReference(type, { user_id: THEM, visibility: 'public' }, ME, NOW), false, `${type} (is_active missing)`);
    assert.equal(canReference(type, { user_id: THEM }, ME, NOW), false, `${type} (no visibility)`);
  }
});

test('public-and-active types: the owner may reference their own private or inactive row', () => {
  for (const type of PUBLIC_ACTIVE_TYPES) {
    assert.equal(canReference(type, { user_id: ME, visibility: 'private', is_active: false }, ME, NOW), true, type);
  }
});

// ─── Recipes ────────────────────────────────────────────────────────────────

test('recipe: public, or scheduled and due', () => {
  assert.equal(canReference('recipe', { user_id: THEM, visibility: 'public' }, ME, NOW), true);
  assert.equal(canReference('recipe', { user_id: THEM, visibility: 'scheduled', scheduled_at: PAST }, ME, NOW), true);
});

test('recipe: draft, not-yet-due and unknown visibilities are refused for non-owners', () => {
  assert.equal(canReference('recipe', { user_id: THEM, visibility: 'draft' }, ME, NOW), false);
  assert.equal(canReference('recipe', { user_id: THEM, visibility: 'scheduled', scheduled_at: FUTURE }, ME, NOW), false);
  assert.equal(canReference('recipe', { user_id: THEM, visibility: 'scheduled', scheduled_at: null }, ME, NOW), false);
  assert.equal(canReference('recipe', { user_id: THEM, visibility: 'scheduled', scheduled_at: 'not a date' }, ME, NOW), false);
  // recipes dropped authenticated_only in migration 032
  assert.equal(canReference('recipe', { user_id: THEM, visibility: 'authenticated_only' }, ME, NOW), false);
  assert.equal(canReference('recipe', { user_id: THEM, visibility: 'private' }, ME, NOW), false);
});

test('recipe: the owner may reference their own draft', () => {
  assert.equal(canReference('recipe', { user_id: ME, visibility: 'draft' }, ME, NOW), true);
});

// ─── Blog posts ─────────────────────────────────────────────────────────────

test('blog_post: public, members-only, or scheduled and due', () => {
  assert.equal(canReference('blog_post', { user_id: THEM, visibility: 'public' }, ME, NOW), true);
  assert.equal(canReference('blog_post', { user_id: THEM, visibility: 'authenticated_only' }, ME, NOW), true);
  assert.equal(canReference('blog_post', { user_id: THEM, visibility: 'scheduled', scheduled_at: PAST }, ME, NOW), true);
});

test('blog_post: draft, private and not-yet-due are refused for non-owners', () => {
  assert.equal(canReference('blog_post', { user_id: THEM, visibility: 'draft' }, ME, NOW), false);
  assert.equal(canReference('blog_post', { user_id: THEM, visibility: 'private' }, ME, NOW), false);
  assert.equal(canReference('blog_post', { user_id: THEM, visibility: 'scheduled', scheduled_at: FUTURE }, ME, NOW), false);
});

test('blog_post: the owner may reference their own private post', () => {
  assert.equal(canReference('blog_post', { user_id: ME, visibility: 'private' }, ME, NOW), true);
});

test('scheduled rows become visible exactly at scheduled_at', () => {
  const at = NOW.toISOString();
  assert.equal(canReference('blog_post', { user_id: THEM, visibility: 'scheduled', scheduled_at: at }, ME, NOW), true);
  const justAfter = new Date(NOW.getTime() + 1).toISOString();
  assert.equal(canReference('blog_post', { user_id: THEM, visibility: 'scheduled', scheduled_at: justAfter }, ME, NOW), false);
});

// ─── loadReferencedRow, with a fake row loader ───────────────────────────────

/** A fake table store: { table: { id: row } }. Records every call. */
function fakeLoader(store: Record<string, Record<string, AccessRow>>, opts: { fail?: boolean } = {}) {
  const calls: { table: string; columns: string; id: string }[] = [];
  const fetchRow: FetchRow = async (table, columns, id) => {
    calls.push({ table, columns, id });
    if (opts.fail) return { row: null, failed: true };
    return { row: store[table]?.[id] ?? null, failed: false };
  };
  return { fetchRow, calls };
}

test('load: the caller\'s own record is allowed and its row is returned', async () => {
  const row = { user_id: ME, vendor: 'Chipotle', amount: 12.4, type: 'expense' };
  const { fetchRow, calls } = fakeLoader({ financial_transactions: { [ID]: row } });
  const result = await loadReferencedRow(fetchRow, 'transaction', ID, ME, 'vendor, amount, type', NOW);
  assert.deepEqual(result, { allowed: true, failed: false, row });
  assert.deepEqual(calls, [
    { table: 'financial_transactions', columns: 'user_id, vendor, amount, type', id: ID },
  ]);
});

test("load: someone else's record and a missing record are indistinguishable", async () => {
  const theirs = { user_id: THEM, vendor: 'Secret Vendor', amount: 9999, type: 'income' };
  const store = { financial_transactions: { [ID]: theirs } };
  const notYours = await loadReferencedRow(fakeLoader(store).fetchRow, 'transaction', ID, ME, 'vendor, amount, type', NOW);
  const missing = await loadReferencedRow(fakeLoader({}).fetchRow, 'transaction', ID, ME, 'vendor, amount, type', NOW);
  assert.deepEqual(notYours, { allowed: false, failed: false, row: null });
  assert.deepEqual(notYours, missing);
});

test('load: a refused record never carries its display columns back', async () => {
  const store = { tasks: { [ID]: { ...taskRow(THEM), activity: 'Private task text' } } };
  const result = await loadReferencedRow(fakeLoader(store).fetchRow, 'task', ID, ME, 'activity', NOW);
  assert.equal(result.allowed, false);
  assert.equal(result.row, null);
});

test('load: an unknown type is refused without touching the database', async () => {
  const { fetchRow, calls } = fakeLoader({});
  for (const type of ['job', 'schedule', 'constructor', undefined]) {
    assert.deepEqual(
      await loadReferencedRow(fetchRow, type, ID, ME, '', NOW),
      { allowed: false, failed: false, row: null },
    );
  }
  assert.equal(calls.length, 0);
});

test('load: a malformed id is refused without touching the database', async () => {
  const { fetchRow, calls } = fakeLoader({});
  for (const id of ['', 'abc', '1', `${ID}x`, "' or 1=1 --", 'id.eq.1,user_id.neq.0', null, undefined, 7, {}]) {
    assert.deepEqual(
      await loadReferencedRow(fetchRow, 'trip', id, ME, '', NOW),
      { allowed: false, failed: false, row: null },
    );
  }
  assert.equal(calls.length, 0);
});

test('load: a lookup failure is reported as failed, not as allowed or refused', async () => {
  const { fetchRow } = fakeLoader({}, { fail: true });
  assert.deepEqual(
    await loadReferencedRow(fetchRow, 'trip', ID, ME, '', NOW),
    { allowed: false, failed: true, row: null },
  );
});

test("load: someone else's public exercise is allowed; their private one is not", async () => {
  const pub = { user_id: THEM, visibility: 'public', is_active: true, name: 'Goblet Squat' };
  const priv = { user_id: THEM, visibility: 'private', is_active: true, name: 'Private Drill' };
  const allowed = await loadReferencedRow(fakeLoader({ exercises: { [ID]: pub } }).fetchRow, 'exercise', ID, ME, 'name', NOW);
  const refused = await loadReferencedRow(fakeLoader({ exercises: { [ID]: priv } }).fetchRow, 'exercise', ID, ME, 'name', NOW);
  assert.deepEqual(allowed, { allowed: true, failed: false, row: pub });
  assert.deepEqual(refused, { allowed: false, failed: false, row: null });
});

test('load: with no display columns only the access columns are selected', async () => {
  const { fetchRow, calls } = fakeLoader({ exercises: { [ID]: { user_id: ME, visibility: 'private', is_active: true } } });
  const result = await loadReferencedRow(fetchRow, 'exercise', ID, ME, undefined, NOW);
  assert.equal(result.allowed, true);
  assert.deepEqual(calls, [{ table: 'exercises', columns: 'user_id, visibility, is_active', id: ID }]);
});
