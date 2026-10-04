// app/api/calendar/google/route.ts
// The signed-in user's Google Calendar connection.
//
// GET    -> { configured, connection, calendars }
//           `connection` is null when nothing is connected. It never carries a token column.
//           `configured` is false while the server still lacks its Google setup.
// PATCH  -> body: any of { default_account_id, default_trip_mode, default_tag } (null clears one).
//           Saves the defaults in connection.settings. -> { connection }
// DELETE -> revokes the grant at Google, then deletes the connection row (tokens and saved
//           calendars go with it). -> { ok, revoked, already_revoked, warning }
//           If Google does not confirm the revocation, nothing is deleted and the answer is
//           { error, code: 'revoke_failed', can_force: true }; DELETE ?force=1 deletes anyway.
//
// Every handler checks the session with the cookie client first, then uses the
// service-role client, because calendar_connections is closed to browser roles.
// Errors are JSON { error, code }; see describeCalendarError for the codes.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TRIP_MODES } from '@/lib/capture/tokens';
import { revokeToken } from '@/lib/google/calendar-client';
import {
  deleteConnection,
  getConnection,
  getPublicConnection,
  listStoredCalendars,
  tokenToRevoke,
  updateSettings,
  type CalendarConnectionSettings,
} from '@/lib/google/connection';
import {
  calendarErrorResponse,
  describeCalendarError,
  getServiceDb,
  missingServerSetup,
} from '@/lib/google/route-helpers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TAG_LENGTH = 40;

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const badRequest = (error: string) => NextResponse.json({ error, code: 'invalid_request' }, { status: 400 });

export async function GET() {
  const user = await getUser();
  if (!user) return unauthorized();

  try {
    const db = getServiceDb();
    const connection = await getPublicConnection(db, user.id);
    const calendars = connection ? await listStoredCalendars(db, connection.id) : [];
    return NextResponse.json({
      configured: missingServerSetup().length === 0,
      connection,
      calendars,
    });
  } catch (err) {
    return calendarErrorResponse(err, 'GET');
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) return unauthorized();

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    body = parsed as Record<string, unknown>;
  } catch {
    return badRequest('Send a JSON object.');
  }

  const changes: CalendarConnectionSettings = {};

  if ('default_account_id' in body) {
    const value = body.default_account_id;
    if (value !== null && (typeof value !== 'string' || !UUID_RE.test(value))) {
      return badRequest('default_account_id must be an account id or null.');
    }
    changes.default_account_id = value;
  }
  if ('default_trip_mode' in body) {
    const value = body.default_trip_mode;
    if (value !== null && !TRIP_MODES.some((mode) => mode === value)) {
      return badRequest(`default_trip_mode must be one of ${TRIP_MODES.join(', ')}, or null.`);
    }
    changes.default_trip_mode = value as string | null;
  }
  if ('default_tag' in body) {
    const value = typeof body.default_tag === 'string' ? body.default_tag.trim() : body.default_tag;
    if (value !== null && (typeof value !== 'string' || value === '' || value.length > MAX_TAG_LENGTH)) {
      return badRequest(`default_tag must be 1 to ${MAX_TAG_LENGTH} characters, or null.`);
    }
    changes.default_tag = value;
  }
  if (Object.keys(changes).length === 0) {
    return badRequest('Nothing to update: send default_account_id, default_trip_mode or default_tag.');
  }

  try {
    const db = getServiceDb();
    const current = await getPublicConnection(db, user.id);
    if (!current) {
      return NextResponse.json({ error: 'Google Calendar is not connected.', code: 'not_connected' }, { status: 404 });
    }

    // The default account must be one of the user's own accounts.
    if (changes.default_account_id) {
      const { data: account, error } = await db
        .from('financial_accounts')
        .select('id')
        .eq('id', changes.default_account_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw new Error(`Checking the default account failed: ${error.message}`);
      if (!account) return badRequest('That account was not found.');
    }

    const connection = await updateSettings(db, user.id, { ...(current.settings ?? {}), ...changes });
    return NextResponse.json({ connection });
  } catch (err) {
    return calendarErrorResponse(err, 'PATCH');
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) return unauthorized();

  const force = request.nextUrl.searchParams.get('force') === '1';

  try {
    const db = getServiceDb();
    const conn = await getConnection(db, user.id);
    // Already gone: disconnecting twice is not an error.
    if (!conn) return NextResponse.json({ ok: true, revoked: false, already_revoked: false, warning: null });

    let revoked = false;
    let alreadyRevoked = false;
    let warning: string | null = null;
    try {
      const token = tokenToRevoke(conn);
      if (token) {
        // Google answering "this token is not valid any more" counts as done: there is
        // nothing left to revoke.
        alreadyRevoked = (await revokeToken(token)).alreadyInvalid;
        revoked = true;
      } else {
        warning = 'No Google token was saved for this connection, so there was nothing to revoke.';
      }
    } catch (err) {
      const reason = describeCalendarError(err).message;
      if (!force) {
        return NextResponse.json(
          {
            error: `Google did not confirm that access was removed, so nothing was deleted. ${reason}`,
            code: 'revoke_failed',
            can_force: true,
          },
          { status: 502 },
        );
      }
      warning =
        'The saved connection was deleted, but Google did not confirm that access was removed. Remove this app from your Google Account yourself at https://myaccount.google.com/permissions.';
    }

    await deleteConnection(db, user.id);
    return NextResponse.json({ ok: true, revoked, already_revoked: alreadyRevoked, warning });
  } catch (err) {
    return calendarErrorResponse(err, 'DELETE');
  }
}
