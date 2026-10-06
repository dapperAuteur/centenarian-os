#!/usr/bin/env node
// scripts/backfill-calendar-event-fields.mjs
// Fills the migration 216 columns (starts_at, ends_at, all_day, time_zone, location) on
// calendar_sync_items rows synced before the migration, by reading each switched-on calendar's
// events from Google again. The live sync fills them for every event it writes from now on; this
// covers the rows it has not touched since.
//
// What it reads: for every ACTIVE Google connection (or one user's, with --user), every switched-on
// calendar, the same window the first sync reads (30 days back, 180 days ahead), read-only.
// What it writes: only the five columns above, on rows that already exist (matched by Google
// event id). It creates no rows, touches no task or record, and leaves sync tokens alone, so the
// next regular sync carries on as before. It sends nothing to RideWitUS.
//
// Usage (BAM runs this; migration 216 must be applied first):
//   node --env-file=.env.local --experimental-strip-types scripts/backfill-calendar-event-fields.mjs --dry
//   node --env-file=.env.local --experimental-strip-types scripts/backfill-calendar-event-fields.mjs
//   ... --user <user uuid>     only that user's connections
//
// --dry reads Google and prints what would change; it writes nothing (an access token that has
// expired is refreshed in memory and not saved). Safe to re-run: the same event always gives the
// same values.
//
// Run it BEFORE switching "Share with RideWitUS" on: switching sharing on sends the calendar's
// events in the window, using these columns. For a calendar that was already shared, switch
// sharing off and on again after the backfill to resend.
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TOKEN_ENCRYPTION_KEY and the Google
// OAuth client (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, see lib/google/calendar-client.ts).
// Logs counts and calendar names only: never tokens, titles or locations.

import { createClient } from '@supabase/supabase-js';
import { listEvents, refreshAccessToken, tokenNeedsRefresh } from '../lib/google/calendar-client.ts';
import { withAccessToken } from '../lib/google/connection.ts';
import { decryptSecret } from '../lib/crypto/tokens.ts';
import { fetchCalendarChanges } from '../lib/calendar/fetch-changes.ts';
import { eventTimeColumns } from '../lib/calendar/event-times.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.argv.includes('--dry');
const userFlag = process.argv.indexOf('--user');
const ONLY_USER = userFlag !== -1 ? process.argv[userFlag + 1] : null;
const LOOKUP_CHUNK = 100;
/** Time allowed for reading one calendar from Google. */
const CALENDAR_BUDGET_MS = 120_000;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE env vars. Run with: node --env-file=.env.local --experimental-strip-types scripts/backfill-calendar-event-fields.mjs --dry',
  );
  process.exit(1);
}
if (userFlag !== -1 && !ONLY_USER) {
  console.error('--user needs a user id.');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Migration 216 must be applied: the new columns have to exist.
{
  const { error } = await db.from('calendar_sync_items').select('id, starts_at, location').limit(1);
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204') {
      console.error('Migration 216_calendar_activity_feed.sql is not applied yet. Apply it, then run this again.');
    } else {
      console.error(`Could not read calendar_sync_items: ${error.message}`);
    }
    process.exit(1);
  }
}

/** Runs fn with a working access token. --dry refreshes in memory only; a live run saves the refresh. */
async function withToken(conn, fn) {
  if (!DRY) return withAccessToken(db, conn, fn);
  if (conn.access_token_enc && !tokenNeedsRefresh(conn.token_expires_at, Date.now())) {
    return fn(decryptSecret(conn.access_token_enc));
  }
  if (!conn.refresh_token_enc) throw new Error('no refresh token saved; reconnect this account');
  const tokens = await refreshAccessToken(decryptSecret(conn.refresh_token_enc));
  return fn(tokens.accessToken);
}

let connQuery = db.from('calendar_connections').select('*').eq('provider', 'google').eq('status', 'active');
if (ONLY_USER) connQuery = connQuery.eq('user_id', ONLY_USER);
const { data: connections, error: connError } = await connQuery;
if (connError) {
  console.error(`Could not read calendar_connections: ${connError.message}`);
  process.exit(1);
}

const totals = { calendars: 0, events: 0, matched: 0, updated: 0, noStart: 0, failedCalendars: 0 };
console.log(`${DRY ? '[dry run] ' : ''}${connections?.length ?? 0} active Google connection(s).`);

for (const conn of connections ?? []) {
  const { data: calendars, error: calError } = await db
    .from('calendar_sync_calendars')
    .select('id, calendar_id, summary, time_zone')
    .eq('connection_id', conn.id)
    .eq('enabled', true);
  if (calError) {
    console.error(`  connection ${conn.id}: could not read its calendars: ${calError.message}`);
    continue;
  }

  for (const cal of calendars ?? []) {
    totals.calendars += 1;
    const name = cal.summary ?? 'unnamed calendar';
    try {
      const changes = await withToken(conn, (accessToken) =>
        fetchCalendarChanges((params) => listEvents(accessToken, cal.calendar_id, params), {
          syncToken: null,
          now: Date.now(),
          deadline: Date.now() + CALENDAR_BUDGET_MS,
        }),
      );
      const timeZone = changes.timeZone ?? cal.time_zone ?? null;
      const events = new Map();
      for (const event of changes.events) events.set(event.id, event);
      totals.events += events.size;

      // The stored rows for these events.
      const ids = [...events.keys()];
      const rows = [];
      for (let i = 0; i < ids.length; i += LOOKUP_CHUNK) {
        const { data, error } = await db
          .from('calendar_sync_items')
          .select('id, event_id')
          .eq('user_id', conn.user_id)
          .eq('calendar_id', cal.calendar_id)
          .in('event_id', ids.slice(i, i + LOOKUP_CHUNK));
        if (error) throw new Error(`reading synced events: ${error.message}`);
        rows.push(...(data ?? []));
      }

      let calUpdated = 0;
      for (const row of rows) {
        totals.matched += 1;
        const columns = eventTimeColumns(events.get(row.event_id), timeZone);
        if (!columns) {
          totals.noStart += 1;
          continue;
        }
        if (!DRY) {
          const { error } = await db.from('calendar_sync_items').update(columns).eq('id', row.id);
          if (error) throw new Error(`saving event fields: ${error.message}`);
        }
        calUpdated += 1;
      }
      totals.updated += calUpdated;
      console.log(
        `  ${name}: ${events.size} event(s) read, ${rows.length} synced row(s) matched, ${calUpdated} ${DRY ? 'would be' : ''} updated${
          changes.complete ? '' : ' (stopped early: time budget or page limit; run again)'
        }.`,
      );
    } catch (err) {
      totals.failedCalendars += 1;
      console.error(`  ${name}: skipped: ${err instanceof Error ? err.message.replace(/^\[[^\]]+\]\s*/, '') : 'unknown error'}`);
    }
  }
}

console.log(
  `${DRY ? '[dry run] ' : ''}Done. Calendars ${totals.calendars} (failed ${totals.failedCalendars}), events read ${totals.events}, rows matched ${totals.matched}, rows ${DRY ? 'to update' : 'updated'} ${totals.updated}, rows without a usable start ${totals.noStart}.`,
);
