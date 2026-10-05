// tests/unit/google-sync.test.ts
// Run: npm run test:unit
//
// Covers the pure parts of the Google Calendar sync: event -> task fields (timed, all-day, time
// zones, description), the sync decision (new, cancelled, moved, etag no-op, user-deleted,
// interrupted create), the change reader (first run window, paging, 410 Gone -> full read,
// deadline), events.list parameters with a fake fetch, and the validation rate limit.
// No network, no database. Every value below is made up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_DAY_TIME,
  DEFAULT_SYNC_TAG,
  MAX_DESCRIPTION_LENGTH,
  decideSyncAction,
  eventStart,
  eventToTaskFields,
  fullSyncWindow,
  htmlToText,
  wallClockAt,
  type SyncItemState,
} from '../../lib/calendar/event-fields.ts';
import { fetchCalendarChanges, type ListPage } from '../../lib/calendar/fetch-changes.ts';
import {
  GoogleApiError,
  buildAuthUrl,
  isSyncTokenGone,
  listEvents,
  type EventsPage,
  type GoogleEvent,
  type ListEventsParams,
} from '../../lib/google/calendar-client.ts';
import { validationDue } from '../../lib/google/connection.ts';

const NOW = Date.parse('2026-10-04T12:00:00.000Z');

const timed = (overrides: Partial<GoogleEvent> = {}): GoogleEvent => ({
  id: 'evt1',
  etag: '"e1"',
  status: 'confirmed',
  summary: 'Dentist',
  start: { dateTime: '2026-10-05T21:30:00Z' },
  ...overrides,
});

const item = (overrides: Partial<SyncItemState> = {}): SyncItemState => ({
  id: '11111111-1111-4111-8111-111111111111',
  etag: '"e0"',
  task_id: '22222222-2222-4222-8222-222222222222',
  event_status: 'confirmed',
  ...overrides,
});

// ── Time zones ──────────────────────────────────────────────────────────────────

test('wallClockAt converts an instant to the wall clock of a time zone', () => {
  // 21:30 UTC on 5 Oct = 14:30 in Los Angeles (PDT, UTC-7).
  assert.deepEqual(wallClockAt('2026-10-05T21:30:00Z', 'America/Los_Angeles'), { date: '2026-10-05', time: '14:30' });
  // Crosses midnight: 02:00 UTC on 6 Oct is still 5 Oct in New York.
  assert.deepEqual(wallClockAt('2026-10-06T02:00:00Z', 'America/New_York'), { date: '2026-10-05', time: '22:00' });
  // Midnight prints as 00, not 24.
  assert.deepEqual(wallClockAt('2026-10-05T00:00:00Z', 'UTC'), { date: '2026-10-05', time: '00:00' });
});

test('wallClockAt without a usable time zone keeps the date and time written in the value', () => {
  assert.deepEqual(wallClockAt('2026-10-05T14:00:00-07:00', null), { date: '2026-10-05', time: '14:00' });
  assert.deepEqual(wallClockAt('2026-10-05T14:00:00-07:00', 'Not/AZone'), { date: '2026-10-05', time: '14:00' });
  assert.equal(wallClockAt('not a date', 'UTC'), null);
});

test('eventStart prefers the event time zone, then the calendar time zone', () => {
  const event = timed({ start: { dateTime: '2026-10-05T21:30:00Z', timeZone: 'Europe/Madrid' } });
  assert.deepEqual(eventStart(event, 'America/Los_Angeles'), { date: '2026-10-05', time: '23:30' });
  assert.deepEqual(eventStart(timed(), 'America/Los_Angeles'), { date: '2026-10-05', time: '14:30' });
});

test('all-day events are scheduled at 09:00 on their start date', () => {
  const event = timed({ start: { date: '2026-10-07' }, end: { date: '2026-10-09' } });
  assert.deepEqual(eventStart(event, 'America/Los_Angeles'), { date: '2026-10-07', time: ALL_DAY_TIME });
  assert.equal(ALL_DAY_TIME, '09:00');
});

test('an event without a start has no task fields', () => {
  assert.equal(eventStart(timed({ start: null }), 'UTC'), null);
  assert.equal(eventToTaskFields(timed({ start: undefined }), 'UTC'), null);
});

// ── Event -> task fields ────────────────────────────────────────────────────────

test('a timed event becomes a task in the calendar time zone with the default tag', () => {
  const fields = eventToTaskFields(timed(), 'America/Los_Angeles');
  assert.ok(fields);
  assert.equal(fields.date, '2026-10-05');
  assert.equal(fields.time, '14:30');
  assert.equal(fields.activity, 'Dentist');
  assert.equal(fields.tag, DEFAULT_SYNC_TAG);
  assert.equal(fields.description, null);
  assert.equal(fields.parseStatus, 'task_only');
});

test('the connection default_tag is used when set', () => {
  assert.equal(eventToTaskFields(timed(), 'UTC', 'WORK')?.tag, 'WORK');
  assert.equal(eventToTaskFields(timed(), 'UTC', '   ')?.tag, DEFAULT_SYNC_TAG);
});

test('capture tokens leave the title and the parse result is kept', () => {
  const fields = eventToTaskFields(timed({ summary: 'Lunch Chipotle #expense $12.40' }), 'UTC');
  assert.ok(fields);
  assert.equal(fields.activity, 'Lunch Chipotle');
  assert.equal(fields.parsed.kind, 'expense');
  assert.equal(fields.parsed.amountCents, 1240);
  assert.equal(fields.parseStatus, 'ok');
});

test('a token with missing data is flagged and noted in the description', () => {
  const fields = eventToTaskFields(timed({ summary: 'Coffee #expense' }), 'UTC');
  assert.ok(fields);
  assert.equal(fields.parseStatus, 'flagged');
  assert.match(fields.parseError ?? '', /no amount/);
  assert.match(fields.description ?? '', /Calendar sync: check the title/);
});

test('description joins the event description (as text) and the location, trimmed to 1000 characters', () => {
  const fields = eventToTaskFields(
    timed({ description: 'Bring <b>X-rays</b><br>Floor 2 &amp; desk B', location: '123 Main St' }),
    'UTC',
  );
  assert.equal(fields?.description, 'Bring X-rays\nFloor 2 & desk B\n\nLocation: 123 Main St');

  const long = eventToTaskFields(timed({ description: 'a'.repeat(5000), location: 'Somewhere' }), 'UTC');
  assert.equal(long?.description?.length, MAX_DESCRIPTION_LENGTH);
});

test('an untitled event gets a placeholder title', () => {
  assert.equal(eventToTaskFields(timed({ summary: null }), 'UTC')?.activity, '(No title)');
});

test('htmlToText strips tags and decodes entities', () => {
  assert.equal(htmlToText('<p>One</p><p>Two &lt;3</p>'), 'One\nTwo <3');
});

// ── Sync decision ───────────────────────────────────────────────────────────────

test('a new event is created', () => {
  assert.deepEqual(decideSyncAction(timed(), null), { action: 'create' });
});

test('an unchanged etag is a no-op', () => {
  assert.deepEqual(decideSyncAction(timed({ etag: '"same"' }), item({ etag: '"same"' })), { action: 'skip' });
  // Also for a cancelled event already handled.
  assert.deepEqual(
    decideSyncAction(timed({ etag: '"same"', status: 'cancelled' }), item({ etag: '"same"' })),
    { action: 'skip' },
  );
});

test('a moved event (new etag) updates its task', () => {
  const moved = timed({ etag: '"e2"', start: { dateTime: '2026-10-08T16:00:00Z' } });
  assert.deepEqual(decideSyncAction(moved, item()), { action: 'update', unarchive: false });
  assert.deepEqual(eventToTaskFields(moved, 'UTC')?.date, '2026-10-08');
  assert.deepEqual(eventToTaskFields(moved, 'UTC')?.time, '16:00');
});

test('a cancelled event archives its task; a cancelled event never seen is ignored', () => {
  const cancelled: GoogleEvent = { id: 'evt1', etag: '"e9"', status: 'cancelled' };
  assert.deepEqual(decideSyncAction(cancelled, item()), { action: 'archive' });
  assert.deepEqual(decideSyncAction(cancelled, null), { action: 'ignore' });
  assert.deepEqual(decideSyncAction(cancelled, item({ task_id: null })), { action: 'record_only' });
});

test('an event restored after a cancellation is un-archived', () => {
  assert.deepEqual(decideSyncAction(timed({ etag: '"e3"' }), item({ event_status: 'cancelled' })), {
    action: 'update',
    unarchive: true,
  });
});

test('a task the user deleted is not recreated; an interrupted create is resumed', () => {
  assert.deepEqual(decideSyncAction(timed({ etag: '"e5"' }), item({ task_id: null })), { action: 'record_only' });
  assert.deepEqual(decideSyncAction(timed(), item({ task_id: null, etag: null })), { action: 'create' });
});

// ── Change reader ───────────────────────────────────────────────────────────────

function fakeLister(pages: Record<string, EventsPage | Error>, calls: ListEventsParams[]): ListPage {
  return async (params) => {
    calls.push(params);
    const key = `${params.syncToken ? `sync:${params.syncToken}` : 'full'}|${params.pageToken ?? ''}`;
    const page = pages[key];
    if (!page) throw new Error(`unexpected request ${key}`);
    if (page instanceof Error) throw page;
    return page;
  };
}

const page = (items: GoogleEvent[], next: Partial<EventsPage> = {}): EventsPage => ({
  items,
  nextPageToken: null,
  nextSyncToken: null,
  timeZone: 'America/Chicago',
  ...next,
});

test('first run reads the 30-day-back / 180-day-ahead window, all pages, and keeps the last page token', async () => {
  const calls: ListEventsParams[] = [];
  const list = fakeLister(
    {
      'full|': page([timed({ id: 'a' })], { nextPageToken: 'p2' }),
      'full|p2': page([timed({ id: 'b' })], { nextSyncToken: 'tok-1' }),
    },
    calls,
  );
  const result = await fetchCalendarChanges(list, { syncToken: null, now: NOW });
  assert.deepEqual(result.events.map((e) => e.id), ['a', 'b']);
  assert.equal(result.nextSyncToken, 'tok-1');
  assert.equal(result.fullSync, true);
  assert.equal(result.tokenReset, false);
  assert.equal(result.complete, true);
  assert.equal(result.timeZone, 'America/Chicago');

  const window = fullSyncWindow(NOW);
  assert.equal(calls[0].timeMin, window.timeMin);
  assert.equal(calls[0].timeMax, window.timeMax);
  assert.equal(calls[0].timeMin, '2026-09-04T12:00:00.000Z');
  assert.equal(calls[0].timeMax, '2027-04-02T12:00:00.000Z');
  assert.equal(calls[0].syncToken, undefined);
  assert.equal(calls[1].pageToken, 'p2');
});

test('an incremental run sends only the sync token', async () => {
  const calls: ListEventsParams[] = [];
  const list = fakeLister({ 'sync:old|': page([timed()], { nextSyncToken: 'new' }) }, calls);
  const result = await fetchCalendarChanges(list, { syncToken: 'old', now: NOW });
  assert.equal(result.fullSync, false);
  assert.equal(result.nextSyncToken, 'new');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].timeMin, undefined);
  assert.equal(calls[0].timeMax, undefined);
});

test('410 Gone on the sync token falls back to one full read', async () => {
  const calls: ListEventsParams[] = [];
  const gone = new GoogleApiError(410, 'fullSyncRequired', 'Sync token is no longer valid', 'test');
  assert.equal(isSyncTokenGone(gone), true);
  const list = fakeLister(
    {
      'sync:stale|': gone,
      'full|': page([timed({ id: 'x' })], { nextSyncToken: 'fresh' }),
    },
    calls,
  );
  const result = await fetchCalendarChanges(list, { syncToken: 'stale', now: NOW });
  assert.equal(result.tokenReset, true);
  assert.equal(result.fullSync, true);
  assert.equal(result.nextSyncToken, 'fresh');
  assert.deepEqual(result.events.map((e) => e.id), ['x']);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].timeMin);
});

test('other Google errors are not swallowed', async () => {
  const list = fakeLister({ 'sync:t|': new GoogleApiError(403, 'rateLimitExceeded', null, 'test') }, []);
  await assert.rejects(fetchCalendarChanges(list, { syncToken: 't', now: NOW }), (err) => {
    assert.ok(err instanceof GoogleApiError);
    assert.equal(err.status, 403);
    return true;
  });
});

test('running out of time stops paging without a sync token', async () => {
  const calls: ListEventsParams[] = [];
  const list = fakeLister(
    {
      'full|': page([timed({ id: 'a' })], { nextPageToken: 'p2' }),
      'full|p2': page([timed({ id: 'b' })], { nextSyncToken: 'never' }),
    },
    calls,
  );
  let clock = 0;
  const result = await fetchCalendarChanges(list, {
    syncToken: null,
    now: NOW,
    deadline: 10,
    clock: () => (clock += 20),
  });
  assert.equal(result.complete, false);
  assert.equal(result.nextSyncToken, null);
  assert.deepEqual(result.events.map((e) => e.id), ['a']);
  assert.equal(calls.length, 1);
});

// ── events.list request ─────────────────────────────────────────────────────────

function fakeFetch(status: number, body: unknown, seen: string[]): typeof fetch {
  return (async (url: string | URL) => {
    seen.push(String(url));
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

test('listEvents sends singleEvents and showDeleted, and the window only without a sync token', async () => {
  const seen: string[] = [];
  const body = { items: [{ id: 'e1', status: 'confirmed' }, { status: 'x' }], nextSyncToken: 'n', timeZone: 'UTC' };
  const result = await listEvents('access', 'me@example.com', { timeMin: 'A', timeMax: 'B' }, {
    fetchImpl: fakeFetch(200, body, seen),
  });
  const first = new URL(seen[0]);
  assert.equal(first.pathname, '/calendar/v3/calendars/me%40example.com/events');
  assert.equal(first.searchParams.get('singleEvents'), 'true');
  assert.equal(first.searchParams.get('showDeleted'), 'true');
  assert.equal(first.searchParams.get('maxResults'), '250');
  assert.equal(first.searchParams.get('timeMin'), 'A');
  assert.equal(first.searchParams.get('timeMax'), 'B');
  assert.deepEqual(result.items.map((e) => e.id), ['e1']);
  assert.equal(result.nextSyncToken, 'n');

  await listEvents('access', 'cal', { syncToken: 'tok', timeMin: 'A', timeMax: 'B' }, {
    fetchImpl: fakeFetch(200, { items: [] }, seen),
  });
  const second = new URL(seen[1]);
  assert.equal(second.searchParams.get('syncToken'), 'tok');
  assert.equal(second.searchParams.get('timeMin'), null);
  assert.equal(second.searchParams.get('timeMax'), null);
});

test('listEvents turns HTTP 410 into an error isSyncTokenGone recognises', async () => {
  const body = { error: { code: 410, message: 'Sync token is no longer valid', errors: [{ reason: 'fullSyncRequired' }] } };
  await assert.rejects(listEvents('access', 'cal', { syncToken: 'old' }, { fetchImpl: fakeFetch(410, body, []) }), (err) => {
    assert.equal(isSyncTokenGone(err), true);
    return true;
  });
});

// ── Connect another account / validation rate limit ─────────────────────────────

test('adding an account asks Google to show the account chooser', () => {
  const config = { clientId: 'id', clientSecret: 'secret' };
  const add = new URL(buildAuthUrl('state', 'https://app.example/cb', { config, selectAccount: true }));
  assert.equal(add.searchParams.get('prompt'), 'consent select_account');
  const reconnect = new URL(buildAuthUrl('state', 'https://app.example/cb', { config, loginHint: 'me@example.com' }));
  assert.equal(reconnect.searchParams.get('prompt'), 'consent');
  assert.equal(reconnect.searchParams.get('login_hint'), 'me@example.com');
});

test('a connection is re-checked with Google at most once per 5 minutes, and only while active', () => {
  const fourMinAgo = new Date(NOW - 4 * 60_000).toISOString();
  const sixMinAgo = new Date(NOW - 6 * 60_000).toISOString();
  assert.equal(validationDue({ status: 'active', last_validated_at: null }, NOW), true);
  assert.equal(validationDue({ status: 'active', last_validated_at: fourMinAgo }, NOW), false);
  assert.equal(validationDue({ status: 'active', last_validated_at: sixMinAgo }, NOW), true);
  assert.equal(validationDue({ status: 'needs_reauth', last_validated_at: null }, NOW), false);
});
