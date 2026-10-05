// lib/ridewitus/calendar-activity.ts
// Pure builder for the `calendar.activity` event CentenarianOS sends to RideWitUS
// (RideWitUS PRD §5.8 and §6.5a). RideWitUS uses these to suggest trips to and from the user's
// calendar activities; it never connects to Google itself.
//
// WHAT IS SENT (one event per synced Google Calendar event, all filters applied here):
//   event_id        "cal:" + SHA-256 of calendar_sync_items.id. Stable: the same row always gives
//                   the same id, and the Google event id never leaves CentenarianOS.
//   event_type      "calendar.activity"
//   schema_version  1
//   witus_sub       the user's WitUS account id (PRD §6.3)
//   occurred_at     when CentenarianOS sent it (the newest send wins on the receiver)
//   starts_at, ends_at  ISO 8601 with the offset of the event's time zone
//   all_day, time_zone
//   title           the title without capture tags; "Event" when the calendar hides titles
//   location        the Location field as typed in Google
//   calendar_label  the calendar's name (never Google's calendar id, which is often an email)
//   status          "confirmed" or "cancelled"
//   trip_token      the parsed #trip data (distance, mode, duration), or null
//   is_active       false when the event no longer qualifies or its calendar stopped sharing
//
// NEVER SENT: the description, attendees, meeting links, Google event or calendar ids, the
// account email, or any event from a calendar that is not shared.
//
// FILTERS: shared calendars only; a location is required (all-day events included, only with a
// location); the window is the past 14 days and the next 30 days by start time.
//
// No I/O and no clock (tests/unit/calendar-activity.test.ts). The relative import keeps its
// ".ts" extension because this file runs under `node --test --experimental-strip-types`.

import { createHash } from 'node:crypto';
import { formatInZone } from '../calendar/event-times.ts';

export const CALENDAR_ACTIVITY_EVENT_TYPE = 'calendar.activity';
export const CALENDAR_ACTIVITY_SCHEMA_VERSION = 1;
/** Title sent when the calendar's "Hide titles" switch is on (PRD §13 Q7). */
export const HIDDEN_TITLE = 'Event';
/** Used when a calendar has no name. */
export const DEFAULT_CALENDAR_LABEL = 'Calendar';
export const WINDOW_PAST_DAYS = 14;
export const WINDOW_FUTURE_DAYS = 30;
/** Receivers accept at most this many events per request (PRD §6.2). */
export const MAX_EVENTS_PER_REQUEST = 500;

const DAY_MS = 86_400_000;

/** The calendar_sync_items columns the feed reads. */
export interface ActivityItem {
  id: string;
  calendar_id: string;
  connection_id?: string | null;
  event_status: string | null;
  title_snapshot: string | null;
  parsed: Record<string, unknown> | null;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean | null;
  time_zone: string | null;
  location: string | null;
}

/** The calendar_sync_calendars columns the feed reads. */
export interface ActivityCalendar {
  calendar_id: string;
  connection_id?: string | null;
  summary: string | null;
  share_with_ridewitus: boolean | null;
  hide_titles_for_ridewitus: boolean | null;
}

export interface TripToken {
  distance_miles: number | null;
  mode: string | null;
  duration_min: number | null;
}

export interface CalendarActivityEvent {
  event_id: string;
  event_type: typeof CALENDAR_ACTIVITY_EVENT_TYPE;
  schema_version: typeof CALENDAR_ACTIVITY_SCHEMA_VERSION;
  witus_sub: string;
  occurred_at: string;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean | null;
  time_zone: string | null;
  title: string | null;
  location: string | null;
  calendar_label: string | null;
  status: 'confirmed' | 'cancelled' | null;
  trip_token: TripToken | null;
  is_active: boolean;
}

export type SkipReason = 'not_shared' | 'no_time' | 'outside_window' | 'no_location';

export type ActivityDecision =
  | { kind: 'send'; event: CalendarActivityEvent }
  | { kind: 'skip'; reason: SkipReason };

/** Stable event id: "cal:" + hex SHA-256 of the calendar_sync_items id. */
export function activityEventId(itemId: string): string {
  return `cal:${createHash('sha256').update(itemId).digest('hex')}`;
}

/** The feed window around `nowMs`: [now - 14 days, now + 30 days]. */
export function activityWindow(nowMs: number): { from: number; to: number } {
  return { from: nowMs - WINDOW_PAST_DAYS * DAY_MS, to: nowMs + WINDOW_FUTURE_DAYS * DAY_MS };
}

export function inWindow(startsAt: string, nowMs: number): boolean {
  const ms = Date.parse(startsAt);
  if (Number.isNaN(ms)) return false;
  const { from, to } = activityWindow(nowMs);
  return ms >= from && ms <= to;
}

/** The parsed #trip data on a sync row, or null when the event is not a #trip. */
export function tripTokenOf(parsed: Record<string, unknown> | null | undefined): TripToken | null {
  if (!parsed || parsed.kind !== 'trip') return null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    distance_miles: num(parsed.distanceMiles),
    mode: typeof parsed.mode === 'string' ? parsed.mode : null,
    duration_min: num(parsed.durationMin),
  };
}

/** The title to send: without capture tags, or "Event" when hidden. */
export function activityTitle(item: Pick<ActivityItem, 'title_snapshot' | 'parsed'>, hide: boolean): string {
  if (hide) return HIDDEN_TITLE;
  const clean = typeof item.parsed?.cleanTitle === 'string' ? item.parsed.cleanTitle.trim() : '';
  return clean || item.title_snapshot?.trim() || HIDDEN_TITLE;
}

/** A retraction: the event no longer qualifies, or its calendar stopped sharing. No details. */
export function buildRetraction(itemId: string, witusSub: string, nowMs: number): CalendarActivityEvent {
  return {
    event_id: activityEventId(itemId),
    event_type: CALENDAR_ACTIVITY_EVENT_TYPE,
    schema_version: CALENDAR_ACTIVITY_SCHEMA_VERSION,
    witus_sub: witusSub,
    occurred_at: new Date(nowMs).toISOString(),
    starts_at: null,
    ends_at: null,
    all_day: null,
    time_zone: null,
    title: null,
    location: null,
    calendar_label: null,
    status: null,
    trip_token: null,
    is_active: false,
  };
}

/**
 * What to send for one synced event, or why nothing is sent.
 *   not_shared      the calendar's "Share with RideWitUS" switch is off
 *   no_time         the row has no start yet (synced before migration 216 and not backfilled)
 *   outside_window  starts more than 14 days ago or more than 30 days ahead
 *   no_location     no Location in Google (all-day events included)
 * A cancelled event that passes the filters is sent with status "cancelled".
 */
export function decideActivity(
  item: ActivityItem,
  calendar: ActivityCalendar | null | undefined,
  witusSub: string,
  nowMs: number,
): ActivityDecision {
  if (!calendar?.share_with_ridewitus) return { kind: 'skip', reason: 'not_shared' };
  if (!item.starts_at) return { kind: 'skip', reason: 'no_time' };
  if (!inWindow(item.starts_at, nowMs)) return { kind: 'skip', reason: 'outside_window' };
  const location = item.location?.trim();
  if (!location) return { kind: 'skip', reason: 'no_location' };

  return {
    kind: 'send',
    event: {
      event_id: activityEventId(item.id),
      event_type: CALENDAR_ACTIVITY_EVENT_TYPE,
      schema_version: CALENDAR_ACTIVITY_SCHEMA_VERSION,
      witus_sub: witusSub,
      occurred_at: new Date(nowMs).toISOString(),
      starts_at: formatInZone(item.starts_at, item.time_zone),
      ends_at: item.ends_at ? formatInZone(item.ends_at, item.time_zone) : null,
      all_day: item.all_day === true,
      time_zone: item.time_zone,
      title: activityTitle(item, calendar.hide_titles_for_ridewitus === true),
      location,
      calendar_label: calendar.summary?.trim() || DEFAULT_CALENDAR_LABEL,
      status: item.event_status === 'cancelled' ? 'cancelled' : 'confirmed',
      trip_token: tripTokenOf(item.parsed),
      is_active: true,
    },
  };
}

/**
 * Events for rows the sync just wrote. A row in a shared calendar that now fails the location
 * filter is retracted (is_active false), so a location removed in Google also leaves RideWitUS.
 * Rows outside the window, without a time, or in calendars that are not shared send nothing
 * (stopping sharing is handled by buildStopSharing).
 */
export function eventsForChangedItems(
  items: ActivityItem[],
  calendarOf: (item: ActivityItem) => ActivityCalendar | null | undefined,
  witusSub: string,
  nowMs: number,
): CalendarActivityEvent[] {
  const out: CalendarActivityEvent[] = [];
  for (const item of items) {
    const decision = decideActivity(item, calendarOf(item), witusSub, nowMs);
    if (decision.kind === 'send') out.push(decision.event);
    else if (decision.reason === 'no_location') out.push(buildRetraction(item.id, witusSub, nowMs));
  }
  return out;
}

/** Events for a whole calendar (sharing switched on, or "Hide titles" changed): only rows that qualify. */
export function eventsForCalendarWindow(
  items: ActivityItem[],
  calendar: ActivityCalendar,
  witusSub: string,
  nowMs: number,
): CalendarActivityEvent[] {
  const out: CalendarActivityEvent[] = [];
  for (const item of items) {
    const decision = decideActivity(item, calendar, witusSub, nowMs);
    if (decision.kind === 'send') out.push(decision.event);
  }
  return out;
}

/** Sharing switched off: is_active false for every row of that calendar that could have been sent. */
export function buildStopSharing(itemIds: string[], witusSub: string, nowMs: number): CalendarActivityEvent[] {
  return itemIds.map((id) => buildRetraction(id, witusSub, nowMs));
}

/** Splits events into request-sized batches. */
export function batchEvents<T>(events: T[], size: number = MAX_EVENTS_PER_REQUEST): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < events.length; i += size) batches.push(events.slice(i, i + size));
  return batches;
}
