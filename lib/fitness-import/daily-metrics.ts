// lib/fitness-import/daily-metrics.ts
// One way to write daily health metrics (user_health_metrics) for every path
// that brings them in: the CSV import on the metrics page and the Data Hub,
// the InBody copy, and the Garmin, Oura and WHOOP syncs.
//
// A day's identity is (user_id, logged_date, source), the unique key from
// migration 080. Each source keeps its own row on purpose (Garmin, Apple and a
// hand-entered day are never added together); Garmin CSV and Garmin sync share
// source 'garmin', so they land on one row.
//
// Rules, all covered by tests/unit/fitness-dedupe.test.ts:
//   - A file can name a date more than once. Those rows are merged first (a
//     later row's values win), so one upsert never touches a row twice
//     (Postgres error 21000 failed the whole import before).
//   - Default mode 'add_only': a new day is inserted; an existing day only
//     gains the fields it had blank; a value already stored is never changed.
//     A different incoming value is reported as a conflict and the stored value
//     stays. Mode 'replace' (opt-in, and what the syncs use): an incoming value
//     wins, and a field the source left out is still never erased.
//   - Every write sends complete rows (stored values plus incoming ones), and
//     rows go in groups that carry the same columns, so the supabase-js
//     NULL-fill default can never erase a stored value.
//   - A dry run classifies every day without writing.
//
// Relative imports end in `.ts` for the unit tests.

import type { SupabaseClient } from '@supabase/supabase-js';
import { chunk, fitnessDbFailure, groupByKeySet, readAllRows } from './db.ts';
import type { PageResult } from './db.ts';

/** The values migration 080's CHECK allows in user_health_metrics.source. */
export const HEALTH_SOURCES = [
  'manual', 'garmin', 'apple_health', 'oura', 'whoop', 'google_health', 'inbody', 'hume_health', 'csv',
] as const;

export type HealthSource = (typeof HEALTH_SOURCES)[number];

export function isHealthSource(value: unknown): value is HealthSource {
  return typeof value === 'string' && (HEALTH_SOURCES as readonly string[]).includes(value);
}

/** The metric columns an import may write (044, 050). */
export const DAILY_METRIC_FIELDS = [
  'resting_hr', 'steps', 'sleep_hours', 'activity_min',
  'sleep_score', 'hrv_ms', 'spo2_pct', 'active_calories',
  'stress_score', 'recovery_score', 'weight_lbs',
  'body_fat_pct', 'muscle_mass_lbs', 'bmi', 'notes',
] as const;

export type DailyMetricField = (typeof DAILY_METRIC_FIELDS)[number];

const FIELD_SET = new Set<string>(DAILY_METRIC_FIELDS);

/** INT columns: values are rounded, so 7.0 and 7 are the same and Postgres never refuses 7.5. */
const INTEGER_FIELDS = new Set<DailyMetricField>([
  'resting_hr', 'steps', 'activity_min', 'sleep_score', 'hrv_ms', 'active_calories', 'stress_score', 'recovery_score',
]);

export type DayValues = Partial<Record<DailyMetricField, number | string>>;

export interface DayInput {
  logged_date: string;
  values: DayValues;
}

export type MergeMode = 'add_only' | 'replace';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** One field's value as it is stored: a rounded number, or trimmed notes text. Null when blank or not a number. */
export function normalizeField(field: DailyMetricField, raw: unknown): number | string | null {
  if (raw === null || raw === undefined) return null;
  if (field === 'notes') {
    const text = String(raw).trim();
    return text === '' ? null : text;
  }
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n)) return null;
  // NUMERIC(…, 2) columns keep two decimals; the INT ones keep none.
  return INTEGER_FIELDS.has(field) ? Math.round(n) : Math.round(n * 100) / 100;
}

/** The known metric fields of a row, normalized; blanks and unknown keys are dropped. */
export function cleanDayValues(raw: Record<string, unknown>): DayValues {
  const values: DayValues = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!FIELD_SET.has(key)) continue;
    const field = key as DailyMetricField;
    const normalized = normalizeField(field, value);
    if (normalized !== null) values[field] = normalized;
  }
  return values;
}

/** True when the row has at least one number (notes alone is not a metric). */
export function hasMetric(values: DayValues): boolean {
  return Object.keys(values).some((key) => key !== 'notes');
}

function sameValue(field: DailyMetricField, a: number | string, b: number | string): boolean {
  if (field === 'notes') return String(a).trim() === String(b).trim();
  return normalizeField(field, a) === normalizeField(field, b);
}

export interface MergeResult {
  values: DayValues;
  /** Fields that were blank and now have a value. */
  filled: DailyMetricField[];
  /** Fields where the incoming value differed and the stored one was kept (add_only). */
  conflicts: DailyMetricField[];
  /** Fields where the incoming value differed and replaced the stored one (replace). */
  replaced: DailyMetricField[];
}

/**
 * Merges incoming values into stored ones. Incoming blanks never erase
 * anything; a differing value is a conflict (add_only) or a replacement.
 */
export function mergeDay(stored: DayValues, incoming: DayValues, mode: MergeMode = 'add_only'): MergeResult {
  const values: DayValues = {};
  for (const field of DAILY_METRIC_FIELDS) {
    const value = normalizeField(field, stored[field]);
    if (value !== null) values[field] = value;
  }
  const filled: DailyMetricField[] = [];
  const conflicts: DailyMetricField[] = [];
  const replaced: DailyMetricField[] = [];
  for (const field of DAILY_METRIC_FIELDS) {
    const next = normalizeField(field, incoming[field]);
    if (next === null) continue;
    const current = values[field];
    if (current === undefined) {
      values[field] = next;
      filled.push(field);
    } else if (!sameValue(field, current, next)) {
      if (mode === 'replace') {
        values[field] = next;
        replaced.push(field);
      } else {
        conflicts.push(field);
      }
    }
  }
  return { values, filled, conflicts, replaced };
}

export interface FileDedupe {
  days: DayInput[];
  /** Dates the file named more than once (merged into one day). */
  repeatedDates: string[];
}

/** One row per date: a later row's values win, its blanks never erase an earlier row's values. */
export function dedupeFileRows(rows: readonly DayInput[]): FileDedupe {
  const byDate = new Map<string, DayValues>();
  const repeated = new Set<string>();
  for (const row of rows) {
    const earlier = byDate.get(row.logged_date);
    if (earlier) {
      repeated.add(row.logged_date);
      byDate.set(row.logged_date, mergeDay(earlier, row.values, 'replace').values);
    } else {
      byDate.set(row.logged_date, mergeDay({}, row.values, 'replace').values);
    }
  }
  return {
    days: [...byDate.entries()].map(([logged_date, values]) => ({ logged_date, values })),
    repeatedDates: [...repeated].sort(),
  };
}

export type DayStatus = 'new' | 'unchanged' | 'filled' | 'conflict' | 'replaced';

export interface PlannedDay {
  logged_date: string;
  status: DayStatus;
  filled: DailyMetricField[];
  conflicts: DailyMetricField[];
  replaced: DailyMetricField[];
  /** The complete values to write, or null when nothing changes. */
  write: DayValues | null;
}

/**
 * Sorts one incoming day against what is stored for it.
 *   new        no row for this date and source yet
 *   unchanged  every incoming value is already stored
 *   filled     only blank fields gain values
 *   conflict   some incoming values differ and the stored ones are kept (add_only);
 *              blank fields on that day are still filled
 *   replaced   some stored values are replaced (replace mode)
 */
export function classifyDay(stored: DayValues | null, incoming: DayInput, mode: MergeMode): PlannedDay {
  if (!stored) {
    const { values } = mergeDay({}, incoming.values, mode);
    return { logged_date: incoming.logged_date, status: 'new', filled: [], conflicts: [], replaced: [], write: values };
  }
  const merged = mergeDay(stored, incoming.values, mode);
  const changes = merged.filled.length + merged.replaced.length;
  const status: DayStatus = merged.replaced.length > 0
    ? 'replaced'
    : merged.conflicts.length > 0
      ? 'conflict'
      : merged.filled.length > 0
        ? 'filled'
        : 'unchanged';
  return {
    logged_date: incoming.logged_date,
    status,
    filled: merged.filled,
    conflicts: merged.conflicts,
    replaced: merged.replaced,
    write: changes > 0 ? merged.values : null,
  };
}

export interface DailyImportCounts {
  /** New days written. */
  inserted: number;
  /** Existing days that only gained blank fields. */
  filled: number;
  /** Days already stored with the same values. */
  unchanged: number;
  /** Days with different values where the stored ones were kept. */
  conflicts: number;
  /** Days where stored values were replaced (replace mode). */
  replaced: number;
  /** Dates the file named more than once (merged before writing). */
  repeated_in_file: number;
}

export interface DailyPlan {
  days: PlannedDay[];
  counts: DailyImportCounts;
  repeatedDates: string[];
}

export function planDailyMetrics(
  rows: readonly DayInput[],
  stored: ReadonlyMap<string, DayValues>,
  mode: MergeMode,
): DailyPlan {
  const { days: fileDays, repeatedDates } = dedupeFileRows(rows);
  const days = fileDays
    .map((day) => classifyDay(stored.get(day.logged_date) ?? null, day, mode))
    .sort((a, b) => a.logged_date.localeCompare(b.logged_date));
  const counts: DailyImportCounts = {
    inserted: 0, filled: 0, unchanged: 0, conflicts: 0, replaced: 0, repeated_in_file: repeatedDates.length,
  };
  for (const day of days) {
    if (day.status === 'new') counts.inserted += 1;
    else if (day.status === 'filled') counts.filled += 1;
    else if (day.status === 'unchanged') counts.unchanged += 1;
    else if (day.status === 'conflict') counts.conflicts += 1;
    else counts.replaced += 1;
  }
  return { days, counts, repeatedDates };
}

/** Rows to upsert: one per changed day, each with every value the day will hold. */
export function rowsToWrite(userId: string, source: HealthSource, days: readonly PlannedDay[]): Record<string, unknown>[] {
  return days
    .filter((day) => day.write !== null)
    .map((day) => ({ user_id: userId, logged_date: day.logged_date, source, ...day.write }));
}

/** "12 new days · 3 already imported · 2 gain fields · 1 with different values (kept existing)". */
export function describeDailyCounts(counts: DailyImportCounts, dryRun: boolean): string {
  const parts: string[] = [];
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
  parts.push(`${counts.inserted} new ${counts.inserted === 1 ? 'day' : 'days'}${dryRun ? ' to add' : ' added'}`);
  if (counts.unchanged > 0) parts.push(`${counts.unchanged} already imported (skipped)`);
  if (counts.filled > 0) {
    parts.push(`${days(counts.filled)} ${dryRun ? 'will gain' : 'gained'} values in blank fields`);
  }
  if (counts.conflicts > 0) {
    parts.push(`${days(counts.conflicts)} with different values (existing values kept)`);
  }
  if (counts.replaced > 0) {
    parts.push(`${days(counts.replaced)} ${dryRun ? 'will be' : ''}${dryRun ? ' ' : ''}updated with the file's values`);
  }
  if (counts.repeated_in_file > 0) {
    parts.push(`${counts.repeated_in_file} ${counts.repeated_in_file === 1 ? 'date appears' : 'dates appear'} more than once in the file (merged)`);
  }
  return parts.join(' · ');
}

export interface DailyImportOptions {
  userId: string;
  source: HealthSource;
  rows: readonly DayInput[];
  mode?: MergeMode;
  dryRun?: boolean;
}

export interface DailyImportResult extends DailyPlan {
  dryRun: boolean;
  /** Rows sent to the database (0 on a dry run). */
  written: number;
}

/** Rows per upsert request. */
export const DAILY_WRITE_CHUNK = 200;

/** Reads the stored days for this source between two dates (inclusive), every page. */
export async function loadStoredDays(
  db: SupabaseClient,
  userId: string,
  source: HealthSource,
  from: string,
  to: string,
): Promise<Map<string, DayValues>> {
  const columns = ['logged_date', ...DAILY_METRIC_FIELDS].join(', ');
  const rows = await readAllRows<Record<string, unknown>>('read the days already stored', (start, end) =>
    db
      .from('user_health_metrics')
      .select(columns)
      .eq('user_id', userId)
      .eq('source', source)
      .gte('logged_date', from)
      .lte('logged_date', to)
      .order('logged_date', { ascending: true })
      .range(start, end) as unknown as PageResult<Record<string, unknown>>,
  );
  const stored = new Map<string, DayValues>();
  for (const row of rows) stored.set(String(row.logged_date), cleanDayValues(row));
  return stored;
}

/**
 * Plans and (unless dryRun) writes daily metrics for one source. Throws
 * FitnessImportError when a read or write fails; nothing is reported as
 * written that was not.
 */
export async function importDailyMetrics(db: SupabaseClient, options: DailyImportOptions): Promise<DailyImportResult> {
  const mode = options.mode ?? 'add_only';
  const dryRun = options.dryRun === true;
  const valid = options.rows.filter((row) => isIsoDate(row.logged_date));
  if (valid.length === 0) {
    return { ...planDailyMetrics([], new Map(), mode), dryRun, written: 0 };
  }
  const dates = valid.map((row) => row.logged_date).sort();
  const stored = await loadStoredDays(db, options.userId, options.source, dates[0], dates[dates.length - 1]);
  const plan = planDailyMetrics(valid, stored, mode);
  if (dryRun) return { ...plan, dryRun, written: 0 };

  const rows = rowsToWrite(options.userId, options.source, plan.days);
  let written = 0;
  for (const group of groupByKeySet(rows)) {
    for (const part of chunk(group, DAILY_WRITE_CHUNK)) {
      const { error } = await db
        .from('user_health_metrics')
        .upsert(part, { onConflict: 'user_id,logged_date,source' });
      if (error) throw fitnessDbFailure(error, 'save the health metrics');
      written += part.length;
    }
  }
  return { ...plan, dryRun, written };
}
