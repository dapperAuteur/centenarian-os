// lib/fitness-import/activity-keys.ts
// The identity of one Garmin activity, the same whichever way it arrives.
//
// Key: `garmin:start:<local start YYYY-MM-DD HH:MM:SS>`. Two activities on one
// account cannot start in the same second, and every Garmin source carries
// that time:
//   - Activities CSV (Garmin Connect, All Activities, Export CSV): the `Date`
//     column, e.g. "2025-06-08 17:20:53".
//   - Full account export JSON (summarizedActivities): `startTimeLocal`, the
//     local wall-clock time as epoch milliseconds (checked against an export:
//     startTimeLocal - startTimeGmt equals the time zone offset).
//   - Health API (later): `startTimeInSeconds` plus `startTimeOffsetInSeconds`.
// The title is left out on purpose: it can be edited in Garmin Connect, and
// the old key (`<Date>|<Title>`) imported a renamed activity a second time.
//
// The old key still goes into trips.garmin_activity_id, for display and
// because Work.WitUS's copy of the import reads that column. Rows written
// before external_id existed are matched by the start time in front of the
// '|' (startKeyFromLegacyId).
//
// Pure functions, no imports: unit tests and scripts load this file directly.

export const GARMIN_START_PREFIX = 'garmin:start:';

const LOCAL_START_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * "2025-06-08 17:20:53", "2025-06-08T17:20:53", "2025-06-08 17:20" (seconds
 * taken as :00) or with fractional seconds -> "2025-06-08 17:20:53". Null when
 * the text is not a real local date and time.
 */
export function normalizeLocalStart(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const match = LOCAL_START_RE.exec(raw.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = s === undefined ? 0 : Number(s);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return `${y}-${mo}-${d} ${pad(hour)}:${mi}:${pad(second)}`;
}

/** The local calendar day of a normalized start ("2025-06-08 17:20:53" -> "2025-06-08"). */
export function localDateOf(localStart: string): string {
  return localStart.slice(0, 10);
}

/** `garmin:start:2025-06-08 17:20:53`, or null when the start time is not valid. */
export function garminStartKey(rawLocalStart: string | null | undefined): string | null {
  const start = normalizeLocalStart(rawLocalStart);
  return start ? `${GARMIN_START_PREFIX}${start}` : null;
}

function formatUtcParts(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/** Health API: UTC epoch seconds plus the offset to local time -> local start text. */
export function localStartFromEpoch(startTimeInSeconds: number, offsetInSeconds: number): string | null {
  if (!Number.isFinite(startTimeInSeconds)) return null;
  const offset = Number.isFinite(offsetInSeconds) ? offsetInSeconds : 0;
  return formatUtcParts(new Date((startTimeInSeconds + offset) * 1000));
}

/** Account export JSON: `startTimeLocal` (local wall clock as epoch ms) -> local start text. */
export function localStartFromWallClockMs(startTimeLocal: number): string | null {
  if (!Number.isFinite(startTimeLocal)) return null;
  return formatUtcParts(new Date(startTimeLocal));
}

/** The old trips.garmin_activity_id format, kept for display and Work.WitUS. */
export function legacyGarminId(rawDate: string, title: string): string {
  return `${rawDate}|${title}`;
}

/** The start-time key hidden in an old garmin_activity_id ("<Date>|<Title>"), or null. */
export function startKeyFromLegacyId(garminActivityId: string | null | undefined): string | null {
  if (typeof garminActivityId !== 'string' || garminActivityId === '') return null;
  const bar = garminActivityId.indexOf('|');
  return garminStartKey(bar === -1 ? garminActivityId : garminActivityId.slice(0, bar));
}

/** The start key a stored row answers to: its external_id, else the one in its legacy id. */
export function storedStartKey(row: { external_id?: string | null; garmin_activity_id?: string | null }): string | null {
  if (typeof row.external_id === 'string' && row.external_id.startsWith(GARMIN_START_PREFIX)) return row.external_id;
  return startKeyFromLegacyId(row.garmin_activity_id);
}

export interface TripLike {
  date: string;
  mode: string;
  distance_miles: number | string | null;
  duration_min: number | string | null;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Distance tolerance: the larger of 0.1 mile and 5% of the larger distance. */
export const DISTANCE_TOLERANCE_MILES = 0.1;
export const DISTANCE_TOLERANCE_SHARE = 0.05;
/** Duration tolerance in minutes. */
export const DURATION_TOLERANCE_MIN = 5;

/**
 * True when two trips look like the same outing logged twice: the same date
 * and mode, and either distance within max(0.1 mi, 5%) or duration within
 * 5 minutes. A comparison needs both sides' value; with neither, no match.
 */
export function isPossibleSameTrip(a: TripLike, b: TripLike): boolean {
  if (a.date !== b.date || a.mode !== b.mode) return false;
  const da = toNumber(a.distance_miles);
  const db = toNumber(b.distance_miles);
  if (da !== null && db !== null) {
    const tolerance = Math.max(DISTANCE_TOLERANCE_MILES, DISTANCE_TOLERANCE_SHARE * Math.max(Math.abs(da), Math.abs(db)));
    if (Math.abs(da - db) <= tolerance + 1e-9) return true;
  }
  const ta = toNumber(a.duration_min);
  const tb = toNumber(b.duration_min);
  if (ta !== null && tb !== null && Math.abs(ta - tb) <= DURATION_TOLERANCE_MIN) return true;
  return false;
}
