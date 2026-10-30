// File: lib/auth/witus-sso.ts
// Ecosystem SSO helpers: silent sign-in ("already signed in to WitUS") + global sign-out.
//
// BAM's complaint (2026-08-30): signing in on a WitUS app sends you to a login form even when
// another tab already has you signed in to a sibling app; and signing out of one app leaves the
// shared session alive everywhere else. Two features answer that, both built on top of the bespoke
// OIDC code flow this app already runs (app/api/auth/witus/*):
//
//   1. Silent sign-in. On /login, once per browser session, a signed-out visitor is sent through
//      the IdP's authorize endpoint with `prompt=none`. With a live WitUS session the IdP answers
//      with a code and the callback finishes an ordinary WitUS sign-in. Without one it answers
//      `error=login_required`, and the callback returns to /login with no message, so the visitor
//      sees the normal sign-in options.
//   2. Global sign-out. Signing out here also ends the shared session at the IdP, so it signs you
//      out of every WitUS app in this browser.
//
// WHY A TOP-LEVEL REDIRECT AND NOT A BACKGROUND REQUEST (2026-10-29). Until this date the login page
// asked the IdP's `/api/ecosystem/session` endpoint with a CORS fetch and relabelled the button
// "Continue as <name>". That could never answer "signed in": centenarianos.com and
// accounts.witus.online are different SITES, and the IdP's session cookie is SameSite=Lax, which a
// browser sends on a cross-site top-level GET navigation but never on a cross-site fetch. The probe
// was removed (see witus plans/bugs/sso-existing-session-not-recognized-2026-10-29.md and this
// repo's plans/future/witus-continue-as-cross-site-2026-10-29.md). There is no same-site case to
// keep it for: no CentOS host is under witus.online. A top-level navigation carries the cookie, so
// the domain stays centenarianos.com.
//
// THE LOOP GUARD. Three layers, any one of which stops a second attempt:
//   - a browser-session cookie (`witus_sso_silent`), written by the login page IMMEDIATELY BEFORE
//     it leaves for the IdP, never after the return;
//   - the `?sso=tried` marker that every bounce back to /login carries;
//   - `?error=` on /login (a failed flow never retries on its own).
// `?no_sso=1` skips the attempt outright, for testing.
//
// Pure helpers only: no `process.env`, no next/headers, no window access at module scope, and no
// '@/' imports, so the server resolver (./witus-sso-server.ts), the client component, the API
// routes and node --test (tests/unit/witus-silent-sso.test.ts) can all import it.

/**
 * Default IdP authorize endpoint. Single source for the ecosystem host in this app —
 * app/api/auth/witus/authorize/route.ts imports this rather than repeating the literal, and every
 * other IdP URL below is DERIVED from whatever `WITUS_OIDC_AUTHORIZE_URL` actually is. Nothing new
 * about accounts.witus.online is asserted anywhere else (authoritative-values rule). Matches the
 * live discovery document (`/api/idp/.well-known/openid-configuration`, read 2026-10-29).
 */
export const WITUS_OIDC_AUTHORIZE_FALLBACK =
  'https://accounts.witus.online/api/idp/oauth2/authorize';

/** Query param marking "this browser already tried the ecosystem flow on this page". */
export const SSO_ATTEMPT_PARAM = 'sso';
export const SSO_ATTEMPT_VALUE = 'tried';

/** `/login?no_sso=1` never starts the silent attempt. A testing escape hatch. */
export const NO_SSO_PARAM = 'no_sso';

/**
 * Browser-session cookie (no Max-Age, so it ends when the browser does) recording that this
 * browser already made its one silent attempt. A cookie rather than sessionStorage so a second tab
 * does not repeat the round trip, and so it is still set after a global sign-out returns here.
 */
export const SILENT_SSO_COOKIE = 'witus_sso_silent';

/** Transient httpOnly cookie carrying the validated `from` path across the IdP round trip. */
export const NEXT_PATH_COOKIE = 'witus_oauth_next';

/**
 * IdP errors that mean "nobody is signed in to WitUS here" or "the IdP would have to show a page".
 * For a silent attempt that is the expected answer, not a failure: return to /login quietly.
 */
const QUIET_SILENT_ERRORS = new Set([
  'login_required',
  'consent_required',
  'interaction_required',
  'account_selection_required',
]);

/**
 * Server-resolved ecosystem SSO configuration, handed to client components through
 * WitusSsoProvider. Every field is null/false when `WITUS_OIDC_CLIENT_ID` is unset: both features
 * stay COMPLETELY DARK, because an affordance the visitor cannot complete is worse than none.
 */
export interface WitusSsoConfig {
  /** Is this app a configured ecosystem OIDC client? The gate for the button and silent sign-in. */
  enabled: boolean;
  /** RP-initiated logout endpoint WITH `client_id` already baked in, or null for local-only. */
  endSessionUrl: string | null;
}

/** The dark state — no ecosystem client configured, so neither feature exists. */
export const WITUS_SSO_DISABLED: WitusSsoConfig = {
  enabled: false,
  endSessionUrl: null,
};

export type SilentSsoSkip =
  | 'not-configured'
  | 'escape-hatch'
  | 'already-attempted'
  | 'already-signed-in'
  | 'error-shown';

export type SilentSsoDecision = { attempt: true } | { attempt: false; skip: SilentSsoSkip };

/**
 * Should the login page send this browser to the IdP with `prompt=none`?
 *
 * `enabled` is the SERVER-RESOLVED gate handed down from the root layout. Never re-derive it on the
 * client, and never accept it from client-supplied data. `attempted` is the browser-session cookie
 * flag. `signedIn` is true when the visitor already has a local session (?mfa=pending).
 */
export function silentSsoDecision(input: {
  enabled: boolean;
  search?: string | null;
  attempted?: boolean;
  signedIn?: boolean;
}): SilentSsoDecision {
  if (!input.enabled) return { attempt: false, skip: 'not-configured' };
  const params = toParams(input.search);
  if (params.get(NO_SSO_PARAM) === '1') return { attempt: false, skip: 'escape-hatch' };
  if (input.signedIn || params.get('mfa') === 'pending') {
    return { attempt: false, skip: 'already-signed-in' };
  }
  if (input.attempted || params.get(SSO_ATTEMPT_PARAM) === SSO_ATTEMPT_VALUE) {
    return { attempt: false, skip: 'already-attempted' };
  }
  if (params.has('error')) return { attempt: false, skip: 'error-shown' };
  return { attempt: true };
}

/** Does a `document.cookie` / Cookie header string carry the silent-attempt flag? */
export function hasSilentSsoFlag(cookieString: string | null | undefined): boolean {
  if (!cookieString) return false;
  return cookieString
    .split(';')
    .some((part) => part.trim() === `${SILENT_SSO_COOKIE}=1`);
}

/** The `document.cookie` assignment that records the attempt for the rest of the browser session. */
export function silentSsoFlagCookie(secure: boolean): string {
  return `${SILENT_SSO_COOKIE}=1; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** Is this IdP error the ordinary "not signed in to WitUS" answer to a silent attempt? */
export function isQuietSilentSsoError(error: string | null | undefined): boolean {
  return typeof error === 'string' && QUIET_SILENT_ERRORS.has(error);
}

/**
 * A same-origin path we are willing to redirect to, or null. Rejects absolute URLs,
 * protocol-relative `//host`, backslash tricks (`/\host`), control characters and absurd lengths,
 * so `from` can never become an open redirect.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\') || /[\u0000-\u001F\u007F]/.test(value)) return null;
  return value;
}

/** Where the login page sends the browser for the silent attempt (a same-origin API route). */
export function silentSignInPath(from: string | null | undefined): string {
  const params = new URLSearchParams({ prompt: 'none' });
  const next = safeNextPath(from);
  if (next) params.set('from', next);
  return `/api/auth/witus/authorize?${params.toString()}`;
}

/**
 * The quiet return to /login after the IdP said "nobody here": no error, the loop-guard marker,
 * and the original `from` so a password sign-in still lands where the visitor was going.
 */
export function quietLoginPath(from: string | null | undefined): string {
  const next = safeNextPath(from);
  return withAttemptMarker(next ? `/login?from=${encodeURIComponent(next)}` : '/login');
}

/**
 * The IdP authorize URL. One builder for both the interactive button and the silent attempt, so
 * client id, callback, state and PKCE are always built the same way; `silent` only adds
 * `prompt=none`.
 */
export function buildWitusAuthorizeUrl(input: {
  authorizeUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  silent?: boolean;
}): string {
  const authUrl = new URL(input.authorizeUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', input.clientId);
  authUrl.searchParams.set('redirect_uri', input.redirectUri);
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', input.state);
  authUrl.searchParams.set('code_challenge', input.codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  if (input.silent) authUrl.searchParams.set('prompt', 'none');
  return authUrl.toString();
}

/** Does this query string carry the one-shot marker? Accepts "?a=b" or "a=b". */
export function hasAttemptMarker(search: string | null | undefined): boolean {
  return toParams(search).get(SSO_ATTEMPT_PARAM) === SSO_ATTEMPT_VALUE;
}

/**
 * Add the one-shot marker to a same-origin path, preserving any query it already has (notably the
 * `?error=` code the witus callback bounces back with).
 */
export function withAttemptMarker(path: string): string {
  const [beforeHash, ...hashRest] = path.split('#');
  const hash = hashRest.length > 0 ? `#${hashRest.join('#')}` : '';
  const [pathname, ...queryRest] = beforeHash.split('?');
  const params = new URLSearchParams(queryRest.join('?'));
  params.set(SSO_ATTEMPT_PARAM, SSO_ATTEMPT_VALUE);
  return `${pathname}?${params.toString()}${hash}`;
}

function toParams(search: string | null | undefined): URLSearchParams {
  if (typeof search !== 'string' || search === '') return new URLSearchParams();
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
}

/**
 * Split the configured authorize URL into the IdP's origin and its better-auth basePath.
 *
 *   https://accounts.witus.online/api/idp/oauth2/authorize
 *     -> { origin: "https://accounts.witus.online", basePath: "/api/idp" }
 *
 * This app has no discovery-URL env (its bespoke flow configures the three endpoints directly), so
 * the authorize URL it is ALREADY pointed at is the authoritative source everything else derives
 * from.
 */
function splitAuthorizeUrl(
  authorizeUrl: string | null | undefined,
): { origin: string; basePath: string } | null {
  if (!authorizeUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(authorizeUrl);
  } catch {
    return null;
  }
  const cut = parsed.pathname.indexOf('/oauth2/authorize');
  if (cut < 0) return null;
  return { origin: parsed.origin, basePath: parsed.pathname.slice(0, cut) };
}

/**
 * The IdP's RP-initiated logout endpoint: `<basePath>/oauth2/endsession` — the `end_session_endpoint`
 * the live discovery document advertises.
 */
export function endSessionEndpointFromAuthorizeUrl(
  authorizeUrl: string | null | undefined,
): string | null {
  const parts = splitAuthorizeUrl(authorizeUrl);
  if (!parts) return null;
  return `${parts.origin}${parts.basePath}/oauth2/endsession`;
}

/**
 * Sign-out button copy. "Logout" is this app's existing word and stays the label whenever sign-out
 * is purely local; the global variant says so explicitly, because a button that signs you out of
 * five other apps should admit it before you press it.
 */
export function signOutLabel(endSessionUrl: string | null | undefined): string {
  return endSessionUrl ? 'Sign out of WitUS' : 'Logout';
}

/**
 * The full RP-initiated logout URL to navigate to AFTER the local session is destroyed.
 *
 * `post_logout_redirect_uri` must be EXACTLY `<origin>/` — with the trailing slash. better-auth
 * exact-matches it against the client's registered redirectUrls and the IdP registry
 * (gemini/witus lib/identity/clients.ts) registers `origin + "/"`. Drop the slash and you get a 400.
 *
 * `origin` is passed in from `window.location.origin` rather than hardcoded: whichever host serves
 * the page sends its own origin. NOTE (verify before relying on it): only
 * `https://www.centenarianos.com/` is registered as a post-logout target — the apex
 * `https://centenarianos.com/` is NOT, so a global sign-out started on the apex host is refused by
 * the IdP. The person is still signed out locally either way (see the ordering note at the call
 * sites); they just do not come back cleanly.
 *
 * `&`, not `?`: endSessionUrl already carries client_id (see ./witus-sso-server.ts).
 */
export function witusLogoutUrl(endSessionUrl: string, origin: string): string {
  const back = `${origin.replace(/\/+$/, '')}/`;
  return `${endSessionUrl}&post_logout_redirect_uri=${encodeURIComponent(back)}`;
}
