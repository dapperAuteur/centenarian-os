// app/api/calendar/google/connect/route.ts
// GET: send the signed-in user to Google's consent screen (read-only calendar access).
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
import { getConnection } from '@/lib/google/connection';
import {
  CALENDAR_SETTINGS_PATH,
  describeCalendarError,
  getServiceDb,
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

    // Reading the row proves migration 204 is applied. When the user is reconnecting, it
    // also gives the account to preselect.
    const existing = await getConnection(getServiceDb(), user.id);

    const url = buildAuthUrl(signOAuthState(user.id), buildRedirectUri(origin), {
      config,
      loginHint: existing?.account_email ?? null,
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
