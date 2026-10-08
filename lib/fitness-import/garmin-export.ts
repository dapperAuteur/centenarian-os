// lib/fitness-import/garmin-export.ts
// Garmin full-account export -> workout_logs, for scripts/import-garmin-workouts.mjs
// (and an in-app import of the same export later). Pure: no database, no files.
//
// Where the activities are: DI_CONNECT/DI-Connect-Fitness/<email>_<n>_summarizedActivities.json.
// The numbers in the file names change from export to export (an older export used 0, 1001,
// 2002, 3003; the 2026-10-07 one uses 1, 301, 601, ... 3601), so every file with that ending is
// read, never a fixed list. A fixed list read none of the newer export's files.
//
// Units, checked against the 2026-10-07 export: `duration` is milliseconds and `distance` and
// `elevationGain` are centimetres (distance / duration gives the same speed as `avgSpeed` x 10,
// in metres per second). `startTimeLocal` is the local wall clock as epoch milliseconds
// (startTimeLocal - startTimeGmt is the time zone offset) and `beginTimestamp` equals
// `startTimeGmt`. The `calories` unit was not confirmed and is kept as exported.
//
// Identity: the Garmin start-time key (activity-keys.ts), the same key trips use. The 2026-10-07
// export lists one recording twice under two activity ids with the same start second; the key
// counts it once.
//
// Relative imports end in `.ts` so the script and the unit tests can load this file.

import { garminStartKey, localStartFromWallClockMs } from './activity-keys.ts';
import { workoutIdentity } from './workouts.ts';

export const SUMMARIZED_ACTIVITIES_SUFFIX = '_summarizedActivities.json';

/** The number in "<email>_<n>_summarizedActivities.json", or null. */
function fileOffset(name: string): number | null {
  const match = /_(\d+)_summarizedActivities\.json$/.exec(name);
  return match ? Number(match[1]) : null;
}

/** Every summarized-activities file in a folder listing, in the export's own order. */
export function summarizedActivityFiles(names: readonly string[]): string[] {
  return names
    .filter((name) => name.endsWith(SUMMARIZED_ACTIVITIES_SUFFIX))
    .sort((a, b) => {
      const oa = fileOffset(a);
      const ob = fileOffset(b);
      if (oa !== null && ob !== null && oa !== ob) return oa - ob;
      return a.localeCompare(b);
    });
}

/** The fields of one export activity this import reads. */
export interface ExportActivity {
  activityId?: number | string;
  name?: string;
  activityType?: string;
  startTimeLocal?: number;
  beginTimestamp?: number;
  duration?: number;
  distance?: number;
  avgHr?: number;
  maxHr?: number;
  calories?: number;
  elevationGain?: number;
  locationName?: string;
}

/** One file's JSON -> its activities. The file holds `[{ summarizedActivitiesExport: [...] }]`. */
export function activitiesFromExport(raw: unknown): ExportActivity[] {
  if (!Array.isArray(raw)) return [];
  const activities: ExportActivity[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (Array.isArray(record.summarizedActivitiesExport)) {
      for (const act of record.summarizedActivitiesExport) {
        if (act && typeof act === 'object') activities.push(act as ExportActivity);
      }
    } else if (record.activityId !== undefined) {
      activities.push(record as ExportActivity);
    }
  }
  return activities;
}

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

export interface ExportWorkoutRow {
  user_id: string;
  name: string;
  /** Local calendar day of the start. */
  date: string;
  started_at: string;
  finished_at: string | null;
  duration_min: number | null;
  notes: string | null;
  external_id: string;
}

/** The workout_logs row for one activity, or null when it has no name or no usable start time. */
export function exportWorkoutRow(userId: string, act: ExportActivity): ExportWorkoutRow | null {
  const start = typeof act.startTimeLocal === 'number' ? localStartFromWallClockMs(act.startTimeLocal) : null;
  const key = garminStartKey(start);
  if (!start || !key || !act.name || typeof act.beginTimestamp !== 'number' || !Number.isFinite(act.beginTimestamp)) {
    return null;
  }
  const durationMs = positive(act.duration) ? act.duration : null;
  const notes: string[] = [];
  if (act.activityType) notes.push(`Type: ${act.activityType}`);
  if (positive(act.distance)) notes.push(`Distance: ${Math.round((act.distance / 160934.4) * 100) / 100} mi`);
  if (positive(act.avgHr)) notes.push(`Avg HR: ${Math.round(act.avgHr)} bpm`);
  if (positive(act.maxHr)) notes.push(`Max HR: ${Math.round(act.maxHr)} bpm`);
  if (positive(act.calories)) notes.push(`Calories: ${Math.round(act.calories)}`);
  if (positive(act.elevationGain)) notes.push(`Elevation: +${Math.round((act.elevationGain / 100) * 3.28084)} ft`);
  if (act.locationName) notes.push(`Location: ${act.locationName}`);
  if (act.activityId !== undefined && act.activityId !== null) notes.push(`Garmin activity ${act.activityId}`);

  return {
    user_id: userId,
    name: act.name,
    date: start.slice(0, 10),
    started_at: new Date(act.beginTimestamp).toISOString(),
    finished_at: durationMs ? new Date(act.beginTimestamp + durationMs).toISOString() : null,
    duration_min: durationMs ? Math.round(durationMs / 60000) : null,
    notes: notes.length > 0 ? notes.join(' | ') : null,
    external_id: key,
  };
}

export interface StoredWorkoutLog {
  name: string;
  date: string;
  started_at: string | null;
  external_id?: string | null;
}

export interface ExportWorkoutCounts {
  new: number;
  /** Already in workout_logs: the same external_id, or (rows from before 224) the same started_at. */
  already: number;
  /** A workout logged by hand with the same name on the same day. */
  possible: number;
  /** The export lists the same start time more than once (one recording uploaded twice). */
  repeated_in_export: number;
}

export interface ExportWorkoutPlan {
  toInsert: ExportWorkoutRow[];
  counts: ExportWorkoutCounts;
}

/**
 * Sorts the export's rows against the stored logs. Pure.
 *   - one row per start-time key (a repeat in the export counts once);
 *   - already there: a stored external_id, or a stored started_at at the same instant (rows the
 *     script wrote before external_id existed, whose `date` was the UTC day);
 *   - possible match: a log without external_id with the same name (any case) on the same day;
 *     skipped unless includePossibleMatches.
 * Pass the stored logs of the export's date range widened by a day on each side.
 */
export function planExportWorkouts(
  rows: readonly ExportWorkoutRow[],
  existing: readonly StoredWorkoutLog[],
  includePossibleMatches: boolean,
): ExportWorkoutPlan {
  const knownKeys = new Set(existing.map((log) => log.external_id).filter((key): key is string => typeof key === 'string' && key !== ''));
  const knownStarts = new Set(
    existing.map((log) => (log.started_at ? Date.parse(log.started_at) : NaN)).filter((time) => !Number.isNaN(time)),
  );
  // Checked after the two above, so an old row of this script never counts as hand-logged.
  const handLogged = new Set(existing.filter((log) => !log.external_id).map((log) => workoutIdentity(log.name, log.date)));

  const counts: ExportWorkoutCounts = { new: 0, already: 0, possible: 0, repeated_in_export: 0 };
  const seen = new Set<string>();
  const toInsert: ExportWorkoutRow[] = [];
  for (const row of [...rows].sort((a, b) => a.external_id.localeCompare(b.external_id))) {
    if (seen.has(row.external_id)) {
      counts.repeated_in_export += 1;
      continue;
    }
    seen.add(row.external_id);
    if (knownKeys.has(row.external_id) || knownStarts.has(Date.parse(row.started_at))) {
      counts.already += 1;
      continue;
    }
    if (handLogged.has(workoutIdentity(row.name, row.date))) {
      counts.possible += 1;
      if (!includePossibleMatches) continue;
    } else {
      counts.new += 1;
    }
    toInsert.push(row);
  }
  return { toInsert, counts };
}
