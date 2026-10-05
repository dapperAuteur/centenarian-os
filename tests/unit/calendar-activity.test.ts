// tests/unit/calendar-activity.test.ts
// Run: npm run test:unit
//
// Covers the RideWitUS calendar activity feed (RideWitUS PRD §6.5a): the event time and location
// columns the sync stores (migration 216), the feed filters (shared only, location required,
// all-day only with a location, the 14/30-day window), hidden titles, stop-sharing retractions,
// event_id stability, and the signed delivery (signature checked with the receiver's own
// verifier, batching, retries, no-op without env). No network, no database. Values are made up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventTimeColumns, formatInZone, zonedMidnight } from '../../lib/calendar/event-times.ts';
import {
  HIDDEN_TITLE,
  activityEventId,
  batchEvents,
  buildStopSharing,
  decideActivity,
  eventsForCalendarWindow,
  eventsForChangedItems,
  type ActivityCalendar,
  type ActivityItem,
  type CalendarActivityEvent,
} from '../../lib/ridewitus/calendar-activity.ts';
import {
  CENTOS_SOURCE_SLUG,
  defaultActivityDelivery,
  httpActivityDelivery,
  signWitusRequest,
} from '../../lib/ridewitus/delivery.ts';
import { verifyWitusSignature } from '../../lib/events/verify-signature.ts';

const NOW = Date.parse('2026-10-05T12:00:00Z');
const DAY = 86_400_000;
const SUB = 'witus-sub-123';

const sharedCal: ActivityCalendar = {
  calendar_id: 'cal-a',
  connection_id: 'conn-1',
  summary: 'Personal',
  share_with_ridewitus: true,
  hide_titles_for_ridewitus: false,
};

function item(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    calendar_id: 'cal-a',
    connection_id: 'conn-1',
    event_status: 'confirmed',
    title_snapshot: 'Jazz night #trip 4mi mode:bike',
    parsed: { kind: 'trip', cleanTitle: 'Jazz night', distanceMiles: 4, mode: 'bike', warnings: [], extraTags: [] },
    starts_at: '2026-10-07T00:00:00.000Z',
    ends_at: '2026-10-07T02:00:00.000Z',
    all_day: false,
    time_zone: 'America/New_York',
    location: 'Blue Note, 131 W 3rd St',
    ...overrides,
  };
}

// ── Stored columns (what the sync saves) ──────────────────────────────────────

test('timed event: start/end instants, event time zone, trimmed location', () => {
  const cols = eventTimeColumns(
    {
      start: { dateTime: '2026-10-06T20:00:00-04:00', timeZone: 'America/New_York' },
      end: { dateTime: '2026-10-06T22:00:00-04:00', timeZone: 'America/New_York' },
      location: '  Blue Note  ',
    },
    'Europe/London',
  );
  assert.deepEqual(cols, {
    starts_at: '2026-10-07T00:00:00.000Z',
    ends_at: '2026-10-07T02:00:00.000Z',
    all_day: false,
    time_zone: 'America/New_York',
    location: 'Blue Note',
  });
});

test('timed event without its own zone uses the calendar zone; empty location is null', () => {
  const cols = eventTimeColumns(
    { start: { dateTime: '2026-10-06T09:00:00Z' }, end: { dateTime: '2026-10-06T10:00:00Z' }, location: '   ' },
    'America/Los_Angeles',
  );
  assert.equal(cols?.time_zone, 'America/Los_Angeles');
  assert.equal(cols?.location, null);
  assert.equal(cols?.starts_at, '2026-10-06T09:00:00.000Z');
});

test('all-day event: midnight in the calendar zone, exclusive end date', () => {
  const cols = eventTimeColumns(
    { start: { date: '2026-10-10' }, end: { date: '2026-10-11' }, location: 'Trailhead' },
    'America/New_York',
  );
  assert.equal(cols?.all_day, true);
  assert.equal(cols?.starts_at, '2026-10-10T04:00:00.000Z');
  assert.equal(cols?.ends_at, '2026-10-11T04:00:00.000Z');
});

test('all-day midnight across a DST change, and no zone means UTC', () => {
  // US DST ends 2026-11-01: midnight that day is still EDT (-04:00), the next day EST (-05:00).
  assert.equal(new Date(zonedMidnight('2026-11-01', 'America/New_York')!).toISOString(), '2026-11-01T04:00:00.000Z');
  assert.equal(new Date(zonedMidnight('2026-11-02', 'America/New_York')!).toISOString(), '2026-11-02T05:00:00.000Z');
  assert.equal(new Date(zonedMidnight('2026-11-02', null)!).toISOString(), '2026-11-02T00:00:00.000Z');
});

test('an event without a usable start stores nothing (keeps the old values)', () => {
  assert.equal(eventTimeColumns({ start: null, location: 'X' }, 'UTC'), null);
  assert.equal(eventTimeColumns({ start: { dateTime: 'not a date' } }, 'UTC'), null);
});

test('formatInZone writes the zone offset at that instant', () => {
  assert.equal(formatInZone('2026-10-07T00:00:00.000Z', 'America/New_York'), '2026-10-06T20:00:00-04:00');
  assert.equal(formatInZone('2026-12-07T00:00:00.000Z', 'America/New_York'), '2026-12-06T19:00:00-05:00');
  assert.equal(formatInZone('2026-10-07T00:00:00.000Z', 'Asia/Kolkata'), '2026-10-07T05:30:00+05:30');
  assert.equal(formatInZone('2026-10-07T00:00:00.000Z', null), '2026-10-07T00:00:00+00:00');
});

// ── The event ─────────────────────────────────────────────────────────────────

test('a qualifying event has exactly the §6.5a fields and nothing private', () => {
  const decision = decideActivity(item(), sharedCal, SUB, NOW);
  assert.equal(decision.kind, 'send');
  if (decision.kind !== 'send') return;
  const e = decision.event;
  assert.deepEqual(Object.keys(e).sort(), [
    'all_day',
    'calendar_label',
    'ends_at',
    'event_id',
    'event_type',
    'is_active',
    'location',
    'occurred_at',
    'schema_version',
    'starts_at',
    'status',
    'time_zone',
    'title',
    'trip_token',
    'witus_sub',
  ]);
  assert.equal(e.event_type, 'calendar.activity');
  assert.equal(e.schema_version, 1);
  assert.equal(e.witus_sub, SUB);
  assert.equal(e.starts_at, '2026-10-06T20:00:00-04:00');
  assert.equal(e.ends_at, '2026-10-06T22:00:00-04:00');
  assert.equal(e.title, 'Jazz night');
  assert.equal(e.location, 'Blue Note, 131 W 3rd St');
  assert.equal(e.calendar_label, 'Personal');
  assert.equal(e.status, 'confirmed');
  assert.deepEqual(e.trip_token, { distance_miles: 4, mode: 'bike', duration_min: null });
  assert.equal(e.is_active, true);
  const body = JSON.stringify(e);
  assert.ok(!body.includes('cal-a'), 'no Google calendar id');
  assert.ok(!body.includes('11111111-1111'), 'no raw row id');
});

test('hide titles sends "Event"; untagged events have no trip_token', () => {
  const hidden = decideActivity(item(), { ...sharedCal, hide_titles_for_ridewitus: true }, SUB, NOW);
  assert.equal(hidden.kind === 'send' && hidden.event.title, HIDDEN_TITLE);
  const plain = decideActivity(
    item({ parsed: { kind: 'task', cleanTitle: 'Dentist', warnings: [], extraTags: [] }, title_snapshot: 'Dentist' }),
    sharedCal,
    SUB,
    NOW,
  );
  assert.equal(plain.kind === 'send' && plain.event.title, 'Dentist');
  assert.equal(plain.kind === 'send' && plain.event.trip_token, null);
});

test('filters: not shared, no location, all-day without location, no time', () => {
  assert.deepEqual(decideActivity(item(), { ...sharedCal, share_with_ridewitus: false }, SUB, NOW), {
    kind: 'skip',
    reason: 'not_shared',
  });
  assert.deepEqual(decideActivity(item(), null, SUB, NOW), { kind: 'skip', reason: 'not_shared' });
  assert.deepEqual(decideActivity(item({ location: null }), sharedCal, SUB, NOW), { kind: 'skip', reason: 'no_location' });
  assert.deepEqual(decideActivity(item({ all_day: true, location: ' ' }), sharedCal, SUB, NOW), {
    kind: 'skip',
    reason: 'no_location',
  });
  const allDayWithPlace = decideActivity(
    item({ all_day: true, starts_at: '2026-10-10T04:00:00.000Z', ends_at: '2026-10-11T04:00:00.000Z' }),
    sharedCal,
    SUB,
    NOW,
  );
  assert.equal(allDayWithPlace.kind === 'send' && allDayWithPlace.event.all_day, true);
  assert.deepEqual(decideActivity(item({ starts_at: null }), sharedCal, SUB, NOW), { kind: 'skip', reason: 'no_time' });
});

test('window: past 14 days and next 30 days by start', () => {
  const at = (ms: number) => item({ starts_at: new Date(ms).toISOString() });
  assert.equal(decideActivity(at(NOW - 14 * DAY), sharedCal, SUB, NOW).kind, 'send');
  assert.deepEqual(decideActivity(at(NOW - 14 * DAY - 1), sharedCal, SUB, NOW), { kind: 'skip', reason: 'outside_window' });
  assert.equal(decideActivity(at(NOW + 30 * DAY), sharedCal, SUB, NOW).kind, 'send');
  assert.deepEqual(decideActivity(at(NOW + 30 * DAY + 1), sharedCal, SUB, NOW), { kind: 'skip', reason: 'outside_window' });
});

test('cancelled events are sent with status cancelled; tentative counts as confirmed', () => {
  const cancelled = decideActivity(item({ event_status: 'cancelled' }), sharedCal, SUB, NOW);
  assert.equal(cancelled.kind === 'send' && cancelled.event.status, 'cancelled');
  const tentative = decideActivity(item({ event_status: 'tentative' }), sharedCal, SUB, NOW);
  assert.equal(tentative.kind === 'send' && tentative.event.status, 'confirmed');
});

test('changed rows: a removed location retracts; unshared and out-of-window rows send nothing', () => {
  const rows = [
    item({ id: 'a' }),
    item({ id: 'b', location: null }),
    item({ id: 'c', calendar_id: 'cal-b' }),
    item({ id: 'd', starts_at: new Date(NOW + 90 * DAY).toISOString() }),
  ];
  const events = eventsForChangedItems(rows, (r) => (r.calendar_id === 'cal-a' ? sharedCal : undefined), SUB, NOW);
  assert.equal(events.length, 2);
  assert.equal(events[0].event_id, activityEventId('a'));
  assert.equal(events[0].is_active, true);
  assert.equal(events[1].event_id, activityEventId('b'));
  assert.equal(events[1].is_active, false);
  assert.equal(events[1].location, null);
  assert.equal(events[1].title, null);
});

test('window emit sends only qualifying rows, never retractions', () => {
  const events = eventsForCalendarWindow([item({ id: 'a' }), item({ id: 'b', location: null })], sharedCal, SUB, NOW);
  assert.deepEqual(events.map((e) => e.event_id), [activityEventId('a')]);
});

test('stop sharing: is_active false with no details for every row', () => {
  const events = buildStopSharing(['a', 'b'], SUB, NOW);
  assert.equal(events.length, 2);
  for (const e of events) {
    assert.equal(e.is_active, false);
    assert.equal(e.title, null);
    assert.equal(e.location, null);
    assert.equal(e.starts_at, null);
    assert.equal(e.calendar_label, null);
    assert.equal(e.witus_sub, SUB);
  }
  assert.equal(events[0].event_id, activityEventId('a'));
});

test('event_id is stable, distinct per row, and hides the row id', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal(activityEventId(id), activityEventId(id));
  assert.notEqual(activityEventId(id), activityEventId('22222222-2222-4222-8222-222222222222'));
  assert.match(activityEventId(id), /^cal:[0-9a-f]{64}$/);
  // The same id whether the event is sent, retracted, or its calendar stops sharing.
  const sent = decideActivity(item({ id }), sharedCal, SUB, NOW);
  assert.equal(sent.kind === 'send' && sent.event.event_id, buildStopSharing([id], SUB, NOW)[0].event_id);
});

test('batches of at most 500', () => {
  const sizes = batchEvents(Array.from({ length: 1201 }, (_, i) => i)).map((b) => b.length);
  assert.deepEqual(sizes, [500, 500, 201]);
});

// ── Signing and delivery ─────────────────────────────────────────────────────

test('signature verifies with the receiver verifier and fails with another secret', () => {
  const body = JSON.stringify({ events: [] });
  const ts = 1_790_000_000;
  const headers = signWitusRequest(body, 'a-secret-that-is-long-enough-000000', ts);
  assert.equal(headers['X-Witus-Source'], CENTOS_SOURCE_SLUG);
  const ok = verifyWitusSignature({
    rawBody: body,
    signatureHeader: headers['X-Witus-Signature'],
    timestampHeader: headers['X-Witus-Timestamp'],
    sourceHeader: headers['X-Witus-Source'],
    secret: 'a-secret-that-is-long-enough-000000',
    nowSeconds: ts + 10,
  });
  assert.deepEqual(ok, { ok: true, source: 'centenarianos' });
  const bad = verifyWitusSignature({
    rawBody: body,
    signatureHeader: headers['X-Witus-Signature'],
    timestampHeader: headers['X-Witus-Timestamp'],
    sourceHeader: headers['X-Witus-Source'],
    secret: 'a-different-secret-000000000000000',
    nowSeconds: ts + 10,
  });
  assert.equal(bad.ok, false);
});

const sample = (n: number): CalendarActivityEvent[] => buildStopSharing(Array.from({ length: n }, (_, i) => `row-${i}`), SUB, NOW);

test('missing env: not configured, nothing sent', async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response('{}');
  }) as typeof fetch;
  const none = httpActivityDelivery({ url: '', secret: 'x', fetchImpl });
  assert.equal(none.configured, false);
  assert.deepEqual(await none.deliver(sample(1)), { ok: true, sent: 0, failed: 0, skipped: 'not_configured' });
  assert.equal(defaultActivityDelivery({}).configured, false);
  assert.equal(calls, 0);
});

test('delivery posts signed batches and retries 5xx, not 4xx', async () => {
  const secret = 'a-secret-that-is-long-enough-000000';
  const seen: { status: number; count: number; verified: boolean }[] = [];
  const answers = [503, 200, 200];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const body = String(init.body);
    const h = init.headers as Record<string, string>;
    const verified = verifyWitusSignature({
      rawBody: body,
      signatureHeader: h['X-Witus-Signature'],
      timestampHeader: h['X-Witus-Timestamp'],
      sourceHeader: h['X-Witus-Source'],
      secret,
      nowSeconds: 1_790_000_000,
    }).ok;
    const status = answers.shift() ?? 200;
    seen.push({ status, count: (JSON.parse(body) as { events: unknown[] }).events.length, verified });
    return new Response('{}', { status });
  }) as unknown as typeof fetch;
  const waits: number[] = [];
  const delivery = httpActivityDelivery({
    url: 'https://ride.example.test/api/events/calendar-activity',
    secret,
    fetchImpl,
    sleep: async (ms) => {
      waits.push(ms);
    },
    nowSeconds: () => 1_790_000_000,
  });
  const result = await delivery.deliver(sample(501));
  assert.deepEqual(result, { ok: true, sent: 501, failed: 0, status: 200 });
  assert.deepEqual(seen.map((s) => [s.status, s.count]), [[503, 500], [200, 500], [200, 1]]);
  assert.ok(seen.every((s) => s.verified));
  assert.deepEqual(waits, [1000]);

  let calls = 0;
  const rejecting = httpActivityDelivery({
    url: 'https://ride.example.test/x',
    secret,
    fetchImpl: (async () => {
      calls += 1;
      return new Response('{}', { status: 401 });
    }) as typeof fetch,
    sleep: async () => {},
  });
  const failed = await rejecting.deliver(sample(2));
  assert.equal(calls, 1);
  assert.deepEqual(failed, { ok: false, sent: 0, failed: 2, status: 401 });
});

test('network errors are retried up to 3 attempts, then reported', async () => {
  let calls = 0;
  const delivery = httpActivityDelivery({
    url: 'https://ride.example.test/x',
    secret: 's',
    fetchImpl: (async () => {
      calls += 1;
      throw new TypeError('fetch failed');
    }) as typeof fetch,
    sleep: async () => {},
  });
  const result = await delivery.deliver(sample(3));
  assert.equal(calls, 3);
  assert.equal(result.ok, false);
  assert.equal(result.failed, 3);
});
