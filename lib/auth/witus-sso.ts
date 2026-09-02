// File: lib/auth/witus-sso.ts
// Ecosystem SSO helpers — "Continue as <name>" + global sign-out.
//
// BAM's complaint (2026-08-30): signing in on a WitUS app sends you to a login form even when
// another tab already has you signed in to a sibling app; and signing out of one app leaves the
// shared session alive everywhere else. Two features answer that, both built on top of the bespoke
// OIDC code flow this app already runs (app/api/auth/witus/*):
//
//   1. On /login, render the form immediately as it renders today and ask the IdP IN PARALLEL who
//      this browser is. If an answer arrives, the existing "Sign in with WitUS" button relabels to
//      "Continue as <name>". Not automatic — clicking still runs the real code flow.
//   2. Signing out here also ends the shared session at the IdP, so it signs you out of every
//      WitUS app in this browser.
//
// WHY A CROSS-ORIGIN PROBE AND NOT OIDC `prompt=none`. `prompt=none` is a NAVIGATION: you leave the
// login page to ask. The only way to ask without leaving is a hidden iframe, which Safari's ITP
// blocks. So we ask a dedicated IdP endpoint over CORS instead, in parallel with a form that has
// already rendered.
//
// WHAT THE PROBE BUYS AND WHAT IT DOES NOT. It carries the IdP's cookie as a THIRD-PARTY cookie, so
// it answers on Chrome/Edge and returns nothing under Safari ITP or Firefox Total Cookie
// Protection. That is the design, not a bug: a probe that answers nothing renders nothing and the
// visitor keeps the exact login page they already had.
//
// THE IDENTITY THIS RETURNS IS DISPLAY COPY, NEVER A CREDENTIAL. It crosses an origin boundary, so
// it is client-supplied by definition. It must never gate access, populate a session, or be sent
// anywhere. Nothing in this file may ever be used to grant access.
//
// Pure helpers only: no `process.env`, no next/headers, no window access at module scope, so the
// server resolver (./witus-sso-server.ts) and the client provider (./witus-sso-client.tsx) can both
// import it.

/**
 * Default IdP authorize endpoint. Single source for the ecosystem host in this app —
 * app/api/auth/witus/authorize/route.ts imports this rather than repeating the literal, and every
 * other IdP URL below is DERIVED from whatever `WITUS_OIDC_AUTHORIZE_URL` actually is. Nothing new
 * about accounts.witus.online is asserted anywhere else (authoritative-values rule).
 */
export const WITUS_OIDC_AUTHORIZE_FALLBACK =
  'https://accounts.witus.online/api/idp/oauth2/authorize';

/** Query param marking "this browser already tried the ecosystem flow on this page". */
export const SSO_ATTEMPT_PARAM = 'sso';
export const SSO_ATTEMPT_VALUE = 'tried';

/**
 * sessionStorage key for the same marker. Written IMMEDIATELY BEFORE we send the browser to the
 * IdP, never after we come back: a marker written on return is a marker that never exists when the
 * return is the thing that failed.
 */
export const SSO_ATTEMPT_STORAGE_KEY = 'witus.sso.attempted';

/** How long to wait for the probe before giving up. A silent check that hangs is a broken page. */
export const SILENT_SSO_TIMEOUT_MS = 4000;

/** Longest display name we will render. Caps a hostile or absurd value from blowing up the card. */
const MAX_LABEL_LENGTH = 48;

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/** Identity shown on the button. Display only, never a credential. */
export interface SsoIdentity {
  /** What "Continue as ___" says. Already trimmed, de-controlled, and length-capped. */
  label: string;
}

/**
 * Server-resolved ecosystem SSO configuration, handed to client components through
 * WitusSsoProvider. Every field is null/false when `WITUS_OIDC_CLIENT_ID` is unset: both features
 * stay COMPLETELY DARK, because an affordance the visitor cannot complete is worse than none.
 */
export interface WitusSsoConfig {
  /** Is this app a configured ecosystem OIDC client? The gate for everything below. */
  enabled: boolean;
  /** IdP endpoint the login page's silent probe asks, or null when the feature is dark. */
  silentCheckUrl: string | null;
  /** RP-initiated logout endpoint WITH `client_id` already baked in, or null for local-only. */
  endSessionUrl: string | null;
}

/** The dark state — no ecosystem client configured, so neither feature exists. */
export const WITUS_SSO_DISABLED: WitusSsoConfig = {
  enabled: false,
  silentCheckUrl: null,
  endSessionUrl: null,
};

export type SilentSsoSkip = 'not-configured' | 'already-attempted' | 'already-signed-in';

export type SilentSsoDecision = { attempt: true } | { attempt: false; skip: SilentSsoSkip };

/**
 * Should this browser ask the IdP who it is?
 *
 * `endpoint` is the SERVER-RESOLVED gate handed down from the root layout. Never re-derive it on
 * the client, and never accept it from client-supplied data.
 */
export function silentSsoDecision(input: {
  endpoint: string | null | undefined;
  search?: string | null;
  attempted?: boolean;
  signedIn?: boolean;
}): SilentSsoDecision {
  if (!input.endpoint) return { attempt: false, skip: 'not-configured' };
  if (input.signedIn) return { attempt: false, skip: 'already-signed-in' };
  if (input.attempted || hasAttemptMarker(input.search)) {
    return { attempt: false, skip: 'already-attempted' };
  }
  return { attempt: true };
}

/** Does this query string carry the one-shot marker? Accepts "?a=b" or "a=b". */
export function hasAttemptMarker(search: string | null | undefined): boolean {
  if (typeof search !== 'string' || search === '') return false;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get(SSO_ATTEMPT_PARAM) === SSO_ATTEMPT_VALUE;
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
 * The ecosystem session probe: `<idp-origin>/api/ecosystem/session`.
 *
 * NOT better-auth's `<basePath>/get-session`, which could never work here: better-auth's core emits
 * no CORS headers, and even with them `/get-session` returns the full `{ session, user }` whose
 * `session` carries the SESSION TOKEN — a credentialed allow-origin on it would let any ecosystem
 * origin (or an XSS on one) lift a live IdP session. `/api/ecosystem/session` is the purpose-built
 * replacement in gemini/witus: same cookie, but it answers with a display label and nothing else.
 * Response shape: `{ signedIn: true, user: { name } }` or `{ signedIn: false }`.
 */
export function silentSsoEndpointFromAuthorizeUrl(
  authorizeUrl: string | null | undefined,
): string | null {
  const parts = splitAuthorizeUrl(authorizeUrl);
  if (!parts) return null;
  return `${parts.origin}/api/ecosystem/session`;
}

/**
 * Read a display name out of the probe response. Handles `{ signedIn, user: { name } }`, a bare
 * user object, and the signed-out answer. Anything else yields null, which renders nothing.
 */
export function parseSilentSsoIdentity(payload: unknown): SsoIdentity | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const candidate =
    root.user && typeof root.user === 'object' ? (root.user as Record<string, unknown>) : root;
  const label = cleanLabel(candidate.name) ?? cleanLabel(candidate.email);
  return label ? { label } : null;
}

function cleanLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(CONTROL_CHARS, '').trim();
  if (!cleaned) return null;
  return cleaned.length > MAX_LABEL_LENGTH
    ? `${cleaned.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…`
    : cleaned;
}

/** Sign-in button copy. Kept here so there is one place the exact strings live. */
export function continueAsLabel(identity: SsoIdentity | null): string {
  return identity ? `Continue as ${identity.label}` : 'Sign in with WitUS';
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
