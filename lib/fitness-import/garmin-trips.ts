// lib/fitness-import/garmin-trips.ts
// Garmin Connect "Activities.csv" -> trips, without duplicates.
//
// What counts as the same activity (see activity-keys.ts):
//   already_imported   a trip with the same Garmin start-time key exists: its
//                      external_id (migration 224), or the start time inside
//                      an older garmin_activity_id ("<Date>|<Title>"), so a
//                      renamed activity is not imported again. Looked up by
//                      key over every date, so a trip whose date was edited
//                      since is still found.
//   duplicate_in_file  the file lists the same start time twice (Garmin can
//                      upload one recording twice); only the first counts.
//   possible_match     a trip that did not come from Garmin (manual, template,
//                      CSV) with the same mode that looks like the same outing
//                      (activity-keys.ts findLoggedTripMatch): distance within
//                      max(0.1 mi, 5%) or duration within 5 minutes, comparing
//                      a round trip both ways and a multi-stop route's legs
//                      added up; a same-day trip saved with no distance or
//                      time; or a close one a day either side (a template
//                      logged with the UTC date). Skipped by default, imported
//                      only when the person says so.
//   new                everything else.
// Rows that can't be read are `invalid`; activity types that aren't travel
// (strength, yoga, ...) are `unsupported`. Each is counted on its own.
//
// Reading, with paging (the old single read stopped at PostgREST's row cap):
// the keys of every Garmin trip already stored, whatever its date is now
// (rows imported before migration 224 have no external_id, so the unique
// index cannot catch them, and their date can be edited out of the file's
// range); and every trip from a day before the file's first date to a day
// after its last, for the possible-match check. With migration 224 the
// rows carry external_id and go in with ON CONFLICT (user_id, external_id) DO
// NOTHING, so two imports racing still can't add one activity twice. Before
// 224 is applied the import still works: it leaves external_id out and relies
// on the paged check. A chunk that fails is retried one row at a time, so one
// bad row no longer loses its 99 neighbours.
//
// Only this CentenarianOS route writes external_id; Work.WitUS's copy of the
// import (same shared trips table) never sets it and is unaffected.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  findLoggedTripMatch,
  garminStartKey,
  legacyGarminId,
  localDateOf,
  loggedTripCandidates,
  normalizeLocalStart,
  shiftDate,
  storedStartKey,
} from './activity-keys.ts';
import type { MatchBasis } from './activity-keys.ts';
import { FitnessImportError, chunk, dbErrorOf, fitnessDbFailure, isMissingColumn, isUniqueViolation, readAllRows } from './db.ts';
import type { PageResult } from './db.ts';

/** Activity types imported as trips (the rest are fitness, not travel). */
export const GARMIN_ACTIVITY_MAP: Record<string, { mode: string; purpose: string }> = {
  'Cycling': { mode: 'bike', purpose: 'exercise' },
  'Indoor Cycling': { mode: 'bike', purpose: 'exercise' },
  'Walking': { mode: 'walk', purpose: 'exercise' },
  'Running': { mode: 'run', purpose: 'exercise' },
  'Treadmill Running': { mode: 'run', purpose: 'exercise' },
  'Hiking': { mode: 'walk', purpose: 'leisure' },
};

/** Splits one CSV line: quoted fields may hold commas, and "" inside quotes is a quote. */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/** "1:02:03" or "45:12" (h:m:s or m:s as Garmin prints it) -> whole minutes. */
export function parseDurationMinutes(text: string | undefined): number | null {
  if (!text || text === '--') return null;
  const parts = text.split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 3) return parts[0] * 60 + parts[1] + Math.round(parts[2] / 60);
  if (parts.length === 2) return parts[0] + Math.round(parts[1] / 60);
  return null;
}

function parseNumber(text: string | undefined): number | null {
  if (!text || text === '--') return null;
  const n = parseFloat(text.replace(/,/g, ''));
  return Number.isNaN(n) ? null : n;
}

export interface GarminActivity {
  /** Spreadsheet line (header = 1). */
  line: number;
  activityType: string;
  mode: string;
  purpose: string;
  title: string;
  /** Local start, normalized ("2025-06-08 17:20:53"). */
  start: string;
  date: string;
  key: string;
  legacyId: string;
  distance_miles: number | null;
  duration_min: number | null;
  calories: number | null;
  avgHR: number | null;
  steps: number | null;
}

export interface InvalidActivity {
  line: number;
  reason: string;
}

export interface ParsedGarminCsv {
  activities: GarminActivity[];
  invalid: InvalidActivity[];
  unsupported: number;
}

/**
 * Reads a Garmin Connect Activities.csv. Throws FitnessImportError (400) when
 * the file is empty or lacks the Activity Type and Date columns.
 */
export function parseGarminActivitiesCsv(text: string): ParsedGarminCsv {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const firstLine = lines.findIndex((line) => line.trim() !== '');
  if (firstLine === -1 || lines.filter((line) => line.trim() !== '').length < 2) {
    throw new FitnessImportError(400, 'empty_file', 'This CSV has no activity rows.');
  }
  const header = splitCsvLine(lines[firstLine]);
  const column = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const idx = {
    type: column('Activity Type'),
    date: column('Date'),
    title: column('Title'),
    distance: column('Distance'),
    calories: column('Calories'),
    time: column('Total Time'),
    avgHR: column('Avg HR'),
    steps: column('Steps'),
  };
  if (idx.type === -1 || idx.date === -1) {
    throw new FitnessImportError(400, 'missing_columns', 'This CSV is missing the Activity Type and Date columns. Export it from Garmin Connect: Activities, All Activities, Export CSV.');
  }
  const cell = (row: string[], i: number) => (i === -1 ? undefined : row[i]);

  const activities: GarminActivity[] = [];
  const invalid: InvalidActivity[] = [];
  let unsupported = 0;
  for (let i = firstLine + 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const row = splitCsvLine(lines[i]);
    const line = i + 1;
    const activityType = cell(row, idx.type) ?? '';
    const mapped = GARMIN_ACTIVITY_MAP[activityType];
    if (!mapped) {
      unsupported += 1;
      continue;
    }
    const rawDate = cell(row, idx.date) ?? '';
    const start = normalizeLocalStart(rawDate);
    const key = garminStartKey(rawDate);
    if (!start || !key) {
      invalid.push({ line, reason: rawDate ? `unreadable date "${rawDate}"` : 'missing date' });
      continue;
    }
    const title = cell(row, idx.title) ?? '';
    const calories = parseNumber(cell(row, idx.calories));
    activities.push({
      line,
      activityType,
      mode: mapped.mode,
      purpose: mapped.purpose,
      title,
      start,
      date: localDateOf(start),
      key,
      legacyId: legacyGarminId(rawDate, title),
      distance_miles: parseNumber(cell(row, idx.distance)),
      duration_min: parseDurationMinutes(cell(row, idx.time)),
      calories: calories === null ? null : Math.round(calories),
      avgHR: parseNumber(cell(row, idx.avgHR)),
      steps: parseNumber(cell(row, idx.steps)),
    });
  }
  return { activities, invalid, unsupported };
}

export interface ExistingTrip {
  id: string;
  date: string;
  mode: string;
  distance_miles: number | string | null;
  duration_min: number | string | null;
  source: string | null;
  garmin_activity_id: string | null;
  external_id?: string | null;
  /** One-way distance and time stored; the trip is twice that. */
  is_round_trip?: boolean | null;
  /** A leg of a multi-stop route. */
  route_id?: string | null;
  leg_order?: number | null;
}

export type ActivityStatus = 'new' | 'already_imported' | 'duplicate_in_file' | 'possible_match';

export interface PlannedActivity extends GarminActivity {
  status: ActivityStatus;
  /** The existing trip a possible match points at (a route's first leg for a route total). */
  matchTripId: string | null;
  /** How it matched: as logged, a round trip both ways, a route's legs added up, or no distance or time to compare. */
  matchReason: MatchBasis | null;
  /** The matched trip's date (a day off when a template was logged with the UTC date). */
  matchDate: string | null;
}

export interface PlanContext {
  /**
   * Start keys of every Garmin trip already stored, on any date. `existing`
   * covers only the file's dates, and a trip's date can be edited since.
   */
  importedKeys?: Iterable<string>;
  /** Ids of the routes saved as round trips (trip_routes.is_round_trip). */
  roundTripRouteIds?: ReadonlySet<string>;
}

/** Sorts the file's activities against the trips already stored. Pure. */
export function planGarminActivities(
  activities: readonly GarminActivity[],
  existing: readonly ExistingTrip[],
  context: PlanContext = {},
): PlannedActivity[] {
  const imported = new Set<string>(context.importedKeys ?? []);
  const others: ExistingTrip[] = [];
  for (const trip of existing) {
    const key = storedStartKey(trip);
    if (key) imported.add(key);
    else if (trip.source !== 'garmin_import') others.push(trip);
  }
  const candidates = loggedTripCandidates(others, context.roundTripRouteIds);
  const none = { matchTripId: null, matchReason: null, matchDate: null };
  const seen = new Set<string>();
  return activities.map((activity): PlannedActivity => {
    if (imported.has(activity.key)) return { ...activity, status: 'already_imported', ...none };
    if (seen.has(activity.key)) return { ...activity, status: 'duplicate_in_file', ...none };
    seen.add(activity.key);
    const match = findLoggedTripMatch(activity, candidates);
    if (match) return { ...activity, status: 'possible_match', matchTripId: match.tripId, matchReason: match.basis, matchDate: match.date };
    return { ...activity, status: 'new', ...none };
  });
}

/** CO2 per mile for the modes Garmin brings in (all human-powered). */
const CO2_KG_PER_MILE: Record<string, number> = { bike: 0, walk: 0, run: 0 };

/** The trips row for one activity. external_id only once migration 224 is there. */
export function tripRow(userId: string, activity: GarminActivity, withExternalId: boolean): Record<string, unknown> {
  const notes: string[] = [];
  if (activity.title) notes.push(`Activity: ${activity.title}`);
  if (activity.avgHR) notes.push(`Avg HR: ${activity.avgHR} bpm`);
  if (activity.steps && activity.mode === 'walk') notes.push(`Steps: ${activity.steps}`);
  const distance = activity.distance_miles;
  return {
    user_id: userId,
    mode: activity.mode,
    date: activity.date,
    distance_miles: distance,
    duration_min: activity.duration_min,
    calories_burned: activity.calories,
    co2_kg: distance ? parseFloat(((CO2_KG_PER_MILE[activity.mode] ?? 0) * distance).toFixed(3)) : null,
    purpose: activity.purpose,
    garmin_activity_id: activity.legacyId,
    ...(withExternalId ? { external_id: activity.key } : {}),
    notes: notes.length > 0 ? notes.join(' | ') : null,
    source: 'garmin_import',
    trip_category: 'fitness',
    tax_category: 'personal',
  };
}

export interface GarminImportCounts {
  inserted: number;
  already_imported: number;
  duplicates_in_file: number;
  possible_matches: number;
  /** Possible matches imported anyway (includePossibleMatches). */
  possible_matches_imported: number;
  invalid: number;
  unsupported: number;
}

export interface GarminImportResult {
  dryRun: boolean;
  counts: GarminImportCounts;
  /** True when migration 224 is not applied yet (the import ran on the paged check alone). */
  needsMigration: boolean;
  activities: PlannedActivity[];
  invalid: InvalidActivity[];
  errors: string[];
}

export interface GarminImportOptions {
  userId: string;
  text: string;
  dryRun?: boolean;
  includePossibleMatches?: boolean;
}

/** Rows per insert request. */
export const TRIP_INSERT_CHUNK = 100;

// is_round_trip (064) and route_id / leg_order (065) are long-standing columns.
const TRIP_COLUMNS = 'id, date, mode, distance_miles, duration_min, source, garmin_activity_id, is_round_trip, route_id, leg_order';

/** Ids per `in` filter when reading routes. */
const ROUTE_ID_CHUNK = 100;

type ImportedTripRow = { id: string; garmin_activity_id: string | null; external_id?: string | null };

/**
 * The start keys of every Garmin trip the person already has, on any date:
 * rows with a garmin_activity_id (every Garmin import, Work.WitUS's too) or an
 * external_id. Small rows, read page by page. hasExternalId is false until
 * migration 224 is applied.
 */
async function loadImportedKeys(db: SupabaseClient, userId: string): Promise<{ keys: Set<string>; hasExternalId: boolean }> {
  const doing = 'read your imported Garmin trips';
  const keysOf = (rows: ImportedTripRow[]) =>
    new Set(rows.map((row) => storedStartKey(row)).filter((key): key is string => key !== null));
  try {
    const rows = await readAllRows<ImportedTripRow>(doing, (start, end) =>
      db
        .from('trips')
        .select('id, garmin_activity_id, external_id')
        .eq('user_id', userId)
        .or('garmin_activity_id.not.is.null,external_id.not.is.null')
        .order('id', { ascending: true })
        .range(start, end) as unknown as PageResult<ImportedTripRow>,
    );
    return { keys: keysOf(rows), hasExternalId: true };
  } catch (error) {
    if (!isMissingColumn(dbErrorOf(error), 'external_id')) throw error;
    const rows = await readAllRows<ImportedTripRow>(doing, (start, end) =>
      db
        .from('trips')
        .select('id, garmin_activity_id')
        .eq('user_id', userId)
        .not('garmin_activity_id', 'is', null)
        .order('id', { ascending: true })
        .range(start, end) as unknown as PageResult<ImportedTripRow>,
    );
    return { keys: keysOf(rows), hasExternalId: false };
  }
}

/** Every trip dated from..to, for the possible-match check. */
function loadTripsInRange(
  db: SupabaseClient,
  userId: string,
  from: string,
  to: string,
  hasExternalId: boolean,
): Promise<ExistingTrip[]> {
  const columns = hasExternalId ? `${TRIP_COLUMNS}, external_id` : TRIP_COLUMNS;
  return readAllRows<ExistingTrip>('read your trips in this date range', (start, end) =>
    db
      .from('trips')
      .select(columns)
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to)
      .order('id', { ascending: true })
      .range(start, end) as unknown as PageResult<ExistingTrip>,
  );
}

/**
 * The routes among `routeIds` saved as round trips. A template round trip
 * logged before return legs were saved has legs one way only, so its legs
 * are also compared doubled.
 */
async function loadRoundTripRoutes(db: SupabaseClient, userId: string, routeIds: readonly string[]): Promise<Set<string>> {
  const roundTrips = new Set<string>();
  for (const ids of chunk([...new Set(routeIds)], ROUTE_ID_CHUNK)) {
    const { data, error } = await db
      .from('trip_routes')
      .select('id, is_round_trip')
      .eq('user_id', userId)
      .in('id', ids);
    if (error) throw fitnessDbFailure(error, 'read your multi-stop routes');
    for (const route of (data ?? []) as { id: string; is_round_trip: boolean | null }[]) {
      if (route.is_round_trip === true) roundTrips.add(route.id);
    }
  }
  return roundTrips;
}

/** "3 new · 12 already imported · 1 listed twice in the file · 2 possible matches (skipped) · 1 unreadable row · 8 not travel". */
export function describeGarminCounts(counts: GarminImportCounts, dryRun: boolean): string {
  const parts = [`${counts.inserted} ${counts.inserted === 1 ? 'trip' : 'trips'} ${dryRun ? 'to add' : 'added'}`];
  if (counts.already_imported > 0) parts.push(`${counts.already_imported} already imported (skipped)`);
  if (counts.duplicates_in_file > 0) parts.push(`${counts.duplicates_in_file} listed twice in the file (skipped)`);
  if (counts.possible_matches > 0) {
    const skipped = counts.possible_matches - counts.possible_matches_imported;
    parts.push(
      counts.possible_matches_imported > 0
        ? `${counts.possible_matches} possible ${counts.possible_matches === 1 ? 'match' : 'matches'} with trips you logged (${counts.possible_matches_imported} ${dryRun ? 'to import' : 'imported'} anyway${skipped > 0 ? `, ${skipped} skipped` : ''})`
        : `${counts.possible_matches} possible ${counts.possible_matches === 1 ? 'match' : 'matches'} with trips you logged (skipped)`,
    );
  }
  if (counts.invalid > 0) parts.push(`${counts.invalid} unreadable ${counts.invalid === 1 ? 'row' : 'rows'}`);
  if (counts.unsupported > 0) parts.push(`${counts.unsupported} not travel activities`);
  return parts.join(' · ');
}

/**
 * Plans and (unless dryRun) imports a Garmin Activities.csv into trips.
 * `db` is the signed-in person's client: RLS scopes the rows to them.
 */
export async function importGarminActivities(db: SupabaseClient, options: GarminImportOptions): Promise<GarminImportResult> {
  const dryRun = options.dryRun === true;
  const parsed = parseGarminActivitiesCsv(options.text);
  const counts: GarminImportCounts = {
    inserted: 0,
    already_imported: 0,
    duplicates_in_file: 0,
    possible_matches: 0,
    possible_matches_imported: 0,
    invalid: parsed.invalid.length,
    unsupported: parsed.unsupported,
  };
  if (parsed.activities.length === 0) {
    return { dryRun, counts, needsMigration: false, activities: [], invalid: parsed.invalid, errors: [] };
  }

  // A day either side: a template trip logged with the UTC date can sit one
  // day off the activity's local date.
  const { keys: importedKeys, hasExternalId } = await loadImportedKeys(db, options.userId);
  const dates = parsed.activities.map((a) => a.date).sort();
  const trips = await loadTripsInRange(db, options.userId, shiftDate(dates[0], -1), shiftDate(dates[dates.length - 1], 1), hasExternalId);
  const routeIds = trips
    .filter((trip) => trip.route_id && trip.source !== 'garmin_import' && !storedStartKey(trip))
    .map((trip) => trip.route_id as string);
  const roundTripRouteIds = routeIds.length > 0 ? await loadRoundTripRoutes(db, options.userId, routeIds) : new Set<string>();
  const planned = planGarminActivities(parsed.activities, trips, { importedKeys, roundTripRouteIds });

  const toWrite: PlannedActivity[] = [];
  for (const activity of planned) {
    if (activity.status === 'already_imported') counts.already_imported += 1;
    else if (activity.status === 'duplicate_in_file') counts.duplicates_in_file += 1;
    else if (activity.status === 'possible_match') {
      counts.possible_matches += 1;
      if (options.includePossibleMatches) toWrite.push(activity);
    } else toWrite.push(activity);
  }

  const errors: string[] = [];
  if (dryRun) {
    for (const activity of toWrite) {
      if (activity.status === 'possible_match') counts.possible_matches_imported += 1;
      else counts.inserted += 1;
    }
    return { dryRun, counts, needsMigration: !hasExternalId, activities: planned, invalid: parsed.invalid, errors };
  }

  const recordWritten = (activity: PlannedActivity) => {
    if (activity.status === 'possible_match') counts.possible_matches_imported += 1;
    else counts.inserted += 1;
  };

  const insertOne = async (activity: PlannedActivity) => {
    const row = tripRow(options.userId, activity, hasExternalId);
    const { error } = await db.from('trips').insert(row);
    if (!error) {
      recordWritten(activity);
    } else if (isUniqueViolation(error)) {
      // Another import added it a moment ago.
      counts.already_imported += 1;
    } else {
      errors.push(`Line ${activity.line} (${activity.start}): ${error.message ?? 'could not be saved'}`);
    }
  };

  for (const part of chunk(toWrite, TRIP_INSERT_CHUNK)) {
    const rows = part.map((activity) => tripRow(options.userId, activity, hasExternalId));
    const request = hasExternalId
      ? db.from('trips').upsert(rows, { onConflict: 'user_id,external_id', ignoreDuplicates: true }).select('external_id')
      : db.from('trips').insert(rows).select('garmin_activity_id');
    const { data, error } = await request;
    if (error) {
      for (const activity of part) await insertOne(activity);
      continue;
    }
    if (hasExternalId) {
      // ON CONFLICT DO NOTHING returns only the rows it inserted.
      const added = new Set(((data ?? []) as { external_id: string | null }[]).map((row) => row.external_id));
      for (const activity of part) {
        if (added.has(activity.key)) recordWritten(activity);
        else counts.already_imported += 1;
      }
    } else {
      for (const activity of part) recordWritten(activity);
    }
  }

  return { dryRun, counts, needsMigration: !hasExternalId, activities: planned, invalid: parsed.invalid, errors };
}
