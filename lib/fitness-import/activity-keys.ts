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
 * Distance within max(0.1 mi, 5%) or duration within 5 minutes. Dates and
 * modes are not looked at. A comparison needs both sides' value.
 */
export function valuesClose(a: Omit<TripLike, 'date' | 'mode'>, b: Omit<TripLike, 'date' | 'mode'>): boolean {
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

/**
 * True when two stored rows look like the same outing logged twice: the same
 * date and mode, and either distance within max(0.1 mi, 5%) or duration within
 * 5 minutes. A comparison needs both sides' value; with neither, no match.
 * Comparing a device activity with trips you logged yourself goes through
 * loggedTripCandidates + findLoggedTripMatch, which also understand round
 * trips, multi-stop routes and trips saved without a distance or time.
 */
export function isPossibleSameTrip(a: TripLike, b: TripLike): boolean {
  if (a.date !== b.date || a.mode !== b.mode) return false;
  return valuesClose(a, b);
}

// ─── Device activity vs trips you logged yourself ────────────────────────────
//
// A trip row is not always the whole outing a watch recorded:
//   - a round trip stores the one-way distance and time with is_round_trip
//     (Travel shows and counts it doubled);
//   - a multi-stop route (one from a template, too) is one row per leg sharing
//     a route_id, and a round-trip route logged from a template before return
//     legs were saved has no return leg;
//   - a template trip can carry no distance or time at all;
//   - a template logged from the Travel dashboard without a date took the
//     server's UTC date, so an evening outing can sit on the next day (and a
//     morning one, east of UTC, on the day before).
// So each logged trip is compared in every shape it can take, and a same-day,
// same-mode trip with nothing to compare is a possible match rather than none.
// A possible match is only a flag: the import skips it unless the person says
// "import possible matches too", so erring towards a flag is the safe side.

export interface LoggedTrip extends TripLike {
  id: string;
  is_round_trip?: boolean | null;
  route_id?: string | null;
  leg_order?: number | null;
}

/** How a logged trip was compared: as stored, both ways, a route's legs added up, or nothing to compare. */
export type MatchBasis = 'as_logged' | 'round_trip' | 'route_total' | 'no_values';

export interface TripCandidate {
  /** The trip the match points at (a route's first leg for a route total). */
  tripId: string;
  date: string;
  mode: string;
  distance_miles: number | null;
  duration_min: number | null;
  basis: MatchBasis;
}

const sumOrNull = (values: Array<number | null>): number | null => {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return Math.round(present.reduce((s, v) => s + v, 0) * 1000) / 1000;
};

const doubled = (value: number | null) => (value === null ? null : value * 2);

/**
 * Every shape a logged trip can take next to a device recording of the same
 * outing. `roundTripRoutes` holds the ids of routes saved as round trips
 * (trip_routes.is_round_trip); legs carry no flag of their own.
 */
export function loggedTripCandidates(
  trips: readonly LoggedTrip[],
  roundTripRoutes: ReadonlySet<string> = new Set(),
): TripCandidate[] {
  const plain: TripCandidate[] = [];
  const both: TripCandidate[] = [];
  const blank: TripCandidate[] = [];
  const routes = new Map<string, LoggedTrip[]>();
  for (const trip of trips) {
    const distance = toNumber(trip.distance_miles);
    const duration = toNumber(trip.duration_min);
    const base = { tripId: trip.id, date: trip.date, mode: trip.mode };
    if (distance === null && duration === null) {
      blank.push({ ...base, distance_miles: null, duration_min: null, basis: 'no_values' });
    } else {
      plain.push({ ...base, distance_miles: distance, duration_min: duration, basis: 'as_logged' });
      if (trip.is_round_trip === true) {
        both.push({ ...base, distance_miles: doubled(distance), duration_min: doubled(duration), basis: 'round_trip' });
      }
    }
    if (trip.route_id) {
      // One total per route, day and mode: a route can mix modes or span days.
      const key = `${trip.route_id}|${trip.date}|${trip.mode}`;
      const legs = routes.get(key);
      if (legs) legs.push(trip);
      else routes.set(key, [trip]);
    }
  }
  const totals: TripCandidate[] = [];
  for (const legs of routes.values()) {
    const ordered = [...legs].sort((a, b) => (a.leg_order ?? 0) - (b.leg_order ?? 0));
    const distance = sumOrNull(ordered.map((leg) => toNumber(leg.distance_miles)));
    const duration = sumOrNull(ordered.map((leg) => toNumber(leg.duration_min)));
    if (distance === null && duration === null) continue; // every leg is already a no_values candidate
    const base = { tripId: ordered[0].id, date: ordered[0].date, mode: ordered[0].mode, basis: 'route_total' as const };
    if (ordered.length > 1) totals.push({ ...base, distance_miles: distance, duration_min: duration });
    if (roundTripRoutes.has(ordered[0].route_id as string)) {
      totals.push({ ...base, distance_miles: doubled(distance), duration_min: doubled(duration) });
    }
  }
  return [...plain, ...both, ...totals, ...blank];
}

/** "2026-10-07" + 1 -> "2026-10-08". */
export function shiftDate(date: string, days: number): string {
  const time = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(time)) return date;
  return new Date(time + days * 86_400_000).toISOString().slice(0, 10);
}

export interface LoggedTripMatch {
  tripId: string;
  basis: MatchBasis;
  /** The logged trip's date (a day either side of the activity's when the date came out as UTC). */
  date: string;
}

/**
 * The logged trips a device activity may duplicate, one per trip, best first.
 * The first of these that finds anything wins: same day with a close distance
 * or time; same day with nothing to compare; a day either side with a close
 * distance or time. Empty when none does.
 */
export function loggedTripMatches(activity: TripLike, candidates: readonly TripCandidate[]): LoggedTripMatch[] {
  const sameMode = candidates.filter((c) => c.mode === activity.mode);
  const nextDays = new Set([shiftDate(activity.date, -1), shiftDate(activity.date, 1)]);
  const tiers: Array<(c: TripCandidate) => boolean> = [
    (c) => c.date === activity.date && c.basis !== 'no_values' && valuesClose(activity, c),
    (c) => c.date === activity.date && c.basis === 'no_values',
    (c) => nextDays.has(c.date) && c.basis !== 'no_values' && valuesClose(activity, c),
  ];
  for (const inTier of tiers) {
    const found = new Map<string, LoggedTripMatch>();
    for (const c of sameMode) {
      if (inTier(c) && !found.has(c.tripId)) found.set(c.tripId, { tripId: c.tripId, basis: c.basis, date: c.date });
    }
    if (found.size > 0) return [...found.values()];
  }
  return [];
}

/** The logged trip a device activity most likely duplicates, or null (see loggedTripMatches). */
export function findLoggedTripMatch(activity: TripLike, candidates: readonly TripCandidate[]): LoggedTripMatch | null {
  return loggedTripMatches(activity, candidates)[0] ?? null;
}
