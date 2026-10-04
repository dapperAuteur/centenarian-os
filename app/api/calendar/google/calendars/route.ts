// app/api/calendar/google/calendars/route.ts
// The calendars on the connected Google account.
//
// GET   -> asks Google for the account's calendar list, saves it, and returns { calendars }.
//          New calendars arrive switched off; calendars no longer on the account are removed;
//          a calendar already saved keeps its on/off switch.
//          (To read the saved list without calling Google, use GET /api/calendar/google.)
// PATCH -> body: { calendar_id: string, enabled: boolean }. Switches one calendar on or off.
//          Switching on clears the calendar's sync token. -> { calendar }
//
// Every handler checks the session with the cookie client first, then uses the
// service-role client. Errors are JSON { error, code }: not_connected (404),
// calendar_not_found (404), needs_reauth (409, the user must reconnect), google_error (502),
// migration_missing / not_configured (503).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listCalendars } from '@/lib/google/calendar-client';
import {
  getConnection,
  getPublicConnection,
  listStoredCalendars,
  saveCalendarList,
  setCalendarEnabled,
  withAccessToken,
} from '@/lib/google/connection';
import { calendarErrorResponse, getServiceDb } from '@/lib/google/route-helpers';

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const notConnected = () =>
  NextResponse.json({ error: 'Google Calendar is not connected.', code: 'not_connected' }, { status: 404 });

export async function GET() {
  const user = await getUser();
  if (!user) return unauthorized();

  try {
    const db = getServiceDb();
    const conn = await getConnection(db, user.id);
    if (!conn) return notConnected();

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

  let calendarId: unknown;
  let enabled: unknown;
  try {
    const body = (await request.json()) as { calendar_id?: unknown; enabled?: unknown } | null;
    calendarId = body?.calendar_id;
    enabled = body?.enabled;
  } catch {
    // Falls through to the validation error below.
  }
  if (typeof calendarId !== 'string' || calendarId === '' || typeof enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'Send { calendar_id: string, enabled: boolean }.', code: 'invalid_request' },
      { status: 400 },
    );
  }

  try {
    const db = getServiceDb();
    const conn = await getPublicConnection(db, user.id);
    if (!conn) return notConnected();

    const calendar = await setCalendarEnabled(db, conn.id, calendarId, enabled);
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
