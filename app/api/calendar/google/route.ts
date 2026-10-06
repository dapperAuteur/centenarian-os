// app/api/calendar/google/route.ts
// The signed-in user's Google Calendar connections (one per Google account, migration 205).
//
// GET    -> { configured, connections: [{ ...connection, calendars: [...] }] }
//           No connection object ever carries a token column. `configured` is false while the
//           server still lacks its Google setup.
//           Before answering, each ACTIVE connection not checked in the last 5 minutes is
//           re-checked with Google (validateConnection: a refresh-token exchange). A grant the
//           user removed at myaccount.google.com/permissions comes back as invalid_grant, the
//           row is marked needs_reauth, and this response already shows it. A Google outage
//           leaves the status alone.
// PATCH  -> body: { connection_id?, allowed_account_ids?, default_account_id?,
//           default_trip_mode?, default_tag? } (null clears a default). connection_id may be left
//           out when only one account is connected. Saves them in that connection's settings.
//           allowed_account_ids: the finance accounts #expense / #income events may record into
//           (replaces the list; unticking the default clears it). default_account_id: one of
//           them, used when a title names no "@account"; sent alone (the old client), it is
//           ticked too. (Nicknames for "@visa" live on the account itself: financial_accounts.nickname,
//           migration 218, edited on Finance → Accounts.) Every account id sent must be the caller's (lib/auth/ownership.ts);
//           stored ids of accounts deleted since are dropped. Rules: lib/capture/calendar-accounts.ts.
//           -> { connection }
// DELETE -> ?connection_id=<id> (optional with one account). Revokes that account's grant at
//           Google, then deletes that one connection row (its tokens and saved calendars go
//           with it; the user's other Google accounts stay). -> { ok, revoked, already_revoked, warning }
//           If Google does not confirm the revocation, nothing is deleted and the answer is
//           { error, code: 'revoke_failed', can_force: true }; add &force=1 to delete anyway.
//
// Every handler checks the session with the cookie client first, then uses the
// service-role client, because calendar_connections is closed to browser roles.
// Errors are JSON { error, code }; see describeCalendarError for the codes, plus
// not_connected (404) and connection_id_required (400).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TRIP_MODES } from '@/lib/capture/tokens';
import { ownedIds } from '@/lib/auth/ownership';
import { mergeAccountSettings, pruneAccountSettings } from '@/lib/capture/calendar-accounts';
import { isGoogleConfigured, revokeToken } from '@/lib/google/calendar-client';
import {
  deleteConnection,
  listConnections,
  listStoredCalendars,
  resolveUserConnection,
  toPublicConnection,
  tokenToRevoke,
  updateSettings,
  validateConnection,
  type CalendarConnectionSettings,
} from '@/lib/google/connection';
import {
  calendarErrorResponse,
  describeCalendarError,
  getServiceDb,
  isUuid,
  missingServerSetup,
} from '@/lib/google/route-helpers';

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
    const rows = await listConnections(db, user.id);

    // Re-check each due connection with Google, in parallel. Only possible when the OAuth
    // client is configured (the refresh needs it). validateConnection updates the row object
    // in place, so the response below reflects the result.
    if (isGoogleConfigured()) {
      await Promise.all(
        rows.map((conn) =>
          validateConnection(db, conn).catch((err) => {
            // A failed bookkeeping write must not hide the page.
            console.error('[api/calendar/google] validate:', err instanceof Error ? err.message : err);
          }),
        ),
      );
    }

    const connections = await Promise.all(
      rows.map(async (conn) => ({
        ...toPublicConnection(conn),
        calendars: await listStoredCalendars(db, conn.id),
      })),
    );
    return NextResponse.json({ configured: missingServerSetup().length === 0, connections });
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

  const connectionId = body.connection_id ?? null;
  if (connectionId !== null && !isUuid(connectionId)) return badRequest('connection_id must be a connection id.');

  const changes: CalendarConnectionSettings = {};
  const accountFields = ['allowed_account_ids', 'default_account_id'] as const;
  const accountPatch = Object.fromEntries(accountFields.filter((key) => key in body).map((key) => [key, body[key]]));
  const changesAccounts = Object.keys(accountPatch).length > 0;
  if (changesAccounts) {
    // Validates the shape before any database call; merged with the stored settings below.
    const check = mergeAccountSettings({}, accountPatch);
    if (!check.ok) return badRequest(check.error);
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
  if (Object.keys(changes).length === 0 && !changesAccounts) {
    return badRequest(
      'Nothing to update: send allowed_account_ids, default_account_id, default_trip_mode or default_tag.',
    );
  }

  try {
    const db = getServiceDb();
    const resolved = await resolveUserConnection(db, user.id, connectionId);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message, code: resolved.code }, { status: resolved.status });
    }
    const current = resolved.connection;

    const stored = (current.settings ?? {}) as Record<string, unknown>;
    if (changesAccounts) {
      const merged = mergeAccountSettings(stored, accountPatch);
      if (!merged.ok) return badRequest(merged.error);
      // Every account id involved must be the caller's: the ones sent are refused if not, the
      // stored ones of accounts deleted since are dropped.
      const all = [
        ...merged.settings.allowed_account_ids,
        ...(merged.settings.default_account_id ? [merged.settings.default_account_id] : []),
      ];
      const owned = await ownedIds(db, user.id, 'financial_accounts', all);
      if (owned.failed) throw new Error('Checking the accounts failed.');
      if (merged.sentIds.some((id) => !owned.has(id))) return badRequest('That account was not found.');
      Object.assign(changes, pruneAccountSettings(merged.settings, (id) => owned.has(id)));
    }

    const connection = await updateSettings(db, user.id, current.id, { ...stored, ...changes });
    return NextResponse.json({ connection });
  } catch (err) {
    return calendarErrorResponse(err, 'PATCH');
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) return unauthorized();

  const params = request.nextUrl.searchParams;
  const force = params.get('force') === '1';
  const connectionId = params.get('connection_id');
  if (connectionId !== null && !isUuid(connectionId)) return badRequest('connection_id must be a connection id.');

  try {
    const db = getServiceDb();
    const resolved = await resolveUserConnection(db, user.id, connectionId);
    if (!resolved.ok) {
      // Already gone: disconnecting twice is not an error.
      if (resolved.code === 'not_connected') {
        return NextResponse.json({ ok: true, revoked: false, already_revoked: false, warning: null });
      }
      return NextResponse.json({ error: resolved.message, code: resolved.code }, { status: resolved.status });
    }
    const conn = resolved.connection;

    let revoked = false;
    let alreadyRevoked = false;
    let warning: string | null = null;
    try {
      const token = tokenToRevoke(conn);
      if (token) {
        // Google answering "this token is not valid any more" counts as done: there is
        // nothing left to revoke. Revoking removes the grant for THIS Google account only;
        // the user's other connected accounts are separate grants.
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

    await deleteConnection(db, user.id, conn.id);
    return NextResponse.json({ ok: true, revoked, already_revoked: alreadyRevoked, warning });
  } catch (err) {
    return calendarErrorResponse(err, 'DELETE');
  }
}
