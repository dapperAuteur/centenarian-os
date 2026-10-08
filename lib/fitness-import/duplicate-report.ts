// lib/fitness-import/duplicate-report.ts
// Finds fitness records that were brought in more than once, for the
// read-only report (scripts/report-fitness-duplicates.mjs; the same checks in
// SQL: supabase/sql-snippets/find-fitness-duplicates.sql). Pure: it only
// groups rows it is given. Nothing here deletes or changes anything; clean-up
// belongs on a screen where each merge or delete is confirmed.

import { loggedTripCandidates, loggedTripMatches, storedStartKey } from './activity-keys.ts';
import type { MatchBasis } from './activity-keys.ts';
import { DAILY_METRIC_FIELDS, normalizeField } from './daily-metrics.ts';
import { workoutIdentity } from './workouts.ts';

export interface ReportTrip {
  id: string;
  user_id: string;
  date: string;
  mode: string;
  distance_miles: number | string | null;
  duration_min: number | string | null;
  source: string | null;
  garmin_activity_id: string | null;
  external_id?: string | null;
  is_round_trip?: boolean | null;
  route_id?: string | null;
  leg_order?: number | null;
  created_at?: string | null;
}

export interface ReportWorkout {
  id: string;
  user_id: string;
  name: string;
  date: string;
  started_at: string | null;
  duration_min: number | null;
  external_id?: string | null;
  created_at?: string | null;
}

export type ReportHealthRow = { id: string; user_id: string; logged_date: string; source: string } & Record<string, unknown>;

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (key === null) continue;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

const byCreated = <T extends { created_at?: string | null }>(a: T, b: T) =>
  String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));

export interface TripGroup {
  user_id: string;
  key: string;
  trip_ids: string[];
  titles: string[];
  /** More than one title for one start time: renamed in Garmin Connect between imports. */
  renamed: boolean;
}

/** Garmin trips with the same start time (the same garmin_activity_id, or renamed), oldest first. */
export function sameStartTrips(trips: readonly ReportTrip[]): TripGroup[] {
  const groups = groupBy(trips, (trip) => {
    const key = storedStartKey(trip);
    return key ? `${trip.user_id}|${key}` : null;
  });
  const result: TripGroup[] = [];
  for (const [composite, group] of groups) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(byCreated);
    const titles = sorted.map((trip) => {
      const id = trip.garmin_activity_id ?? '';
      const bar = id.indexOf('|');
      return bar === -1 ? '' : id.slice(bar + 1);
    });
    result.push({
      user_id: sorted[0].user_id,
      key: composite.slice(composite.indexOf('|') + 1),
      trip_ids: sorted.map((trip) => trip.id),
      titles,
      renamed: new Set(titles).size > 1,
    });
  }
  return result.sort((a, b) => a.key.localeCompare(b.key));
}

export interface TripPair {
  user_id: string;
  date: string;
  mode: string;
  garmin_trip_id: string;
  other_trip_id: string;
  other_source: string | null;
  /** The other trip's date (a day off when a template was logged with the UTC date). */
  other_date: string;
  /** How it was compared: as logged, a round trip both ways, a route's legs added up, or nothing to compare. */
  basis: MatchBasis;
}

/**
 * Garmin trips that look like a trip logged another way: the import's rule
 * (activity-keys.ts loggedTripMatches), with round trips compared both ways,
 * multi-stop routes added up, same-day trips with no distance or time, and a
 * day either side. `roundTripRouteIds` = trip_routes rows with is_round_trip.
 */
export function garminVsOtherTrips(trips: readonly ReportTrip[], roundTripRouteIds: ReadonlySet<string> = new Set()): TripPair[] {
  const garmin = trips.filter((trip) => trip.source === 'garmin_import' || storedStartKey(trip) !== null);
  const othersByUser = groupBy(
    trips.filter((trip) => trip.source !== 'garmin_import' && storedStartKey(trip) === null),
    (trip) => trip.user_id,
  );
  const candidatesByUser = new Map(
    [...othersByUser].map(([userId, others]) => [userId, loggedTripCandidates(others, roundTripRouteIds)]),
  );
  const sourceOf = new Map(trips.map((trip) => [trip.id, trip.source]));
  const pairs: TripPair[] = [];
  for (const g of garmin) {
    for (const match of loggedTripMatches(g, candidatesByUser.get(g.user_id) ?? [])) {
      pairs.push({
        user_id: g.user_id,
        date: g.date,
        mode: g.mode,
        garmin_trip_id: g.id,
        other_trip_id: match.tripId,
        other_source: sourceOf.get(match.tripId) ?? null,
        other_date: match.date,
        basis: match.basis,
      });
    }
  }
  return pairs.sort((a, b) => a.date.localeCompare(b.date));
}

export interface WorkoutGroup {
  user_id: string;
  name: string;
  date: string;
  log_ids: string[];
  /** Every copy has the same started_at: one recording imported twice (certain). */
  same_start: boolean;
}

/** Workout logs with the same name (any case) on the same day, oldest first. */
export function sameNameSameDayWorkouts(logs: readonly ReportWorkout[]): WorkoutGroup[] {
  const groups = groupBy(logs, (log) => `${log.user_id}|${workoutIdentity(log.name, log.date)}`);
  const result: WorkoutGroup[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(byCreated);
    const starts = sorted.map((log) => (log.started_at ? Date.parse(log.started_at) : NaN));
    const sameStart = starts.every((t) => !Number.isNaN(t)) && new Set(starts).size === 1;
    result.push({
      user_id: sorted[0].user_id,
      name: sorted[0].name.trim().toLowerCase(),
      date: sorted[0].date,
      log_ids: sorted.map((log) => log.id),
      same_start: sameStart,
    });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/** Logs longer than a day: the old workout script read milliseconds as seconds. */
export function implausibleWorkoutDurations(logs: readonly ReportWorkout[]): ReportWorkout[] {
  return logs.filter((log) => typeof log.duration_min === 'number' && log.duration_min > 1440);
}

export interface HealthCopy {
  user_id: string;
  logged_date: string;
  device_source: string;
  manual_row_id: string;
  device_row_id: string;
}

const NUMERIC_FIELDS = DAILY_METRIC_FIELDS.filter((field) => field !== 'notes' && field !== 'body_fat_pct' && field !== 'muscle_mass_lbs' && field !== 'bmi');

/**
 * Manual daily rows with the same values as a device row that day (at least
 * two metrics set, every metric equal): likely copies made before migration
 * 080 gave each source its own row. Informational.
 */
export function manualCopiesOfDevice(rows: readonly ReportHealthRow[]): HealthCopy[] {
  const byDay = groupBy(rows, (row) => `${row.user_id}|${row.logged_date}`);
  const copies: HealthCopy[] = [];
  for (const day of byDay.values()) {
    const manual = day.filter((row) => row.source === 'manual');
    const devices = day.filter((row) => row.source !== 'manual');
    for (const m of manual) {
      const set = NUMERIC_FIELDS.filter((field) => normalizeField(field, m[field]) !== null);
      if (set.length < 2) continue;
      for (const d of devices) {
        const same = NUMERIC_FIELDS.every((field) => normalizeField(field, m[field]) === normalizeField(field, d[field]));
        if (same) copies.push({ user_id: m.user_id, logged_date: m.logged_date, device_source: d.source, manual_row_id: m.id, device_row_id: d.id });
      }
    }
  }
  return copies.sort((a, b) => a.logged_date.localeCompare(b.logged_date));
}

