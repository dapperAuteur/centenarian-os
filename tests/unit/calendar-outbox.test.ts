// tests/unit/calendar-outbox.test.ts
// The calendar activity feed on the durable outbox (CentOS plan 70, branch C-2):
// lib/ridewitus/delivery.ts outboxActivityDelivery, lib/ridewitus/emit-calendar-activity.ts,
// and the `calendar` scope of RideWitUS "Sync now" (lib/integrations/ridewitus/resync.ts).
// Run: npm run test:unit
//
// No database (in-memory fake) and no network (fetch is a fake). Ids, subjects and secrets are made up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FetchLike } from '../../lib/events/sign-request.ts';
import { verifyWitusSignature } from '../../lib/events/verify-signature.ts';
import { drain, RECEIVERS } from '../../lib/integrations/outbox.ts';
import { runResync } from '../../lib/integrations/ridewitus/resync.ts';
import { activityEventId, buildStopSharing, type CalendarActivityEvent } from '../../lib/ridewitus/calendar-activity.ts';
import {
  ACTIVITY_SECRET_ENV,
  ACTIVITY_URL_ENV,
  CALENDAR_ACTIVITY_RECEIVER,
  outboxActivityDelivery,
  outboxRows,
} from '../../lib/ridewitus/delivery.ts';
import {
  emitCalendarWindow,
  emitChangedItems,
  emitStopSharing,
  enqueueCalendarResync,
  sinceFloor,
} from '../../lib/ridewitus/emit-calendar-activity.ts';
import { FakeDb } from './fake-supabase.ts';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const SUB = 'sub-me';
const NOW = Date.parse('2026-11-01T12:00:00.000Z');
const DAY = 86_400_000;
const SECRET = 'calendar-secret-test-only-0123456789abcdef0123';
const URL_ = 'https://ride.example.test/api/events/calendar-activity';
const ENV = { [ACTIVITY_URL_ENV]: URL_, [ACTIVITY_SECRET_ENV]: SECRET };
const iso = (ms: number) => new Date(ms).toISOString();

interface Sent {
  events: CalendarActivityEvent[];
  verified: boolean;
  source: string;
}

/** A RideWitUS stand-in: records each request, checks its signature, answers from `answer`. */
function fakeRide(answer: (events: CalendarActivityEvent[]) => { status: number; body?: unknown } | 'throw' = () => ({ status: 200 })) {
  const sent: Sent[] = [];
  const fetchImpl: FetchLike = async (_url, init) => {
    const events = (JSON.parse(init.body ?? '{}') as { events: CalendarActivityEvent[] }).events;
    const verdict = verifyWitusSignature({
      rawBody: init.body ?? '',
      signatureHeader: init.headers['X-Witus-Signature'],
      timestampHeader: init.headers['X-Witus-Timestamp'],
      sourceHeader: init.headers['X-Witus-Source'],
      secret: SECRET,
      nowSeconds: Math.floor(NOW / 1000),
    });
    sent.push({ events, verified: verdict.ok, source: init.headers['X-Witus-Source'] });
    const reply = answer(events);
    if (reply === 'throw') throw new TypeError('fetch failed');
    const text = JSON.stringify(reply.body ?? { accepted: events.length, rejected: [] });
    return { ok: reply.status >= 200 && reply.status < 300, status: reply.status, text: async () => text };
  };
  return { sent, fetchImpl };
}

function delivery(db: FakeDb, fetchImpl: FetchLike, env: Record<string, string> = ENV) {
  return outboxActivityDelivery({ db, userId: ME, env, fetchImpl, sleep: async () => {}, now: () => new Date(NOW) });
}

function seed(): FakeDb {
  const db = new FakeDb();
  db.seed('witus_identities', [{ user_id: ME, witus_sub: SUB }]);
  db.seed('calendar_sync_calendars', [
    { user_id: ME, connection_id: 'conn-1', calendar_id: 'cal-shared', summary: 'Work', share_with_ridewitus: true, hide_titles_for_ridewitus: false },
    { user_id: ME, connection_id: 'conn-1', calendar_id: 'cal-private', summary: 'Private', share_with_ridewitus: false, hide_titles_for_ridewitus: false },
    { user_id: OTHER, connection_id: 'conn-9', calendar_id: 'cal-theirs', summary: 'Theirs', share_with_ridewitus: true, hide_titles_for_ridewitus: false },
  ]);
  const item = (id: string, calendar: string, startMs: number, location: string | null, user = ME, connection = 'conn-1') => ({
    id,
    user_id: user,
    calendar_id: calendar,
    connection_id: connection,
    event_status: 'confirmed',
    title_snapshot: `Event ${id}`,
    parsed: null,
    starts_at: iso(startMs),
    ends_at: iso(startMs + 3_600_000),
    all_day: false,
    time_zone: 'UTC',
    location,
  });
  db.seed('calendar_sync_items', [
    item('row-past', 'cal-shared', NOW - 10 * DAY, '1 Past St'),
    item('row-soon', 'cal-shared', NOW + 2 * DAY, '2 Soon Ave'),
    item('row-later', 'cal-shared', NOW + 20 * DAY, '3 Later Rd'),
    item('row-far', 'cal-shared', NOW + 45 * DAY, '4 Far Way'),
    item('row-noloc', 'cal-shared', NOW + 1 * DAY, null),
    item('row-private', 'cal-private', NOW + 1 * DAY, '5 Private Ln'),
    item('row-theirs', 'cal-theirs', NOW + 1 * DAY, '6 Their St', OTHER, 'conn-9'),
  ]);
  return db;
}

const outbox = (db: FakeDb) => db.rows('integration_outbox');

test('the calendar receiver is registered with the env names the direct POST used', () => {
  assert.deepEqual(RECEIVERS[CALENDAR_ACTIVITY_RECEIVER], {
    urlEnv: 'RIDEWITUS_CALENDAR_ACTIVITY_URL',
    secretEnv: 'CALENDAR_ACTIVITY_EVENTS_SECRET',
  });
});

test('not configured: a no-op that queues nothing and sends nothing', async () => {
  const db = seed();
  const ride = fakeRide();
  const none = delivery(db, ride.fetchImpl, {});
  assert.equal(none.configured, false);
  assert.deepEqual(await none.deliver(buildStopSharing(['row-1'], SUB, NOW)), { ok: true, sent: 0, failed: 0, skipped: 'not_configured' });
  const summary = await emitChangedItems(db, ME, ['row-soon'], { delivery: none, now: NOW });
  assert.equal(summary.skipped, 'not_configured');
  assert.equal(outbox(db).length, 0);
  assert.equal(ride.sent.length, 0);
});

test('enqueue twice: one row per event, holding the newer payload', async () => {
  const db = seed();
  // RideWitUS is down, so the rows stay queued and can be inspected.
  const ride = fakeRide(() => ({ status: 503 }));
  const d = delivery(db, ride.fetchImpl);
  const first = await emitChangedItems(db, ME, ['row-soon'], { delivery: d, now: NOW });
  assert.deepEqual(first, { sent: 0, failed: 0, retrying: 1 });

  db.rows('calendar_sync_items').find((r) => r.id === 'row-soon')!.location = '22 Moved Ave';
  await emitChangedItems(db, ME, ['row-soon'], { delivery: d, now: NOW + 60_000 });

  const rows = outbox(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].receiver, CALENDAR_ACTIVITY_RECEIVER);
  assert.equal(rows[0].event_id, activityEventId('row-soon'));
  assert.equal(rows[0].event_type, 'calendar.activity');
  assert.equal((rows[0].payload as CalendarActivityEvent).location, '22 Moved Ave');
  assert.equal(rows[0].status, 'pending');
});

test('a repeated event_id in one call collapses to one row (one upsert cannot touch a row twice)', () => {
  const a = buildStopSharing(['row-1'], SUB, NOW)[0];
  const b = { ...a, occurred_at: iso(NOW + 1) };
  const rows = outboxRows(ME, [a, b]);
  assert.equal(rows.length, 1);
  assert.equal((rows[0].payload as CalendarActivityEvent).occurred_at, iso(NOW + 1));
});

test('RideWitUS down during a sync: rows wait on the backoff, then the next drain delivers them', async () => {
  const db = seed();
  let up = false;
  const ride = fakeRide(() => (up ? { status: 200 } : 'throw'));
  const summary = await emitChangedItems(db, ME, ['row-soon', 'row-later'], { delivery: delivery(db, ride.fetchImpl), now: NOW });
  assert.deepEqual(summary, { sent: 0, failed: 0, retrying: 2 });
  assert.equal(ride.sent.length, 3); // one try plus two quick retries
  for (const row of outbox(db)) {
    assert.equal(row.status, 'pending');
    assert.equal(row.attempts, 1);
    assert.ok(String(row.next_attempt_at) > iso(NOW));
  }

  // Later (the next write or the daily cron): RideWitUS is back.
  up = true;
  const later = new Date(NOW + 5 * 60_000);
  const result = await drain(db, { env: ENV, fetchImpl: ride.fetchImpl, now: later });
  assert.deepEqual(
    result.receivers.map((r) => [r.receiver, r.sent, r.retrying, r.failed]),
    [[CALENDAR_ACTIVITY_RECEIVER, 2, 0, 0]],
  );
  assert.ok(outbox(db).every((row) => row.status === 'sent'));
});

test('a delivered batch is signed by centenarianos over { events } and rows are marked sent', async () => {
  const db = seed();
  const ride = fakeRide();
  const summary = await emitChangedItems(db, ME, ['row-soon', 'row-later', 'row-private', 'row-theirs'], {
    delivery: delivery(db, ride.fetchImpl),
    now: NOW,
  });
  assert.deepEqual(summary, { sent: 2, failed: 0 });
  assert.equal(ride.sent.length, 1);
  assert.equal(ride.sent[0].verified, true);
  assert.equal(ride.sent[0].source, 'centenarianos');
  assert.deepEqual(ride.sent[0].events.map((e) => e.event_id).sort(), [activityEventId('row-later'), activityEventId('row-soon')].sort());
  assert.ok(outbox(db).every((row) => row.status === 'sent' && row.user_id === ME));
});

test('unknown_subject from RideWitUS keeps the row pending, never failed', async () => {
  const db = seed();
  const ride = fakeRide((events) => ({ status: 200, body: { accepted: 0, rejected: events.map((e) => ({ event_id: e.event_id, reason: 'unknown_subject' })) } }));
  const summary = await emitChangedItems(db, ME, ['row-soon'], { delivery: delivery(db, ride.fetchImpl), now: NOW });
  assert.deepEqual(summary, { sent: 0, failed: 0, retrying: 1 });
  assert.equal(outbox(db)[0].status, 'pending');
  assert.equal(outbox(db)[0].last_error, 'unknown_subject');
});

test('stop sharing queues is_active false, with no details, for every row of that calendar', async () => {
  const db = seed();
  const ride = fakeRide(() => ({ status: 503 }));
  const summary = await emitStopSharing(db, ME, 'conn-1', 'cal-shared', { delivery: delivery(db, ride.fetchImpl), now: NOW });
  // Every located row of the calendar, any date (row-far too); the row without a location was never sent.
  assert.equal(summary.retrying, 4);
  const rows = outbox(db);
  assert.equal(rows.length, 4);
  for (const row of rows) {
    const payload = row.payload as CalendarActivityEvent;
    assert.equal(payload.is_active, false);
    assert.equal(payload.title, null);
    assert.equal(payload.location, null);
    assert.equal(payload.starts_at, null);
  }
});

test('sharing switched on queues the calendar window only (no far-future or unlocated rows)', async () => {
  const db = seed();
  const ride = fakeRide();
  const summary = await emitCalendarWindow(db, ME, 'conn-1', 'cal-shared', { delivery: delivery(db, ride.fetchImpl), now: NOW });
  assert.deepEqual(summary, { sent: 3, failed: 0 });
  assert.deepEqual(
    outbox(db).map((r) => r.event_id).sort(),
    ['row-past', 'row-soon', 'row-later'].map(activityEventId).sort(),
  );
});

test('missing outbox table (no migration 217): falls back to the direct signed POST', async () => {
  const db = seed();
  db.missingTables = ['integration_outbox'];
  const ride = fakeRide();
  const summary = await emitChangedItems(db, ME, ['row-soon'], { delivery: delivery(db, ride.fetchImpl), now: NOW });
  assert.equal(summary.sent, 1);
  assert.equal(ride.sent.length, 1);
  assert.equal(ride.sent[0].events[0].event_id, activityEventId('row-soon'));
});

test('sinceFloor reads a date or an ISO timestamp, and ignores junk', () => {
  assert.equal(sinceFloor('2026-10-30'), Date.parse('2026-10-30'));
  assert.equal(sinceFloor('2026-10-30T08:00:00Z'), Date.parse('2026-10-30T08:00:00Z'));
  assert.equal(sinceFloor(null), null);
  assert.equal(sinceFloor('soon'), null);
});

test('resync calendar: queues every shared calendar window, own rows only, and sends nothing itself', async () => {
  const db = seed();
  const result = await enqueueCalendarResync(db, ME, SUB, { now: NOW });
  assert.deepEqual(result, { queued: 3, calendars: 1 });
  const rows = outbox(db);
  assert.deepEqual(rows.map((r) => r.event_id).sort(), ['row-past', 'row-soon', 'row-later'].map(activityEventId).sort());
  assert.ok(rows.every((r) => r.status === 'pending' && r.user_id === ME && r.receiver === CALENDAR_ACTIVITY_RECEIVER));
  assert.ok(rows.every((r) => (r.payload as CalendarActivityEvent).witus_sub === SUB));
});

test('resync calendar honors since: only events starting on or after it', async () => {
  const db = seed();
  const result = await enqueueCalendarResync(db, ME, SUB, { since: iso(NOW), now: NOW });
  assert.deepEqual(result, { queued: 2, calendars: 1 });
  assert.deepEqual(outbox(db).map((r) => r.event_id).sort(), ['row-soon', 'row-later'].map(activityEventId).sort());

  const none = await enqueueCalendarResync(seed(), ME, SUB, { since: iso(NOW + 40 * DAY), now: NOW });
  assert.deepEqual(none, { queued: 0, calendars: 1 });
});

test('runResync calendar scope: queued with counts; skipped when the receiver is not configured', async () => {
  const db = seed();
  const ctx = { db, userId: ME, witusSub: SUB, since: '2026-11-01', origin: 'https://centos.example', now: new Date(NOW) };
  const report = await runResync({ ...ctx, receiverReady: () => true }, ['calendar']);
  assert.deepEqual(report.calendar, { status: 'queued', queued: 2, detail: { calendars: 1 } });

  const off = seed();
  const skipped = await runResync({ ...ctx, db: off, receiverReady: () => false }, ['calendar']);
  assert.deepEqual(skipped.calendar, { status: 'skipped', queued: 0, note: 'not_configured' });
  assert.equal(outbox(off).length, 0);
});

test('runResync calendar scope before migration 216 or 217: skipped with the reason', async () => {
  const noColumns = seed();
  noColumns.missingColumns = { calendar_sync_calendars: ['share_with_ridewitus'] };
  const a = await runResync(
    { db: noColumns, userId: ME, witusSub: SUB, since: null, origin: 'https://centos.example', now: new Date(NOW), receiverReady: () => true },
    ['calendar'],
  );
  assert.deepEqual(a.calendar, { status: 'skipped', queued: 0, note: 'migration_missing' });

  const noOutbox = seed();
  noOutbox.missingTables = ['integration_outbox'];
  const b = await runResync(
    { db: noOutbox, userId: ME, witusSub: SUB, since: null, origin: 'https://centos.example', now: new Date(NOW), receiverReady: () => true },
    ['calendar'],
  );
  assert.deepEqual(b.calendar, { status: 'skipped', queued: 0, note: 'missing_table' });
});
