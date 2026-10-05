// lib/calendar/event-fields.ts
// Pure helpers for the Google Calendar -> planner sync (lib/calendar/google-sync.ts):
//   - wall-clock date and time of an event in its own (or its calendar's) time zone
//   - the planner task fields an event becomes
//   - what to do with an event given what the sync saw last time (the sync decision)
//
// No I/O, no clock, no database (tests/unit/google-sync.test.ts). Relative imports keep their
// ".ts" extension because this file runs under `node --test --experimental-strip-types`.
//
// Google field meanings are from the Events resource reference:
//   https://developers.google.com/workspace/calendar/api/v3/reference/events

import { parseCaptureTitle, type ParsedCapture } from '../capture/parse-tokens.ts';
import type { GoogleEvent } from '../google/calendar-client.ts';

/** All-day events have no time; they are scheduled at 09:00, as the .ics import does. */
export const ALL_DAY_TIME = '09:00';
/** tasks.tag is NOT NULL. Used when the connection has no default_tag. */
export const DEFAULT_SYNC_TAG = 'LIFESTYLE';
/** Longest task description the sync writes. */
export const MAX_DESCRIPTION_LENGTH = 1000;
/** Title for an event with no summary (Google leaves summary out for untitled events). */
export const UNTITLED_EVENT = '(No title)';

export type ParseStatus = 'ok' | 'flagged' | 'task_only';

// ── Time zones ──────────────────────────────────────────────────────────────────

/** True when `tz` is an IANA time zone this runtime knows. */
export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface WallClock {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24-hour */
  time: string;
}

const RFC3339_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/;

/**
 * The wall-clock date and time of an RFC 3339 instant in `timeZone`.
 *
 * Without a usable time zone, the date and time written in the string itself are used: an
 * RFC 3339 value carries its own offset ("2026-10-05T14:00:00-07:00"), so its literal date and
 * time ARE the wall clock at that offset. The server's own time zone is never used.
 * Returns null for a value that is not a date-time.
 */
export function wallClockAt(dateTime: string, timeZone: string | null | undefined): WallClock | null {
  const literal = RFC3339_RE.exec(dateTime);
  if (!literal) return null;
  const instant = Date.parse(dateTime);
  if (!isValidTimeZone(timeZone) || Number.isNaN(instant)) {
    return { date: literal[1], time: `${literal[2]}:${literal[3]}` };
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  // Some engines print midnight as "24" even with h23; normalise.
  const hour = get('hour') === '24' ? '00' : get('hour');
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${hour}:${get('minute')}` };
}

/**
 * When the event starts, as a planner date and time.
 *   All-day (start.date):  that date at 09:00.
 *   Timed (start.dateTime): in the event's own time zone (start.timeZone, "The time zone in
 *                           which the time is specified"), else the calendar's time zone, else
 *                           the offset written in the value.
 * Null when the event has no usable start (a cancelled event in an incremental sync can arrive
 * without one).
 */
export function eventStart(event: GoogleEvent, calendarTimeZone: string | null | undefined): WallClock | null {
  const start = event.start;
  if (!start) return null;
  if (start.date && /^\d{4}-\d{2}-\d{2}$/.test(start.date)) return { date: start.date, time: ALL_DAY_TIME };
  if (start.dateTime) {
    const tz = isValidTimeZone(start.timeZone) ? start.timeZone : calendarTimeZone;
    return wallClockAt(start.dateTime, tz);
  }
  return null;
}

// ── Event -> task fields ────────────────────────────────────────────────────────

/**
 * Google event descriptions can hold HTML (the Calendar web UI writes <br>, <b>, <a>). The task
 * description is plain text, so tags are removed and the common entities decoded.
 */
export function htmlToText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const WARNING_TEXT: Record<string, string> = {
  missing_amount: 'no amount found',
  missing_distance: 'no distance found',
  multiple_kinds: 'more than one kind tag',
  unknown_token: 'unknown #tag',
};

/** ok: parsed cleanly; flagged: a token is there but data is missing; task_only: no token. */
export function parseStatusOf(parsed: ParsedCapture): ParseStatus {
  if (parsed.warnings.length > 0) return 'flagged';
  return parsed.kind === 'task' ? 'task_only' : 'ok';
}

export interface EventTaskFields {
  date: string;
  time: string;
  activity: string;
  description: string | null;
  tag: string;
  parsed: ParsedCapture;
  parseStatus: ParseStatus;
  parseError: string | null;
}

/**
 * The planner task an event becomes. Null when the event has no usable start.
 *   activity     the title without its capture tokens (parseCaptureTitle().cleanTitle); the
 *                raw title when nothing is left.
 *   description  event description (as plain text) + "Location: ..." + a note when the title
 *                had a token the parser could not complete; trimmed to 1000 characters.
 *   tag          the connection's default_tag, else LIFESTYLE.
 */
export function eventToTaskFields(
  event: GoogleEvent,
  calendarTimeZone: string | null | undefined,
  defaultTag?: string | null,
): EventTaskFields | null {
  const start = eventStart(event, calendarTimeZone);
  if (!start) return null;

  const title = (event.summary ?? '').trim() || UNTITLED_EVENT;
  const parsed = parseCaptureTitle(title, { startTime: start.time });
  const parseStatus = parseStatusOf(parsed);
  const parseError =
    parseStatus === 'flagged' ? parsed.warnings.map((w) => WARNING_TEXT[w] ?? w).join(', ') : null;

  const sections: string[] = [];
  const description = event.description ? htmlToText(event.description) : '';
  if (description) sections.push(description);
  const location = event.location?.trim();
  if (location) sections.push(`Location: ${location}`);
  if (parseError) sections.push(`Calendar sync: check the title (${parseError}).`);
  let text = sections.join('\n\n');
  if (text.length > MAX_DESCRIPTION_LENGTH) text = `${text.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…`;

  const tag = defaultTag?.trim() || DEFAULT_SYNC_TAG;

  return {
    date: start.date,
    time: start.time,
    activity: parsed.cleanTitle.trim() || title,
    description: text || null,
    tag,
    parsed,
    parseStatus,
    parseError,
  };
}

// ── Sync decision ───────────────────────────────────────────────────────────────

/** What the sync stored about an event last time (a calendar_sync_items row). */
export interface SyncItemState {
  id: string;
  etag: string | null;
  task_id: string | null;
  event_status: string | null;
}

export type SyncAction =
  /** Nothing to do: Google reports the same etag as last time. */
  | { action: 'skip' }
  /** A cancelled event the sync never made a task for: nothing to store. */
  | { action: 'ignore' }
  /** Make a task (new event, or a create that did not finish last time). */
  | { action: 'create' }
  /** Update the task's fields; `unarchive` when the sync archived it for a cancellation that was undone. */
  | { action: 'update'; unarchive: boolean }
  /** Cancelled: archive the task (never delete it). */
  | { action: 'archive' }
  /** Refresh the stored row only; no task is touched (the user deleted it, or it never existed). */
  | { action: 'record_only' };

export const isCancelled = (event: Pick<GoogleEvent, 'status'>) => event.status === 'cancelled';

/**
 * Decides what to do with one event.
 *
 * - Same etag as stored -> skip. ("ETag of the resource", which changes when the event does.)
 * - Cancelled: archive the task if there is one; with no stored row it is ignored (a full sync
 *   with showDeleted=true also returns old cancelled instances of recurring events).
 * - Not cancelled, no stored row -> create.
 * - Stored row with a task -> update (moved events get the new date and time).
 * - Stored row without a task:
 *     etag null   -> the create was interrupted after the row was written; create again (the
 *                    sync first looks for a task pointing at the row, so nothing is doubled).
 *     etag set    -> the task existed and the user deleted it (tasks -> calendar_sync_items is
 *                    ON DELETE SET NULL); respect that and do not bring it back.
 */
export function decideSyncAction(event: GoogleEvent, item: SyncItemState | null): SyncAction {
  if (item && item.etag && event.etag && item.etag === event.etag) return { action: 'skip' };

  if (isCancelled(event)) {
    if (!item) return { action: 'ignore' };
    if (item.task_id) return { action: 'archive' };
    return { action: 'record_only' };
  }

  if (!item) return { action: 'create' };
  if (item.task_id) return { action: 'update', unarchive: item.event_status === 'cancelled' };
  if (!item.etag) return { action: 'create' };
  return { action: 'record_only' };
}

// ── Run summary ─────────────────────────────────────────────────────────────────

export interface SyncCounts {
  created: number;
  updated: number;
  archived: number;
  flagged: number;
  unchanged: number;
}

export const emptyCounts = (): SyncCounts => ({ created: 0, updated: 0, archived: 0, flagged: 0, unchanged: 0 });

export function addCounts(a: SyncCounts, b: SyncCounts): SyncCounts {
  return {
    created: a.created + b.created,
    updated: a.updated + b.updated,
    archived: a.archived + b.archived,
    flagged: a.flagged + b.flagged,
    unchanged: a.unchanged + b.unchanged,
  };
}

/** The first-sync window: 30 days back, 180 days ahead of `now`, as RFC 3339 instants. */
export function fullSyncWindow(now: number): { timeMin: string; timeMax: string } {
  const day = 86_400_000;
  return {
    timeMin: new Date(now - 30 * day).toISOString(),
    timeMax: new Date(now + 180 * day).toISOString(),
  };
}
