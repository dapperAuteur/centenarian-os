#!/usr/bin/env node
// scripts/garmin-export-to-centos.mjs
// Garmin full-account export (Garmin's "Export your data" ZIP, or its unzipped folder) ->
// CSV files the CentenarianOS importers read as they are. Reads local files only: no network,
// no database. Nothing is written anywhere except the output folder.
//
// Usage:
//   node scripts/garmin-export-to-centos.mjs <export-dir | export.zip> [--out <dir>] [--since YYYY-MM-DD]
//                                            [--exercises] [--with-notes]
//
//   <export-dir>   the unzipped export (the folder that holds DI_CONNECT), DI_CONNECT itself, or the ZIP
//                  (unzipped into a temporary folder with the system `unzip`, then removed).
//   --out <dir>    where the files go (default: <export-dir>/centos-import). The script's own earlier
//                  files there (health-metrics-*.csv, trips-*.csv, workouts*.csv, summary.txt) are
//                  replaced; nothing else in the folder is touched.
//   --since <day>  only days and activities on or after this local date (for a newer export on top
//                  of one already imported).
//   --exercises    also write each workout's exercise sets (Garmin's summarizedExerciseSets) as
//                  exercise rows. The files then split at workout boundaries (1,000-row cap).
//   --with-notes   put Garmin's logged water intake and blood-pressure readings into the health
//                  file's notes column ("Water 1.2 L; BP 118/76 pulse 60"). CentenarianOS has no
//                  column for either, so they are text only.
//
// What it writes, and where each file goes:
//   health-metrics-NN-of-MM_<from>_<to>.csv  -> Metrics > Import, source Garmin
//       (/dashboard/metrics/import?source=garmin). One row per local day with every daily metric
//       merged: daily summary (UDSFile_*), sleep (*_sleepData.json) and weight (*_userBioMetrics.json).
//       Split into files of at most 365 days, the import's per-request cap.
//   trips-garmin-activities.csv  -> Travel > Import (Garmin Activities CSV). Rides, walks, runs and
//       hikes, with Garmin Connect's Activities.csv headers. No row cap.
//   workouts[-NN-of-MM].csv  -> Data Hub > Import > Workouts. Every other activity type
//       (strength, HIIT, yoga, ...). At most 1,000 rows per file.
//   summary.txt  counts, date ranges, what was skipped and why, and the import steps.
//
// Units, checked against a real export (2026-10-07) and Garmin Connect's own CSV for the same
// activities: activity `duration`, `movingDuration` and `elapsedDuration` are milliseconds;
// `distance` and `elevationGain` are centimetres; `calories` is kilojoules-like: round(calories / 4.19)
// equals Garmin Connect's Calories column on every matched activity (4.184 misses some);
// `startTimeLocal` is the local wall clock as epoch ms. Weight is grams. Sleep stages are seconds.
// Exercise-set `maxWeight` is grams and `duration` milliseconds; `reps` is the total over the sets.
//
// Choices that keep a re-import quiet against rows the old one-time script wrote (source 'garmin'):
//   - resting_hr = currentDayRestingHeartRate (that day's RHR). Not restingHeartRate, which is
//     Garmin's 7-day average, and not the sleep average HR the old script used.
//   - sleep_hours = deep + light + REM, rounded to 0.1 h like the old script and the sync.
//   - weight = the weigh-in with the highest `version` on each local day, like the old script.
//   - stress_score = the all-day TOTAL average (negative values mean "not enough data" and are left
//     out). recovery_score = Body Battery HIGHEST, an interpretation of "recovery".
//   - A blank cell means "not measured": it never erases a stored value. A 0 is written only for
//     intensity minutes, where Garmin reports a real zero; every other 0 is treated as not measured.
//
// The pure functions are exported for tests/unit/garmin-export-converter.test.ts. Running this file
// directly runs main().

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------------------------
// Constants: importer limits and column sets (read from the CentenarianOS importers)
// ---------------------------------------------------------------------------------------------

/** POST /api/health-metrics/import rejects more than 365 rows per request. */
export const HEALTH_MAX_ROWS = 365;
/** POST /api/workouts/logs/import (MAX_IMPORT_ROWS in lib/csv/helpers.ts). */
export const WORKOUT_MAX_ROWS = 1000;

/** Health CSV header: the snake_case names the metrics import page maps for source Garmin. */
export const HEALTH_COLUMNS = [
  'logged_date', 'resting_hr', 'steps', 'sleep_hours', 'activity_min', 'sleep_score',
  'spo2_pct', 'active_calories', 'stress_score', 'recovery_score', 'weight_lbs', 'notes',
];

/**
 * Trips CSV header: Garmin Connect's Activities.csv names. The Travel importer reads Activity Type,
 * Date, Title, Distance, Calories, Total Time, Avg HR and Steps. Garmin Connect itself calls the
 * duration column "Time"; both are written so the file works whichever name the importer reads.
 */
export const TRIP_COLUMNS = [
  'Activity Type', 'Date', 'Favorite', 'Title', 'Distance', 'Calories', 'Time', 'Total Time',
  'Avg HR', 'Max HR', 'Steps', 'Total Ascent', 'Moving Time', 'Elapsed Time',
];

/** Workouts CSV header: a subset of public/templates/workouts-import-template.csv. */
export const WORKOUT_COLUMNS = [
  'date', 'name', 'duration_min', 'purpose', 'overall_feeling', 'exercise_name',
  'sets_completed', 'reps_completed', 'weight_lbs', 'duration_sec', 'notes',
];

/**
 * Export activity types imported as trips, with the exact (case-sensitive) labels of
 * GARMIN_ACTIVITY_MAP in lib/fitness-import/garmin-trips.ts. These six are the ones seen in a real
 * export; any other type (including other cycling or running sub-types a later export may have)
 * goes to the workouts file, and summary.txt lists every type with its count.
 */
export const TRIP_TYPE_LABELS = {
  cycling: 'Cycling',
  indoor_cycling: 'Indoor Cycling',
  walking: 'Walking',
  running: 'Running',
  treadmill_running: 'Treadmill Running',
  hiking: 'Hiking',
};

/** Display labels for the workout notes (Garmin Connect shows indoor_cardio as "Cardio"). */
const WORKOUT_TYPE_LABELS = {
  strength_training: 'Strength Training',
  hiit: 'HIIT',
  indoor_cardio: 'Cardio',
  lap_swimming: 'Pool Swim',
  floor_climbing: 'Floor Climbing',
};

/** workout_logs.purpose, using the Capitalized options WorkoutPurposeSelect compares against. */
export const WORKOUT_PURPOSE = {
  strength_training: 'Strength',
  hiit: 'Conditioning',
  indoor_cardio: 'Conditioning',
  floor_climbing: 'Conditioning',
  yoga: 'Mobility',
  pilates: 'Mobility',
  breathwork: 'Recovery',
  lap_swimming: 'Endurance',
};

const GRAMS_PER_POUND = 453.592;
const CM_PER_MILE = 160934.4;
/** Export `calories` / 4.19 = kcal (matches Garmin Connect's CSV on every compared activity). */
const EXPORT_CALORIE_DIVISOR = 4.19;

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const positive = (v) => isNum(v) && v > 0;
const round = (v, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real YYYY-MM-DD calendar date. */
export function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Local wall clock as epoch ms (Garmin `startTimeLocal`) -> "YYYY-MM-DD HH:MM:SS". */
export function localStartFromWallClockMs(ms) {
  if (!isNum(ms)) return null;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** Milliseconds -> "HH:MM:SS" (Garmin Connect's Time format). Blank when not positive. */
export function formatDuration(ms) {
  if (!positive(ms)) return '';
  const total = Math.round(ms / 1000);
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Export calories -> kcal. */
export function exportCaloriesToKcal(calories) {
  return positive(calories) ? Math.round(calories / EXPORT_CALORIE_DIVISOR) : null;
}

/** "BENCH_PRESS" -> "Bench Press". */
export function titleCase(snake) {
  return String(snake)
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/** One CSV cell: line breaks become spaces; quoted when it holds a comma or a quote. */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/[\r\n]+/g, ' ');
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Header + rows (objects keyed by column) -> CSV text with a trailing newline. */
export function toCsv(columns, rows) {
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(','));
  return `${lines.join('\n')}\n`;
}

/** Splits rows into consecutive chunks of at most `max`. */
export function chunkRows(rows, max) {
  const out = [];
  for (let i = 0; i < rows.length; i += max) out.push(rows.slice(i, i + max));
  return out;
}

/**
 * Splits rows into chunks of at most `max` without cutting a group (consecutive rows sharing
 * `groupKey`) in two: the workouts importer would see the second half as "already logged" and drop it.
 */
export function chunkByGroup(rows, max, groupKey) {
  // Aim for even files (2,004 rows -> 3 x ~668, not 1,000 + 1,000 + 4); never above max.
  const target = Math.ceil(rows.length / Math.max(1, Math.ceil(rows.length / max)));
  const groups = [];
  for (const row of rows) {
    const key = groupKey(row);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else groups.push({ key, rows: [row] });
  }
  const chunks = [];
  let current = [];
  for (const group of groups) {
    if (group.rows.length > max) throw new Error(`One workout has ${group.rows.length} rows, more than the ${max}-row cap.`);
    if (current.length > 0 && (current.length + group.rows.length > max || current.length >= target)) {
      chunks.push(current);
      current = [];
    }
    current.push(...group.rows);
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** Adds to a skip count. `example` (a date, never a value) is kept for up to three per reason. */
function addSkip(list, reason, count = 1, example = null) {
  if (count <= 0) return;
  let found = list.find((s) => s.reason === reason);
  if (!found) {
    found = { reason, count: 0 };
    list.push(found);
  }
  found.count += count;
  if (example) {
    found.examples = found.examples ?? [];
    if (found.examples.length < 3) found.examples.push(example);
  }
}

function countBy(items, keyOf) {
  const counts = {};
  for (const item of items) {
    const key = keyOf(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function dateRange(dates) {
  const sorted = dates.filter(Boolean).sort();
  return sorted.length === 0 ? null : { from: sorted[0], to: sorted[sorted.length - 1] };
}

// ---------------------------------------------------------------------------------------------
// Daily health metrics
// ---------------------------------------------------------------------------------------------

/** One daily summary (UDSFile_*) -> its metric values. Empty object when it has none. */
export function udsMetrics(rec) {
  const m = {};
  if (positive(rec.totalSteps)) m.steps = Math.round(rec.totalSteps);
  if (positive(rec.currentDayRestingHeartRate)) m.resting_hr = Math.round(rec.currentDayRestingHeartRate);
  if (positive(rec.activeKilocalories)) m.active_calories = Math.round(rec.activeKilocalories);
  if (isNum(rec.moderateIntensityMinutes) && isNum(rec.vigorousIntensityMinutes)) {
    const minutes = rec.moderateIntensityMinutes + rec.vigorousIntensityMinutes;
    if (minutes >= 0) m.activity_min = Math.round(minutes);
  }
  const total = rec.allDayStress?.aggregatorList?.find?.((a) => a?.type === 'TOTAL');
  if (isNum(total?.averageStressLevel) && total.averageStressLevel >= 0) m.stress_score = Math.round(total.averageStressLevel);
  const highest = rec.bodyBattery?.bodyBatteryStatList?.find?.((s) => s?.bodyBatteryStatType === 'HIGHEST');
  if (isNum(highest?.statsValue) && highest.statsValue >= 0 && highest.statsValue <= 100) m.recovery_score = Math.round(highest.statsValue);
  return m;
}

/** One night (*_sleepData.json) -> sleep_hours, sleep_score, spo2_pct. */
export function sleepMetrics(rec) {
  const m = {};
  const seconds = [rec.deepSleepSeconds, rec.lightSleepSeconds, rec.remSleepSeconds].reduce((sum, v) => sum + (isNum(v) && v > 0 ? v : 0), 0);
  if (seconds > 0) m.sleep_hours = round(seconds / 3600, 1);
  if (positive(rec.sleepScores?.overallScore)) m.sleep_score = Math.round(rec.sleepScores.overallScore);
  if (positive(rec.spo2SleepSummary?.averageSPO2)) m.spo2_pct = round(rec.spo2SleepSummary.averageSPO2, 2);
  return m;
}

/** Grams -> pounds, 2 decimals (weight_lbs is NUMERIC(6,2)). */
export function gramsToLbs(grams) {
  return round(grams / GRAMS_PER_POUND, 2);
}

/**
 * Weigh-ins (*_userBioMetrics.json records with a `weight`) -> one weight per local day: the entry
 * with the highest `version` (its last edit). The day is metaData.calendarDate, Garmin's local time.
 */
export function pickDailyWeights(records, skipped = [], since = null) {
  const byDate = new Map();
  let weighIns = 0;
  for (const rec of records) {
    if (!rec || !positive(rec.weight?.weight)) continue;
    const raw = rec.metaData?.calendarDate;
    const date = typeof raw === 'string' ? raw.slice(0, 10) : null;
    if (!isIsoDate(date)) {
      addSkip(skipped, 'weigh-ins without a local date');
      continue;
    }
    if (since && date < since) continue;
    weighIns += 1;
    const version = isNum(rec.version) ? rec.version : -Infinity;
    const current = byDate.get(date);
    if (!current || version >= current.version) byDate.set(date, { version, grams: rec.weight.weight });
  }
  const weights = new Map([...byDate].map(([date, w]) => [date, gramsToLbs(w.grams)]));
  return { weights, weighIns };
}

/** Garmin hydration logs -> net logged intake (mL) per day, from GARMIN_GCM entries only. */
export function dailyWaterIntake(entries) {
  const byDate = new Map();
  for (const e of entries) {
    if (!e || e.hydrationSource !== 'GARMIN_GCM' || !isNum(e.valueInML) || !isIsoDate(e.calendarDate)) continue;
    byDate.set(e.calendarDate, (byDate.get(e.calendarDate) ?? 0) + e.valueInML);
  }
  for (const [date, ml] of byDate) if (!(ml > 0)) byDate.delete(date);
  return byDate;
}

/** A blood-pressure reading's local date: metaData.calendarDate is [y, m, d, h, min, ...] or text. */
export function bloodPressureDate(rec) {
  const raw = rec?.metaData?.calendarDate;
  if (Array.isArray(raw) && raw.length >= 3 && raw.slice(0, 3).every(isNum)) {
    const date = `${raw[0]}-${pad(raw[1])}-${pad(raw[2])}`;
    return isIsoDate(date) ? date : null;
  }
  if (typeof raw === 'string' && isIsoDate(raw.slice(0, 10))) return raw.slice(0, 10);
  return null;
}

/** Blood-pressure readings -> "BP 118/76 pulse 60" texts per day (the reading's own notes are left out). */
export function dailyBloodPressure(records, skipped = []) {
  const byDate = new Map();
  for (const rec of records) {
    const bp = rec?.bloodPressure;
    if (!positive(bp?.systolic) || !positive(bp?.diastolic)) continue;
    const date = bloodPressureDate(rec);
    if (!date) {
      addSkip(skipped, 'blood-pressure readings without a readable date');
      continue;
    }
    const text = `BP ${Math.round(bp.systolic)}/${Math.round(bp.diastolic)}${positive(bp.pulse) ? ` pulse ${Math.round(bp.pulse)}` : ''}`;
    byDate.set(date, [...(byDate.get(date) ?? []), text]);
  }
  return byDate;
}

/**
 * Daily summaries + sleep + weigh-ins (+ water and blood pressure with withNotes) -> one row per
 * local day, sorted by date. Each column comes from exactly one source, so the merge never has to
 * choose between two values.
 */
export function buildHealthRows({ uds = [], sleep = [], bio = [], hydration = [], bloodPressure = [] }, { since = null, withNotes = false } = {}) {
  const skipped = [];
  const days = new Map();
  const day = (date) => {
    if (!days.has(date)) days.set(date, { logged_date: date });
    return days.get(date);
  };
  // --since applies to every source before anything is counted.
  const earlier = new Set();
  const inWindow = (date) => {
    if (!since || date >= since) return true;
    earlier.add(date);
    return false;
  };

  // Daily summaries: one per calendarDate (the highest `version` if an export repeats one).
  const udsByDate = new Map();
  for (const rec of uds) {
    if (!rec || !isIsoDate(rec.calendarDate)) {
      addSkip(skipped, 'daily summaries without a date');
      continue;
    }
    if (!inWindow(rec.calendarDate)) continue;
    const prev = udsByDate.get(rec.calendarDate);
    if (prev) addSkip(skipped, 'daily summaries listed twice for one date (latest version kept)');
    if (!prev || (rec.version ?? 0) >= (prev.version ?? 0)) udsByDate.set(rec.calendarDate, rec);
  }
  let udsDays = 0;
  for (const [date, rec] of udsByDate) {
    const m = udsMetrics(rec);
    if (Object.keys(m).length === 0) {
      addSkip(skipped, 'daily summaries with no metrics (a date set by a device clock, or a day not worn)', 1, date);
      continue;
    }
    const stress = rec.allDayStress?.aggregatorList?.find?.((a) => a?.type === 'TOTAL')?.averageStressLevel;
    if (isNum(stress) && stress < 0) addSkip(skipped, 'days with a negative stress level (Garmin: not enough data; stress left blank)');
    udsDays += 1;
    Object.assign(day(date), m);
  }

  // Sleep: calendarDate is the wake-up day. One night per date (the longest if repeated).
  const sleepByDate = new Map();
  for (const rec of sleep) {
    if (!rec || !isIsoDate(rec.calendarDate)) {
      addSkip(skipped, 'sleep records without a date');
      continue;
    }
    if (!inWindow(rec.calendarDate)) continue;
    const m = sleepMetrics(rec);
    if (Object.keys(m).length > 0 && m.sleep_hours === undefined) addSkip(skipped, 'nights with a score or SpO2 but no sleep-stage time (sleep_hours left blank)');
    if (isNum(rec.sleepScores?.overallScore) && rec.sleepScores.overallScore <= 0) addSkip(skipped, 'nights with a sleep score of 0 (sleep_score left blank)');
    const prev = sleepByDate.get(rec.calendarDate);
    if (prev) addSkip(skipped, 'nights listed twice for one date (longest kept)');
    if (!prev || (m.sleep_hours ?? 0) > (prev.sleep_hours ?? 0)) sleepByDate.set(rec.calendarDate, m);
  }
  let sleepDays = 0;
  for (const [date, m] of sleepByDate) {
    if (Object.keys(m).length === 0) {
      addSkip(skipped, 'nights with nothing to import (no sleep-stage time, score or SpO2)');
      continue;
    }
    sleepDays += 1;
    Object.assign(day(date), m);
  }

  const { weights, weighIns } = pickDailyWeights(bio, skipped, since);
  for (const [date, lbs] of weights) day(date).weight_lbs = lbs;
  if (weighIns > weights.size) addSkip(skipped, 'extra weigh-ins on a day that has more than one (the latest edit is kept)', weighIns - weights.size);

  let waterDays = 0;
  let bpDays = 0;
  const water = new Map([...dailyWaterIntake(hydration)].filter(([date]) => !since || date >= since));
  const bp = new Map([...dailyBloodPressure(bloodPressure, skipped)].filter(([date]) => !since || date >= since));
  if (withNotes) {
    const notes = new Map();
    for (const [date, ml] of water) notes.set(date, [`Water ${(ml / 1000).toFixed(1)} L`]);
    for (const [date, texts] of bp) notes.set(date, [...(notes.get(date) ?? []), ...texts]);
    for (const [date, parts] of notes) {
      const row = days.get(date);
      if (!row) {
        addSkip(skipped, 'note days with no metric (the importer rejects notes-only rows)');
        continue;
      }
      if (water.has(date)) waterDays += 1;
      if (bp.has(date)) bpDays += 1;
      row.notes = parts.join('; ').replace(/,/g, ';');
    }
  } else {
    if (water.size > 0) addSkip(skipped, 'water-intake days not written (no CentenarianOS column; --with-notes puts them in notes)', water.size);
    if (bp.size > 0) addSkip(skipped, 'blood-pressure days not written (no CentenarianOS column; --with-notes puts them in notes)', bp.size);
  }

  const rows = [...days.values()].sort((a, b) => a.logged_date.localeCompare(b.logged_date));
  if (since) addSkip(skipped, `days before --since ${since} (daily summaries and sleep)`, earlier.size);

  const fieldDays = {};
  for (const col of HEALTH_COLUMNS.slice(1)) fieldDays[col] = rows.filter((r) => r[col] !== undefined).length;

  return {
    rows,
    skipped,
    stats: { udsDays, sleepDays, weighIns, weightDays: weights.size, waterDays, bpDays, fieldDays },
  };
}

// ---------------------------------------------------------------------------------------------
// Activities -> trips and workouts
// ---------------------------------------------------------------------------------------------

/** summarizedActivities file JSON (`[{ summarizedActivitiesExport: [...] }]`) -> activities. */
export function activitiesFromExport(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (item && Array.isArray(item.summarizedActivitiesExport)) {
      for (const act of item.summarizedActivitiesExport) if (act && typeof act === 'object') out.push(act);
    } else if (item && typeof item === 'object' && item.activityId !== undefined) {
      out.push(item);
    }
  }
  return out;
}

/**
 * Sorts activities by local start, drops repeats of one start second (Garmin can list one recording
 * under two activity ids), applies --since, and splits them into trip and workout types.
 */
export function prepareActivities(activities, { since = null } = {}) {
  const skipped = [];
  const withStart = [];
  for (const act of activities) {
    const start = localStartFromWallClockMs(act?.startTimeLocal);
    if (!start) {
      addSkip(skipped, 'activities without a local start time');
      continue;
    }
    withStart.push({ act, start, date: start.slice(0, 10) });
  }
  withStart.sort((a, b) => a.start.localeCompare(b.start) || String(a.act.activityId).localeCompare(String(b.act.activityId)));
  const seen = new Set();
  let kept = [];
  for (const item of withStart) {
    if (seen.has(item.start)) {
      addSkip(skipped, 'activities listed twice in the export (same start second; the first is kept)');
      continue;
    }
    seen.add(item.start);
    kept.push(item);
  }
  if (since) {
    const before = kept.length;
    kept = kept.filter((item) => item.date >= since);
    addSkip(skipped, `activities before --since ${since}`, before - kept.length);
  }
  const trips = kept.filter((item) => TRIP_TYPE_LABELS[item.act.activityType]);
  const workouts = kept.filter((item) => !TRIP_TYPE_LABELS[item.act.activityType]);
  return { trips, workouts, skipped };
}

/** One trip-type activity -> a row in Garmin Connect's Activities.csv shape. */
export function tripRow({ act, start }) {
  const duration = formatDuration(act.duration);
  return {
    'Activity Type': TRIP_TYPE_LABELS[act.activityType],
    'Date': start,
    'Favorite': act.favorite ? 'true' : 'false',
    'Title': (act.name ?? '').trim() || TRIP_TYPE_LABELS[act.activityType],
    'Distance': positive(act.distance) ? (act.distance / CM_PER_MILE).toFixed(2) : '',
    'Calories': exportCaloriesToKcal(act.calories) ?? '',
    'Time': duration,
    'Total Time': duration,
    'Avg HR': positive(act.avgHr) ? Math.round(act.avgHr) : '',
    'Max HR': positive(act.maxHr) ? Math.round(act.maxHr) : '',
    'Steps': positive(act.steps) ? Math.round(act.steps) : '',
    'Total Ascent': positive(act.elevationGain) ? Math.round((act.elevationGain / 100) * 3.28084) : '',
    'Moving Time': formatDuration(act.movingDuration),
    'Elapsed Time': formatDuration(act.elapsedDuration),
  };
}

export function buildTripRows(items) {
  return items.map(tripRow);
}

function workoutTypeLabel(type) {
  return WORKOUT_TYPE_LABELS[type] ?? titleCase(type || 'activity');
}

/** The workouts importer's identity: name (any case) + date. */
const workoutKey = (row) => `${String(row.name).trim().toLowerCase()}::${row.date}`;

/**
 * Workout-type activities -> Workouts CSV rows: one workout row per activity, then (with
 * exercises) one row per named exercise set. Garmin reuses names ("Strength" every day), and the
 * importer merges rows that share a name and date into ONE workout, so when a name repeats on a
 * local day every one of those activities gets its start time added: "Strength (07:05)".
 */
export function buildWorkoutRows(items, { exercises = false } = {}) {
  const skipped = [];
  const baseName = (item) => (item.act.name ?? '').trim() || workoutTypeLabel(item.act.activityType);
  const counts = new Map();
  for (const item of items) {
    const key = `${baseName(item).toLowerCase()}::${item.date}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const names = items.map((item) => {
    const name = baseName(item);
    return counts.get(`${name.toLowerCase()}::${item.date}`) > 1 ? `${name} (${item.start.slice(11, 16)})` : name;
  });
  // Two repeats that also start in the same minute: use the seconds too.
  const finalCounts = new Map();
  items.forEach((item, i) => {
    const key = `${names[i].toLowerCase()}::${item.date}`;
    finalCounts.set(key, (finalCounts.get(key) ?? 0) + 1);
  });
  items.forEach((item, i) => {
    if (finalCounts.get(`${names[i].toLowerCase()}::${item.date}`) > 1) names[i] = `${baseName(item)} (${item.start.slice(11, 19)})`;
  });

  const rows = [];
  let renamed = 0;
  let exerciseRows = 0;
  items.forEach((item, i) => {
    const { act, start, date } = item;
    const name = names[i];
    if (name !== baseName(item)) renamed += 1;
    const minutes = positive(act.duration) ? Math.round(act.duration / 60000) : 0;
    if (positive(act.duration) && minutes === 0) addSkip(skipped, 'workouts shorter than 30 seconds (duration left blank)');
    const feel = isNum(act.workoutFeel) && act.workoutFeel >= 0 && act.workoutFeel <= 100 ? Math.round(act.workoutFeel / 25) + 1 : '';
    const notes = [`Garmin ${workoutTypeLabel(act.activityType)}`, `Start ${start.slice(11, 16)}`];
    if (positive(act.distance)) notes.push(`${(act.distance / CM_PER_MILE).toFixed(2)} mi`);
    if (positive(act.avgHr)) notes.push(`Avg HR ${Math.round(act.avgHr)} bpm`);
    const kcal = exportCaloriesToKcal(act.calories);
    if (kcal) notes.push(`${kcal} kcal`);
    rows.push({
      date,
      name,
      duration_min: minutes > 0 ? minutes : '',
      purpose: WORKOUT_PURPOSE[act.activityType] ?? '',
      overall_feeling: feel,
      exercise_name: '',
      notes: notes.join(' | ').replace(/,/g, ';'),
    });
    if (!exercises) return;
    for (const set of Array.isArray(act.summarizedExerciseSets) ? act.summarizedExerciseSets : []) {
      if (!set || !set.category || set.category === 'UNKNOWN') {
        addSkip(skipped, 'exercise sets with no named exercise (UNKNOWN)');
        continue;
      }
      const sets = positive(set.sets) ? Math.round(set.sets) : null;
      const reps = positive(set.reps) ? (sets ? Math.round(set.reps / sets) : Math.round(set.reps)) : '';
      rows.push({
        date,
        name,
        exercise_name: titleCase(set.category),
        sets_completed: sets ?? '',
        reps_completed: reps,
        weight_lbs: positive(set.maxWeight) ? round(set.maxWeight / GRAMS_PER_POUND, 1) : '',
        duration_sec: positive(set.duration) ? Math.round(set.duration / 1000) : '',
      });
      exerciseRows += 1;
    }
  });
  return { rows, skipped, stats: { workouts: items.length, renamed, exerciseRows } };
}

// ---------------------------------------------------------------------------------------------
// Whole export
// ---------------------------------------------------------------------------------------------

/** Every data list the converter reads, already parsed -> the output files and a summary object. */
export function convertExport(data, { since = null, exercises = false, withNotes = false } = {}) {
  const health = buildHealthRows(data, { since, withNotes });
  const prepared = prepareActivities(data.activities ?? [], { since });
  const tripRows = buildTripRows(prepared.trips);
  const workouts = buildWorkoutRows(prepared.workouts, { exercises });

  const files = [];
  const healthChunks = chunkRows(health.rows, HEALTH_MAX_ROWS);
  healthChunks.forEach((rows, i) => {
    const range = dateRange(rows.map((r) => r.logged_date));
    files.push({
      kind: 'health',
      name: `health-metrics-${pad(i + 1)}-of-${pad(healthChunks.length)}_${range.from}_to_${range.to}.csv`,
      columns: HEALTH_COLUMNS,
      rows,
      range,
    });
  });
  if (tripRows.length > 0) {
    files.push({
      kind: 'trips',
      name: 'trips-garmin-activities.csv',
      columns: TRIP_COLUMNS,
      rows: tripRows,
      range: dateRange(prepared.trips.map((t) => t.date)),
    });
  }
  const workoutChunks = chunkByGroup(workouts.rows, WORKOUT_MAX_ROWS, workoutKey);
  workoutChunks.forEach((rows, i) => {
    const base = exercises ? 'workouts-with-exercises' : 'workouts';
    files.push({
      kind: 'workouts',
      name: workoutChunks.length === 1 ? `${base}.csv` : `${base}-${pad(i + 1)}-of-${pad(workoutChunks.length)}.csv`,
      columns: WORKOUT_COLUMNS,
      rows,
      range: dateRange(rows.map((r) => r.date)),
    });
  });

  const summary = {
    since,
    options: { exercises, withNotes },
    health: {
      days: health.rows.length,
      range: dateRange(health.rows.map((r) => r.logged_date)),
      ...health.stats,
      skipped: health.skipped,
    },
    trips: {
      rows: tripRows.length,
      range: dateRange(prepared.trips.map((t) => t.date)),
      byType: countBy(prepared.trips, (t) => TRIP_TYPE_LABELS[t.act.activityType]),
      noDistance: tripRows.filter((r) => r.Distance === '').length,
      noDuration: tripRows.filter((r) => r['Total Time'] === '').length,
    },
    workouts: {
      workouts: workouts.stats.workouts,
      rows: workouts.rows.length,
      exerciseRows: workouts.stats.exerciseRows,
      renamed: workouts.stats.renamed,
      range: dateRange(prepared.workouts.map((w) => w.date)),
      byType: countBy(prepared.workouts, (w) => w.act.activityType || 'unknown'),
      skipped: workouts.skipped,
    },
    activitiesSkipped: prepared.skipped,
    files: files.map((f) => ({ name: f.name, kind: f.kind, rows: f.rows.length, range: f.range })),
  };
  return { files, summary };
}

// ---------------------------------------------------------------------------------------------
// Reading the export from disk
// ---------------------------------------------------------------------------------------------

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const listDir = (dir) => {
  try {
    return readdirSync(dir).sort();
  } catch {
    return [];
  }
};

/** The DI_CONNECT folder inside an export folder (or the folder itself), searched two levels deep. */
export function findDiConnect(root) {
  const isDir = (p) => {
    try {
      return statSync(p).isDirectory();
    } catch {
      return false;
    }
  };
  if (basename(root) === 'DI_CONNECT' && isDir(root)) return root;
  if (listDir(root).some((n) => n.startsWith('DI-Connect-'))) return root;
  if (isDir(join(root, 'DI_CONNECT'))) return join(root, 'DI_CONNECT');
  for (const name of listDir(root)) {
    const nested = join(root, name, 'DI_CONNECT');
    if (isDir(nested)) return nested;
  }
  return null;
}

/** Reads every file the converter uses. File names carry dates and an account number, so they are matched by pattern. */
export function readExport(diConnect) {
  const agg = join(diConnect, 'DI-Connect-Aggregator');
  const well = join(diConnect, 'DI-Connect-Wellness');
  const fit = join(diConnect, 'DI-Connect-Fitness');
  const pick = (dir, test) => listDir(dir).filter(test).map((n) => join(dir, n));
  const arrays = (paths, map = (x) => x) => paths.flatMap((p) => {
    const raw = readJson(p);
    return Array.isArray(raw) ? map(raw) : [];
  });
  const sources = {
    uds: pick(agg, (n) => /^UDSFile_.*\.json$/.test(n)),
    hydration: pick(agg, (n) => /^HydrationLogFile_.*\.json$/.test(n)),
    sleep: pick(well, (n) => n.endsWith('_sleepData.json')),
    bio: pick(well, (n) => n.endsWith('_userBioMetrics.json')),
    bloodPressure: pick(well, (n) => /^BloodPressureFile_.*\.json$/.test(n)),
    activities: pick(fit, (n) => n.endsWith('_summarizedActivities.json')),
  };
  return {
    data: {
      uds: arrays(sources.uds),
      hydration: arrays(sources.hydration),
      sleep: arrays(sources.sleep),
      bio: arrays(sources.bio),
      bloodPressure: arrays(sources.bloodPressure),
      activities: arrays(sources.activities, activitiesFromExport),
    },
    fileCounts: Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, v.length])),
  };
}

// ---------------------------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------------------------

const OWN_OUTPUT = /^(health-metrics-.*\.csv|trips-.*\.csv|workouts.*\.csv|summary\.txt)$/;

const fmtRange = (range) => (range ? `${range.from} to ${range.to}` : 'none');
const fmtCounts = (obj) => Object.entries(obj).map(([k, v]) => `${k} ${v}`).join(', ');

/** summary.txt: counts, date ranges, skips and the import steps. No personal values. */
export function summaryText(summary, { fileCounts = null, exportPath = '' } = {}) {
  const s = summary;
  const L = [];
  L.push('Garmin export -> CentenarianOS import files');
  L.push(`Made by scripts/garmin-export-to-centos.mjs${exportPath ? ` from ${exportPath}` : ''}`);
  if (s.since) L.push(`Only dates on or after ${s.since} (--since).`);
  if (fileCounts) L.push(`Export files read: ${fmtCounts(fileCounts)}`);
  L.push('');
  L.push('FILES');
  for (const f of s.files) L.push(`  ${f.name}: ${f.rows} rows, ${fmtRange(f.range)}`);
  L.push('');
  L.push(`HEALTH METRICS: ${s.health.days} days, ${fmtRange(s.health.range)}`);
  L.push(`  From: daily summaries ${s.health.udsDays} days, sleep ${s.health.sleepDays} nights, weight ${s.health.weightDays} days (${s.health.weighIns} weigh-ins)` +
    (s.options.withNotes ? `, notes: water ${s.health.waterDays} days, blood pressure ${s.health.bpDays} days` : ''));
  L.push(`  Days with a value per column: ${fmtCounts(s.health.fieldDays)}`);
  L.push('  hrv_ms: not in a Garmin account export, so the column is left out.');
  L.push('');
  L.push(`TRIPS: ${s.trips.rows} activities, ${fmtRange(s.trips.range)}`);
  L.push(`  By type: ${fmtCounts(s.trips.byType)}`);
  L.push(`  No distance (indoor or no GPS): ${s.trips.noDistance}; no duration: ${s.trips.noDuration}`);
  L.push('');
  L.push(`WORKOUTS: ${s.workouts.workouts} workouts in ${s.workouts.rows} rows, ${fmtRange(s.workouts.range)}`);
  L.push(`  By Garmin type: ${fmtCounts(s.workouts.byType)}`);
  L.push(`  Renamed with their start time (a name used twice on one day): ${s.workouts.renamed}`);
  if (s.options.exercises) L.push(`  Exercise rows: ${s.workouts.exerciseRows}`);
  L.push('');
  L.push('SKIPPED');
  const skips = [...s.health.skipped, ...s.activitiesSkipped, ...s.workouts.skipped];
  if (skips.length === 0) L.push('  nothing');
  for (const k of skips) L.push(`  ${k.reason}: ${k.count}${k.examples ? ` (e.g. ${k.examples.join(', ')})` : ''}`);
  L.push('');
  L.push('NOT IN ANY FILE (no CentenarianOS column or importer): VO2 max, fitness age, training status and');
  L.push('load, HRV (not in the export), respiration, floors, distance per day, min/max HR, Body Battery');
  L.push('detail, sleep stages, hydration and blood pressure (unless --with-notes), BMI (the metrics page');
  L.push('does not send it), body fat and muscle (not in a Garmin export), GPS tracks and FIT files, gear,');
  L.push('planned workouts, personal records, golf.');
  L.push('');
  L.push('HOW TO IMPORT (each importer has a check step that writes nothing; re-running a file is safe)');
  L.push('  1. Health: Settings > Wearables > Garmin > Import CSV (/dashboard/metrics/import?source=garmin).');
  L.push('     Upload one health-metrics file at a time (365 days each), click Check rows, then Import.');
  L.push('     New days are added and blank fields filled; a stored value that differs is kept and listed');
  L.push('     under "Different values" unless Replace existing values is ticked (the file then wins on');
  L.push('     every differing field; a blank cell never erases anything). The old one-time script stored');
  L.push('     the sleep average HR as resting_hr, so expect resting_hr differences on the days it loaded.');
  L.push('  2. Trips: Travel > Import, Garmin Activities CSV: trips-garmin-activities.csv. Check file, then');
  L.push('     Import. Activities already imported (same start time) are skipped.');
  L.push('  3. Workouts: Data Hub > Import > Workouts. Check rows, then Import, one file at a time. If the');
  L.push('     old scripts/import-garmin-workouts.mjs ever wrote these, run');
  L.push('     scripts/report-fitness-duplicates.mjs (read-only) first: the CSV import matches by name and');
  L.push('     date only, and cannot see rows that script wrote under a different day or name.');
  return `${L.join('\n')}\n`;
}

/** Writes the files and summary.txt into `outDir`, replacing the script's own earlier output there. */
export function writeOutputs(outDir, files, summaryTextValue) {
  mkdirSync(outDir, { recursive: true });
  for (const name of listDir(outDir)) if (OWN_OUTPUT.test(name)) unlinkSync(join(outDir, name));
  for (const f of files) writeFileSync(join(outDir, f.name), toCsv(f.columns, f.rows), 'utf8');
  writeFileSync(join(outDir, 'summary.txt'), summaryTextValue, 'utf8');
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

const USAGE = `Usage: node scripts/garmin-export-to-centos.mjs <export-dir | export.zip> [--out <dir>] [--since YYYY-MM-DD] [--exercises] [--with-notes]`;

export function parseArgs(argv) {
  const opts = { input: null, out: null, since: null, exercises: false, withNotes: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--out') opts.out = argv[++i] ?? null;
    else if (a === '--since') opts.since = argv[++i] ?? null;
    else if (a === '--exercises') opts.exercises = true;
    else if (a === '--with-notes') opts.withNotes = true;
    else if (a.startsWith('--')) throw new Error(`Unknown option ${a}\n${USAGE}`);
    else if (!opts.input) opts.input = a;
    else throw new Error(`Unexpected argument ${a}\n${USAGE}`);
  }
  if (!opts.help && !opts.input) throw new Error(USAGE);
  if (opts.out === null && argv.includes('--out')) throw new Error('--out needs a folder');
  if (opts.since !== null && !isIsoDate(opts.since)) throw new Error('--since needs a date as YYYY-MM-DD');
  return opts;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  if (opts.help) {
    console.log(USAGE);
    return;
  }

  const input = resolve(opts.input);
  if (!existsSync(input)) {
    console.error(`Not found: ${input}`);
    process.exit(1);
  }
  let tempDir = null;
  let root = input;
  try {
    if (input.toLowerCase().endsWith('.zip')) {
      tempDir = mkdtempSync(join(tmpdir(), 'garmin-export-'));
      execFileSync('unzip', ['-q', input, '-d', tempDir], { stdio: ['ignore', 'ignore', 'inherit'] });
      root = tempDir;
    }
    const diConnect = findDiConnect(root);
    if (!diConnect) throw new Error(`No DI_CONNECT folder found in ${input}. Point at the unzipped Garmin export.`);
    const { data, fileCounts } = readExport(diConnect);
    const { files, summary } = convertExport(data, { since: opts.since, exercises: opts.exercises, withNotes: opts.withNotes });
    const outDir = resolve(opts.out ?? (tempDir ? join(dirname(input), `${basename(input, '.zip')}-centos-import`) : join(input, 'centos-import')));
    const text = summaryText(summary, { fileCounts, exportPath: input });
    writeOutputs(outDir, files, text);
    console.log(text);
    console.log(`Written to ${outDir}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
