// lib/fitness-import/wearable-days.ts
// Turns wearable API responses into one row per provider calendar day, and
// works out the window each sync asks for. Pure, so the rules are tested
// (tests/unit/fitness-dedupe.test.ts) without calling Garmin, Oura or WHOOP.
//
// Day keys use the provider's own day, never the UTC date of a timestamp:
// a UTC date can be one day off from the date a CSV export of the same data
// shows, and then the two never merge.
//   Garmin  dailies and sleeps carry `calendarDate`. When it is missing, the
//           start time plus `startTimeOffsetInSeconds` gives the local day.
//   Oura    every daily document carries `day`.
//   WHOOP   sleeps and workouts: `start` shifted by `timezone_offset`.
//           Recovery records carry no offset, so `created_at`'s date is used.
//
// Only values present in the response are set. A field the provider left out
// is absent from the row, so the write (daily-metrics.ts) never erases it.
//
// Field names follow the existing sync routes. They were not re-checked
// against each provider's current API reference for this change.

import { localStartFromEpoch } from './activity-keys.ts';
import type { DayInput, DayValues } from './daily-metrics.ts';

type Json = Record<string, unknown>;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asList(value: unknown): Json[] {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === 'object') as Json[]) : [];
}

class DayMap {
  private days = new Map<string, DayValues>();

  get(date: string): DayValues {
    let day = this.days.get(date);
    if (!day) {
      day = {};
      this.days.set(date, day);
    }
    return day;
  }

  toInputs(): DayInput[] {
    return [...this.days.entries()]
      .filter(([, values]) => Object.keys(values).length > 0)
      .map(([logged_date, values]) => ({ logged_date, values }))
      .sort((a, b) => a.logged_date.localeCompare(b.logged_date));
  }
}

/** Garmin's day for a daily or sleep summary: calendarDate, else local start date. Null when neither is usable. */
export function garminDayOf(summary: Json): string | null {
  const calendarDate = summary.calendarDate;
  if (typeof calendarDate === 'string' && ISO_DAY.test(calendarDate)) return calendarDate;
  const start = num(summary.startTimeInSeconds);
  if (start === null) return null;
  const local = localStartFromEpoch(start, num(summary.startTimeOffsetInSeconds) ?? 0);
  return local ? local.slice(0, 10) : null;
}

/** Garmin Health API dailies + sleeps -> one row per calendar day. */
export function garminDays(dailies: unknown, sleeps: unknown): DayInput[] {
  const map = new DayMap();
  for (const daily of asList(dailies)) {
    const date = garminDayOf(daily);
    if (!date) continue;
    const d = map.get(date);
    const steps = num(daily.steps);
    if (steps !== null) d.steps = steps;
    const calories = num(daily.activeKilocalories);
    if (calories !== null) d.active_calories = calories;
    const active = num(daily.highlyActiveSeconds);
    if (active !== null) d.activity_min = Math.round(active / 60);
    const rhr = num(daily.restingHeartRateInBeatsPerMinute);
    if (rhr !== null) d.resting_hr = rhr;
    // Garmin reports a negative stress level when there was not enough data.
    const stress = num(daily.averageStressLevel);
    if (daily.stressQualifier && stress !== null && stress >= 0) d.stress_score = stress;
  }
  for (const sleep of asList(sleeps)) {
    const date = garminDayOf(sleep);
    if (!date) continue;
    const d = map.get(date);
    const seconds = num(sleep.durationInSeconds);
    if (seconds !== null) d.sleep_hours = Math.round((seconds / 3600) * 10) / 10;
    const score = num((sleep.overallSleepScore as Json | undefined)?.value);
    if (score !== null) d.sleep_score = score;
  }
  return map.toInputs();
}

/** Oura v2 daily_sleep, daily_activity and daily_readiness -> one row per `day`. */
export function ouraDays(sleep: unknown, activity: unknown, readiness: unknown): DayInput[] {
  const map = new DayMap();
  const dayOf = (doc: Json) => (typeof doc.day === 'string' && ISO_DAY.test(doc.day) ? doc.day : null);
  for (const s of asList((sleep as Json | null)?.data)) {
    const date = dayOf(s);
    if (!date) continue;
    const d = map.get(date);
    const contributors = s.contributors as Json | undefined;
    const score = num(s.score);
    if (contributors?.total_sleep && score !== null) d.sleep_score = score;
    const duration = num(s.total_sleep_duration);
    if (contributors?.deep_sleep != null && duration !== null) d.sleep_hours = Math.round((duration / 3600) * 10) / 10;
  }
  for (const a of asList((activity as Json | null)?.data)) {
    const date = dayOf(a);
    if (!date) continue;
    const d = map.get(date);
    const steps = num(a.steps);
    if (steps !== null) d.steps = steps;
    const calories = num(a.active_calories);
    if (calories !== null) d.active_calories = calories;
    const high = num(a.high_activity_time);
    if (a.equivalent_walking_distance && high !== null) d.activity_min = Math.round(high / 60);
  }
  for (const r of asList((readiness as Json | null)?.data)) {
    const date = dayOf(r);
    if (!date) continue;
    const score = num(r.score);
    if (score !== null) map.get(date).recovery_score = score;
  }
  return map.toInputs();
}

/** "2026-10-07T23:30:00.000Z" shifted by "-05:00" -> "2026-10-07". Falls back to the UTC date. */
export function localDateFromIso(iso: unknown, offset: unknown): string | null {
  if (typeof iso !== 'string') return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  let shiftMinutes = 0;
  if (typeof offset === 'string') {
    const match = /^([+-])(\d{2}):?(\d{2})$/.exec(offset.trim());
    if (match) shiftMinutes = (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
  }
  return new Date(time + shiftMinutes * 60_000).toISOString().slice(0, 10);
}

/** WHOOP v1 recovery, sleep and workout collections -> one row per local day. */
export function whoopDays(recovery: unknown, sleep: unknown, workout: unknown): DayInput[] {
  const map = new DayMap();
  for (const r of asList((recovery as Json | null)?.records)) {
    const date = localDateFromIso(r.created_at ?? r.updated_at, null);
    if (!date) continue;
    const score = (r.score as Json | undefined) ?? {};
    const d = map.get(date);
    const recoveryScore = num(score.recovery_score);
    if (recoveryScore !== null) d.recovery_score = Math.round(recoveryScore);
    const rhr = num(score.resting_heart_rate);
    if (rhr !== null) d.resting_hr = Math.round(rhr);
    const hrv = num(score.hrv_rmssd_milli);
    if (hrv !== null) d.hrv_ms = Math.round(hrv);
    const spo2 = num(score.spo2_percentage);
    if (spo2 !== null) d.spo2_pct = spo2;
  }
  for (const s of asList((sleep as Json | null)?.records)) {
    const date = localDateFromIso(s.start ?? s.created_at, s.timezone_offset);
    if (!date) continue;
    const score = (s.score as Json | undefined) ?? {};
    const d = map.get(date);
    const performance = num(score.sleep_performance_percentage);
    if (performance !== null) d.sleep_score = Math.round(performance);
    const inBed = num((score.stage_summary as Json | undefined)?.total_in_bed_time_milli);
    if (inBed !== null) d.sleep_hours = Math.round((inBed / 3600000) * 10) / 10;
  }
  for (const w of asList((workout as Json | null)?.records)) {
    const date = localDateFromIso(w.start ?? w.created_at, w.timezone_offset);
    if (!date) continue;
    const score = (w.score as Json | undefined) ?? {};
    const d = map.get(date);
    const kilojoule = num(score.kilojoule);
    if (kilojoule !== null) d.active_calories = Math.round(kilojoule * 0.239006); // kJ to kcal
    const meters = num(score.distance_meter);
    if (meters !== null) d.steps = (typeof d.steps === 'number' ? d.steps : 0) + Math.round(meters / 0.762); // rough step estimate
  }
  return map.toInputs();
}

const DAY_MS = 86_400_000;

/** How far back a first sync (or a long-idle connection) reaches. */
export const SYNC_MAX_LOOKBACK_DAYS = 30;
/** Days re-read before the last sync. The write is idempotent, so the overlap only catches late uploads. */
export const SYNC_OVERLAP_DAYS = 2;

/** Where a sync starts: last sync minus 2 days, never more than 30 days back, never in the future. */
export function syncWindowStart(lastSyncedAt: string | null | undefined, now: Date): Date {
  const earliest = now.getTime() - SYNC_MAX_LOOKBACK_DAYS * DAY_MS;
  const last = typeof lastSyncedAt === 'string' ? Date.parse(lastSyncedAt) : NaN;
  if (Number.isNaN(last)) return new Date(earliest);
  const start = Math.max(earliest, last - SYNC_OVERLAP_DAYS * DAY_MS);
  return new Date(Math.min(start, now.getTime()));
}

/** Splits [start, end) epoch seconds into ranges no longer than maxSeconds. */
export function splitRange(startSeconds: number, endSeconds: number, maxSeconds: number): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  if (!(maxSeconds > 0) || endSeconds <= startSeconds) return ranges;
  for (let from = startSeconds; from < endSeconds; from += maxSeconds) {
    ranges.push([from, Math.min(from + maxSeconds, endSeconds)]);
  }
  return ranges;
}
