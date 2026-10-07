// lib/categories/life-areas.ts
// A transaction's life area comes from its budget category's parent (one category tree,
// plans/63 E, migration 223). This file holds that rule.
//
// THE RULE
//   1. On read (analytics): a transaction counts toward the life area of its budget category,
//      plus any life area it is tagged with. Each transaction counts once per life area. Nothing
//      has to be written for this to be right, so transactions categorized before a budget
//      category was placed under a life area count straight away.
//   2. On save: when a transaction is saved with a budget category that sits under a life area,
//      the app also writes that tag to entity_life_categories, marked auto_source =
//      'budget_category', so everything that reads tags (the tag chips, the uncategorized list,
//      Work.WitUS's life analytics on the shared database) agrees. When the category changes,
//      auto tags for other life areas are removed.
//   3. A tag a person added (auto_source NULL, which is also every tag saved before migration
//      223 and every tag Work.WitUS writes) is never removed by the app. Tagging by hand a life
//      area the app had already tagged makes the tag the person's own (markTagsManual).
//
// Before migration 223 there is no life_category_id and no auto_source: everything here
// reports ready: false and changes nothing, so screens behave as they did.
//
// The db-facing functions never throw and never fail a save: they return what they did.
// Relative imports keep their ".ts" extension so this file loads under node --test.

import { isMissingColumn } from '../finance/transfers/schema.ts';

export const AUTO_SOURCE = 'budget_category';

/** Ids per `in (...)` filter, keeping request URLs short. */
const CHUNK = 200;
/** PostgREST's default page size. */
const PAGE = 1000;
/** Stop paging a category's transactions after this many rows. */
const MAX_ROWS = 50_000;

const TAG_CONFLICT = 'user_id,life_category_id,entity_type,entity_id';

/**
 * The part of a Supabase client this file uses. `from` returns `any` because the real builder's
 * generics are too deep to compare structurally (same reason as lib/auth/ownership.ts).
 */
export interface LifeAreaDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

interface DbError {
  code?: string | null;
  message?: string | null;
}

export interface ExistingTag {
  id: string;
  life_category_id: string;
  entity_id: string;
  auto_source?: string | null;
}

export interface TagPlan {
  /** Tags to add (auto). */
  insert: { entity_id: string; life_category_id: string }[];
  /** Ids of auto tags that no longer match the transaction's category. */
  remove: string[];
}

const isAuto = (tag: { auto_source?: string | null }) => tag.auto_source === AUTO_SOURCE;

/**
 * What to write so each transaction's auto tag matches its budget category's life area.
 * Manual tags (auto_source not 'budget_category') are never in `remove`, and a manual tag for
 * the right life area means nothing is inserted.
 */
export function planAutoLifeTags(
  transactions: readonly { id: string; category_id: string | null }[],
  lifeAreaByCategory: ReadonlyMap<string, string>,
  existing: readonly ExistingTag[],
): TagPlan {
  const tagsByTx = new Map<string, ExistingTag[]>();
  for (const tag of existing) {
    const list = tagsByTx.get(tag.entity_id) ?? [];
    list.push(tag);
    tagsByTx.set(tag.entity_id, list);
  }
  const plan: TagPlan = { insert: [], remove: [] };
  for (const tx of transactions) {
    const wanted = tx.category_id ? lifeAreaByCategory.get(tx.category_id) ?? null : null;
    const tags = tagsByTx.get(tx.id) ?? [];
    if (wanted && !tags.some((tag) => tag.life_category_id === wanted)) {
      plan.insert.push({ entity_id: tx.id, life_category_id: wanted });
    }
    for (const tag of tags) {
      if (isAuto(tag) && tag.life_category_id !== wanted) plan.remove.push(tag.id);
    }
  }
  return plan;
}

// ── Reading the tree's links ────────────────────────────────────────────────────

export interface LifeAreaMap {
  /** False before migration 223 (no life_category_id column). */
  ready: boolean;
  /** budget category id -> life area id, only for the user's own life areas. */
  map: Map<string, string>;
  error?: string;
}

/**
 * budget category -> life area for `userId`. With `categoryIds`, only those categories. A link
 * to a life area that is not the user's (which the API and migration 223's trigger refuse) is
 * ignored rather than trusted.
 */
export async function loadLifeAreaByCategory(
  db: LifeAreaDb,
  userId: string,
  categoryIds?: readonly string[],
): Promise<LifeAreaMap> {
  const map = new Map<string, string>();
  const rows: { id: string; life_category_id: string | null }[] = [];
  const groups = categoryIds ? chunk([...new Set(categoryIds)], CHUNK) : [null];
  if (categoryIds && categoryIds.length === 0) return { ready: true, map };

  for (const group of groups) {
    let query = db.from('budget_categories').select('id, life_category_id').eq('user_id', userId);
    if (group) query = query.in('id', group);
    const { data, error } = (await query) as { data: unknown; error: DbError | null };
    if (error) {
      if (isMissingColumn(error, 'life_category_id')) return { ready: false, map };
      return { ready: false, map, error: error.message ?? 'Could not read budget categories' };
    }
    rows.push(...((data ?? []) as { id: string; life_category_id: string | null }[]));
  }

  const linked = rows.filter((row) => row.life_category_id);
  if (linked.length === 0) return { ready: true, map };

  const { data: areas, error: areaError } = (await db
    .from('life_categories')
    .select('id')
    .eq('user_id', userId)) as { data: unknown; error: DbError | null };
  if (areaError) return { ready: false, map, error: areaError.message ?? 'Could not read life categories' };
  const own = new Set(((areas ?? []) as { id: string }[]).map((area) => area.id));
  for (const row of linked) {
    if (own.has(row.life_category_id as string)) map.set(row.id, row.life_category_id as string);
  }
  return { ready: true, map };
}

// ── Writing auto tags ───────────────────────────────────────────────────────────

export interface SyncResult {
  ready: boolean;
  inserted: number;
  removed: number;
  error?: string;
}

/**
 * Brings the auto life-area tags of these transactions in line with their budget categories.
 * Only the user's own transactions are touched. Never throws.
 */
export async function syncAutoLifeAreas(
  db: LifeAreaDb,
  userId: string,
  transactionIds: readonly string[],
): Promise<SyncResult> {
  const result: SyncResult = { ready: true, inserted: 0, removed: 0 };
  const ids = [...new Set(transactionIds.filter((id) => typeof id === 'string' && id))];
  if (ids.length === 0 || !userId) return result;

  try {
    let lifeAreas: Map<string, string> | null = null;
    for (const group of chunk(ids, CHUNK)) {
      const { data: txRows, error: txError } = (await db
        .from('financial_transactions')
        .select('id, category_id')
        .eq('user_id', userId)
        .in('id', group)) as { data: unknown; error: DbError | null };
      if (txError) return { ...result, error: txError.message ?? 'Could not read transactions' };
      const transactions = (txRows ?? []) as { id: string; category_id: string | null }[];
      if (transactions.length === 0) continue;

      if (!lifeAreas) {
        const loaded = await loadLifeAreaByCategory(db, userId);
        if (!loaded.ready) return { ...result, ready: false, error: loaded.error };
        lifeAreas = loaded.map;
      }

      const { data: tagRows, error: tagError } = (await db
        .from('entity_life_categories')
        .select('id, life_category_id, entity_id, auto_source')
        .eq('user_id', userId)
        .eq('entity_type', 'transaction')
        .in('entity_id', transactions.map((tx) => tx.id))) as { data: unknown; error: DbError | null };
      if (tagError) {
        if (isMissingColumn(tagError, 'auto_source')) return { ...result, ready: false };
        return { ...result, error: tagError.message ?? 'Could not read life-area tags' };
      }

      const plan = planAutoLifeTags(transactions, lifeAreas, (tagRows ?? []) as ExistingTag[]);
      if (plan.insert.length > 0) {
        const { error } = (await db.from('entity_life_categories').upsert(
          plan.insert.map((row) => ({
            user_id: userId,
            life_category_id: row.life_category_id,
            entity_type: 'transaction',
            entity_id: row.entity_id,
            auto_source: AUTO_SOURCE,
          })),
          { onConflict: TAG_CONFLICT, ignoreDuplicates: true },
        )) as { error: DbError | null };
        if (error) return { ...result, error: error.message ?? 'Could not save life-area tags' };
        result.inserted += plan.insert.length;
      }
      if (plan.remove.length > 0) {
        const { error } = (await db
          .from('entity_life_categories')
          .delete()
          .eq('user_id', userId)
          .eq('auto_source', AUTO_SOURCE)
          .in('id', plan.remove)) as { error: DbError | null };
        if (error) return { ...result, error: error.message ?? 'Could not remove life-area tags' };
        result.removed += plan.remove.length;
      }
    }
    return result;
  } catch (error) {
    return { ...result, error: error instanceof Error ? error.message : 'Could not sync life areas' };
  }
}

/** Ids of the user's transactions matching one column value, paged. */
export async function transactionIdsWhere(
  db: LifeAreaDb,
  userId: string,
  column: 'category_id' | 'import_batch_id',
  value: string,
): Promise<{ ids: string[]; error?: string }> {
  const ids: string[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = (await db
      .from('financial_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq(column, value)
      .order('id')
      .range(from, from + PAGE - 1)) as { data: unknown; error: DbError | null };
    if (error) return { ids, error: error.message ?? 'Could not read transactions' };
    const rows = (data ?? []) as { id: string }[];
    ids.push(...rows.map((row) => row.id));
    if (rows.length < PAGE) break;
  }
  return { ids };
}

/** Re-syncs every transaction in one budget category (after its life area changed). */
export async function syncAutoLifeAreasForCategory(
  db: LifeAreaDb,
  userId: string,
  categoryId: string,
): Promise<SyncResult & { transactions: number }> {
  const { ids, error } = await transactionIdsWhere(db, userId, 'category_id', categoryId);
  if (error) return { ready: true, inserted: 0, removed: 0, transactions: 0, error };
  return { ...(await syncAutoLifeAreas(db, userId, ids)), transactions: ids.length };
}

/** Syncs the rows of one statement import. */
export async function syncAutoLifeAreasForBatch(
  db: LifeAreaDb,
  userId: string,
  batchId: string | null | undefined,
): Promise<SyncResult> {
  if (!batchId) return { ready: true, inserted: 0, removed: 0 };
  const { ids, error } = await transactionIdsWhere(db, userId, 'import_batch_id', batchId);
  if (error) return { ready: true, inserted: 0, removed: 0, error };
  return syncAutoLifeAreas(db, userId, ids);
}

/**
 * A person tagged these entities with this life area by hand: any auto tag already there for it
 * becomes theirs (auto_source NULL), so a later category change never removes it. Before
 * migration 223 there is nothing to mark. Never throws.
 */
export async function markTagsManual(
  db: LifeAreaDb,
  userId: string,
  lifeCategoryId: string,
  entityType: string,
  entityIds: readonly string[],
): Promise<{ error?: string }> {
  try {
    for (const group of chunk([...new Set(entityIds)], CHUNK)) {
      const { error } = (await db
        .from('entity_life_categories')
        .update({ auto_source: null })
        .eq('user_id', userId)
        .eq('life_category_id', lifeCategoryId)
        .eq('entity_type', entityType)
        .eq('auto_source', AUTO_SOURCE)
        .in('entity_id', group)) as { error: DbError | null };
      if (error && !isMissingColumn(error, 'auto_source')) return { error: error.message ?? 'Could not update tags' };
      if (error) return {};
    }
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not update tags' };
  }
}

// ── Analytics roll-up ───────────────────────────────────────────────────────────

export interface RollUpTransaction {
  id: string;
  category_id: string | null;
  type: string;
  /** The amount in the home currency (0 when it could not be converted). */
  amount: number;
}

export interface LifeAreaTotals {
  /** Tagged items in the period plus transactions in the period, each counted once. */
  entity_count: number;
  /** Expenses minus income of the period's transactions in this life area. */
  spending: number;
  /** entity_type -> count. */
  entity_breakdown: Record<string, number>;
  /** How many of the period's transactions count here only through their budget category. */
  from_budget_category: number;
}

export interface RollUpInput {
  lifeAreaIds: readonly string[];
  /** Tags of everything that is not a transaction (the period is the caller's choice). */
  otherTags: readonly { life_category_id: string; entity_type: string; entity_id: string }[];
  /** The period's transactions, transfers already left out. */
  transactions: readonly RollUpTransaction[];
  /** Every tag on those transactions, whenever it was added. */
  transactionTags: readonly { life_category_id: string; entity_id: string }[];
  lifeAreaByCategory: ReadonlyMap<string, string>;
}

/**
 * Per life area: items, spending and the breakdown by kind. A transaction belongs to the life
 * area of its budget category and to every life area it is tagged with, once each, so an auto
 * tag and the category it came from are never counted twice.
 */
export function rollUpLifeAreas(input: RollUpInput): Map<string, LifeAreaTotals> {
  const totals = new Map<string, LifeAreaTotals>();
  for (const id of input.lifeAreaIds) {
    totals.set(id, { entity_count: 0, spending: 0, entity_breakdown: {}, from_budget_category: 0 });
  }
  const bump = (lifeId: string, entityType: string) => {
    const t = totals.get(lifeId);
    if (!t) return null;
    t.entity_count += 1;
    t.entity_breakdown[entityType] = (t.entity_breakdown[entityType] ?? 0) + 1;
    return t;
  };

  const seenOther = new Set<string>();
  for (const tag of input.otherTags) {
    if (tag.entity_type === 'transaction') continue;
    const key = `${tag.life_category_id}|${tag.entity_type}|${tag.entity_id}`;
    if (seenOther.has(key)) continue;
    seenOther.add(key);
    bump(tag.life_category_id, tag.entity_type);
  }

  const tagsByTx = new Map<string, Set<string>>();
  for (const tag of input.transactionTags) {
    const set = tagsByTx.get(tag.entity_id) ?? new Set<string>();
    set.add(tag.life_category_id);
    tagsByTx.set(tag.entity_id, set);
  }

  for (const tx of input.transactions) {
    const tagged = tagsByTx.get(tx.id) ?? new Set<string>();
    const fromCategory = tx.category_id ? input.lifeAreaByCategory.get(tx.category_id) ?? null : null;
    const areas = new Set(tagged);
    if (fromCategory) areas.add(fromCategory);
    const signed = tx.type === 'expense' ? tx.amount : -tx.amount;
    for (const lifeId of areas) {
      const t = bump(lifeId, 'transaction');
      if (!t) continue;
      t.spending += signed;
      if (lifeId === fromCategory && !tagged.has(lifeId)) t.from_budget_category += 1;
    }
  }

  for (const t of totals.values()) t.spending = Math.round(t.spending * 100) / 100;
  return totals;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
