// tests/unit/category-tree.test.ts
// Unit tests for the one category tree (plans/63 E, migration 223), lib/categories/*:
// building the tree and the picker's groups, suggestions by name, grouping lists by life area,
// ownership of budget_categories.life_category_id, the automatic life area of a transaction
// (never removing a tag a person added), budgets staying exactly as they were, the analytics
// roll-up, and merging. Everything runs against the in-memory fake; nothing touches a database.
// Run: npm run test:unit

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildCategoryTree,
  flattenGroups,
  groupByLifeArea,
  hasExactName,
  normalizeForSearch,
  pickerGroups,
  selectionLabel,
  suggestLifeArea,
  UNASSIGNED_HEADING,
} from '../../lib/categories/tree.ts';
import {
  AUTO_SOURCE,
  loadLifeAreaByCategory,
  markTagsManual,
  planAutoLifeTags,
  rollUpLifeAreas,
  syncAutoLifeAreas,
  syncAutoLifeAreasForBatch,
} from '../../lib/categories/life-areas.ts';
import {
  checkLifeAreaReference,
  loadCategoryTree,
  mergeBudgetCategories,
  mergeLifeAreas,
  placeBudgetCategory,
  TREE_NOT_READY,
} from '../../lib/categories/server.ts';
import { loadBudgetReport } from '../../lib/finance/budgets/server.ts';
import { FakeDb, type Row } from './fake-supabase.ts';

// Ids must be UUIDs: lib/auth/ownership.ts drops anything else before querying.
const uid = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
const ME = uid(1);
const THEM = uid(2);

const HEALTH = uid(10);
const HOME = uid(11);
const TRAVEL = uid(12);
const THEIR_AREA = uid(19);

const GROCERIES = uid(20);
const GAS = uid(21);
const DINING = uid(22);
const THEIR_CAT = uid(29);

const asDb = (db: FakeDb) => db as unknown as SupabaseClient;

const lifeAreas = [
  { id: TRAVEL, name: 'Travel', color: '#06b6d4', sort_order: 2 },
  { id: HEALTH, name: 'Health', color: '#ef4444', sort_order: 0 },
  { id: HOME, name: 'Home', color: '#f59e0b', sort_order: 1 },
];
const budgetCategories = [
  { id: GROCERIES, name: 'Groceries', color: '#10b981', life_category_id: HEALTH },
  { id: DINING, name: 'Dining Out', color: '#f97316', life_category_id: null },
  { id: GAS, name: 'Gas', color: '#f59e0b', life_category_id: TRAVEL },
  { id: THEIR_CAT, name: 'Theirs', color: null, life_category_id: THEIR_AREA },
];

function seededDb(): FakeDb {
  const db = new FakeDb();
  db.seed('life_categories', [
    { id: HEALTH, user_id: ME, name: 'Health', color: '#ef4444', icon: 'heart', sort_order: 0 },
    { id: HOME, user_id: ME, name: 'Home', color: '#f59e0b', icon: 'home', sort_order: 1 },
    { id: TRAVEL, user_id: ME, name: 'Travel', color: '#06b6d4', icon: 'map-pin', sort_order: 2 },
    { id: THEIR_AREA, user_id: THEM, name: 'Health', color: '#000000', icon: 'tag', sort_order: 0 },
  ]);
  db.seed('budget_categories', [
    { id: GROCERIES, user_id: ME, name: 'Groceries', color: '#10b981', monthly_budget: 400, sort_order: 0, life_category_id: null },
    { id: GAS, user_id: ME, name: 'Gas', color: '#f59e0b', monthly_budget: null, sort_order: 1, life_category_id: TRAVEL },
    { id: DINING, user_id: ME, name: 'Dining Out', color: '#f97316', monthly_budget: 200, sort_order: 2, life_category_id: null },
    { id: THEIR_CAT, user_id: THEM, name: 'Theirs', color: null, monthly_budget: 10, sort_order: 0, life_category_id: THEIR_AREA },
  ]);
  return db;
}

const tx = (n: number, user: string, category: string | null, extra: Row = {}): Row => ({
  id: uid(100 + n),
  user_id: user,
  amount: 10 * n,
  type: 'expense',
  category_id: category,
  transaction_date: '2026-10-01',
  source: 'manual',
  transfer_group_id: null,
  ...extra,
});

const tagsOf = (db: FakeDb, entityId: string) =>
  db
    .rows('entity_life_categories')
    .filter((row) => row.entity_id === entityId)
    .map((row) => [row.life_category_id, row.auto_source ?? null])
    .sort();

// ── The tree ────────────────────────────────────────────────────────────────

test('buildCategoryTree puts budget categories under their life area, in order, with an unassigned bucket', () => {
  const tree = buildCategoryTree(lifeAreas, budgetCategories);
  assert.deepEqual(tree.lifeAreas.map((a) => a.name), ['Health', 'Home', 'Travel']);
  assert.deepEqual(tree.lifeAreas[0].children.map((c) => c.name), ['Groceries']);
  assert.deepEqual(tree.lifeAreas[1].children, []);
  assert.deepEqual(tree.lifeAreas[2].children.map((c) => c.name), ['Gas']);
  // No life area, and a life area that is not in the list (someone else's), both count as unassigned.
  assert.deepEqual(tree.unassigned.map((c) => c.name), ['Dining Out', 'Theirs']);
  assert.equal(tree.parentOf.get(GROCERIES)?.id, HEALTH);
  assert.equal(tree.parentOf.get(THEIR_CAT), null);
});

test('buildCategoryTree reads the life area from an override when the rows do not carry it', () => {
  const rows = budgetCategories.map(({ id, name, color }) => ({ id, name, color }));
  const tree = buildCategoryTree(lifeAreas, rows, (c) => (c.id === DINING ? HOME : null));
  assert.deepEqual(tree.lifeAreas[1].children.map((c) => c.name), ['Dining Out']);
  assert.deepEqual(tree.unassigned.map((c) => c.name), ['Gas', 'Groceries', 'Theirs']);
});

test('pickerGroups: budget mode shows life areas as headings over their categories, unassigned last', () => {
  const tree = buildCategoryTree(lifeAreas, budgetCategories);
  const groups = pickerGroups(tree, { mode: 'budget' });
  assert.deepEqual(groups.map((g) => [g.heading, g.self, g.options.map((o) => o.label)]), [
    ['Health', null, ['Groceries']],
    ['Travel', null, ['Gas']],
    [UNASSIGNED_HEADING, null, ['Dining Out', 'Theirs']],
  ]);
  assert.equal(groups[0].options[0].path, 'Health › Groceries');
  assert.equal(groups[2].options[0].path, 'Dining Out');
});

test('pickerGroups: life mode lists life areas only; any mode offers both levels', () => {
  const tree = buildCategoryTree(lifeAreas, budgetCategories);
  const life = flattenGroups(pickerGroups(tree, { mode: 'life' }));
  assert.deepEqual(life.map((o) => [o.kind, o.label]), [['life', 'Health'], ['life', 'Home'], ['life', 'Travel']]);
  const any = flattenGroups(pickerGroups(tree, { mode: 'any' }));
  assert.deepEqual(any.map((o) => o.key), [
    `life:${HEALTH}`, `budget:${GROCERIES}`, `life:${HOME}`, `life:${TRAVEL}`, `budget:${GAS}`,
    `budget:${DINING}`, `budget:${THEIR_CAT}`,
  ]);
});

test('pickerGroups search: a child match keeps its heading, a life-area match shows all its children, accents ignored', () => {
  const tree = buildCategoryTree(lifeAreas, [...budgetCategories, { id: uid(30), name: 'Café', color: null, life_category_id: HOME }]);
  assert.deepEqual(pickerGroups(tree, { mode: 'budget', query: 'groc' }).map((g) => [g.heading, g.options.map((o) => o.label)]), [
    ['Health', ['Groceries']],
  ]);
  assert.deepEqual(pickerGroups(tree, { mode: 'budget', query: 'TRAV' }).map((g) => [g.heading, g.options.map((o) => o.label)]), [
    ['Travel', ['Gas']],
  ]);
  assert.deepEqual(flattenGroups(pickerGroups(tree, { mode: 'budget', query: 'cafe' })).map((o) => o.label), ['Café']);
  assert.deepEqual(pickerGroups(tree, { mode: 'budget', query: 'zzz' }), []);
  assert.equal(normalizeForSearch('  Café   Food '), 'cafe food');
});

test('selectionLabel and hasExactName', () => {
  const tree = buildCategoryTree(lifeAreas, budgetCategories);
  assert.equal(selectionLabel(tree, { kind: 'budget', id: GROCERIES })?.path, 'Health › Groceries');
  assert.equal(selectionLabel(tree, { kind: 'budget', id: DINING })?.path, 'Dining Out');
  assert.equal(selectionLabel(tree, { kind: 'life', id: HOME })?.label, 'Home');
  assert.equal(selectionLabel(tree, { kind: 'budget', id: uid(999) }), null);
  assert.equal(selectionLabel(tree, null), null);
  assert.equal(hasExactName(tree, 'groceries', 'budget'), true);
  assert.equal(hasExactName(tree, 'home', 'budget'), false);
  assert.equal(hasExactName(tree, 'home', 'life'), true);
  assert.equal(hasExactName(tree, 'gas', 'life'), false);
});

test('groupByLifeArea keeps item order inside a group and puts unplaced items last', () => {
  const tree = buildCategoryTree(lifeAreas, budgetCategories);
  const lines = [{ id: DINING, n: 1 }, { id: GAS, n: 2 }, { id: GROCERIES, n: 3 }, { id: uid(998), n: 4 }];
  assert.deepEqual(
    groupByLifeArea(lines, tree).map((g) => [g.lifeArea?.name ?? null, g.items.map((i) => i.n)]),
    [['Health', [3]], ['Travel', [2]], [null, [1, 4]]],
  );
});

// ── Suggestions ─────────────────────────────────────────────────────────────

test('suggestLifeArea: same name, then a name inside, then common words, using the life areas the person has', () => {
  const areas = [
    { id: HEALTH, name: 'Health' },
    { id: HOME, name: 'Home' },
    { id: TRAVEL, name: 'Travel' },
    { id: uid(13), name: 'Finance' },
    { id: uid(14), name: 'Career' },
  ];
  assert.deepEqual(suggestLifeArea('Travel', areas), { lifeAreaId: TRAVEL, lifeAreaName: 'Travel', reason: 'same_name' });
  assert.equal(suggestLifeArea('Healthcare', areas)?.lifeAreaName, 'Health');
  assert.equal(suggestLifeArea('Home Office Supplies', areas)?.reason, 'name_contains');
  assert.deepEqual(suggestLifeArea('Groceries', areas), { lifeAreaId: HEALTH, lifeAreaName: 'Health', reason: 'keyword' });
  assert.equal(suggestLifeArea('Groceries', areas.filter((a) => a.name !== 'Health'))?.lifeAreaName, 'Home');
  assert.equal(suggestLifeArea('Gas', areas)?.lifeAreaName, 'Travel');
  assert.equal(suggestLifeArea('Rent', areas)?.lifeAreaName, 'Home');
  assert.equal(suggestLifeArea('Union Dues', areas)?.lifeAreaName, 'Career');
  // Short words match whole words only: "card" is not "car", "barber" is not "bar".
  assert.equal(suggestLifeArea('Credit card payments', areas)?.lifeAreaName, 'Finance');
  assert.equal(suggestLifeArea('Barber', areas), null);
  assert.equal(suggestLifeArea('Zzyzx', areas), null);
  assert.equal(suggestLifeArea('Groceries', []), null);
});

// ── Ownership of life_category_id ───────────────────────────────────────────

test('placeBudgetCategory: own category under own life area, then its transactions follow', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [tx(1, ME, GROCERIES), tx(2, ME, GROCERIES), tx(3, ME, GAS)]);
  const result = await placeBudgetCategory(asDb(db), ME, GROCERIES, HEALTH);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.transactions, 2);
  assert.equal(result.value.tagsAdded, 2);
  assert.equal(db.rows('budget_categories').find((c) => c.id === GROCERIES)?.life_category_id, HEALTH);
  assert.deepEqual(tagsOf(db, uid(101)), [[HEALTH, AUTO_SOURCE]]);
  // Gas's transaction was not part of this change.
  assert.deepEqual(tagsOf(db, uid(103)), []);
});

test('placeBudgetCategory refuses someone else\'s life area (400) and someone else\'s category (404)', async () => {
  const db = seededDb();
  const foreignArea = await placeBudgetCategory(asDb(db), ME, GROCERIES, THEIR_AREA);
  assert.deepEqual(foreignArea.ok ? null : [foreignArea.status, foreignArea.error], [400, 'Invalid reference: life_category_id']);
  const foreignCategory = await placeBudgetCategory(asDb(db), ME, THEIR_CAT, HEALTH);
  assert.deepEqual(foreignCategory.ok ? null : foreignCategory.status, 404);
  const malformed = await placeBudgetCategory(asDb(db), ME, GROCERIES, 'not-a-uuid');
  assert.equal(malformed.ok ? null : malformed.status, 400);
  // Nothing changed.
  assert.equal(db.rows('budget_categories').find((c) => c.id === GROCERIES)?.life_category_id, null);
  assert.equal(db.rows('budget_categories').find((c) => c.id === THEIR_CAT)?.life_category_id, THEIR_AREA);
});

test('placeBudgetCategory with null takes the category out of its life area and drops only automatic tags', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [tx(1, ME, GAS)]);
  db.seed('entity_life_categories', [
    { user_id: ME, life_category_id: TRAVEL, entity_type: 'transaction', entity_id: uid(101), auto_source: AUTO_SOURCE },
    { user_id: ME, life_category_id: HOME, entity_type: 'transaction', entity_id: uid(101), auto_source: null },
  ]);
  const result = await placeBudgetCategory(asDb(db), ME, GAS, null);
  assert.equal(result.ok, true);
  assert.equal(db.rows('budget_categories').find((c) => c.id === GAS)?.life_category_id, null);
  assert.deepEqual(tagsOf(db, uid(101)), [[HOME, null]]);
});

test('before migration 223, placing answers "Run migration 223 first" and writes nothing', async () => {
  const db = seededDb();
  db.missingColumns = { budget_categories: ['life_category_id'], entity_life_categories: ['auto_source'] };
  const result = await placeBudgetCategory(asDb(db), ME, GROCERIES, HEALTH);
  assert.deepEqual(result.ok ? null : [result.status, result.code, result.error], [409, TREE_NOT_READY.code, TREE_NOT_READY.error]);
  assert.match(TREE_NOT_READY.error, /Run migration 223 first/);
  assert.deepEqual(db.writes().filter((call) => !call.failed), []);
});

test('checkLifeAreaReference: blank clears, own passes, foreign and malformed fail', async () => {
  const db = seededDb();
  assert.deepEqual(await checkLifeAreaReference(asDb(db), ME, ''), { ok: true, value: null });
  assert.deepEqual(await checkLifeAreaReference(asDb(db), ME, null), { ok: true, value: null });
  assert.deepEqual(await checkLifeAreaReference(asDb(db), ME, HEALTH), { ok: true, value: HEALTH });
  assert.equal((await checkLifeAreaReference(asDb(db), ME, THEIR_AREA)).ok, false);
  assert.equal((await checkLifeAreaReference(asDb(db), ME, 42)).ok, false);
});

test('loadLifeAreaByCategory ignores a link to someone else\'s life area, and is not ready before 223', async () => {
  const db = seededDb();
  db.rows('budget_categories').find((c) => c.id === DINING)!.life_category_id = THEIR_AREA;
  const { ready, map } = await loadLifeAreaByCategory(asDb(db), ME);
  assert.equal(ready, true);
  assert.deepEqual([...map], [[GAS, TRAVEL]]);
  db.missingColumns = { budget_categories: ['life_category_id'] };
  const before = await loadLifeAreaByCategory(asDb(db), ME);
  assert.deepEqual([before.ready, before.map.size, before.error], [false, 0, undefined]);
});

test('loadCategoryTree seeds default life areas once, suggests for unplaced categories, and works before 223', async () => {
  const db = new FakeDb();
  db.seed('budget_categories', [
    { id: GROCERIES, user_id: ME, name: 'Groceries', color: null, monthly_budget: null, sort_order: 0, life_category_id: null },
  ]);
  const first = await loadCategoryTree(asDb(db), ME, { seed: true });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.value.lifeAreas.length, 8);
  assert.equal(first.value.ready, true);
  assert.equal(first.value.suggestions[GROCERIES]?.lifeAreaName, 'Health');
  const again = await loadCategoryTree(asDb(db), ME, { seed: true });
  assert.equal(again.ok && again.value.lifeAreas.length, 8);
  assert.equal(db.rows('life_categories').length, 8);

  db.missingColumns = { budget_categories: ['life_category_id'] };
  const before = await loadCategoryTree(asDb(db), ME);
  assert.equal(before.ok && before.value.ready, false);
  assert.equal(before.ok && before.value.budgetCategories[0].life_category_id, null);
});

// ── The automatic life area ─────────────────────────────────────────────────

test('planAutoLifeTags adds the category\'s life area, moves automatic tags, and never touches a person\'s tags', () => {
  const map = new Map([[GROCERIES, HEALTH], [GAS, TRAVEL]]);
  const plan = planAutoLifeTags(
    [
      { id: 'a', category_id: GROCERIES }, // no tags yet
      { id: 'b', category_id: GROCERIES }, // already has Health by hand
      { id: 'c', category_id: GAS }, // category changed from Groceries to Gas
      { id: 'd', category_id: null }, // category cleared
      { id: 'e', category_id: DINING }, // category without a life area
    ],
    map,
    [
      { id: 't1', entity_id: 'b', life_category_id: HEALTH, auto_source: null },
      { id: 't2', entity_id: 'c', life_category_id: HEALTH, auto_source: AUTO_SOURCE },
      { id: 't3', entity_id: 'c', life_category_id: HOME, auto_source: null },
      { id: 't4', entity_id: 'd', life_category_id: HEALTH, auto_source: AUTO_SOURCE },
      { id: 't5', entity_id: 'd', life_category_id: TRAVEL, auto_source: null },
      { id: 't6', entity_id: 'e', life_category_id: HOME },
    ],
  );
  assert.deepEqual(plan.insert, [
    { entity_id: 'a', life_category_id: HEALTH },
    { entity_id: 'c', life_category_id: TRAVEL },
  ]);
  assert.deepEqual(plan.remove, ['t2', 't4']);
});

test('syncAutoLifeAreas writes automatic tags for own transactions only and keeps hand tags', async () => {
  const db = seededDb();
  db.rows('budget_categories').find((c) => c.id === GROCERIES)!.life_category_id = HEALTH;
  db.seed('financial_transactions', [tx(1, ME, GROCERIES), tx(2, ME, GAS), tx(3, THEM, THEIR_CAT), tx(4, ME, null)]);
  db.seed('entity_life_categories', [
    { user_id: ME, life_category_id: HOME, entity_type: 'transaction', entity_id: uid(102), auto_source: null },
    { user_id: ME, life_category_id: HEALTH, entity_type: 'transaction', entity_id: uid(104), auto_source: AUTO_SOURCE },
  ]);
  const result = await syncAutoLifeAreas(asDb(db), ME, [uid(101), uid(102), uid(103), uid(104)]);
  assert.deepEqual(result, { ready: true, inserted: 2, removed: 1 });
  assert.deepEqual(tagsOf(db, uid(101)), [[HEALTH, AUTO_SOURCE]]);
  assert.deepEqual(tagsOf(db, uid(102)), [[HOME, null], [TRAVEL, AUTO_SOURCE]]);
  assert.deepEqual(tagsOf(db, uid(103)), []); // someone else's transaction
  assert.deepEqual(tagsOf(db, uid(104)), []); // category cleared: its automatic tag went
  assert.ok(db.rows('entity_life_categories').every((row) => row.user_id === ME));

  // Running it again changes nothing.
  const writesBefore = db.writes().length;
  assert.deepEqual(await syncAutoLifeAreas(asDb(db), ME, [uid(101), uid(102)]), { ready: true, inserted: 0, removed: 0 });
  assert.equal(db.writes().length, writesBefore);
});

test('syncAutoLifeAreas changes nothing before migration 223', async () => {
  const db = seededDb();
  db.missingColumns = { budget_categories: ['life_category_id'], entity_life_categories: ['auto_source'] };
  db.seed('financial_transactions', [tx(1, ME, GAS)]);
  const result = await syncAutoLifeAreas(asDb(db), ME, [uid(101)]);
  assert.equal(result.ready, false);
  assert.deepEqual(db.writes(), []);
});

test('syncAutoLifeAreasForBatch syncs the rows of one import', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [
    tx(1, ME, GAS, { import_batch_id: 'batch-1' }),
    tx(2, ME, GAS, { import_batch_id: 'batch-2' }),
  ]);
  const result = await syncAutoLifeAreasForBatch(asDb(db), ME, 'batch-1');
  assert.equal(result.inserted, 1);
  assert.deepEqual(tagsOf(db, uid(101)), [[TRAVEL, AUTO_SOURCE]]);
  assert.deepEqual(tagsOf(db, uid(102)), []);
});

test('markTagsManual makes an automatic tag the person\'s own, so a category change keeps it', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [tx(1, ME, GAS)]);
  await syncAutoLifeAreas(asDb(db), ME, [uid(101)]);
  assert.deepEqual(tagsOf(db, uid(101)), [[TRAVEL, AUTO_SOURCE]]);
  await markTagsManual(asDb(db), ME, TRAVEL, 'transaction', [uid(101)]);
  assert.deepEqual(tagsOf(db, uid(101)), [[TRAVEL, null]]);
  // The category moves away from Travel: the tag stays, because the person chose it.
  db.rows('financial_transactions')[0].category_id = DINING;
  await syncAutoLifeAreas(asDb(db), ME, [uid(101)]);
  assert.deepEqual(tagsOf(db, uid(101)), [[TRAVEL, null]]);
});

// ── Budgets are unaffected ──────────────────────────────────────────────────

test('budgets: placing categories under life areas changes no budget number', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [
    tx(1, ME, GROCERIES, { transaction_date: '2026-06-10' }),
    tx(2, ME, GROCERIES, { transaction_date: '2026-09-10' }),
    tx(3, ME, DINING, { transaction_date: '2026-10-02' }),
    tx(4, ME, null, { transaction_date: '2026-10-03' }),
  ]);
  db.missingTables = ['budget_periods'];
  const options = { month: '2026-10', window: 6 as const, method: 'average' as const, currentMonth: '2026-10' };
  const before = await loadBudgetReport(asDb(db), ME, options);
  const transactionsBefore = JSON.stringify(db.rows('financial_transactions'));

  assert.equal((await placeBudgetCategory(asDb(db), ME, GROCERIES, HEALTH)).ok, true);
  assert.equal((await placeBudgetCategory(asDb(db), ME, DINING, HOME)).ok, true);

  const after = await loadBudgetReport(asDb(db), ME, options);
  assert.equal(before.error, null);
  assert.deepEqual(after, before);
  // Placing writes tags, never the transactions themselves.
  assert.equal(JSON.stringify(db.rows('financial_transactions')), transactionsBefore);
});

// ── Analytics roll-up ───────────────────────────────────────────────────────

test('rollUpLifeAreas counts each transaction once per life area, from its category and its tags', () => {
  const totals = rollUpLifeAreas({
    lifeAreaIds: [HEALTH, HOME, TRAVEL],
    otherTags: [
      { life_category_id: HEALTH, entity_type: 'workout', entity_id: 'w1' },
      { life_category_id: HEALTH, entity_type: 'workout', entity_id: 'w1' }, // duplicate row
      { life_category_id: HOME, entity_type: 'task', entity_id: 'k1' },
      { life_category_id: THEIR_AREA, entity_type: 'task', entity_id: 'k2' }, // not one of the person's areas
    ],
    transactions: [
      { id: 'a', category_id: GROCERIES, type: 'expense', amount: 100 }, // Health from its category only
      { id: 'b', category_id: GROCERIES, type: 'expense', amount: 50 }, // Health from category AND an auto tag
      { id: 'c', category_id: GAS, type: 'expense', amount: 30 }, // Travel from category, Home tagged by hand
      { id: 'd', category_id: GROCERIES, type: 'income', amount: 20 }, // a refund lowers Health
      { id: 'e', category_id: null, type: 'expense', amount: 999 }, // nowhere
    ],
    transactionTags: [
      { life_category_id: HEALTH, entity_id: 'b' },
      { life_category_id: HOME, entity_id: 'c' },
    ],
    lifeAreaByCategory: new Map([[GROCERIES, HEALTH], [GAS, TRAVEL]]),
  });
  assert.deepEqual(totals.get(HEALTH), {
    entity_count: 4,
    spending: 130,
    entity_breakdown: { workout: 1, transaction: 3 },
    from_budget_category: 2,
  });
  assert.deepEqual(totals.get(HOME), { entity_count: 2, spending: 30, entity_breakdown: { task: 1, transaction: 1 }, from_budget_category: 0 });
  assert.deepEqual(totals.get(TRAVEL), { entity_count: 1, spending: 30, entity_breakdown: { transaction: 1 }, from_budget_category: 1 });
  assert.equal(totals.has(THEIR_AREA), false);
});

// ── Merging ─────────────────────────────────────────────────────────────────

test('mergeBudgetCategories moves everything that used the old category, then deletes it', async () => {
  const db = seededDb();
  const TEMPLATE = uid(40);
  db.seed('financial_transactions', [tx(1, ME, DINING), tx(2, ME, DINING), tx(3, THEM, THEIR_CAT)]);
  db.seed('user_contacts', [
    { id: uid(50), user_id: ME, name: 'Chipotle', default_category_id: DINING },
    { id: uid(51), user_id: THEM, name: 'Theirs', default_category_id: THEIR_CAT },
  ]);
  db.seed('schedule_templates', [{ id: TEMPLATE, user_id: ME }]);
  db.seed('schedule_template_finance', [{ id: uid(41), template_id: TEMPLATE, pay_category_id: DINING, per_diem_category_id: null, travel_category_id: null }]);
  db.missingTables = ['cash_counts'];

  const result = await mergeBudgetCategories(asDb(db), ME, DINING, GAS);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.transactions, 2);
  assert.deepEqual(result.value.moved, {
    'financial_transactions.category_id': 2,
    'user_contacts.default_category_id': 1,
    'schedule_template_finance.pay_category_id': 1,
  });
  assert.deepEqual(db.rows('financial_transactions').map((row) => row.category_id), [GAS, GAS, THEIR_CAT]);
  assert.equal(db.rows('budget_categories').some((c) => c.id === DINING), false);
  // Moved transactions now follow Gas's life area.
  assert.deepEqual(tagsOf(db, uid(101)), [[TRAVEL, AUTO_SOURCE]]);
  assert.equal(db.rows('user_contacts').find((c) => c.id === uid(51))?.default_category_id, THEIR_CAT);
});

test('mergeBudgetCategories refuses a category that is not the caller\'s, and the same category twice', async () => {
  const db = seededDb();
  const foreign = await mergeBudgetCategories(asDb(db), ME, THEIR_CAT, GAS);
  assert.equal(foreign.ok ? null : foreign.status, 404);
  const same = await mergeBudgetCategories(asDb(db), ME, GAS, GAS);
  assert.equal(same.ok ? null : same.status, 400);
  assert.equal(db.rows('budget_categories').length, 4);
});

test('mergeLifeAreas moves budget categories and tags, keeps hand tags as the person\'s, deletes the old area', async () => {
  const db = seededDb();
  db.seed('entity_life_categories', [
    { user_id: ME, life_category_id: TRAVEL, entity_type: 'transaction', entity_id: uid(101), auto_source: AUTO_SOURCE },
    { user_id: ME, life_category_id: TRAVEL, entity_type: 'trip', entity_id: uid(60), auto_source: null },
    // Home already has an automatic tag for this trip: the hand tag from Travel must stay the person's.
    { user_id: ME, life_category_id: HOME, entity_type: 'trip', entity_id: uid(60), auto_source: AUTO_SOURCE },
  ]);
  const result = await mergeLifeAreas(asDb(db), ME, TRAVEL, HOME);
  assert.deepEqual(result, { ok: true, value: { budgetCategories: 1, tags: 2 } });
  assert.equal(db.rows('budget_categories').find((c) => c.id === GAS)?.life_category_id, HOME);
  assert.equal(db.rows('life_categories').some((a) => a.id === TRAVEL), false);
  const homeTags = db.rows('entity_life_categories').filter((t) => t.life_category_id === HOME);
  assert.deepEqual(homeTags.map((t) => [t.entity_type, t.auto_source]).sort(), [['transaction', AUTO_SOURCE], ['trip', null]]);
  const refused = await mergeLifeAreas(asDb(db), ME, THEIR_AREA, HOME);
  assert.equal(refused.ok ? null : refused.status, 404);
});
