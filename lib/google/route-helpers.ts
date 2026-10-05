// lib/google/route-helpers.ts
// Server-only. What the /api/calendar/google/* routes share: the service-role client,
// the "is the server set up?" check, and one place that turns a thrown error into a
// clear response, so no route returns a raw Postgres or Google error.

import { NextResponse } from 'next/server';
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js';
import { encryptSecret } from '@/lib/crypto/tokens';
import { hasOAuthStateSecret } from '@/lib/oauth-state';
import { GoogleApiError, GoogleAuthError, GoogleConfigError, isGoogleConfigured } from './calendar-client';
import { CalendarSchemaMissingError, StoredTokenError } from './connection';

/** Where the browser lands after the OAuth round trip, with ?connected= or ?error=. */
export const CALENDAR_SETTINGS_PATH = '/dashboard/settings/calendar';

/**
 * Service-role client. calendar_connections has Row Level Security on and no policies,
 * so this is the only client that can read it. Use it only after the user's session has
 * been checked, and always filter by that user's id.
 */
export function getServiceDb(): SupabaseClient {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a UUID string, e.g. a connection_id from a request. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** True when TOKEN_ENCRYPTION_KEY is set and well formed, i.e. tokens can be stored. */
export function isTokenEncryptionReady(): boolean {
  try {
    encryptSecret('preflight');
    return true;
  } catch {
    return false;
  }
}

/** True when lib/oauth-state.ts can sign the OAuth state (either name of the Supabase JWT secret). */
export function isOAuthStateReady(): boolean {
  return hasOAuthStateSecret();
}

/** What the server still lacks before anyone can connect. Empty when it is ready. */
export function missingServerSetup(): string[] {
  const missing: string[] = [];
  if (!isGoogleConfigured()) missing.push('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET');
  if (!isTokenEncryptionReady()) missing.push('TOKEN_ENCRYPTION_KEY');
  if (!isOAuthStateReady()) missing.push('SUPABASE_JWT_SECRET (or SUPABASE__SUPABASE_JWT_SECRET)');
  return missing;
}

export type CalendarErrorCode =
  | 'migration_missing'
  | 'not_configured'
  | 'needs_reauth'
  | 'google_error'
  | 'token_unreadable'
  | 'internal';

interface CalendarErrorInfo {
  code: CalendarErrorCode;
  status: number;
  message: string;
}

/** Maps a thrown error to a code, an HTTP status and a message that is safe to show. */
export function describeCalendarError(err: unknown): CalendarErrorInfo {
  if (err instanceof CalendarSchemaMissingError) {
    return {
      code: 'migration_missing',
      status: 503,
      message:
        'Google Calendar sync is not set up on this site yet: database migrations 204_calendar_sync.sql and 205_calendar_multi_account.sql must both be applied.',
    };
  }
  if (err instanceof GoogleConfigError) {
    return {
      code: 'not_configured',
      status: 503,
      message: `Google Calendar is not configured on this site yet: ${err.missing.join(' and ')} ${
        err.missing.length === 1 ? 'is' : 'are'
      } not set.`,
    };
  }
  if (err instanceof GoogleAuthError) {
    return {
      code: 'needs_reauth',
      status: 409,
      message: 'Google no longer accepts the saved authorization. Reconnect Google Calendar.',
    };
  }
  if (err instanceof GoogleApiError) {
    return {
      code: 'google_error',
      status: 502,
      message: err.status
        ? `Google returned an error (HTTP ${err.status}${err.code ? `, ${err.code}` : ''}). Try again in a minute.`
        : 'Google could not be reached. Try again in a minute.',
    };
  }
  if (err instanceof StoredTokenError) {
    return {
      code: 'token_unreadable',
      status: 500,
      message:
        'The saved Google tokens could not be read (the encryption key is missing or has changed). Disconnect and connect again.',
    };
  }
  return { code: 'internal', status: 500, message: 'Something went wrong. Try again.' };
}

/** The JSON error response for a thrown error. Unexpected errors are logged, never echoed. */
export function calendarErrorResponse(err: unknown, where: string): NextResponse {
  const info = describeCalendarError(err);
  if (info.code === 'internal') {
    console.error(`[api/calendar/google] ${where}:`, err instanceof Error ? err.message : err);
  }
  return NextResponse.json({ error: info.message, code: info.code }, { status: info.status });
}
