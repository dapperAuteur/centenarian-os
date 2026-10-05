// app/api/calendar/google/connect/route.ts
// GET: send the signed-in user to Google's consent screen (read-only calendar access).
//   ?connection_id=<id>  reconnect that Google account (preselected via login_hint)
//   no parameter         add a Google account; Google shows its account chooser
//
// This is a browser navigation, not a fetch: every outcome is a redirect. A failure goes
// back to the settings page with ?error=<code>, where the page explains it.
//
// Everything that could make the callback fail is checked BEFORE the user is sent to
// Google (OAuth client, encryption key, state secret, migration 204), so nobody consents
// and then lands on an error.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { signOAuthState } from '@/lib/oauth-state';
import { buildAuthUrl, buildRedirectUri, getGoogleOAuthConfig } from '@/lib/google/calendar-client';
import { getConnection, listPublicConnections } from '@/lib/google/connection';
import {
  CALENDAR_SETTINGS_PATH,
  describeCalendarError,
  getServiceDb,
  isUuid,
  isOAuthStateReady,
  isTokenEncryptionReady,
} from '@/lib/google/route-helpers';

export async function GET(request: NextRequest) {
  // The origin the user is on. The redirect URI is built from it, never hardcoded, so the
  // same code works on production, on localhost, and on any other host that is registered
  // as a redirect URI on the Google OAuth client.
  const origin = request.nextUrl.origin;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', origin));

  const fail = (code: string) =>
    NextResponse.redirect(new URL(`${CALENDAR_SETTINGS_PATH}?error=${encodeURIComponent(code)}`, origin));

  try {
    const config = getGoogleOAuthConfig();
    if (!isTokenEncryptionReady()) return fail('encryption_not_configured');
    if (!isOAuthStateReady()) return fail('state_secret_missing');

    // ?connection_id=<id> means "reconnect this account": its email is passed as the login
    // hint so Google preselects it. Without it the user is adding an account (the first, or
    // another one), so Google shows its account chooser (prompt=select_account) instead of
    // silently reusing whichever account the browser is signed in to.
    // Reading the table also proves migrations 204/205 are applied before the user consents.
    const db = getServiceDb();
    const connectionId = request.nextUrl.searchParams.get('connection_id');
    const reconnecting = isUuid(connectionId) ? await getConnection(db, user.id, connectionId) : null;
    if (!reconnecting) await listPublicConnections(db, user.id);

    const url = buildAuthUrl(signOAuthState(user.id), buildRedirectUri(origin), {
      config,
      loginHint: reconnecting?.account_email ?? null,
      selectAccount: !reconnecting,
    });
    return NextResponse.redirect(url);
  } catch (err) {
    const info = describeCalendarError(err);
    if (info.code === 'internal') {
      console.error('[api/calendar/google/connect]', err instanceof Error ? err.message : err);
    }
    return fail(info.code);
  }
}
