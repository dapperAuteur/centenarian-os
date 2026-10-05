// app/api/calendar/google/calendars/route.ts
// The calendars on one connected Google account.
//
// GET   ?connection_id=<id> -> asks Google for that account's calendar list, saves it, and
//          returns { calendars }. New calendars arrive switched off; calendars no longer on the
//          account are removed; a calendar already saved keeps its on/off switch.
//          (To read the saved lists without calling Google, use GET /api/calendar/google.)
// PATCH -> body: { connection_id, calendar_id: string, enabled?: boolean,
//          share_with_ridewitus?: boolean, hide_titles_for_ridewitus?: boolean } (at least one of
//          the three). `enabled` switches the calendar's sync on or off; switching on clears its
//          sync token. The two RideWitUS switches (migration 216) decide whether the calendar's
//          events with a location go to RideWitUS, and whether their titles are replaced by
//          "Event". Switching sharing on (or changing "Hide titles" while shared) sends the
//          calendar's events in the window; switching it off tells RideWitUS to drop them
//          (is_active false). Both run after the response. -> { calendar }
// connection_id may be left out only when the user has exactly one Google account connected.
//
// Every handler checks the session with the cookie client first, then uses the
// service-role client. Errors are JSON { error, code }: not_connected (404),
// connection_id_required (400), calendar_not_found (404), needs_reauth (409, the user must
// reconnect), google_error (502), migration_missing / not_configured (503). A RideWitUS switch
// sent before migration 216 is applied answers 503 { code: 'migration_missing' }.

import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listCalendars } from '@/lib/google/calendar-client';
import {
  listStoredCalendars,
  resolveUserConnection,
  saveCalendarList,
  setCalendarEnabled,
  setCalendarSharing,
  withAccessToken,
  type StoredCalendar,
} from '@/lib/google/connection';
import { emitCalendarWindow, emitStopSharing } from '@/lib/ridewitus/emit-calendar-activity';
import { calendarErrorResponse, getServiceDb, isUuid } from '@/lib/google/route-helpers';

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const badRequest = (error: string) => NextResponse.json({ error, code: 'invalid_request' }, { status: 400 });

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return unauthorized();

  const connectionId = request.nextUrl.searchParams.get('connection_id');
  if (connectionId !== null && !isUuid(connectionId)) return badRequest('connection_id must be a connection id.');

  try {
    const db = getServiceDb();
    const resolved = await resolveUserConnection(db, user.id, connectionId);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message, code: resolved.code }, { status: resolved.status });
    }
    const conn = resolved.connection;

    const fromGoogle = await withAccessToken(db, conn, (accessToken) => listCalendars(accessToken));
    await saveCalendarList(db, conn, fromGoogle);
    return NextResponse.json({ calendars: await listStoredCalendars(db, conn.id) });
  } catch (err) {
    return calendarErrorResponse(err, 'calendars GET');
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) return unauthorized();

  let connectionId: unknown = null;
  let calendarId: unknown;
  let enabled: unknown;
  let share: unknown;
  let hideTitles: unknown;
  try {
    const body = (await request.json()) as
      | {
          connection_id?: unknown;
          calendar_id?: unknown;
          enabled?: unknown;
          share_with_ridewitus?: unknown;
          hide_titles_for_ridewitus?: unknown;
        }
      | null;
    connectionId = body?.connection_id ?? null;
    calendarId = body?.calendar_id;
    enabled = body?.enabled;
    share = body?.share_with_ridewitus;
    hideTitles = body?.hide_titles_for_ridewitus;
  } catch {
    // Falls through to the validation error below.
  }
  const optionalBool = (value: unknown) => value === undefined || typeof value === 'boolean';
  if (
    typeof calendarId !== 'string' ||
    calendarId === '' ||
    !optionalBool(enabled) ||
    !optionalBool(share) ||
    !optionalBool(hideTitles) ||
    (enabled === undefined && share === undefined && hideTitles === undefined) ||
    (connectionId !== null && !isUuid(connectionId))
  ) {
    return badRequest(
      'Send { connection_id: string, calendar_id: string } with enabled, share_with_ridewitus or hide_titles_for_ridewitus (booleans).',
    );
  }

  try {
    const db = getServiceDb();
    const resolved = await resolveUserConnection(db, user.id, connectionId as string | null);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message, code: resolved.code }, { status: resolved.status });
    }

    const conn = resolved.connection;
    const notFound = () =>
      NextResponse.json(
        { error: 'That calendar is not on the connected account. Refresh the list.', code: 'calendar_not_found' },
        { status: 404 },
      );

    let calendar: StoredCalendar | null = null;
    if (typeof enabled === 'boolean') {
      calendar = await setCalendarEnabled(db, conn.id, calendarId, enabled);
      if (!calendar) return notFound();
    }

    if (typeof share === 'boolean' || typeof hideTitles === 'boolean') {
      const result = await setCalendarSharing(db, conn.id, calendarId, {
        share_with_ridewitus: share as boolean | undefined,
        hide_titles_for_ridewitus: hideTitles as boolean | undefined,
      });
      if (!result.ok) {
        if (result.code === 'calendar_not_found') return notFound();
        return NextResponse.json(
          {
            error: 'Sharing with RideWitUS is not available on this site yet: database migration 216 must be applied.',
            code: 'migration_missing',
          },
          { status: 503 },
        );
      }
      calendar = result.calendar;
      const nowShared = result.calendar.share_with_ridewitus === true;
      const userId = user.id;
      if (result.before.share && !nowShared) {
        after(() => emitStopSharing(db, userId, conn.id, calendarId).then(() => undefined));
      } else if (nowShared && (!result.before.share || result.before.hideTitles !== result.calendar.hide_titles_for_ridewitus)) {
        after(() => emitCalendarWindow(db, userId, conn.id, calendarId).then(() => undefined));
      }
    }

    return NextResponse.json({ calendar });
  } catch (err) {
    return calendarErrorResponse(err, 'calendars PATCH');
  }
}
