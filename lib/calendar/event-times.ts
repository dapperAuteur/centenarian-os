// lib/calendar/event-times.ts
// Pure helpers for when and where a synced Google Calendar event happens (migration 216):
//   - eventTimeColumns: the calendar_sync_items columns starts_at, ends_at, all_day, time_zone,
//     location for one event
//   - formatInZone: an instant as ISO 8601 with the offset of a time zone at that instant
//
// No I/O, no clock, no database (tests/unit/calendar-activity.test.ts). Relative imports keep
// their ".ts" extension because this file runs under `node --test --experimental-strip-types`.
//
// Google field meanings are from the Events resource reference:
//   https://developers.google.com/workspace/calendar/api/v3/reference/events
//   start.date / end.date: "The date, in the format yyyy-mm-dd, if this is an all-day event."
//   end: "The (exclusive) end time of the event."

import { isValidTimeZone } from './event-fields.ts';
import type { GoogleEvent, GoogleEventTime } from '../google/calendar-client.ts';

/** The calendar_sync_items columns added by migration 216. */
export interface EventTimeColumns {
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  time_zone: string | null;
  location: string | null;
}

/** Column names, for the missing-column check before migration 216 is applied. */
export const EVENT_TIME_COLUMN_NAMES = ['starts_at', 'ends_at', 'all_day', 'time_zone', 'location'] as const;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Offset of `timeZone` from UTC at `instantMs`, in minutes (east positive). */
export function zoneOffsetMinutes(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instantMs));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const hour = get('hour') === 24 ? 0 : get('hour');
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  // Whole minutes: drop the milliseconds the formatter cannot show.
  return Math.round((asUtc - Math.floor(instantMs / 1000) * 1000) / 60_000);
}

/** Midnight of `date` (YYYY-MM-DD) in `timeZone`, as an instant (ms). Null for a bad date. */
export function zonedMidnight(date: string, timeZone: string | null | undefined): number | null {
  const m = DATE_RE.exec(date);
  if (!m) return null;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!isValidTimeZone(timeZone)) return guess;
  // Two passes settle the offset across a DST change.
  let instant = guess - zoneOffsetMinutes(guess, timeZone) * 60_000;
  instant = guess - zoneOffsetMinutes(instant, timeZone) * 60_000;
  return instant;
}

function pad(n: number, width = 2): string {
  return String(Math.abs(n)).padStart(width, '0');
}

/**
 * An instant as "YYYY-MM-DDTHH:MM:SS±HH:MM" in `timeZone` (UTC, written "+00:00", when the
 * zone is missing or unknown). Null for a value that is not a date.
 */
export function formatInZone(value: string | number, timeZone: string | null | undefined): string | null {
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (Number.isNaN(ms)) return null;
  const offset = isValidTimeZone(timeZone) ? zoneOffsetMinutes(ms, timeZone) : 0;
  const local = new Date(Math.floor(ms / 1000) * 1000 + offset * 60_000);
  const sign = offset < 0 ? '-' : '+';
  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}` +
    `${sign}${pad(Math.trunc(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
  );
}

function instantOf(time: GoogleEventTime | null | undefined, timeZone: string | null): { iso: string; allDay: boolean } | null {
  if (!time) return null;
  if (time.date && DATE_RE.test(time.date)) {
    const ms = zonedMidnight(time.date, timeZone);
    return ms === null ? null : { iso: new Date(ms).toISOString(), allDay: true };
  }
  if (time.dateTime) {
    const ms = Date.parse(time.dateTime);
    return Number.isNaN(ms) ? null : { iso: new Date(ms).toISOString(), allDay: false };
  }
  return null;
}

/**
 * The migration 216 columns for one event. Null when the event has no usable start (a cancelled
 * event in an incremental sync can arrive without one): the caller then keeps what it stored.
 *
 *   time_zone  start.timeZone when valid, else the calendar's time zone, else null.
 *   starts_at  timed: the start instant; all-day: midnight of start.date in time_zone.
 *   ends_at    the same for end; null when Google sent no usable end.
 *   all_day    true for start.date.
 *   location   trimmed Location field, null when empty.
 */
export function eventTimeColumns(
  event: Pick<GoogleEvent, 'start' | 'end' | 'location'>,
  calendarTimeZone: string | null | undefined,
): EventTimeColumns | null {
  const ownZone = event.start?.timeZone;
  const timeZone = isValidTimeZone(ownZone) ? ownZone : isValidTimeZone(calendarTimeZone) ? calendarTimeZone : null;
  const start = instantOf(event.start, timeZone);
  if (!start) return null;
  const end = instantOf(event.end, timeZone);
  const location = event.location?.trim() || null;
  return {
    starts_at: start.iso,
    ends_at: end?.iso ?? null,
    all_day: start.allDay,
    time_zone: timeZone,
    location,
  };
}
