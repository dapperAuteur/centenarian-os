// lib/activity-links/ownership.ts
// Who may reference which record in an activity link.
//
// WHY THIS EXISTS
// /api/activity-links reads and writes with the service-role client, which
// bypasses RLS. Without a check here, a signed-in user could link to any id and
// then read that record's name back (task text, trip route, transaction vendor
// and amount, private recipe/blog/exercise titles). Every id that route touches
// goes through canReference() first.
//
// THE RULES
// The per-table rules (own row by user_id; tasks through milestone → goal →
// roadmap; the public-read types by their visibility rule) live in
// lib/auth/ownership.ts, shared with every other route that takes an id from
// the browser. This file maps a link's entity type to its table and applies
// that table's rule with public rows admitted: a link may point at a public
// exercise, equipment item, media item, recipe or blog post.
//   - trips and trip_routes have a visibility column (124) but NO public-read
//     policy (they are only ever shared by token), so they are owner-only.
//   - Any type not in the table is refused. That includes 'job' and 'schedule',
//     which the activity_links CHECK allows but this app never links.
//
// This file is pure apart from the injected row loader, so the rules are unit
// tested without a database (tests/unit/activity-link-ownership.test.ts). Keep
// it free of '@/' imports so node --test can load it.

import {
  TABLE_ACCESS_RULES,
  canAccessRow,
  isUuid,
  type AccessRow,
  type TableAccessRule,
} from '../auth/ownership.ts';

export type { AccessRow } from '../auth/ownership.ts';

export interface EntityAccessRule extends TableAccessRule {
  /** Table the entity lives in. */
  table: string;
}

/** Entity type (as stored in activity_links) → the table it lives in. */
const ENTITY_TABLES: Readonly<Record<string, string>> = {
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
};

export const ENTITY_ACCESS_RULES: Readonly<Record<string, EntityAccessRule>> = Object.fromEntries(
  Object.entries(ENTITY_TABLES).map(([type, table]) => [type, { table, ...TABLE_ACCESS_RULES[table] }]),
);

/** The rule for a type, or null. Uses an own-property check: `type` comes from the client. */
export function getEntityRule(type: unknown): EntityAccessRule | null {
  if (typeof type !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(ENTITY_ACCESS_RULES, type)
    ? ENTITY_ACCESS_RULES[type]
    : null;
}

/**
 * The whole rule, as a pure function: may `callerId` reference this row?
 * false for an unknown type, a missing row, and a row that is neither the
 * caller's nor public under its type's rule.
 */
export function canReference(
  type: unknown,
  row: AccessRow | null | undefined,
  callerId: string,
  now: Date = new Date(),
): boolean {
  const rule = getEntityRule(type);
  if (!rule) return false;
  return canAccessRow(rule.table, row, callerId, { allowPublic: true, now });
}

/** Loads one row by id. Injected so the route can use Supabase and tests can use a fake. */
export type FetchRow = (
  table: string,
  columns: string,
  id: string,
) => Promise<{ row: AccessRow | null; failed: boolean }>;

export interface ReferenceCheck {
  /** The caller may reference the record. */
  allowed: boolean;
  /** The lookup itself failed (answer 500, which says nothing about the id). */
  failed: boolean;
  /** The row (access + display columns) when allowed, otherwise null. */
  row: AccessRow | null;
}

const REFUSED: ReferenceCheck = { allowed: false, failed: false, row: null };

/**
 * Load a record and decide whether the caller may reference it. An unknown
 * type, a malformed id, a missing row and someone else's private row all come
 * back identically (`allowed: false`), so callers can answer 404 for each
 * without confirming that an id exists. `displayColumns` are fetched in the
 * same query and are only returned when access is allowed.
 */
export async function loadReferencedRow(
  fetchRow: FetchRow,
  type: unknown,
  id: unknown,
  callerId: string,
  displayColumns = '',
  now: Date = new Date(),
): Promise<ReferenceCheck> {
  const rule = getEntityRule(type);
  if (!rule || !isUuid(id)) return REFUSED;

  const columns = displayColumns ? `${rule.select}, ${displayColumns}` : rule.select;
  const { row, failed } = await fetchRow(rule.table, columns, id);
  if (failed) return { allowed: false, failed: true, row: null };
  if (!canReference(type, row, callerId, now)) return REFUSED;
  return { allowed: true, failed: false, row };
}
