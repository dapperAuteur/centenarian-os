// lib/pain/server.ts
// Database reads and writes for pain entries (app/api/engine/pain-entries/*).
//
// Callers pass the RLS session client and the signed-in user's id; every query is also
// scoped with `.eq('user_id', userId)`, so another person's entry reads as "not found".
// The rules (checking input, the day summary) live in ./logic.ts.
//
// ONE PLACE KEEPS daily_logs IN STEP
//   Every write here ends with recomputeDaySummary() for each day it touched (both days
//   when an edit moves an entry to another date). It rewrites that day's
//   daily_logs.pain_* columns from the day's entries, so the correlation engine, the
//   daily_aggregates view, AI reports, Coaching Gems and charts keep reading daily_logs
//   unchanged. Nothing else writes those columns once migration 222 is applied.
//
// BEFORE MIGRATION 222 (no pain_entries table)
//   Writes fall back to the old behavior: one pain record per day on daily_logs, a new save
//   replacing that day's earlier one. Listing reads daily_logs and presents each day as one
//   entry whose id is "day-<daily_logs id>", so the history page can still edit and clear
//   it. Every answer carries ready: false and NOT_READY_NOTICE for the screen.
//
// Imports only sibling files with .ts extensions (and types), so the tests run it against
// the in-memory fake (tests/unit/pain-entries.test.ts).

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PainRuleError,
  backfillTime,
  isEmptySummary,
  isUuid,
  jsonList,
  summarizeDay,
} from './logic.ts';
import type { DaySummary, PainEntry, PainEntryInput } from './logic.ts';

export { PainRuleError };

export const NOT_READY_NOTICE =
  'Run migration 222 first (supabase/migrations/222_pain_entries.sql). Until then the pain log keeps one entry per day, and saving again replaces that day\'s entry.';

export const ENTRY_SELECT =
  'id, occurred_at, local_date, intensity, locations, sensations, activities, notes, source, created_at, updated_at';

/** History pages hold this many entries per request. */
export const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
/** The chart and the legacy list read at most this many days. */
const DAY_LIMIT = 400;
const LEGACY_PREFIX = 'day-';

interface DbErrorLike {
  code?: string | null;
  message?: string | null;
}

/** Postgres (42P01) or PostgREST (PGRST205) saying pain_entries does not exist yet. */
export function isPainTableMissing(error: DbErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.code !== '42P01' && error.code !== 'PGRST205') return false;
  return (error.message ?? '').includes('pain_entries');
}

/** One returned row, whether the client handed back an object or a one-row array. */
function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null;
  return (data as T | null) ?? null;
}

function fail(error: DbErrorLike, what: string): never {
  throw new Error(`${what}: ${error.message ?? 'database error'}`);
}

export interface DayState {
  date: string;
  /** The day's daily_logs row (photos, audio, links and life categories attach to it). */
  daily_log_id: string | null;
  summary: DaySummary;
}

/**
 * Rewrites one day's daily_logs.pain_* from that day's entries (rules: logic.ts
 * summarizeDay). Creates the daily_logs row when the day has entries and no row yet; never
 * creates one just to store an empty summary, and never deletes one (it may hold debrief
 * data, photos or links).
 */
export async function recomputeDaySummary(db: SupabaseClient, userId: string, date: string): Promise<DayState> {
  const { data: entries, error } = await db
    .from('pain_entries')
    .select('id, occurred_at, intensity, locations, sensations, activities, notes, created_at')
    .eq('user_id', userId)
    .eq('local_date', date);
  if (error) fail(error, 'Could not read the day\'s pain entries');
  const summary = summarizeDay((entries ?? []) as PainEntry[]);
  return writeDaySummary(db, userId, date, summary);
}

async function writeDaySummary(db: SupabaseClient, userId: string, date: string, summary: DaySummary): Promise<DayState> {
  const { data: existing, error: readError } = await db
    .from('daily_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (readError) fail(readError, 'Could not read the daily log');

  if (existing) {
    const id = (existing as { id: string }).id;
    const { error: updateError } = await db.from('daily_logs').update(summary).eq('id', id).eq('user_id', userId);
    if (updateError) fail(updateError, 'Could not update the daily log');
    return { date, daily_log_id: id, summary };
  }

  if (isEmptySummary(summary)) return { date, daily_log_id: null, summary };

  const { data: created, error: insertError } = await db
    .from('daily_logs')
    .insert({ user_id: userId, date, ...summary })
    .select('id')
    .maybeSingle();
  if (insertError) {
    // Another request created the day's row first (UNIQUE user_id, date): update that one.
    if (insertError.code === '23505') return writeDaySummary(db, userId, date, summary);
    fail(insertError, 'Could not create the daily log');
  }
  return { date, daily_log_id: firstRow<{ id: string }>(created)?.id ?? null, summary };
}

export interface ReadyResult<T> {
  ready: true;
  value: T;
}
export interface NotReadyResult<T> {
  ready: false;
  notice: string;
  value: T;
}
export type MaybeReady<T> = ReadyResult<T> | NotReadyResult<T>;

// ── Create ─────────────────────────────────────────────────────────────────

/**
 * Adds an entry and refreshes its day. `id` (optional, from the browser) makes an offline
 * replay safe: sending the same id twice returns the entry saved the first time.
 */
export async function createEntry(
  db: SupabaseClient,
  userId: string,
  input: PainEntryInput,
  id?: unknown,
): Promise<MaybeReady<{ entry: PainEntry | null; day: DayState }>> {
  if (id !== undefined && id !== null && !isUuid(id)) throw new PainRuleError('The entry id is not valid.');
  const row = { ...(id ? { id } : {}), user_id: userId, ...input, source: 'app' };
  const { data, error } = await db.from('pain_entries').insert(row).select(ENTRY_SELECT).maybeSingle();

  if (error) {
    if (isPainTableMissing(error)) {
      const day = await legacySaveDay(db, userId, input);
      return { ready: false, notice: NOT_READY_NOTICE, value: { entry: legacyEntry(day.log), day: day.state } };
    }
    if (error.code === '23505' && id) {
      const { data: saved, error: readError } = await db
        .from('pain_entries')
        .select(ENTRY_SELECT)
        .eq('id', id as string)
        .eq('user_id', userId)
        .maybeSingle();
      if (readError) fail(readError, 'Could not read the pain entry');
      if (!saved) throw new PainRuleError('That entry id is already in use.', 409);
      const entry = saved as PainEntry;
      const day = await recomputeDaySummary(db, userId, entry.local_date);
      return { ready: true, value: { entry, day } };
    }
    fail(error, 'Could not save the pain entry');
  }

  const entry = firstRow<PainEntry>(data);
  if (!entry) throw new Error('Could not save the pain entry: nothing came back.');
  const day = await recomputeDaySummary(db, userId, entry.local_date);
  return { ready: true, value: { entry, day } };
}

// ── Update and delete ──────────────────────────────────────────────────────

async function ownedEntry(db: SupabaseClient, userId: string, id: string): Promise<PainEntry | null> {
  const { data, error } = await db
    .from('pain_entries')
    .select(ENTRY_SELECT)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    if (isPainTableMissing(error)) return null;
    fail(error, 'Could not read the pain entry');
  }
  return (data as PainEntry | null) ?? null;
}

export function isLegacyId(id: string): boolean {
  return id.startsWith(LEGACY_PREFIX) && isUuid(id.slice(LEGACY_PREFIX.length));
}

/** Changes an entry; refreshes its day, and the day it moved from when the date changed. */
export async function updateEntry(
  db: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<PainEntryInput>,
): Promise<{ entry: PainEntry; days: DayState[] }> {
  if (isLegacyId(id)) return legacyUpdate(db, userId, id, patch);
  if (!isUuid(id)) throw new PainRuleError('Entry not found.', 404);
  const before = await ownedEntry(db, userId, id);
  if (!before) throw new PainRuleError('Entry not found.', 404);

  const { data, error } = await db
    .from('pain_entries')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select(ENTRY_SELECT);
  if (error) fail(error, 'Could not update the pain entry');
  const entry = ((data ?? []) as PainEntry[])[0];
  if (!entry) throw new PainRuleError('Entry not found.', 404);

  const days = [await recomputeDaySummary(db, userId, entry.local_date)];
  if (before.local_date !== entry.local_date) days.push(await recomputeDaySummary(db, userId, before.local_date));
  return { entry, days };
}

/** Deletes an entry and refreshes its day. */
export async function deleteEntry(db: SupabaseClient, userId: string, id: string): Promise<{ day: DayState }> {
  if (isLegacyId(id)) return legacyClear(db, userId, id);
  if (!isUuid(id)) throw new PainRuleError('Entry not found.', 404);
  const before = await ownedEntry(db, userId, id);
  if (!before) throw new PainRuleError('Entry not found.', 404);

  const { error } = await db.from('pain_entries').delete().eq('id', id).eq('user_id', userId);
  if (error) fail(error, 'Could not delete the pain entry');
  return { day: await recomputeDaySummary(db, userId, before.local_date) };
}

// ── Lists ──────────────────────────────────────────────────────────────────

export interface EntryFilters {
  from?: string | null;
  to?: string | null;
  minIntensity?: number | null;
  maxIntensity?: number | null;
  /** Match any of these locations (one location, or both sides of a pair). */
  locations?: string[] | null;
  /** Text to find in the notes. */
  q?: string | null;
  offset?: number;
  limit?: number;
}

export interface DayInfo {
  daily_log_id: string | null;
  /** daily_logs.pain_intensity: the day's highest, across all its entries. */
  pain_intensity: number | null;
}

export interface EntryPage {
  entries: PainEntry[];
  /** Summary of each day on this page, keyed by date. */
  days: Record<string, DayInfo>;
  has_more: boolean;
  next_offset: number | null;
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Entries newest first, with filters and offset paging. */
export async function listEntries(
  db: SupabaseClient,
  userId: string,
  filters: EntryFilters,
): Promise<MaybeReady<EntryPage>> {
  const offset = Math.max(0, Math.floor(filters.offset ?? 0));
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(filters.limit ?? PAGE_SIZE)));

  let query = db.from('pain_entries').select(ENTRY_SELECT).eq('user_id', userId);
  if (filters.from) query = query.gte('local_date', filters.from);
  if (filters.to) query = query.lte('local_date', filters.to);
  if (filters.minIntensity != null) query = query.gte('intensity', filters.minIntensity);
  if (filters.maxIntensity != null) query = query.lte('intensity', filters.maxIntensity);
  const locations = filters.locations?.filter(Boolean) ?? [];
  if (locations.length === 1) query = query.contains('locations', locations);
  else if (locations.length > 1) query = query.overlaps('locations', locations);
  const q = filters.q?.trim();
  if (q) query = query.ilike('notes', `%${escapeLike(q)}%`);

  const { data, error } = await query
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit);
  if (error) {
    if (isPainTableMissing(error)) {
      return { ready: false, notice: NOT_READY_NOTICE, value: await legacyList(db, userId, filters) };
    }
    fail(error, 'Could not load pain entries');
  }

  const rows = (data ?? []) as PainEntry[];
  const entries = rows.slice(0, limit);
  const has_more = rows.length > limit;
  const days = await dayInfo(db, userId, [...new Set(entries.map((e) => e.local_date))]);
  return { ready: true, value: { entries, days, has_more, next_offset: has_more ? offset + limit : null } };
}

async function dayInfo(db: SupabaseClient, userId: string, dates: string[]): Promise<Record<string, DayInfo>> {
  const out: Record<string, DayInfo> = {};
  if (dates.length === 0) return out;
  const { data, error } = await db
    .from('daily_logs')
    .select('id, date, pain_intensity')
    .eq('user_id', userId)
    .in('date', dates);
  if (error) fail(error, 'Could not read the daily logs');
  for (const row of (data ?? []) as { id: string; date: string; pain_intensity: number | null }[]) {
    out[row.date] = { daily_log_id: row.id, pain_intensity: row.pain_intensity };
  }
  for (const date of dates) out[date] ??= { daily_log_id: null, pain_intensity: null };
  return out;
}

export interface DayPoint {
  date: string;
  pain_intensity: number;
}

/** Daily summaries (daily_logs.pain_intensity) for the chart, oldest first. */
export async function listDayPoints(
  db: SupabaseClient,
  userId: string,
  range: { from?: string | null; to?: string | null },
): Promise<DayPoint[]> {
  let query = db
    .from('daily_logs')
    .select('date, pain_intensity')
    .eq('user_id', userId)
    .not('pain_intensity', 'is', null);
  if (range.from) query = query.gte('date', range.from);
  if (range.to) query = query.lte('date', range.to);
  const { data, error } = await query.order('date', { ascending: false }).limit(DAY_LIMIT);
  if (error) fail(error, 'Could not read the daily logs');
  return ((data ?? []) as DayPoint[]).reverse();
}

// ── Before migration 222 ───────────────────────────────────────────────────

interface LegacyLog {
  id: string;
  date: string;
  pain_intensity: number | null;
  pain_locations: unknown;
  pain_sensations: unknown;
  pain_activities: unknown;
  pain_notes: string | null;
}

const LEGACY_SELECT = 'id, date, pain_intensity, pain_locations, pain_sensations, pain_activities, pain_notes';

/** A daily_logs row shown as one entry (id "day-<daily_logs id>"). */
export function legacyEntry(log: LegacyLog | null): PainEntry | null {
  if (!log || log.pain_intensity == null) return null;
  return {
    id: `${LEGACY_PREFIX}${log.id}`,
    occurred_at: backfillTime(log.date),
    local_date: log.date,
    intensity: log.pain_intensity,
    locations: jsonList(log.pain_locations),
    sensations: jsonList(log.pain_sensations),
    activities: jsonList(log.pain_activities),
    notes: log.pain_notes,
    source: 'daily_log',
  };
}

function legacyColumns(input: Partial<PainEntryInput>): Partial<DaySummary> {
  const out: Partial<DaySummary> = {};
  if (input.intensity !== undefined) out.pain_intensity = Math.min(10, Math.max(1, input.intensity));
  if (input.locations !== undefined) out.pain_locations = input.locations.length ? input.locations : null;
  if (input.sensations !== undefined) out.pain_sensations = input.sensations.length ? input.sensations : null;
  if (input.activities !== undefined) out.pain_activities = input.activities.length ? input.activities : null;
  if (input.notes !== undefined) out.pain_notes = input.notes;
  return out;
}

/** The old save: the day's pain data on daily_logs, replacing what was there. */
async function legacySaveDay(
  db: SupabaseClient,
  userId: string,
  input: PainEntryInput,
): Promise<{ log: LegacyLog | null; state: DayState }> {
  const columns = legacyColumns(input) as DaySummary;
  const { error } = await db
    .from('daily_logs')
    .upsert({ user_id: userId, date: input.local_date, ...columns }, { onConflict: 'user_id,date' });
  if (error) fail(error, 'Could not save the pain log');
  const { data: log, error: readError } = await db
    .from('daily_logs')
    .select(LEGACY_SELECT)
    .eq('user_id', userId)
    .eq('date', input.local_date)
    .maybeSingle();
  if (readError) fail(readError, 'Could not read the daily log');
  const row = (log as LegacyLog | null) ?? null;
  return { log: row, state: { date: input.local_date, daily_log_id: row?.id ?? null, summary: columns } };
}

async function legacyRow(db: SupabaseClient, userId: string, id: string): Promise<LegacyLog> {
  const { data, error } = await db
    .from('daily_logs')
    .select(LEGACY_SELECT)
    .eq('id', id.slice(LEGACY_PREFIX.length))
    .eq('user_id', userId)
    .maybeSingle();
  if (error) fail(error, 'Could not read the daily log');
  if (!data) throw new PainRuleError('Entry not found.', 404);
  return data as LegacyLog;
}

async function legacyUpdate(
  db: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<PainEntryInput>,
): Promise<{ entry: PainEntry; days: DayState[] }> {
  const log = await legacyRow(db, userId, id);
  if (patch.local_date !== undefined && patch.local_date !== log.date) {
    throw new PainRuleError('Moving an entry to another day needs migration 222.', 409);
  }
  const columns = legacyColumns(patch);
  const { error } = await db.from('daily_logs').update(columns).eq('id', log.id).eq('user_id', userId);
  if (error) fail(error, 'Could not update the daily log');
  const next = { ...log, ...columns } as LegacyLog;
  const entry = legacyEntry(next) as PainEntry;
  const summary: DaySummary = {
    pain_intensity: next.pain_intensity,
    pain_locations: jsonList(next.pain_locations),
    pain_sensations: jsonList(next.pain_sensations),
    pain_activities: jsonList(next.pain_activities),
    pain_notes: next.pain_notes,
  };
  return { entry, days: [{ date: log.date, daily_log_id: log.id, summary }] };
}

async function legacyClear(db: SupabaseClient, userId: string, id: string): Promise<{ day: DayState }> {
  const log = await legacyRow(db, userId, id);
  const summary: DaySummary = {
    pain_intensity: null,
    pain_locations: null,
    pain_sensations: null,
    pain_activities: null,
    pain_notes: null,
  };
  const { error } = await db.from('daily_logs').update(summary).eq('id', log.id).eq('user_id', userId);
  if (error) fail(error, 'Could not clear the daily log');
  return { day: { date: log.date, daily_log_id: log.id, summary } };
}

/** The old history: one entry per day, newest first; location and notes filtered here. */
async function legacyList(db: SupabaseClient, userId: string, filters: EntryFilters): Promise<EntryPage> {
  let query = db
    .from('daily_logs')
    .select(LEGACY_SELECT)
    .eq('user_id', userId)
    .not('pain_intensity', 'is', null);
  if (filters.from) query = query.gte('date', filters.from);
  if (filters.to) query = query.lte('date', filters.to);
  if (filters.minIntensity != null) query = query.gte('pain_intensity', filters.minIntensity);
  if (filters.maxIntensity != null) query = query.lte('pain_intensity', filters.maxIntensity);
  const { data, error } = await query.order('date', { ascending: false }).limit(DAY_LIMIT);
  if (error) fail(error, 'Could not load the daily logs');

  const wanted = filters.locations?.filter(Boolean) ?? [];
  const q = filters.q?.trim().toLowerCase();
  const entries = ((data ?? []) as LegacyLog[])
    .map(legacyEntry)
    .filter((e): e is PainEntry => e !== null)
    .filter((e) => wanted.length === 0 || e.locations.some((loc) => wanted.includes(loc)))
    .filter((e) => !q || (e.notes ?? '').toLowerCase().includes(q));
  const days: Record<string, DayInfo> = {};
  for (const e of entries) days[e.local_date] = { daily_log_id: e.id.slice(LEGACY_PREFIX.length), pain_intensity: e.intensity };
  return { entries, days, has_more: false, next_offset: null };
}
