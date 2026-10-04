// lib/google/connection.ts
// Server-only. The stored side of the Google Calendar connection: reading the
// calendar_connections row, saving tokens, and handing out an access token that works.
//
// RULES THIS FILE KEEPS
//   - Tokens are written only through encryptSecret (lib/crypto/tokens.ts). No plain-text
//     token is ever stored, logged, or put in an error message.
//   - `db` is always a SERVICE-ROLE Supabase client. calendar_connections has Row Level
//     Security on and no policies (migration 204), so no other client can read it. The
//     caller checks the user's session first and passes that user's id.
//   - A missing table (migration 204 not applied yet) becomes CalendarSchemaMissingError,
//     so routes can say so instead of returning a raw Postgres error.
//
// The relative imports keep their ".ts" extension because this file also runs under
// `node --test --experimental-strip-types` (tests/unit/google-calendar-client.test.ts).

import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '../crypto/tokens.ts';
import {
  GoogleApiError,
  GoogleAuthError,
  refreshAccessToken,
  tokenNeedsRefresh,
  type GoogleCalendarEntry,
  type GoogleClientOptions,
  type GoogleTokenSet,
} from './calendar-client.ts';

const LABEL = '[lib/google/connection]';

export const CALENDAR_PROVIDER = 'google';

export type CalendarConnectionStatus = 'active' | 'needs_reauth' | 'disconnected';

/** The user's defaults for records made from events. Used from the sync phase on. */
export interface CalendarConnectionSettings {
  default_account_id?: string | null;
  default_trip_mode?: string | null;
  default_tag?: string | null;
}

/** A full calendar_connections row, tokens included. Never send this to the browser. */
export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: string;
  account_email: string | null;
  provider_sub: string | null;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  scopes: string | null;
  status: CalendarConnectionStatus;
  settings: CalendarConnectionSettings | null;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/** The connection as the browser may see it: no token columns. */
export type PublicCalendarConnection = Pick<
  CalendarConnection,
  | 'id'
  | 'provider'
  | 'account_email'
  | 'status'
  | 'scopes'
  | 'settings'
  | 'last_synced_at'
  | 'last_error'
  | 'created_at'
  | 'updated_at'
>;

/** The only calendar_connections columns a browser-facing response may select. */
export const PUBLIC_CONNECTION_COLUMNS =
  'id, provider, account_email, status, scopes, settings, last_synced_at, last_error, created_at, updated_at';

/** A calendar_sync_calendars row as the browser sees it (no sync token). */
export interface StoredCalendar {
  id: string;
  calendar_id: string;
  summary: string | null;
  time_zone: string | null;
  color: string | null;
  enabled: boolean;
  last_synced_at: string | null;
  last_error: string | null;
}

export const PUBLIC_CALENDAR_COLUMNS =
  'id, calendar_id, summary, time_zone, color, enabled, last_synced_at, last_error';

// ── Errors ──────────────────────────────────────────────────────────────────────

/** Migration 204_calendar_sync.sql has not been applied to this database yet. */
export class CalendarSchemaMissingError extends Error {
  constructor() {
    super(
      `${LABEL} The calendar sync tables do not exist yet: migration 204_calendar_sync.sql has not been applied to this database.`,
    );
    this.name = 'CalendarSchemaMissingError';
  }
}

/** A stored token could not be decrypted (wrong or missing TOKEN_ENCRYPTION_KEY, or a damaged value). */
export class StoredTokenError extends Error {
  constructor() {
    super(
      `${LABEL} A saved Google token could not be decrypted. TOKEN_ENCRYPTION_KEY is missing or is not the key the token was saved with.`,
    );
    this.name = 'StoredTokenError';
  }
}

interface DbError {
  code?: string;
  message?: string;
}

/**
 * True when the database says the table is not there.
 * 42P01 is PostgreSQL's undefined_table; PGRST205 is PostgREST's "Could not find the
 * table ... in the schema cache" (https://docs.postgrest.org/en/stable/references/errors.html).
 */
export function isMissingTableError(error: DbError | null | undefined): boolean {
  return !!error && (error.code === '42P01' || error.code === 'PGRST205');
}

/** Throws the right error for a failed query. `context` says what was being done. */
export function throwDbError(error: DbError, context: string): never {
  if (isMissingTableError(error)) throw new CalendarSchemaMissingError();
  throw new Error(`${LABEL} ${context} failed: ${error.message ?? error.code ?? 'unknown database error'}`);
}

function readSecret(stored: string): string {
  try {
    return decryptSecret(stored);
  } catch {
    throw new StoredTokenError();
  }
}

// ── Reading ─────────────────────────────────────────────────────────────────────

/** The user's Google connection with its (encrypted) tokens, or null when there is none. */
export async function getConnection(db: SupabaseClient, userId: string): Promise<CalendarConnection | null> {
  const { data, error } = await db
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', CALENDAR_PROVIDER)
    .maybeSingle();
  if (error) throwDbError(error, 'Reading the calendar connection');
  return (data as CalendarConnection | null) ?? null;
}

/** The same row without any token column, for responses that go to the browser. */
export async function getPublicConnection(
  db: SupabaseClient,
  userId: string,
): Promise<PublicCalendarConnection | null> {
  const { data, error } = await db
    .from('calendar_connections')
    .select(PUBLIC_CONNECTION_COLUMNS)
    .eq('user_id', userId)
    .eq('provider', CALENDAR_PROVIDER)
    .maybeSingle();
  if (error) throwDbError(error, 'Reading the calendar connection');
  return (data as PublicCalendarConnection | null) ?? null;
}

/** The calendars saved for a connection, by name. */
export async function listStoredCalendars(db: SupabaseClient, connectionId: string): Promise<StoredCalendar[]> {
  const { data, error } = await db
    .from('calendar_sync_calendars')
    .select(PUBLIC_CALENDAR_COLUMNS)
    .eq('connection_id', connectionId)
    .order('summary', { ascending: true });
  if (error) throwDbError(error, 'Reading the saved calendars');
  return (data as StoredCalendar[] | null) ?? [];
}

// ── Writing ─────────────────────────────────────────────────────────────────────

export interface SaveTokensInput {
  userId: string;
  /** From the code exchange. `refreshToken` must be present: check before calling. */
  tokens: GoogleTokenSet;
  accountEmail: string | null;
  providerSub: string;
}

/**
 * Stores a freshly granted set of tokens, encrypted, as the user's Google connection.
 * One row per user and provider: connecting again replaces the tokens and the account,
 * marks the connection active, and keeps the user's settings.
 */
export async function saveTokens(db: SupabaseClient, input: SaveTokensInput): Promise<CalendarConnection> {
  const { userId, tokens, accountEmail, providerSub } = input;
  if (!tokens.refreshToken) {
    throw new Error(`${LABEL} saveTokens needs a refresh token; Google did not return one.`);
  }
  const { data, error } = await db
    .from('calendar_connections')
    .upsert(
      {
        user_id: userId,
        provider: CALENDAR_PROVIDER,
        account_email: accountEmail,
        provider_sub: providerSub,
        access_token_enc: encryptSecret(tokens.accessToken),
        refresh_token_enc: encryptSecret(tokens.refreshToken),
        token_expires_at: tokens.expiresAt,
        scopes: tokens.scope,
        status: 'active',
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    )
    .select('*')
    .maybeSingle();
  if (error) throwDbError(error, 'Saving the calendar connection');
  if (!data) throw new Error(`${LABEL} Saving the calendar connection returned no row.`);
  return data as CalendarConnection;
}

async function markNeedsReauth(db: SupabaseClient, conn: CalendarConnection, reason: string): Promise<void> {
  const patch = { status: 'needs_reauth' as const, last_error: reason, updated_at: new Date().toISOString() };
  const { error } = await db.from('calendar_connections').update(patch).eq('id', conn.id);
  // The caller is about to rethrow the Google error, which is the one that matters;
  // a failure to record it is logged and not allowed to hide it.
  if (error) console.error(`${LABEL} could not mark connection ${conn.id} as needs_reauth:`, error.message);
  else Object.assign(conn, patch);
}

async function refreshAndPersist(
  db: SupabaseClient,
  conn: CalendarConnection,
  options: GoogleClientOptions,
): Promise<string> {
  if (!conn.refresh_token_enc) {
    const reason = 'No refresh token is saved for this connection. Reconnect Google Calendar.';
    await markNeedsReauth(db, conn, reason);
    throw new GoogleAuthError(reason);
  }
  const refreshToken = readSecret(conn.refresh_token_enc);

  let tokens: GoogleTokenSet;
  try {
    tokens = await refreshAccessToken(refreshToken, options);
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      await markNeedsReauth(
        db,
        conn,
        `Google no longer accepts the saved authorization (invalid_grant${
          err.description ? `: ${err.description}` : ''
        }). Reconnect Google Calendar.`,
      );
    }
    throw err;
  }

  const patch: Partial<CalendarConnection> = {
    access_token_enc: encryptSecret(tokens.accessToken),
    token_expires_at: tokens.expiresAt,
    status: 'active',
    last_error: null,
    updated_at: new Date().toISOString(),
  };
  // Google normally sends no refresh token on a refresh; when it does, the new one replaces the old.
  if (tokens.refreshToken) patch.refresh_token_enc = encryptSecret(tokens.refreshToken);
  if (tokens.scope) patch.scopes = tokens.scope;

  const { error } = await db.from('calendar_connections').update(patch).eq('id', conn.id);
  if (error) throwDbError(error, 'Saving the refreshed Google token');
  Object.assign(conn, patch);
  return tokens.accessToken;
}

/**
 * Runs `fn` with an access token that works.
 *
 *   - The stored token is used as is unless it expires within 60 seconds; then it is
 *     refreshed first and the new one is saved (encrypted).
 *   - If Google answers `fn` with 401 ("The access token you're using is either expired or
 *     invalid" - https://developers.google.com/workspace/calendar/api/guides/errors), the
 *     token is refreshed once and `fn` runs again.
 *   - If the refresh fails with invalid_grant, the connection is marked `needs_reauth`
 *     with `last_error`, and the GoogleAuthError is rethrown. A connection already marked
 *     needs_reauth throws straight away, without asking Google again.
 *
 * `conn` is updated in place with whatever was saved, so calling this again with the
 * same object does not refresh a second time.
 */
export async function withAccessToken<T>(
  db: SupabaseClient,
  conn: CalendarConnection,
  fn: (accessToken: string) => Promise<T>,
  options: GoogleClientOptions = {},
): Promise<T> {
  if (conn.status === 'needs_reauth') {
    throw new GoogleAuthError(conn.last_error ?? 'This connection needs to be reconnected.');
  }

  const now = options.now ?? Date.now();
  let accessToken: string;
  let refreshed = false;
  if (conn.access_token_enc && !tokenNeedsRefresh(conn.token_expires_at, now)) {
    accessToken = readSecret(conn.access_token_enc);
  } else {
    accessToken = await refreshAndPersist(db, conn, options);
    refreshed = true;
  }

  try {
    return await fn(accessToken);
  } catch (err) {
    if (refreshed || !(err instanceof GoogleApiError) || err.status !== 401) throw err;
    return fn(await refreshAndPersist(db, conn, options));
  }
}

/**
 * The token to hand to Google's revoke endpoint, or null when none is saved. The refresh
 * token is preferred: it is the long-lived one, and revoking either removes the whole grant.
 * Throws StoredTokenError when the saved value cannot be decrypted.
 */
export function tokenToRevoke(
  conn: Pick<CalendarConnection, 'access_token_enc' | 'refresh_token_enc'>,
): string | null {
  const stored = conn.refresh_token_enc ?? conn.access_token_enc;
  return stored ? readSecret(stored) : null;
}

/**
 * Deletes the user's connection row, tokens included. The database then removes its
 * calendar_sync_calendars rows (ON DELETE CASCADE) and keeps calendar_sync_items with
 * connection_id set to NULL.
 */
export async function deleteConnection(db: SupabaseClient, userId: string): Promise<void> {
  const { error } = await db
    .from('calendar_connections')
    .delete()
    .eq('user_id', userId)
    .eq('provider', CALENDAR_PROVIDER);
  if (error) throwDbError(error, 'Deleting the calendar connection');
}

/** Forgets every saved calendar of a connection (used when a different Google account connects). */
export async function clearCalendars(db: SupabaseClient, connectionId: string): Promise<void> {
  const { error } = await db.from('calendar_sync_calendars').delete().eq('connection_id', connectionId);
  if (error) throwDbError(error, 'Clearing the saved calendars');
}

/** Replaces the connection's settings object. Returns the row without token columns, or null when there is no connection. */
export async function updateSettings(
  db: SupabaseClient,
  userId: string,
  settings: CalendarConnectionSettings,
): Promise<PublicCalendarConnection | null> {
  const { data, error } = await db
    .from('calendar_connections')
    .update({ settings, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('provider', CALENDAR_PROVIDER)
    .select(PUBLIC_CONNECTION_COLUMNS)
    .maybeSingle();
  if (error) throwDbError(error, 'Saving the calendar settings');
  return (data as PublicCalendarConnection | null) ?? null;
}

/**
 * Switches one calendar on or off. Switching it on clears its sync token (and its last
 * error), so the next sync reads the calendar from scratch instead of resuming from
 * wherever it stopped before it was switched off. Returns null when the connection has no
 * such calendar.
 */
export async function setCalendarEnabled(
  db: SupabaseClient,
  connectionId: string,
  calendarId: string,
  enabled: boolean,
): Promise<StoredCalendar | null> {
  const patch: Record<string, unknown> = { enabled, updated_at: new Date().toISOString() };
  if (enabled) {
    patch.sync_token = null;
    patch.last_error = null;
  }
  const { data, error } = await db
    .from('calendar_sync_calendars')
    .update(patch)
    .eq('connection_id', connectionId)
    .eq('calendar_id', calendarId)
    .select(PUBLIC_CALENDAR_COLUMNS)
    .maybeSingle();
  if (error) throwDbError(error, 'Updating the calendar');
  return (data as StoredCalendar | null) ?? null;
}

/**
 * Makes calendar_sync_calendars match the list Google just returned: adds new calendars
 * (switched off), refreshes the name, time zone and color of known ones, and removes
 * calendars that are no longer on the account. A known calendar keeps its `enabled`
 * switch, its sync token and its milestone, because the upsert does not send those columns.
 */
export async function saveCalendarList(
  db: SupabaseClient,
  conn: Pick<CalendarConnection, 'id' | 'user_id'>,
  calendars: GoogleCalendarEntry[],
): Promise<void> {
  const { data: existing, error: readError } = await db
    .from('calendar_sync_calendars')
    .select('id, calendar_id')
    .eq('connection_id', conn.id);
  if (readError) throwDbError(readError, 'Reading the saved calendars');

  if (calendars.length > 0) {
    const now = new Date().toISOString();
    const { error } = await db.from('calendar_sync_calendars').upsert(
      calendars.map((calendar) => ({
        connection_id: conn.id,
        user_id: conn.user_id,
        calendar_id: calendar.id,
        summary: calendar.summary,
        time_zone: calendar.timeZone,
        color: calendar.color,
        updated_at: now,
      })),
      { onConflict: 'connection_id,calendar_id' },
    );
    if (error) throwDbError(error, 'Saving the calendar list');
  }

  const current = new Set(calendars.map((calendar) => calendar.id));
  const staleIds = ((existing as { id: string; calendar_id: string }[] | null) ?? [])
    .filter((row) => !current.has(row.calendar_id))
    .map((row) => row.id);
  if (staleIds.length > 0) {
    const { error } = await db.from('calendar_sync_calendars').delete().in('id', staleIds);
    if (error) throwDbError(error, 'Removing calendars that are no longer on the account');
  }
}
