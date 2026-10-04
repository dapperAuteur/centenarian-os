// app/api/calendar/google/callback/route.ts
// GET: Google sends the browser back here after the consent screen. Verify the signed
// state, exchange the code for tokens, look up which Google account it is, store the
// tokens encrypted, and redirect to the settings page.
//
// Every outcome is a redirect to /dashboard/settings/calendar with ?connected=google or
// ?error=<code>; the page turns the code into a sentence. The response never renders the
// code or the tokens: Google's guide recommends that "the server first handle the request,
// then redirect to another URL that doesn't include the response parameters"
// (https://developers.google.com/identity/protocols/oauth2/web-server, Step 4).
//
// Error codes: access_denied (or whatever Google sent in ?error=), missing_code,
// not_signed_in, invalid_state, not_configured, encryption_not_configured, code_rejected,
// calendar_scope_not_granted, no_refresh_token, account_lookup_failed, migration_missing,
// google_error, token_unreadable, internal.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyOAuthState } from '@/lib/oauth-state';
import {
  CALENDAR_READONLY_SCOPE,
  GoogleApiError,
  GoogleAuthError,
  buildRedirectUri,
  exchangeCode,
  fetchUserInfo,
  getGoogleOAuthConfig,
  hasScope,
  revokeToken,
  type GoogleTokenSet,
  type GoogleUserInfo,
} from '@/lib/google/calendar-client';
import { clearCalendars, getConnection, saveTokens, tokenToRevoke } from '@/lib/google/connection';
import {
  CALENDAR_SETTINGS_PATH,
  describeCalendarError,
  getServiceDb,
  isTokenEncryptionReady,
} from '@/lib/google/route-helpers';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;
  const done = (query: string) => NextResponse.redirect(new URL(`${CALENDAR_SETTINGS_PATH}?${query}`, origin));
  const fail = (code: string) => done(`error=${encodeURIComponent(code)}`);

  // Google reports a refusal on the query string, e.g. ?error=access_denied when the user
  // pressed Cancel. Only a short, plain code is passed on to the page.
  const googleError = params.get('error');
  if (googleError) return fail(/^[a-z_]{1,40}$/.test(googleError) ? googleError : 'google_error');

  const code = params.get('code');
  const rawState = params.get('state');
  if (!code || !rawState) return fail('missing_code');

  // The state must carry a valid signature AND name the user whose session this browser
  // holds. Checking both ties the callback to the browser that started the flow.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('not_signed_in');

  let stateUserId: string | null = null;
  try {
    stateUserId = verifyOAuthState(rawState);
  } catch {
    // verifyOAuthState throws when its signing secret is missing; treat as an invalid state.
  }
  if (!stateUserId || stateUserId !== user.id) return fail('invalid_state');

  try {
    const config = getGoogleOAuthConfig();
    if (!isTokenEncryptionReady()) return fail('encryption_not_configured');

    // The redirect URI must be the one the authorization request used; both routes build
    // it from the request origin with the same helper.
    let tokens: GoogleTokenSet;
    try {
      tokens = await exchangeCode(code, buildRedirectUri(origin), { config });
    } catch (err) {
      // invalid_grant here means the code is invalid, expired or already used.
      if (err instanceof GoogleAuthError) return fail('code_rejected');
      throw err;
    }

    // Google's consent screen lets the user untick individual permissions, so the granted
    // scopes are checked rather than assumed (web-server guide, Step 6).
    if (!hasScope(tokens.scope, CALENDAR_READONLY_SCOPE)) return fail('calendar_scope_not_granted');

    // Without a refresh token the connection would stop working within the hour.
    if (!tokens.refreshToken) return fail('no_refresh_token');

    let account: GoogleUserInfo;
    try {
      account = await fetchUserInfo(tokens.accessToken);
    } catch (err) {
      if (err instanceof GoogleApiError) return fail('account_lookup_failed');
      throw err;
    }

    const db = getServiceDb();
    const existing = await getConnection(db, user.id);

    // A DIFFERENT Google account than the one connected before: the saved calendars (and
    // their sync tokens) belong to the old account, so forget them.
    const accountChanged = Boolean(existing?.provider_sub && existing.provider_sub !== account.sub);
    if (existing && accountChanged) await clearCalendars(db, existing.id);

    await saveTokens(db, {
      userId: user.id,
      tokens,
      accountEmail: account.email,
      providerSub: account.sub,
    });

    // Then release the old account's grant at Google, now that its tokens are overwritten.
    // Only for a different account: revoking removes the whole grant for that Google
    // account, so doing it for the same account would kill the tokens just saved.
    if (existing && accountChanged) {
      try {
        const oldToken = tokenToRevoke(existing);
        if (oldToken) await revokeToken(oldToken);
      } catch {
        // Best effort: the old tokens are gone from the database either way.
      }
    }

    return done('connected=google');
  } catch (err) {
    const info = describeCalendarError(err);
    if (info.code === 'internal') {
      console.error('[api/calendar/google/callback]', err instanceof Error ? err.message : err);
    }
    return fail(info.code);
  }
}
