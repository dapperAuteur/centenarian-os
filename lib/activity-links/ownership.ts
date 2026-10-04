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
// THE RULE, PER TYPE (taken from the migrations, not guessed)
//   - Tables with a user_id column: the row's user_id must be the caller.
//   - task: tasks has no user_id. Ownership runs milestone → goal → roadmap,
//     and roadmaps.user_id must be the caller (the tasks RLS policy, 001).
//   - Types with a public-read policy: the caller's own row, OR a row that
//     policy would show them. Those are exercise (117), equipment (126),
//     media_item (125), recipe (027/032) and blog_post (024).
//   - trips and trip_routes have a visibility column (124) but NO public-read
//     policy — they are only ever shared by token — so they are owner-only.
//   - Any type not in the table is refused. That includes 'job' and 'schedule',
//     which the activity_links CHECK allows but this app never links.
//
// This file is pure apart from the injected row loader, so the rules are unit
// tested without a database (tests/unit/activity-link-ownership.test.ts). Keep
// it free of '@/' imports so node --test can load it.

/** The columns fetched for an access decision (plus any display columns). */
export type AccessRow = Record<string, unknown>;

export interface EntityAccessRule {
  /** Table the entity lives in. */
  table: string;
  /** PostgREST select for the columns ownerId/isPublic read. */
  select: string;
  /** The user who owns the row. null when it cannot be established. */
  ownerId: (row: AccessRow) => string | null;
  /** Only for types with a public-read policy: may a signed-in non-owner see this row? */
  isPublic?: (row: AccessRow, now: Date) => boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PostgREST returns a to-one embed as an object, but types (and some joins) give an array. */
function one(value: unknown): AccessRow | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v && typeof v === 'object' ? (v as AccessRow) : null;
}

function byUserId(row: AccessRow): string | null {
  return typeof row.user_id === 'string' && row.user_id ? row.user_id : null;
}

/** tasks → milestones → goals → roadmaps.user_id */
function taskOwner(row: AccessRow): string | null {
  const roadmap = one(one(one(row.milestones)?.goals)?.roadmaps);
  return roadmap ? byUserId(roadmap) : null;
}

/** exercises_public_read / equipment_public_read / media_items_public_read */
function publicAndActive(row: AccessRow): boolean {
  return row.visibility === 'public' && row.is_active === true;
}

/** 'scheduled' rows become readable once scheduled_at has passed. */
function scheduledAndDue(row: AccessRow, now: Date): boolean {
  if (row.visibility !== 'scheduled' || typeof row.scheduled_at !== 'string') return false;
  const at = Date.parse(row.scheduled_at);
  return Number.isFinite(at) && at <= now.getTime();
}

const OWNER_ONLY = { select: 'user_id', ownerId: byUserId } as const;
const OWNER_OR_PUBLIC_ACTIVE = {
  select: 'user_id, visibility, is_active',
  ownerId: byUserId,
  isPublic: publicAndActive,
} as const;

export const ENTITY_ACCESS_RULES: Readonly<Record<string, EntityAccessRule>> = {
  task: {
    table: 'tasks',
    select: 'milestones!inner(goals!inner(roadmaps!inner(user_id)))',
    ownerId: taskOwner,
  },
  trip: { table: 'trips', ...OWNER_ONLY },
  route: { table: 'trip_routes', ...OWNER_ONLY },
  transaction: { table: 'financial_transactions', ...OWNER_ONLY },
  fuel_log: { table: 'fuel_logs', ...OWNER_ONLY },
  maintenance: { table: 'vehicle_maintenance', ...OWNER_ONLY },
  invoice: { table: 'invoices', ...OWNER_ONLY },
  workout: { table: 'workout_logs', ...OWNER_ONLY },
  focus_session: { table: 'focus_sessions', ...OWNER_ONLY },
  daily_log: { table: 'daily_logs', ...OWNER_ONLY },
  podcast_episode: { table: 'podcast_episodes', ...OWNER_ONLY },
  exercise: { table: 'exercises', ...OWNER_OR_PUBLIC_ACTIVE },
  equipment: { table: 'equipment', ...OWNER_OR_PUBLIC_ACTIVE },
  media_item: { table: 'media_items', ...OWNER_OR_PUBLIC_ACTIVE },
  recipe: {
    table: 'recipes',
    select: 'user_id, visibility, scheduled_at',
    ownerId: byUserId,
    // recipes: 'public', or 'scheduled' and due (migration 032 removed the other values)
    isPublic: (row, now) => row.visibility === 'public' || scheduledAndDue(row, now),
  },
  blog_post: {
    table: 'blog_posts',
    select: 'user_id, visibility, scheduled_at',
    ownerId: byUserId,
    // The caller of this API is always signed in, so the "Authenticated users
    // can read non-private posts" policy applies: public, authenticated_only,
    // or scheduled and due. Never draft or private.
    isPublic: (row, now) =>
      row.visibility === 'public'
      || row.visibility === 'authenticated_only'
      || scheduledAndDue(row, now),
  },
};

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
  if (!rule || !row || !callerId) return false;
  if (rule.ownerId(row) === callerId) return true;
  return rule.isPublic ? rule.isPublic(row, now) : false;
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
  if (!rule || typeof id !== 'string' || !UUID_RE.test(id)) return REFUSED;

  const columns = displayColumns ? `${rule.select}, ${displayColumns}` : rule.select;
  const { row, failed } = await fetchRow(rule.table, columns, id);
  if (failed) return { allowed: false, failed: true, row: null };
  if (!canReference(type, row, callerId, now)) return REFUSED;
  return { allowed: true, failed: false, row };
}
