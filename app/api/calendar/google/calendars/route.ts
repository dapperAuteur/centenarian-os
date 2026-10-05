// app/api/calendar/google/calendars/route.ts
// The calendars on one connected Google account.
//
// GET   ?connection_id=<id> -> asks Google for that account's calendar list, saves it, and
//          returns { calendars }. New calendars arrive switched off; calendars no longer on the
//          account are removed; a calendar already saved keeps its on/off switch.
//          (To read the saved lists without calling Google, use GET /api/calendar/google.)
// PATCH -> body: { connection_id, calendar_id: string, enabled: boolean }. Switches one calendar
//          on or off. Switching on clears the calendar's sync token. -> { calendar }
// connection_id may be left out only when the user has exactly one Google account connected.
//
// Every handler checks the session with the cookie client first, then uses the
// service-role client. Errors are JSON { error, code }: not_connected (404),
// connection_id_required (400), calendar_not_found (404), needs_reauth (409, the user must
// reconnect), google_error (502), migration_missing / not_configured (503).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listCalendars } from '@/lib/google/calendar-client';
import {
  listStoredCalendars,
  resolveUserConnection,
  saveCalendarList,
  setCalendarEnabled,
  withAccessToken,
} from '@/lib/google/connection';
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
  try {
    const body = (await request.json()) as
      | { connection_id?: unknown; calendar_id?: unknown; enabled?: unknown }
      | null;
    connectionId = body?.connection_id ?? null;
    calendarId = body?.calendar_id;
    enabled = body?.enabled;
  } catch {
    // Falls through to the validation error below.
  }
  if (
    typeof calendarId !== 'string' ||
    calendarId === '' ||
    typeof enabled !== 'boolean' ||
    (connectionId !== null && !isUuid(connectionId))
  ) {
    return badRequest('Send { connection_id: string, calendar_id: string, enabled: boolean }.');
  }

  try {
    const db = getServiceDb();
    const resolved = await resolveUserConnection(db, user.id, connectionId as string | null);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message, code: resolved.code }, { status: resolved.status });
    }

    const calendar = await setCalendarEnabled(db, resolved.connection.id, calendarId, enabled);
    if (!calendar) {
      return NextResponse.json(
        { error: 'That calendar is not on the connected account. Refresh the list.', code: 'calendar_not_found' },
        { status: 404 },
      );
    }
    return NextResponse.json({ calendar });
  } catch (err) {
    return calendarErrorResponse(err, 'calendars PATCH');
  }
}
