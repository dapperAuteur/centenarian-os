// lib/auth/ownership.ts
// May the signed-in user reference this record?
//
// WHY THIS EXISTS
// Many API routes read and write with the service-role client, which bypasses
// RLS. A route that stores or follows an id sent by the browser (an account, a
// category, a milestone, a vehicle, an exercise...) must first check that the
// record belongs to the caller. Otherwise one user can write into another
// user's planner, or read another user's names and amounts back through a join.
// This file is the one place that check lives.
//
// THE RULE, PER TABLE (taken from the migrations, not guessed)
//   - Tables with a user_id column: the row's user_id must be the caller.
//   - milestones and tasks have no user_id. Ownership runs
//     task → milestone → goal → roadmap, and roadmaps.user_id must be the caller
//     (the RLS policies in the base schema).
//   - contact_locations has no user_id: it belongs to its user_contacts row (064).
//   - Tables with a public-read policy also admit a row that policy would show
//     the caller, but ONLY when the call site passes `allowPublic: true`:
//       exercises (117), equipment (126), media_items (125): public and active
//       workout_templates (117): visibility = 'public'
//       workout_categories (186): is_global
//       recipes (027/032): public, or scheduled and due
//       vehicles (129): is_system (the shared public-transport library)
//       contractor_jobs (105): is_public
//       blog_posts (024): public, members-only, or scheduled and due
//   - trips and trip_routes have a visibility column (124) but NO public-read
//     policy (they are only ever shared by token), so they are owner-only.
//   - A table that is not listed is refused. Add it here, with the migration
//     that proves the rule, before using it.
//
// HOW TO USE IT IN A ROUTE
//   - A reference inside a request body: checkReferences(), then answer 400
//     with invalidReferenceMessage(). The message names the field and nothing
//     else, so it never confirms that an id exists.
//   - The record the route is about (a path id): checkOwned(), then answer 404.
//     "Not yours" and "does not exist" get the same answer.
//   - A reference saved before these checks existed, used again later (a
//     schedule's milestone, a template's vehicle): usableReferences(), which
//     hands back null for anything the caller may not use.
//
// This file is pure apart from the injected database client, so the rules are
// unit tested without a database (tests/unit/ownership.test.ts). Keep it free
// of '@/' imports so node --test can load it.

/** A row as PostgREST returns it. */
export type AccessRow = Record<string, unknown>;

export interface TableAccessRule {
  /** PostgREST select for the columns ownerId/isPublic read. */
  select: string;
  /**
   * Column (or path through !inner embeds) holding the owner, when PostgREST
   * can filter on it. Used to put the owner check in the query itself.
   */
  ownerColumn?: string;
  /** The user who owns the row. null when it cannot be established. */
  ownerId: (row: AccessRow) => string | null;
  /** Only for tables with a public-read policy: may a signed-in non-owner see this row? */
  isPublic?: (row: AccessRow, now: Date) => boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a well-formed UUID string. Anything else never reaches the database. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** PostgREST returns a to-one embed as an object, but types (and some joins) give an array. */
function one(value: unknown): AccessRow | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v && typeof v === 'object' ? (v as AccessRow) : null;
}

function byUserId(row: AccessRow): string | null {
  return typeof row.user_id === 'string' && row.user_id ? row.user_id : null;
}

/** milestones → goals → roadmaps.user_id */
function milestoneOwner(row: AccessRow): string | null {
  const roadmap = one(one(row.goals)?.roadmaps);
  return roadmap ? byUserId(roadmap) : null;
}

/** tasks → milestones → goals → roadmaps.user_id */
function taskOwner(row: AccessRow): string | null {
  const milestone = one(row.milestones);
  return milestone ? milestoneOwner(milestone) : null;
}

/** contact_locations → user_contacts.user_id */
function contactLocationOwner(row: AccessRow): string | null {
  const contact = one(row.user_contacts);
  return contact ? byUserId(contact) : null;
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

const OWNER_ONLY: TableAccessRule = { select: 'user_id', ownerColumn: 'user_id', ownerId: byUserId };
const OWNER_OR_PUBLIC_ACTIVE: TableAccessRule = {
  select: 'user_id, visibility, is_active',
  ownerColumn: 'user_id',
  ownerId: byUserId,
  isPublic: publicAndActive,
};

export const TABLE_ACCESS_RULES: Readonly<Record<string, TableAccessRule>> = {
  // ── Planner: no user_id, ownership runs up to roadmaps.user_id ──
  milestones: {
    select: 'goals!inner(roadmaps!inner(user_id))',
    // The same filter app/api/tasks/route.ts uses.
    ownerColumn: 'goals.roadmaps.user_id',
    ownerId: milestoneOwner,
  },
  tasks: {
    select: 'milestones!inner(goals!inner(roadmaps!inner(user_id)))',
    // No ownerColumn: decided from the returned row.
    ownerId: taskOwner,
  },
  schedule_templates: OWNER_ONLY,
  focus_sessions: OWNER_ONLY,
  daily_logs: OWNER_ONLY,
  life_categories: OWNER_ONLY,

  // ── Finance ──
  financial_accounts: OWNER_ONLY,
  financial_transactions: OWNER_ONLY,
  budget_categories: OWNER_ONLY,
  user_brands: OWNER_ONLY,
  invoices: OWNER_ONLY,
  invoice_templates: OWNER_ONLY,
  contractor_jobs: {
    select: 'user_id, is_public',
    ownerColumn: 'user_id',
    ownerId: byUserId,
    // contractor_jobs_public_read (105): is_public. Linking a record to a job
    // stays owner-only unless a call site passes allowPublic.
    isPublic: (row) => row.is_public === true,
  },
  scan_images: OWNER_ONLY,

  // ── Contacts ──
  user_contacts: OWNER_ONLY,
  contact_locations: {
    select: 'user_contacts!inner(user_id)',
    ownerColumn: 'user_contacts.user_id',
    ownerId: contactLocationOwner,
  },

  // ── Travel ──
  vehicles: {
    select: 'user_id, is_system',
    ownerColumn: 'user_id',
    ownerId: byUserId,
    // vehicles_system_read (129): the seeded public-transport vehicles, user_id null
    isPublic: (row) => row.is_system === true,
  },
  trips: OWNER_ONLY,
  trip_routes: OWNER_ONLY,
  trip_templates: OWNER_ONLY,
  fuel_logs: OWNER_ONLY,
  vehicle_maintenance: OWNER_ONLY,

  // ── Workouts, exercises, equipment ──
  workout_logs: OWNER_ONLY,
  workout_templates: {
    select: 'user_id, visibility',
    ownerColumn: 'user_id',
    ownerId: byUserId,
    // workout_templates_public_read (117): visibility = 'public', no is_active column
    isPublic: (row) => row.visibility === 'public',
  },
  workout_categories: {
    select: 'user_id, is_global',
    ownerColumn: 'user_id',
    ownerId: byUserId,
    // workout_categories_select (186): own rows, or the seeded global ones
    isPublic: (row) => row.is_global === true,
  },
  exercises: OWNER_OR_PUBLIC_ACTIVE,
  exercise_categories: OWNER_ONLY,
  equipment: OWNER_OR_PUBLIC_ACTIVE,
  equipment_categories: OWNER_ONLY,

  // ── Fuel (meals) ──
  // meal_logs and protocols: user_id NOT NULL, policy "Users can CRUD their ..."
  // (auth.uid() = user_id) in the base schema (20251021155203_remote_schema.sql).
  meal_logs: OWNER_ONLY,
  protocols: OWNER_ONLY,

  // ── Media, recipes, blog ──
  media_items: OWNER_OR_PUBLIC_ACTIVE,
  podcast_episodes: OWNER_ONLY,
  recipes: {
    select: 'user_id, visibility, scheduled_at',
    ownerColumn: 'user_id',
    ownerId: byUserId,
    // recipes: 'public', or 'scheduled' and due (migration 032 removed the other values)
    isPublic: (row, now) => row.visibility === 'public' || scheduledAndDue(row, now),
  },
  blog_posts: {
    select: 'user_id, visibility, scheduled_at',
    ownerColumn: 'user_id',
    ownerId: byUserId,
    // The caller is always signed in, so the "Authenticated users can read
    // non-private posts" policy applies: public, authenticated_only, or
    // scheduled and due. Never draft or private.
    isPublic: (row, now) =>
      row.visibility === 'public'
      || row.visibility === 'authenticated_only'
      || scheduledAndDue(row, now),
  },
};

/** The rule for a table, or null. Uses an own-property check: never trust a name from the client. */
export function getTableRule(table: unknown): TableAccessRule | null {
  if (typeof table !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(TABLE_ACCESS_RULES, table)
    ? TABLE_ACCESS_RULES[table]
    : null;
}

export interface AccessOptions {
  /**
   * Also admit a row the table's public-read policy would show the caller.
   * Off by default: most references (accounts, categories, vehicles) must be
   * the caller's own. Ignored for tables with no public rule.
   */
  allowPublic?: boolean;
  /** The clock, for 'scheduled' rows. */
  now?: Date;
}

/**
 * The whole rule, as a pure function: may `userId` reference this row?
 * false for an unknown table, a missing row, no caller, and a row that is
 * neither the caller's nor (when allowed) public under its table's rule.
 */
export function canAccessRow(
  table: unknown,
  row: AccessRow | null | undefined,
  userId: string,
  options: AccessOptions = {},
): boolean {
  const rule = getTableRule(table);
  if (!rule || !row || !userId) return false;
  if (rule.ownerId(row) === userId) return true;
  if (!options.allowPublic || !rule.isPublic) return false;
  return rule.isPublic(row, options.now ?? new Date());
}

// ─── Database access ─────────────────────────────────────────────────────────

/** What a query resolves to. Matches Supabase's { data, error }. */
export interface OwnershipQueryResult {
  data: unknown;
  error: unknown;
}

/** The part of a PostgREST filter builder this file uses. */
export interface OwnershipQuery extends PromiseLike<OwnershipQueryResult> {
  in(column: string, values: readonly string[]): OwnershipQuery;
  eq(column: string, value: string): OwnershipQuery;
}

/** What `db.from(table)` must offer. */
interface OwnershipTable {
  select(columns: string): OwnershipQuery;
}

/**
 * The part of a Supabase client this file uses. Both the service-role client
 * and the RLS server client fit; tests pass a fake. `from` returns `any`
 * because the real builder's generics are too deep for TypeScript to compare
 * against a structural type (TS2589); the result is narrowed to OwnershipTable
 * at the one place it is used.
 */
export interface OwnershipDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

/** Ids per `in (...)` filter, keeping the request URL short. */
const ID_CHUNK = 100;

export interface OwnedIds {
  /** The ids the caller may reference, lower-cased. */
  ids: Set<string>;
  /** The lookup itself failed (answer 500, which says nothing about any id). */
  failed: boolean;
  /** Case-insensitive membership test. false for anything that is not a string. */
  has(id: unknown): boolean;
}

function ownedResult(ids: Set<string>, failed: boolean): OwnedIds {
  return { ids, failed, has: (id) => typeof id === 'string' && ids.has(id.toLowerCase()) };
}

/**
 * Of `ids`, the ones the caller may reference in `table`. Malformed ids are
 * dropped before any query, an unknown table yields nothing, and for tables
 * with a user_id (or an owner path) the owner filter is part of the query.
 */
export async function ownedIds(
  db: OwnershipDb,
  userId: string,
  table: string,
  ids: readonly unknown[],
  options: AccessOptions = {},
): Promise<OwnedIds> {
  const allowed = new Set<string>();
  const rule = getTableRule(table);
  const wanted = [...new Set(ids.filter(isUuid).map((id) => id.toLowerCase()))];
  if (!rule || !userId || wanted.length === 0) return ownedResult(allowed, false);

  const allowPublic = options.allowPublic === true && !!rule.isPublic;
  const now = options.now ?? new Date();

  for (let i = 0; i < wanted.length; i += ID_CHUNK) {
    const group = wanted.slice(i, i + ID_CHUNK);
    let query = (db.from(table) as OwnershipTable).select(`id, ${rule.select}`).in('id', group);
    // Owner-only lookups filter in the query. A lookup that may admit public
    // rows has to see them, so it is decided from the returned row instead.
    if (!allowPublic && rule.ownerColumn) query = query.eq(rule.ownerColumn, userId);

    const { data, error } = await query;
    if (error) return ownedResult(new Set(), true);

    for (const row of Array.isArray(data) ? (data as AccessRow[]) : []) {
      // Decided again from the row, so a filter PostgREST did not apply can
      // never admit someone else's record.
      if (typeof row.id === 'string' && canAccessRow(table, row, userId, { allowPublic, now })) {
        allowed.add(row.id.toLowerCase());
      }
    }
  }
  return ownedResult(allowed, false);
}

export interface OwnershipCheck {
  /** The caller may reference the record. */
  allowed: boolean;
  /** The lookup itself failed. */
  failed: boolean;
}

/**
 * May the caller reference this one record? An unknown table, a malformed id,
 * a missing row and someone else's row all come back identically
 * (`allowed: false`), so a route can answer 404 for each.
 */
export async function checkOwned(
  db: OwnershipDb,
  userId: string,
  table: string,
  id: unknown,
  options: AccessOptions = {},
): Promise<OwnershipCheck> {
  const owned = await ownedIds(db, userId, table, [id], options);
  return { allowed: owned.has(id), failed: owned.failed };
}

/** Thrown by assertOwned. `status` is the HTTP status to answer with. */
export class OwnershipError extends Error {
  readonly reason: 'not_found' | 'lookup_failed';
  readonly status: 404 | 500;

  constructor(reason: 'not_found' | 'lookup_failed') {
    super(reason === 'not_found' ? 'Not found' : 'Could not verify ownership');
    this.name = 'OwnershipError';
    this.reason = reason;
    this.status = reason === 'not_found' ? 404 : 500;
  }
}

/** checkOwned for code that prefers to throw. Resolves only when the caller may reference the record. */
export async function assertOwned(
  db: OwnershipDb,
  userId: string,
  table: string,
  id: unknown,
  options: AccessOptions = {},
): Promise<void> {
  const check = await checkOwned(db, userId, table, id, options);
  if (check.failed) throw new OwnershipError('lookup_failed');
  if (!check.allowed) throw new OwnershipError('not_found');
}

// ─── References inside a request body ────────────────────────────────────────

export interface Reference {
  /** The field name to report, e.g. 'account_id' or 'legs.vehicle_id'. */
  field: string;
  /** The table the id points into. */
  table: string;
  /** The id as the client sent it. null, undefined and '' mean "no reference". */
  id: unknown;
  /** Admit a publicly visible row too (see AccessOptions.allowPublic). */
  allowPublic?: boolean;
}

export interface ReferenceCheck {
  /** Nothing was refused and nothing failed. */
  ok: boolean;
  /** Fields whose id the caller may not reference, in the order given, each once. */
  invalid: string[];
  /** A lookup failed (answer 500). */
  failed: boolean;
}

const isBlank = (id: unknown): boolean => id === null || id === undefined || id === '';

/**
 * Check every foreign id a request carries, one query per table. A field is
 * invalid when its id is malformed, missing from the table, someone else's, or
 * the table has no rule. Blank ids are not references and are skipped.
 */
export async function checkReferences(
  db: OwnershipDb,
  userId: string,
  references: readonly Reference[],
  now: Date = new Date(),
): Promise<ReferenceCheck> {
  const given = references.filter((ref) => !isBlank(ref.id));
  const groups = new Map<string, { table: string; allowPublic: boolean; ids: unknown[] }>();
  for (const ref of given) {
    const allowPublic = ref.allowPublic === true;
    const key = `${ref.table}|${allowPublic}`;
    const group = groups.get(key) ?? { table: ref.table, allowPublic, ids: [] };
    group.ids.push(ref.id);
    groups.set(key, group);
  }

  const results = new Map<string, OwnedIds>();
  await Promise.all(
    [...groups].map(async ([key, group]) => {
      results.set(key, await ownedIds(db, userId, group.table, group.ids, { allowPublic: group.allowPublic, now }));
    }),
  );

  const failed = [...results.values()].some((result) => result.failed);
  const invalid: string[] = [];
  for (const ref of given) {
    const result = results.get(`${ref.table}|${ref.allowPublic === true}`);
    if (!result?.has(ref.id) && !invalid.includes(ref.field)) invalid.push(ref.field);
  }
  return { ok: !failed && invalid.length === 0, invalid: failed ? [] : invalid, failed };
}

/** A body field that holds a foreign id, and the table it points into. */
export interface ReferenceField {
  field: string;
  table: string;
  allowPublic?: boolean;
}

/**
 * The references `body` carries, for checkReferences(): one per field in
 * `fields` that the body actually has (blank values are skipped later by
 * checkReferences). `prefix` names nested fields in the 400 message, e.g.
 * 'items.' for line items.
 */
export function referencesIn(
  body: unknown,
  fields: readonly ReferenceField[],
  prefix = '',
): Reference[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  const record = body as Record<string, unknown>;
  return fields
    .filter(({ field }) => Object.prototype.hasOwnProperty.call(record, field))
    .map(({ field, table, allowPublic }) => ({ field: `${prefix}${field}`, table, id: record[field], allowPublic }));
}

/** The 400 message for refused references. Names the fields only. */
export function invalidReferenceMessage(fields: readonly string[]): string {
  return `Invalid reference: ${fields.join(', ')}`;
}

export interface UsableReferences {
  /** field → the id when the caller may reference it, otherwise null. */
  values: Record<string, string | null>;
  /** A lookup failed (answer 500, and use none of the values). */
  failed: boolean;
}

/**
 * For references that were saved earlier and are about to be used again: keep
 * the ones the caller may reference, null the rest. Use this where a row saved
 * before these checks existed could still point at someone else's record.
 */
export async function usableReferences(
  db: OwnershipDb,
  userId: string,
  references: readonly Reference[],
  now: Date = new Date(),
): Promise<UsableReferences> {
  const check = await checkReferences(db, userId, references, now);
  const values: Record<string, string | null> = {};
  for (const ref of references) {
    const usable = !check.failed && !isBlank(ref.id) && !check.invalid.includes(ref.field);
    values[ref.field] = usable ? (ref.id as string) : null;
  }
  return { values, failed: check.failed };
}

// ─── Embedded rows in a response ─────────────────────────────────────────────

/**
 * `row` with each embed in `keys` kept only when it belongs to `userId`, and
 * its user_id column removed. For service-role reads that join through a
 * stored foreign id (a recurring payment's account, an invoice's category):
 * an id saved before reference checks existed could otherwise show another
 * user's account or category name. Select `user_id` inside each embed.
 */
export function withOwnEmbeds<T extends Record<string, unknown>>(
  row: T,
  keys: readonly string[],
  userId: string,
): T {
  const out: Record<string, unknown> = { ...row };
  for (const key of keys) {
    const embed = one(out[key]);
    if (!embed || !userId || embed.user_id !== userId) {
      out[key] = null;
      continue;
    }
    const { user_id: _owner, ...rest } = embed;
    void _owner;
    out[key] = rest;
  }
  return out as T;
}

// ─── Fields a request body may never set ─────────────────────────────────────

/**
 * A copy of `body` without `fields`. For PATCH handlers that pass the rest of
 * the body to an update: the owner, server-maintained links (a trip's
 * transaction_id, a leg's route_id) and timestamps must never come from the
 * browser. Only own properties are copied, so nothing reaches the update via
 * the prototype.
 */
export function withoutFields(
  body: unknown,
  fields: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return out;
  const drop = new Set(fields);
  for (const key of Object.keys(body)) {
    if (!drop.has(key) && key !== '__proto__') out[key] = (body as Record<string, unknown>)[key];
  }
  return out;
}
