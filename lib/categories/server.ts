// lib/categories/server.ts
// Server helpers for the one category tree (plans/63 E, migration 223): read the tree, place a
// budget category under a life area, and merge two categories of the same level. Every helper
// takes the database client and the signed-in user's id; every id from the browser is checked
// with lib/auth/ownership.ts before it is used.
//
// Relative imports keep their ".ts" extension so this file loads under node --test
// (tests/unit/category-tree.test.ts).

import { checkReferences, invalidReferenceMessage, type OwnershipDb } from '../auth/ownership.ts';
import { isMissingColumn } from '../finance/transfers/schema.ts';
import {
  AUTO_SOURCE,
  markTagsManual,
  syncAutoLifeAreas,
  syncAutoLifeAreasForCategory,
  transactionIdsWhere,
} from './life-areas.ts';
import { suggestLifeArea, type BudgetCategoryRow, type LifeAreaRow, type LifeAreaSuggestion } from './tree.ts';

/** What every route answers when migration 223 is not applied yet. */
export const TREE_NOT_READY = {
  error:
    'Run migration 223 first: budget categories can only be placed under life areas once the database has that update. Nothing was changed.',
  code: 'category_tree_not_migrated',
} as const;

/** The life areas a new account starts with (also seeded by GET /api/life-categories). */
export const DEFAULT_LIFE_CATEGORIES = [
  { name: 'Health', icon: 'heart-pulse', color: '#ef4444', sort_order: 0 },
  { name: 'Finance', icon: 'dollar-sign', color: '#22c55e', sort_order: 1 },
  { name: 'Career', icon: 'briefcase', color: '#3b82f6', sort_order: 2 },
  { name: 'Home', icon: 'home', color: '#f59e0b', sort_order: 3 },
  { name: 'Fitness', icon: 'dumbbell', color: '#ec4899', sort_order: 4 },
  { name: 'Travel', icon: 'map-pin', color: '#06b6d4', sort_order: 5 },
  { name: 'Learning', icon: 'graduation-cap', color: '#8b5cf6', sort_order: 6 },
  { name: 'Social', icon: 'users', color: '#f97316', sort_order: 7 },
] as const;

interface DbError {
  code?: string | null;
  message?: string | null;
}

type Result<T> = { ok: true; value: T } | { ok: false; status: 400 | 404 | 409 | 500; error: string; code?: string };

const fail = (status: 400 | 404 | 409 | 500, error: string, code?: string) => ({ ok: false as const, status, error, code });

export interface TreeData {
  lifeAreas: LifeAreaRow[];
  budgetCategories: (BudgetCategoryRow & { life_category_id: string | null })[];
  /** False before migration 223. */
  ready: boolean;
  /** Unplaced budget category id -> a suggested life area (the person confirms it). */
  suggestions: Record<string, LifeAreaSuggestion>;
}

/**
 * Both levels of the tree for one user. `seed` adds the default life areas when the user has
 * none, as GET /api/life-categories always has. Before migration 223 every budget category
 * comes back with life_category_id null and ready: false.
 */
export async function loadCategoryTree(
  db: OwnershipDb,
  userId: string,
  options: { seed?: boolean } = {},
): Promise<Result<TreeData>> {
  const lifeRes = (await db
    .from('life_categories')
    .select('id, name, icon, color, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })) as { data: unknown; error: DbError | null };
  if (lifeRes.error) return fail(500, lifeRes.error.message ?? 'Could not read life categories');
  let lifeAreas = (lifeRes.data ?? []) as LifeAreaRow[];

  if (lifeAreas.length === 0 && options.seed) {
    const seeded = (await db
      .from('life_categories')
      .insert(DEFAULT_LIFE_CATEGORIES.map((area) => ({ user_id: userId, ...area })))
      .select('id, name, icon, color, sort_order')) as { data: unknown; error: DbError | null };
    // Another request may have seeded them a moment ago (unique user_id, name): read again.
    if (seeded.error) {
      const again = (await db
        .from('life_categories')
        .select('id, name, icon, color, sort_order')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })) as { data: unknown; error: DbError | null };
      if (again.error) return fail(500, again.error.message ?? 'Could not read life categories');
      lifeAreas = (again.data ?? []) as LifeAreaRow[];
    } else {
      lifeAreas = (seeded.data ?? []) as LifeAreaRow[];
    }
  }

  const columns = 'id, name, color, monthly_budget, sort_order';
  let ready = true;
  let budgetRes = (await db
    .from('budget_categories')
    .select(`${columns}, life_category_id`)
    .eq('user_id', userId)
    .order('sort_order')
    .order('name')) as { data: unknown; error: DbError | null };
  if (budgetRes.error && isMissingColumn(budgetRes.error, 'life_category_id')) {
    ready = false;
    budgetRes = (await db
      .from('budget_categories')
      .select(columns)
      .eq('user_id', userId)
      .order('sort_order')
      .order('name')) as { data: unknown; error: DbError | null };
  }
  if (budgetRes.error) return fail(500, budgetRes.error.message ?? 'Could not read budget categories');

  const own = new Set(lifeAreas.map((area) => area.id));
  const budgetCategories = ((budgetRes.data ?? []) as BudgetCategoryRow[]).map((category) => ({
    ...category,
    // A link to a life area that is not the user's is shown as no link.
    life_category_id: category.life_category_id && own.has(category.life_category_id) ? category.life_category_id : null,
  }));

  const suggestions: Record<string, LifeAreaSuggestion> = {};
  for (const category of budgetCategories) {
    if (category.life_category_id) continue;
    const suggestion = suggestLifeArea(category.name, lifeAreas);
    if (suggestion) suggestions[category.id] = suggestion;
  }

  return { ok: true, value: { lifeAreas, budgetCategories, ready, suggestions } };
}

/**
 * Checks a life_category_id from a request body: null/'' clears it, anything else must be one of
 * the user's life areas. Returns the value to store, or an error result.
 */
export async function checkLifeAreaReference(
  db: OwnershipDb,
  userId: string,
  lifeCategoryId: unknown,
): Promise<Result<string | null>> {
  if (lifeCategoryId === null || lifeCategoryId === undefined || lifeCategoryId === '') return { ok: true, value: null };
  const refs = await checkReferences(db, userId, [{ field: 'life_category_id', table: 'life_categories', id: lifeCategoryId }]);
  if (refs.failed) return fail(500, 'Could not verify the life area');
  if (!refs.ok) return fail(400, invalidReferenceMessage(refs.invalid));
  return { ok: true, value: lifeCategoryId as string };
}

export interface PlaceResult {
  category: Record<string, unknown>;
  /** Transactions in the category whose auto tags were brought in line. */
  transactions: number;
  tagsAdded: number;
  tagsRemoved: number;
}

/**
 * Puts one of the user's budget categories under one of their life areas (or under none), then
 * moves the auto life-area tags of that category's transactions along with it.
 */
export async function placeBudgetCategory(
  db: OwnershipDb,
  userId: string,
  categoryId: unknown,
  lifeCategoryId: unknown,
): Promise<Result<PlaceResult>> {
  const refs = await checkReferences(db, userId, [{ field: 'id', table: 'budget_categories', id: categoryId }]);
  if (refs.failed) return fail(500, 'Could not verify the category');
  if (!refs.ok) return fail(404, 'Category not found');
  const life = await checkLifeAreaReference(db, userId, lifeCategoryId);
  if (!life.ok) return life;

  const { data, error } = (await db
    .from('budget_categories')
    .update({ life_category_id: life.value })
    .eq('id', categoryId as string)
    .eq('user_id', userId)
    .select()
    .maybeSingle()) as { data: unknown; error: DbError | null };
  if (error) {
    if (isMissingColumn(error, 'life_category_id')) return fail(409, TREE_NOT_READY.error, TREE_NOT_READY.code);
    return fail(500, error.message ?? 'Could not save the category');
  }
  if (!data) return fail(404, 'Category not found');

  const sync = await syncAutoLifeAreasForCategory(db, userId, categoryId as string);
  return {
    ok: true,
    value: {
      category: data as Record<string, unknown>,
      transactions: sync.transactions,
      tagsAdded: sync.inserted,
      tagsRemoved: sync.removed,
    },
  };
}

// ── Merging ─────────────────────────────────────────────────────────────────────

/**
 * Every column that points at a budget category, by table, with the column that names the
 * owner (from the migrations: 051, 056, 058, 063/202, 079, 213, 215). schedule_template_finance
 * (151) has no user_id and is handled through the user's schedule templates. budget_periods
 * (208) is not moved: the category that is kept keeps its own budgets by month.
 */
export const BUDGET_CATEGORY_REFERENCES: readonly { table: string; column: string }[] = [
  { table: 'financial_transactions', column: 'category_id' },
  { table: 'invoices', column: 'category_id' },
  { table: 'invoice_templates', column: 'category_id' },
  { table: 'recurring_payments', column: 'category_id' },
  { table: 'user_contacts', column: 'default_category_id' },
  { table: 'cash_counts', column: 'category_id' },
  { table: 'insurance_policies', column: 'premium_category_id' },
];

const SCHEDULE_FINANCE_COLUMNS = ['pay_category_id', 'per_diem_category_id', 'travel_category_id'] as const;

/** A table or column that does not exist on this database yet: nothing there to move. */
function isMissingSchema(error: DbError | null | undefined): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703' || error.code === 'PGRST204';
}

export interface MergeResult {
  /** table.column -> rows moved (only tables where something moved). */
  moved: Record<string, number>;
  transactions: number;
}

/**
 * Moves everything that points at budget category `fromId` to `intoId`, then deletes `fromId`.
 * Both must be the user's. Transactions moved get their auto life-area tags re-synced.
 */
export async function mergeBudgetCategories(
  db: OwnershipDb,
  userId: string,
  fromId: unknown,
  intoId: unknown,
): Promise<Result<MergeResult>> {
  if (!fromId || !intoId || fromId === intoId) return fail(400, 'Choose two different categories to merge');
  const refs = await checkReferences(db, userId, [
    { field: 'from_id', table: 'budget_categories', id: fromId },
    { field: 'into_id', table: 'budget_categories', id: intoId },
  ]);
  if (refs.failed) return fail(500, 'Could not verify the categories');
  if (!refs.ok) return fail(404, 'Category not found');

  const from = fromId as string;
  const into = intoId as string;
  const { ids: movedTransactions, error: listError } = await transactionIdsWhere(db, userId, 'category_id', from);
  if (listError) return fail(500, listError);

  const moved: Record<string, number> = {};
  for (const { table, column } of BUDGET_CATEGORY_REFERENCES) {
    const { data, error } = (await db
      .from(table)
      .update({ [column]: into })
      .eq('user_id', userId)
      .eq(column, from)
      .select('id')) as { data: unknown; error: DbError | null };
    if (error) {
      if (isMissingSchema(error)) continue;
      return fail(500, `Could not move ${table}: ${error.message ?? 'unknown error'}`);
    }
    const count = Array.isArray(data) ? data.length : 0;
    if (count > 0) moved[`${table}.${column}`] = count;
  }

  // Schedule pay settings: owned through schedule_templates.user_id.
  const templates = (await db.from('schedule_templates').select('id').eq('user_id', userId)) as {
    data: unknown;
    error: DbError | null;
  };
  const templateIds = ((templates.data ?? []) as { id: string }[]).map((row) => row.id);
  if (!templates.error && templateIds.length > 0) {
    for (const column of SCHEDULE_FINANCE_COLUMNS) {
      const { data, error } = (await db
        .from('schedule_template_finance')
        .update({ [column]: into })
        .in('template_id', templateIds)
        .eq(column, from)
        .select('id')) as { data: unknown; error: DbError | null };
      if (error) {
        if (isMissingSchema(error)) continue;
        return fail(500, `Could not move schedule pay settings: ${error.message ?? 'unknown error'}`);
      }
      const count = Array.isArray(data) ? data.length : 0;
      if (count > 0) moved[`schedule_template_finance.${column}`] = count;
    }
  }

  const { error: deleteError } = (await db
    .from('budget_categories')
    .delete()
    .eq('id', from)
    .eq('user_id', userId)) as { error: DbError | null };
  if (deleteError) return fail(500, `Moved everything, but could not delete the old category: ${deleteError.message ?? ''}`);

  await syncAutoLifeAreas(db, userId, movedTransactions);
  return { ok: true, value: { moved, transactions: movedTransactions.length } };
}

/**
 * Moves life area `fromId` into `intoId`: its budget categories and its tags move over (a tag a
 * person added stays theirs), then `fromId` is deleted. Both must be the user's.
 */
export async function mergeLifeAreas(
  db: OwnershipDb,
  userId: string,
  fromId: unknown,
  intoId: unknown,
): Promise<Result<{ budgetCategories: number; tags: number }>> {
  if (!fromId || !intoId || fromId === intoId) return fail(400, 'Choose two different life areas to merge');
  const refs = await checkReferences(db, userId, [
    { field: 'from_id', table: 'life_categories', id: fromId },
    { field: 'into_id', table: 'life_categories', id: intoId },
  ]);
  if (refs.failed) return fail(500, 'Could not verify the life areas');
  if (!refs.ok) return fail(404, 'Life area not found');
  const from = fromId as string;
  const into = intoId as string;

  let budgetCategories = 0;
  const moveRes = (await db
    .from('budget_categories')
    .update({ life_category_id: into })
    .eq('user_id', userId)
    .eq('life_category_id', from)
    .select('id')) as { data: unknown; error: DbError | null };
  if (moveRes.error && !isMissingColumn(moveRes.error, 'life_category_id')) {
    return fail(500, moveRes.error.message ?? 'Could not move the budget categories');
  }
  budgetCategories = Array.isArray(moveRes.data) ? moveRes.data.length : 0;

  // Copy the tags (paged), keeping who added each one.
  let tags = 0;
  const manualByType = new Map<string, string[]>();
  for (let page = 0; page < 50; page++) {
    let tagRes = (await db
      .from('entity_life_categories')
      .select('entity_type, entity_id, auto_source')
      .eq('user_id', userId)
      .eq('life_category_id', from)
      .order('id')
      .range(page * 1000, page * 1000 + 999)) as { data: unknown; error: DbError | null };
    if (tagRes.error && isMissingColumn(tagRes.error, 'auto_source')) {
      tagRes = (await db
        .from('entity_life_categories')
        .select('entity_type, entity_id')
        .eq('user_id', userId)
        .eq('life_category_id', from)
        .order('id')
        .range(page * 1000, page * 1000 + 999)) as { data: unknown; error: DbError | null };
    }
    if (tagRes.error) return fail(500, tagRes.error.message ?? 'Could not read the tags');
    const rows = (tagRes.data ?? []) as { entity_type: string; entity_id: string; auto_source?: string | null }[];
    if (rows.length > 0) {
      const { error } = (await db.from('entity_life_categories').upsert(
        rows.map((row) => ({
          user_id: userId,
          life_category_id: into,
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          ...(row.auto_source !== undefined ? { auto_source: row.auto_source } : {}),
        })),
        { onConflict: 'user_id,life_category_id,entity_type,entity_id', ignoreDuplicates: true },
      )) as { error: DbError | null };
      if (error) return fail(500, error.message ?? 'Could not move the tags');
      tags += rows.length;
      for (const row of rows) {
        if (row.auto_source === AUTO_SOURCE) continue;
        const list = manualByType.get(row.entity_type) ?? [];
        list.push(row.entity_id);
        manualByType.set(row.entity_type, list);
      }
    }
    if (rows.length < 1000) break;
  }
  // A tag the person added under the old life area stays theirs under the new one.
  for (const [entityType, ids] of manualByType) {
    await markTagsManual(db, userId, into, entityType, ids);
  }

  const { error: deleteError } = (await db
    .from('life_categories')
    .delete()
    .eq('id', from)
    .eq('user_id', userId)) as { error: DbError | null };
  if (deleteError) return fail(500, `Moved everything, but could not delete the old life area: ${deleteError.message ?? ''}`);

  return { ok: true, value: { budgetCategories, tags } };
}
