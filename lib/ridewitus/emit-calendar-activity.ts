// lib/ridewitus/emit-calendar-activity.ts
// Server-only. Sends `calendar.activity` events to RideWitUS (RideWitUS PRD §6.5a). The rules
// for what is sent live in lib/ridewitus/calendar-activity.ts; how it travels lives in
// lib/ridewitus/delivery.ts. This file reads the rows and hands the events over.
//
//   emitChangedItems   after a sync: the rows the sync just wrote (lib/calendar/google-sync.ts)
//   emitCalendarWindow sharing switched on, or "Hide titles" changed: the calendar's rows in
//                      the window (past 14 days, next 30)
//   emitStopSharing    sharing switched off: is_active false for every row of that calendar that
//                      has a location
//
// Every function is a no-op (and reads nothing) when the delivery is not configured, returns a
// summary instead of throwing, and skips quietly when migration 216 is not applied or the user
// has never signed in with WitUS (no witus_sub to send).
//
// `db` must be a SERVICE-ROLE client; every query is scoped by user_id.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  activityWindow,
  buildStopSharing,
  eventsForCalendarWindow,
  eventsForChangedItems,
  type ActivityCalendar,
  type ActivityItem,
} from '@/lib/ridewitus/calendar-activity';
import { defaultActivityDelivery, type ActivityDelivery } from '@/lib/ridewitus/delivery';
import { witusSubForUser } from '@/lib/ridewitus/witus-sub';

const LABEL = '[lib/ridewitus/emit-calendar-activity]';
const ITEM_COLUMNS =
  'id, calendar_id, connection_id, event_status, title_snapshot, parsed, starts_at, ends_at, all_day, time_zone, location';
const CALENDAR_COLUMNS = 'calendar_id, connection_id, summary, share_with_ridewitus, hide_titles_for_ridewitus';
const LOOKUP_CHUNK = 100;
const PAGE = 1000;
/** Upper bound on rows read for one calendar, so a huge calendar cannot stall a request. */
const MAX_ROWS = 10_000;

export type EmitSkip = 'not_configured' | 'migration_missing' | 'no_witus_sub' | 'nothing_to_send' | 'error';

export interface EmitSummary {
  sent: number;
  failed: number;
  skipped?: EmitSkip;
}

export interface EmitOptions {
  delivery?: ActivityDelivery;
  now?: number;
}

interface DbError {
  code?: string;
  message?: string;
}

/** 42703 / PGRST204: a column this feature needs (migration 216) is not there yet. */
function isMissingColumn(error: DbError | null | undefined): boolean {
  return !!error && (error.code === '42703' || error.code === 'PGRST204');
}

const calendarKey = (connectionId: string | null | undefined, calendarId: string) => `${connectionId ?? ''}|${calendarId}`;

async function prepare(
  db: SupabaseClient,
  userId: string,
  options: EmitOptions,
): Promise<{ delivery: ActivityDelivery; witusSub: string; now: number } | EmitSummary> {
  const delivery = options.delivery ?? defaultActivityDelivery();
  if (!delivery.configured) return { sent: 0, failed: 0, skipped: 'not_configured' };
  const witusSub = await witusSubForUser(db, userId);
  if (!witusSub) return { sent: 0, failed: 0, skipped: 'no_witus_sub' };
  return { delivery, witusSub, now: options.now ?? Date.now() };
}

async function deliver(delivery: ActivityDelivery, events: Parameters<ActivityDelivery['deliver']>[0]): Promise<EmitSummary> {
  if (events.length === 0) return { sent: 0, failed: 0, skipped: 'nothing_to_send' };
  const result = await delivery.deliver(events);
  return { sent: result.sent, failed: result.failed, ...(result.skipped ? { skipped: result.skipped } : {}) };
}

/** Events for rows the sync just wrote. Called by syncConnection after it has saved its results. */
export async function emitChangedItems(
  db: SupabaseClient,
  userId: string,
  itemIds: string[],
  options: EmitOptions = {},
): Promise<EmitSummary> {
  try {
    if (itemIds.length === 0) return { sent: 0, failed: 0, skipped: 'nothing_to_send' };
    const ready = await prepare(db, userId, options);
    if ('sent' in ready) return ready;

    // The user's shared calendars first: with none, nothing is read further.
    const { data: calRows, error: calError } = await db
      .from('calendar_sync_calendars')
      .select(CALENDAR_COLUMNS)
      .eq('user_id', userId)
      .eq('share_with_ridewitus', true);
    if (isMissingColumn(calError)) return { sent: 0, failed: 0, skipped: 'migration_missing' };
    if (calError) throw new Error(calError.message);
    const calendars = new Map<string, ActivityCalendar>();
    for (const cal of (calRows as ActivityCalendar[] | null) ?? []) calendars.set(calendarKey(cal.connection_id, cal.calendar_id), cal);
    if (calendars.size === 0) return { sent: 0, failed: 0, skipped: 'nothing_to_send' };

    const items: ActivityItem[] = [];
    const unique = [...new Set(itemIds)];
    for (let i = 0; i < unique.length; i += LOOKUP_CHUNK) {
      const { data, error } = await db
        .from('calendar_sync_items')
        .select(ITEM_COLUMNS)
        .eq('user_id', userId)
        .in('id', unique.slice(i, i + LOOKUP_CHUNK));
      if (isMissingColumn(error)) return { sent: 0, failed: 0, skipped: 'migration_missing' };
      if (error) throw new Error(error.message);
      items.push(...((data as ActivityItem[] | null) ?? []));
    }

    const events = eventsForChangedItems(
      items,
      (item) => calendars.get(calendarKey(item.connection_id, item.calendar_id)),
      ready.witusSub,
      ready.now,
    );
    return await deliver(ready.delivery, events);
  } catch (err) {
    console.error(`${LABEL} emitChangedItems failed:`, err instanceof Error ? err.message : err);
    return { sent: 0, failed: 0, skipped: 'error' };
  }
}

async function readCalendar(
  db: SupabaseClient,
  userId: string,
  connectionId: string,
  calendarId: string,
): Promise<ActivityCalendar | null | 'missing'> {
  const { data, error } = await db
    .from('calendar_sync_calendars')
    .select(CALENDAR_COLUMNS)
    .eq('user_id', userId)
    .eq('connection_id', connectionId)
    .eq('calendar_id', calendarId)
    .maybeSingle();
  if (isMissingColumn(error)) return 'missing';
  if (error) throw new Error(error.message);
  return (data as ActivityCalendar | null) ?? null;
}

/** Sharing switched on, or "Hide titles" changed: send the calendar's qualifying rows in the window. */
export async function emitCalendarWindow(
  db: SupabaseClient,
  userId: string,
  connectionId: string,
  calendarId: string,
  options: EmitOptions = {},
): Promise<EmitSummary> {
  try {
    const ready = await prepare(db, userId, options);
    if ('sent' in ready) return ready;
    const calendar = await readCalendar(db, userId, connectionId, calendarId);
    if (calendar === 'missing') return { sent: 0, failed: 0, skipped: 'migration_missing' };
    if (!calendar?.share_with_ridewitus) return { sent: 0, failed: 0, skipped: 'nothing_to_send' };

    const { from, to } = activityWindow(ready.now);
    const items: ActivityItem[] = [];
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
      const { data, error } = await db
        .from('calendar_sync_items')
        .select(ITEM_COLUMNS)
        .eq('user_id', userId)
        .eq('calendar_id', calendarId)
        .not('location', 'is', null)
        .gte('starts_at', new Date(from).toISOString())
        .lte('starts_at', new Date(to).toISOString())
        .order('starts_at', { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (isMissingColumn(error)) return { sent: 0, failed: 0, skipped: 'migration_missing' };
      if (error) throw new Error(error.message);
      const rows = (data as ActivityItem[] | null) ?? [];
      // Rows left behind by a disconnected account (connection_id null) are not this calendar's any more.
      items.push(...rows.filter((row) => row.connection_id === connectionId));
      if (rows.length < PAGE) break;
    }

    return await deliver(ready.delivery, eventsForCalendarWindow(items, calendar, ready.witusSub, ready.now));
  } catch (err) {
    console.error(`${LABEL} emitCalendarWindow failed:`, err instanceof Error ? err.message : err);
    return { sent: 0, failed: 0, skipped: 'error' };
  }
}

/**
 * Sharing switched off: is_active false for every row of that calendar that has a location
 * (any date: RideWitUS may still hold rows that have since left the window). RideWitUS then
 * deletes the unconfirmed suggestions built from them; confirmed trips stay.
 */
export async function emitStopSharing(
  db: SupabaseClient,
  userId: string,
  connectionId: string,
  calendarId: string,
  options: EmitOptions = {},
): Promise<EmitSummary> {
  try {
    const ready = await prepare(db, userId, options);
    if ('sent' in ready) return ready;

    const ids: string[] = [];
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
      const { data, error } = await db
        .from('calendar_sync_items')
        .select('id, connection_id')
        .eq('user_id', userId)
        .eq('calendar_id', calendarId)
        .not('location', 'is', null)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (isMissingColumn(error)) return { sent: 0, failed: 0, skipped: 'migration_missing' };
      if (error) throw new Error(error.message);
      const rows = (data as { id: string; connection_id: string | null }[] | null) ?? [];
      ids.push(...rows.filter((row) => row.connection_id === connectionId).map((row) => row.id));
      if (rows.length < PAGE) break;
    }

    return await deliver(ready.delivery, buildStopSharing(ids, ready.witusSub, ready.now));
  } catch (err) {
    console.error(`${LABEL} emitStopSharing failed:`, err instanceof Error ? err.message : err);
    return { sent: 0, failed: 0, skipped: 'error' };
  }
}
