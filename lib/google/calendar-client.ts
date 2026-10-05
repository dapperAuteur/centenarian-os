// lib/google/calendar-client.ts
// Server-only. Talks to Google for the one-way Google Calendar -> CentenarianOS sync:
// the OAuth 2.0 web-server flow (authorization URL, code exchange, refresh, revoke),
// the signed-in account's email, and the list of calendars on the account.
//
// Plain fetch, no googleapis dependency. Nothing here writes to Google: the only
// Calendar scope requested is read-only.
//
// EVERY GOOGLE VALUE BELOW COMES FROM GOOGLE'S OWN DOCUMENTATION (read 2026-10-03).
// The page each rule comes from is cited next to it. Nothing here has been run against a
// real Google OAuth client yet, because none exists; the README section "Optional: Google
// Calendar (one-way sync)" lists what to check by hand once one does.
//   [oauth-web]  https://developers.google.com/identity/protocols/oauth2/web-server
//   [oauth]      https://developers.google.com/identity/protocols/oauth2
//   [oidc]       https://developers.google.com/identity/openid-connect/openid-connect
//   [discovery]  https://accounts.google.com/.well-known/openid-configuration
//   [cal-list]   https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list
//   [cal-entry]  https://developers.google.com/workspace/calendar/api/v3/reference/calendarList
//   [cal-errors] https://developers.google.com/workspace/calendar/api/guides/errors
//   [ev-list]    https://developers.google.com/workspace/calendar/api/v3/reference/events/list
//   [ev-res]     https://developers.google.com/workspace/calendar/api/v3/reference/events
//   [cal-sync]   https://developers.google.com/workspace/calendar/api/guides/sync
//
// This file also runs under `node --test --experimental-strip-types`
// (tests/unit/google-calendar-client.test.ts), so it uses no enums and no
// constructor parameter properties, and it imports nothing from the app.

const LABEL = '[lib/google/calendar-client]';

// ── Endpoints ───────────────────────────────────────────────────────────────────

/** [oauth-web] "Google's OAuth 2.0 endpoint is at https://accounts.google.com/o/oauth2/v2/auth." */
export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
/** [oauth-web] Code exchange and refresh both POST to this endpoint. */
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
/** [oauth-web] "Token revocation". */
export const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
/**
 * The `userinfo_endpoint` value in [discovery] as read on 2026-10-03. [oidc] says to take
 * this endpoint from the Discovery document; it is pinned here rather than fetched on
 * every request. If account lookups start failing, re-read the Discovery document first.
 */
export const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
/** [cal-list] "GET https://www.googleapis.com/calendar/v3/users/me/calendarList". */
export const GOOGLE_CALENDAR_LIST_ENDPOINT =
  'https://www.googleapis.com/calendar/v3/users/me/calendarList';

// ── Scopes ──────────────────────────────────────────────────────────────────────

/** [cal-list] Read-only Calendar scope; one of the scopes calendarList.list accepts. */
export const CALENDAR_READONLY_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

/**
 * What the app asks for: the account's email address (to show which account is
 * connected) and read-only calendar access.
 * [oidc] "The scope parameter must begin with the openid value and then include the
 * profile value, the email value, or both", so `openid email` goes first.
 */
export const GOOGLE_SCOPES: readonly string[] = ['openid', 'email', CALENDAR_READONLY_SCOPE];

/** The app's OAuth callback path. The origin is taken from the request, never hardcoded. */
export const GOOGLE_CALLBACK_PATH = '/api/calendar/google/callback';

/**
 * The redirect URI for an origin such as "https://example.com".
 * [oauth-web] The value "must exactly match one of the authorized redirect URIs" on the
 * OAuth client: "the http or https scheme, case, and trailing slash ('/') must all match".
 * The connect route and the callback route both build it here, so the URI sent with the
 * code exchange is the one the authorization request used.
 */
export function buildRedirectUri(origin: string): string {
  return `${origin.replace(/\/+$/, '')}${GOOGLE_CALLBACK_PATH}`;
}

// ── Errors ──────────────────────────────────────────────────────────────────────

/** GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are not set. */
export class GoogleConfigError extends Error {
  missing: string[];

  constructor(missing: string[]) {
    super(
      `${LABEL} Google Calendar is not configured: ${missing.join(' and ')} ${
        missing.length === 1 ? 'is' : 'are'
      } not set. Create an OAuth client in Google Cloud Console and add both values to the environment.`,
    );
    this.name = 'GoogleConfigError';
    this.missing = missing;
  }
}

/**
 * Google answered `invalid_grant`: the grant behind the request is no longer usable.
 * [oauth-web] On a refresh: "the token may have expired or has been invalidated.
 * Authenticate the user again and ask for user consent to obtain new tokens."
 * On a code exchange: "The supplied authorization code is invalid or in the wrong format."
 * Either way the user has to go through the consent screen again.
 */
export class GoogleAuthError extends Error {
  code: 'invalid_grant';
  description: string | null;
  /** [oauth] `error_subtype`, e.g. "invalid_rapt" for a Google Cloud session-control policy. */
  subtype: string | null;

  constructor(description: string | null, subtype: string | null = null) {
    super(`${LABEL} Google rejected the authorization (invalid_grant${description ? `: ${description}` : ''}).`);
    this.name = 'GoogleAuthError';
    this.code = 'invalid_grant';
    this.description = description;
    this.subtype = subtype;
  }
}

/**
 * Any other failed call to Google. `status` is the HTTP status, or 0 when no response
 * arrived (network failure or timeout). `code` is Google's short error code when it sent one.
 */
export class GoogleApiError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, code: string | null, detail: string | null, context: string) {
    const parts = [status ? `HTTP ${status}` : 'no response', code, detail].filter(Boolean);
    super(`${LABEL} ${context} failed (${parts.join(', ')}).`);
    this.name = 'GoogleApiError';
    this.status = status;
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

/**
 * Turns a failed response from Google into the right error. Pure.
 *
 * Two body shapes are handled:
 *   OAuth endpoints  {"error": "invalid_grant", "error_description": "...", "error_subtype": "..."}
 *   Calendar API     {"error": {"code": 401, "message": "...", "errors": [{"reason": "authError"}]}}
 *                    ([cal-errors] shows this shape for every listed error)
 * `invalid_grant` becomes GoogleAuthError; everything else becomes GoogleApiError.
 */
export function classifyGoogleError(
  status: number,
  body: unknown,
  context: string,
): GoogleAuthError | GoogleApiError {
  const record = asRecord(body);
  const error = record?.error;

  if (typeof error === 'string') {
    const description = asString(record?.error_description);
    if (error === 'invalid_grant') {
      return new GoogleAuthError(description, asString(record?.error_subtype));
    }
    return new GoogleApiError(status, error, description, context);
  }

  const nested = asRecord(error);
  if (nested) {
    const first = Array.isArray(nested.errors) ? asRecord(nested.errors[0]) : null;
    return new GoogleApiError(status, asString(first?.reason), asString(nested.message), context);
  }

  return new GoogleApiError(status, null, null, context);
}

// ── Configuration ───────────────────────────────────────────────────────────────

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
}

/** Reads the OAuth client from the environment. Throws GoogleConfigError when either value is missing. */
export function getGoogleOAuthConfig(
  env: Record<string, string | undefined> = process.env,
): GoogleOAuthConfig {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const missing: string[] = [];
  if (!clientId) missing.push('GOOGLE_OAUTH_CLIENT_ID');
  if (!clientSecret) missing.push('GOOGLE_OAUTH_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new GoogleConfigError(missing);
  return { clientId, clientSecret };
}

/** True when both OAuth values are set. For status screens; never throws. */
export function isGoogleConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.GOOGLE_OAUTH_CLIENT_ID?.trim() && env.GOOGLE_OAUTH_CLIENT_SECRET?.trim());
}

export interface GoogleClientOptions {
  /** Defaults to the environment (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET). */
  config?: GoogleOAuthConfig;
  /** Defaults to the global fetch. Tests pass a fake. */
  fetchImpl?: typeof fetch;
  /** Milliseconds since the epoch. Defaults to Date.now(). Tests pass a fixed clock. */
  now?: number;
}

// ── Authorization URL ───────────────────────────────────────────────────────────

export interface AuthUrlOptions extends Pick<GoogleClientOptions, 'config'> {
  /** The account to preselect when reconnecting. [oauth-web] `login_hint`: "an email address or sub identifier". */
  loginHint?: string | null;
  /**
   * Show Google's account chooser even when the browser is signed in to one account, so the
   * user can connect ANOTHER Google account. [oauth-web] `prompt`: "A space-delimited,
   * case-sensitive list of prompts to present the user"; `select_account` = "Prompt the user
   * to select an account."
   */
  selectAccount?: boolean;
}

/**
 * The URL that starts the consent flow. Parameters, all from [oauth-web] "Step 1: Set
 * authorization parameters":
 *   client_id, redirect_uri, response_type=code   required
 *   scope                    space-delimited
 *   access_type=offline      "instructs the Google authorization server to return a refresh
 *                            token and an access token the first time that your application
 *                            exchanges an authorization code for tokens"
 *   prompt=consent           "Prompt the user for consent." Without it Google prompts "only the
 *                            first time your project requests access", and a refresh token is
 *                            only issued on that first exchange; forcing consent means a
 *                            reconnect gets a new refresh token too.
 *   include_granted_scopes=true  "the new access token will also cover any scopes to which the
 *                            user previously granted the application access"
 *   state                    returned unchanged; the callback checks its signature.
 */
export function buildAuthUrl(state: string, redirectUri: string, options: AuthUrlOptions = {}): string {
  const { clientId } = options.config ?? getGoogleOAuthConfig();
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', options.selectAccount ? 'consent select_account' : 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  if (options.loginHint) url.searchParams.set('login_hint', options.loginHint);
  return url.toString();
}

// ── Tokens ──────────────────────────────────────────────────────────────────────

export interface GoogleTokenSet {
  accessToken: string;
  /** ISO timestamp at which the access token stops working. */
  expiresAt: string;
  /** Null when Google did not send one (it does not on a refresh). */
  refreshToken: string | null;
  /** Space-delimited scopes actually granted, or null when the response left it out. */
  scope: string | null;
}

/**
 * The scopes the user actually granted.
 * [oauth-web] "Step 6: Check which scopes users granted": "users may not grant your app
 * access to all of them. Your app must verify which scopes were actually granted".
 */
export function hasScope(grantedScopes: string | null | undefined, scope: string): boolean {
  return (grantedScopes ?? '').split(/\s+/).includes(scope);
}

/**
 * True when the access token is missing, unreadable, or expires within `skewMs`
 * (60 seconds by default), i.e. when it must be refreshed before use. Pure.
 */
export function tokenNeedsRefresh(
  expiresAt: string | Date | null | undefined,
  now: number = Date.now(),
  skewMs = 60_000,
): boolean {
  if (!expiresAt) return true;
  const expiresMs = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) return true;
  return expiresMs - now <= skewMs;
}

const REQUEST_TIMEOUT_MS = 15_000;

interface GoogleResponse {
  ok: boolean;
  status: number;
  body: unknown;
}

/** One request to Google. A network failure or timeout becomes GoogleApiError with status 0. */
async function send(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  context: string,
): Promise<GoogleResponse> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.name : null;
    throw new GoogleApiError(0, 'network_error', detail, context);
  }
  let body: unknown = null;
  try {
    const text = await response.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    // A body that is not JSON is treated as no body; the status still decides the outcome.
  }
  return { ok: response.ok, status: response.status, body };
}

const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' };

/**
 * Reads a token response. [oauth-web] fields: access_token, expires_in ("remaining
 * lifetime of the access token in seconds"), refresh_token, scope ("space-delimited"),
 * token_type. "Your application should ignore any unrecognized fields".
 */
function readTokenResponse(body: unknown, now: number, context: string): GoogleTokenSet {
  const record = asRecord(body);
  const accessToken = asString(record?.access_token);
  if (!accessToken) throw new GoogleApiError(200, 'malformed_response', 'no access_token', context);
  // A missing or odd expires_in is read as "already expired", so the token gets
  // refreshed before its first use instead of being trusted for an unknown time.
  const expiresIn =
    typeof record?.expires_in === 'number' && record.expires_in > 0 ? record.expires_in : 0;
  return {
    accessToken,
    expiresAt: new Date(now + expiresIn * 1000).toISOString(),
    refreshToken: asString(record?.refresh_token),
    scope: asString(record?.scope),
  };
}

/**
 * Exchanges the authorization code from the callback for tokens.
 * [oauth-web] "Step 5": POST https://oauth2.googleapis.com/token, form-encoded, with
 * client_id, client_secret, code, grant_type=authorization_code and redirect_uri.
 * Throws GoogleAuthError when the code is invalid, expired or already used.
 */
export async function exchangeCode(
  code: string,
  redirectUri: string,
  options: GoogleClientOptions = {},
): Promise<GoogleTokenSet> {
  const { clientId, clientSecret } = options.config ?? getGoogleOAuthConfig();
  const context = 'Google code exchange';
  const response = await send(
    options.fetchImpl ?? fetch,
    GOOGLE_TOKEN_ENDPOINT,
    {
      method: 'POST',
      headers: FORM_HEADERS,
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    },
    context,
  );
  if (!response.ok) throw classifyGoogleError(response.status, response.body, context);
  return readTokenResponse(response.body, options.now ?? Date.now(), context);
}

/**
 * Gets a new access token from a refresh token.
 * [oauth-web] "Refresh an access token (offline access)": POST to the token endpoint with client_id,
 * client_secret, grant_type=refresh_token and refresh_token. The sample response carries
 * a new access_token and expires_in and no refresh_token, so `refreshToken` is normally
 * null here and the stored one stays in use.
 * Throws GoogleAuthError when the refresh token no longer works. [oauth] lists why that
 * happens: the user revoked access, the token went unused for six months, the account
 * passed its refresh-token limit, or the OAuth consent screen is in "Testing" status,
 * where a refresh token for a Calendar scope expires after 7 days.
 */
export async function refreshAccessToken(
  refreshToken: string,
  options: GoogleClientOptions = {},
): Promise<GoogleTokenSet> {
  const { clientId, clientSecret } = options.config ?? getGoogleOAuthConfig();
  const context = 'Google token refresh';
  const response = await send(
    options.fetchImpl ?? fetch,
    GOOGLE_TOKEN_ENDPOINT,
    {
      method: 'POST',
      headers: FORM_HEADERS,
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    },
    context,
  );
  if (!response.ok) throw classifyGoogleError(response.status, response.body, context);
  return readTokenResponse(response.body, options.now ?? Date.now(), context);
}

export interface RevokeResult {
  /** True when Google said the token was not valid any more, so there was nothing left to revoke. */
  alreadyInvalid: boolean;
}

/**
 * Revokes a token at Google. Needs no client credentials.
 * [oauth-web] "Token revocation": a request to https://oauth2.googleapis.com/revoke with the
 * token as a parameter and Content-type application/x-www-form-urlencoded. "The token can be
 * an access token or a refresh token." "If the revocation is successfully processed, then the
 * HTTP status code of the response is 200. For error conditions, an HTTP status code 400 is
 * returned along with an error code." Revocation "removes all OAuth 2.0 scopes previously
 * granted to a project" for that Google account, so every token the app holds for the account
 * stops working, not only the one sent.
 *
 * "Already revoked" is NOT spelled out in Google's documentation. OBSERVED, not documented:
 * on 2026-10-03 the endpoint answered a made-up token with HTTP 400 {"error": "invalid_token"}.
 * That answer is treated as "nothing left to revoke". What an expired or already revoked REAL
 * token returns has not been checked (no OAuth client exists yet); any other 400 is an error.
 */
export async function revokeToken(
  token: string,
  options: Pick<GoogleClientOptions, 'fetchImpl'> = {},
): Promise<RevokeResult> {
  const context = 'Google token revocation';
  const response = await send(
    options.fetchImpl ?? fetch,
    GOOGLE_REVOKE_ENDPOINT,
    { method: 'POST', headers: FORM_HEADERS, body: new URLSearchParams({ token }).toString() },
    context,
  );
  if (response.ok) return { alreadyInvalid: false };
  if (response.status === 400 && asRecord(response.body)?.error === 'invalid_token') {
    return { alreadyInvalid: true };
  }
  throw classifyGoogleError(response.status, response.body, context);
}

// ── Account ─────────────────────────────────────────────────────────────────────

export interface GoogleUserInfo {
  /** [oidc] "An identifier for the user, unique among all Google Accounts and never reused." */
  sub: string;
  /**
   * For display only. [oidc] "you shouldn't use this value as the primary identifier";
   * and "Users or their organizations may choose to supply or withhold certain fields",
   * so it can be missing.
   */
  email: string | null;
}

/**
 * The Google account behind an access token.
 * [oidc] "Obtaining user profile information": "Add your access token to the authorization
 * header and make an HTTPS GET request to the userinfo endpoint".
 */
export async function fetchUserInfo(
  accessToken: string,
  options: Pick<GoogleClientOptions, 'fetchImpl'> = {},
): Promise<GoogleUserInfo> {
  const context = 'Google account lookup';
  const response = await send(
    options.fetchImpl ?? fetch,
    GOOGLE_USERINFO_ENDPOINT,
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
    context,
  );
  if (!response.ok) throw classifyGoogleError(response.status, response.body, context);
  const record = asRecord(response.body);
  const sub = asString(record?.sub);
  if (!sub) throw new GoogleApiError(response.status, 'malformed_response', 'no sub', context);
  return { sub, email: asString(record?.email) };
}

// ── Calendars ───────────────────────────────────────────────────────────────────

export interface GoogleCalendarEntry {
  /** [cal-entry] `id`: "Identifier of the calendar." */
  id: string;
  /** The name the user sees in Google Calendar: their own `summaryOverride` when set, else `summary`. */
  summary: string;
  /** [cal-entry] `timeZone`: "The time zone of the calendar. Optional." */
  timeZone: string | null;
  /** [cal-entry] `backgroundColor`: "The main color of the calendar in the hexadecimal format". */
  color: string | null;
  /** [cal-entry] `primary`: "Whether the calendar is the primary calendar of the authenticated user." */
  primary: boolean;
  /** [cal-entry] `accessRole`: freeBusyReader, reader, writerWithoutPrivateAccess, writer or owner. */
  accessRole: string | null;
}

/** [cal-list] maxResults: "The page size can never be larger than 250 entries." */
const CALENDAR_PAGE_SIZE = 250;
/** A stop for a `nextPageToken` that never ends. 20 pages is 5,000 calendars. */
const CALENDAR_MAX_PAGES = 20;

/**
 * Every calendar on the account whose events the user can read, across all pages.
 *
 * [cal-list] GET .../users/me/calendarList with `maxResults`, `pageToken` and
 * `minAccessRole`. `nextPageToken` is "Omitted if no further results are available",
 * which is what ends the loop.
 * `minAccessRole=reader` ("The user can read events that are not private") leaves out
 * calendars shared as free/busy only: their events carry no titles, and the sync reads
 * titles. Hidden and deleted entries are left out by Google's defaults (showHidden and
 * showDeleted both default to False).
 *
 * Throws GoogleApiError: status 401 means the access token is "either expired or
 * invalid" ([cal-errors]) and the caller should refresh and try once more.
 */
export async function listCalendars(
  accessToken: string,
  options: Pick<GoogleClientOptions, 'fetchImpl'> = {},
): Promise<GoogleCalendarEntry[]> {
  const context = 'Google calendar list';
  const calendars: GoogleCalendarEntry[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < CALENDAR_MAX_PAGES; page += 1) {
    const url = new URL(GOOGLE_CALENDAR_LIST_ENDPOINT);
    url.searchParams.set('maxResults', String(CALENDAR_PAGE_SIZE));
    url.searchParams.set('minAccessRole', 'reader');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await send(
      options.fetchImpl ?? fetch,
      url.toString(),
      { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
      context,
    );
    if (!response.ok) throw classifyGoogleError(response.status, response.body, context);

    const record = asRecord(response.body);
    const items = Array.isArray(record?.items) ? record.items : [];
    for (const item of items) {
      const entry = asRecord(item);
      const id = asString(entry?.id);
      if (!entry || !id) continue;
      calendars.push({
        id,
        summary: asString(entry.summaryOverride) ?? asString(entry.summary) ?? id,
        timeZone: asString(entry.timeZone),
        color: asString(entry.backgroundColor),
        primary: entry.primary === true,
        accessRole: asString(entry.accessRole),
      });
    }

    pageToken = asString(record?.nextPageToken);
    if (!pageToken) return calendars;
  }

  throw new GoogleApiError(200, 'too_many_pages', `more than ${CALENDAR_MAX_PAGES} pages`, context);
}

// ── Events ──────────────────────────────────────────────────────────────────────

/** [ev-list] "GET https://www.googleapis.com/calendar/v3/calendars/calendarId/events". */
export function eventsListEndpoint(calendarId: string): string {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
}

/**
 * The part of an event resource ([ev-res]) the sync reads. Anything else Google sends is
 * ignored. In an incremental sync a deleted event may arrive with little more than `id`
 * and `status: "cancelled"`, so every other field is optional.
 */
export interface GoogleEventTime {
  /** All-day events: "The date, in the format yyyy-mm-dd, if this is an all-day event." */
  date?: string | null;
  /** Timed events: "a combined date-time value (formatted according to RFC3339)". */
  dateTime?: string | null;
  /** "The time zone in which the time is specified. (Formatted as an IANA Time Zone Database name...)" */
  timeZone?: string | null;
}

export interface GoogleEvent {
  id: string;
  /** [ev-res] `etag`: "ETag of the resource." Changes whenever the event changes. */
  etag?: string | null;
  /** [ev-res] `status`: "confirmed", "tentative" or "cancelled". */
  status?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  /** [ev-res] `updated`: "Last modification time of the main event data (as a RFC3339 timestamp)." */
  updated?: string | null;
  start?: GoogleEventTime | null;
  end?: GoogleEventTime | null;
  /** Set on an instance of a recurring event (singleEvents=true expands them). */
  recurringEventId?: string | null;
}

export interface EventsPage {
  items: GoogleEvent[];
  /** [ev-list] "Token used to access the next page of this result. Omitted if no further results are available". */
  nextPageToken: string | null;
  /**
   * [ev-list] "Token used at a later point in time to retrieve only the entries that have
   * changed since this result was returned. Omitted if further results are available, in
   * which case nextPageToken is provided." So it arrives on the LAST page only.
   */
  nextSyncToken: string | null;
  /** [ev-list] `timeZone`: "The time zone of the calendar." */
  timeZone: string | null;
}

export interface ListEventsParams {
  syncToken?: string | null;
  timeMin?: string | null;
  timeMax?: string | null;
  pageToken?: string | null;
  maxResults?: number;
}

/** True for Google's "sync token no longer valid" answer: HTTP 410 Gone ([cal-sync], [cal-errors]). */
export function isSyncTokenGone(err: unknown): boolean {
  return err instanceof GoogleApiError && err.status === 410;
}

/**
 * One page of events.list.
 *
 * Parameters, all from [ev-list]:
 *   singleEvents=true  "Whether to expand recurring events into instances and only return single
 *                      one-off events and instances of recurring events". Each instance becomes
 *                      its own task, and a moved instance is its own change.
 *   showDeleted=true   "Whether to include deleted events (with status equals "cancelled") in the
 *                      result." Cancelled events are how the sync learns to archive a task. With a
 *                      syncToken, deleted events "will always be in the result set and it is not
 *                      allowed to set showDeleted to False", so it is sent as true every time.
 *   syncToken          Incremental sync. "There are several query parameters that cannot be
 *                      specified together with nextSyncToken ... iCalUID, orderBy,
 *                      privateExtendedProperty, q, sharedExtendedProperty, timeMin, timeMax,
 *                      updatedMin." So timeMin/timeMax are sent ONLY without a sync token.
 *                      "If the syncToken expires, the server will respond with a 410 GONE response
 *                      code and the client should clear its storage and perform a full
 *                      synchronization without any syncToken." (isSyncTokenGone)
 *   maxResults         "Maximum number of events returned on one result page ... The default is
 *                      250 events. The page size can never be larger than 2500 events."
 *
 * Throws GoogleApiError (status 410 for an expired sync token, 401 for an expired access token)
 * or GoogleAuthError.
 */
export async function listEvents(
  accessToken: string,
  calendarId: string,
  params: ListEventsParams,
  options: Pick<GoogleClientOptions, 'fetchImpl'> = {},
): Promise<EventsPage> {
  const context = 'Google events list';
  const url = new URL(eventsListEndpoint(calendarId));
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('showDeleted', 'true');
  url.searchParams.set('maxResults', String(params.maxResults ?? 250));
  if (params.syncToken) {
    url.searchParams.set('syncToken', params.syncToken);
  } else {
    if (params.timeMin) url.searchParams.set('timeMin', params.timeMin);
    if (params.timeMax) url.searchParams.set('timeMax', params.timeMax);
  }
  if (params.pageToken) url.searchParams.set('pageToken', params.pageToken);

  const response = await send(
    options.fetchImpl ?? fetch,
    url.toString(),
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
    context,
  );
  if (!response.ok) throw classifyGoogleError(response.status, response.body, context);

  const record = asRecord(response.body);
  const rawItems = Array.isArray(record?.items) ? record.items : [];
  const items: GoogleEvent[] = [];
  for (const raw of rawItems) {
    const entry = asRecord(raw);
    const id = asString(entry?.id);
    if (!entry || !id) continue;
    items.push({ ...(entry as Omit<GoogleEvent, 'id'>), id });
  }
  return {
    items,
    nextPageToken: asString(record?.nextPageToken),
    nextSyncToken: asString(record?.nextSyncToken),
    timeZone: asString(record?.timeZone),
  };
}
