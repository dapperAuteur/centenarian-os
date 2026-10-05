// tests/unit/ridewitus-envelope.test.ts
// envelope.balance for RideWitUS (lib/integrations/ridewitus/envelope.ts), the
// integration_outbox it goes through (lib/integrations/outbox.ts), and the
// "Sync now" resync (lib/integrations/ridewitus/resync.ts).
// Run: npm run test:unit
//
// Every goal, amount, subject and URL is made up. No database (in-memory
// fake) and no network (fetch is a fake).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FetchLike } from '../../lib/events/sign-request.ts';
import { witusSignature } from '../../lib/events/sign-request.ts';
import { drain, enqueue, rejectedIds, RETRY_DELAYS_MS } from '../../lib/integrations/outbox.ts';
import {
  buildEnvelopeEvent,
  ENVELOPE_RECEIVER,
  enqueueEnvelopeBalances,
} from '../../lib/integrations/ridewitus/envelope.ts';
import {
  parseResyncBody,
  registerResyncHandler,
  resyncHandlerFor,
  ResyncRateLimiter,
  runResync,
} from '../../lib/integrations/ridewitus/resync.ts';
import { FakeDb } from './fake-supabase.ts';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const ACCOUNT = 'acc00000-0000-4000-8000-000000000001';
const TRIP_GOAL = 'g0000000-0000-4000-8000-000000000001';
const BIKE_GOAL = 'g0000000-0000-4000-8000-000000000002';
const HOUSE_GOAL = 'g0000000-0000-4000-8000-000000000003';
const THEIR_GOAL = 'g0000000-0000-4000-8000-000000000004';
const TRIP = 't0000000-0000-4000-8000-000000000001';
const BIKE = 'e0000000-0000-4000-8000-000000000001';
const ORIGIN = 'https://centos.example';
const NOW = new Date('2026-10-05T12:00:00.000Z');
const SECRET = 'envelope-secret-0123456789abcdef0123456789';
const ENV = { ENVELOPE_BALANCE_EVENTS_URL: 'https://ride.example/api/events/envelope-balance', ENVELOPE_BALANCE_EVENTS_SECRET: SECRET };

function seed(): FakeDb {
  const db = new FakeDb();
  db.seed('witus_identities', [{ user_id: ME, witus_sub: 'sub-me' }]);
  db.seed('financial_accounts', [{ id: ACCOUNT, user_id: ME, currency: 'EUR' }]);
  db.seed('savings_goals', [
    { id: TRIP_GOAL, user_id: ME, name: 'Lisbon trip', kind: 'trip', target_amount: 1200, target_date: '2027-03-01', funding_account_id: ACCOUNT, starting_amount: 100, status: 'active', linked_trip_id: TRIP, linked_equipment_id: null },
    { id: BIKE_GOAL, user_id: ME, name: 'New e-bike', kind: 'equipment', target_amount: 2500, target_date: null, funding_account_id: null, starting_amount: 0, status: 'active', linked_trip_id: null, linked_equipment_id: BIKE },
    { id: HOUSE_GOAL, user_id: ME, name: 'House', kind: 'house', target_amount: 50000, target_date: null, funding_account_id: ACCOUNT, starting_amount: 0, status: 'active', linked_trip_id: null, linked_equipment_id: null },
    { id: THEIR_GOAL, user_id: OTHER, name: 'Theirs', kind: 'trip', target_amount: 10, status: 'active', linked_trip_id: TRIP, linked_equipment_id: null },
  ]);
  db.seed('savings_allocations', [
    { goal_id: TRIP_GOAL, user_id: ME, amount: 150.25, allocated_on: '2026-09-01' },
    { goal_id: TRIP_GOAL, user_id: ME, amount: -10, allocated_on: '2026-09-15' },
    { goal_id: BIKE_GOAL, user_id: ME, amount: 40, allocated_on: '2026-09-01' },
  ]);
  return db;
}

const payloadOf = (db: FakeDb, goalId: string) =>
  db.rows('integration_outbox').find((r) => r.event_id === `envelope:${goalId}`)?.payload as Record<string, unknown> | undefined;

// ── The event ───────────────────────────────────────────────────────────────

test('buildEnvelopeEvent: saved = starting + allocations, decimal strings, CentOS link ids', () => {
  const event = buildEnvelopeEvent({
    goal: { id: TRIP_GOAL, name: 'Lisbon trip', kind: 'trip', target_amount: '1200', target_date: '2027-03-01', starting_amount: '100', status: 'active', linked_trip_id: TRIP, linked_equipment_id: null },
    allocated: 140.25,
    currency: 'EUR',
    witusSub: 'sub-me',
    now: NOW,
    origin: ORIGIN,
  })!;
  assert.equal(event.event_id, `envelope:${TRIP_GOAL}`);
  assert.equal(event.event_type, 'envelope.balance');
  assert.equal(event.balance, '240.25');
  assert.equal(event.target_amount, '1200.00');
  assert.equal(event.link_type, 'trip');
  assert.equal(event.link_id, TRIP);
  assert.equal(event.link_source, 'centenarian-os');
  assert.equal(event.currency, 'EUR');
  assert.equal(event.is_active, true);
  assert.equal(event.deep_link, `${ORIGIN}/dashboard/finance/savings`);
  assert.equal(event.as_of, NOW.toISOString());
});

test('an unlinked goal builds no event; an archived goal is inactive; no currency falls back to USD', () => {
  const base = { id: 'x', name: 'n', kind: 'other', target_amount: 1, target_date: null, starting_amount: 0, status: 'active', linked_trip_id: null, linked_equipment_id: null };
  assert.equal(buildEnvelopeEvent({ goal: base, allocated: 0, currency: null, witusSub: 's', now: NOW, origin: ORIGIN }), null);
  const archived = buildEnvelopeEvent({ goal: { ...base, status: 'archived', linked_equipment_id: BIKE }, allocated: 0, currency: null, witusSub: 's', now: NOW, origin: ORIGIN })!;
  assert.equal(archived.is_active, false);
  assert.equal(archived.link_type, 'equipment');
  assert.equal(archived.currency, 'USD');
});

// ── Queueing ────────────────────────────────────────────────────────────────

test('enqueue all: linked goals only, own rows only, with the funding account currency', async () => {
  const db = seed();
  const result = await enqueueEnvelopeBalances(db, ME, { goalIds: 'all', origin: ORIGIN, now: NOW });
  assert.deepEqual(result, { queued: 2, active: 2, retired: 0, skipped: null, error: null });
  const rows = db.rows('integration_outbox');
  assert.deepEqual(rows.map((r) => r.event_id).sort(), [`envelope:${TRIP_GOAL}`, `envelope:${BIKE_GOAL}`]);
  assert.ok(rows.every((r) => r.user_id === ME && r.receiver === ENVELOPE_RECEIVER && r.status === 'pending'));
  assert.equal(payloadOf(db, TRIP_GOAL)!.balance, '240.25');
  assert.equal(payloadOf(db, TRIP_GOAL)!.currency, 'EUR');
  assert.equal(payloadOf(db, BIKE_GOAL)!.balance, '40.00');
  assert.equal(payloadOf(db, BIKE_GOAL)!.currency, 'USD');
  assert.equal(payloadOf(db, BIKE_GOAL)!.witus_sub, 'sub-me');
});

test('no WitUS identity: nothing is queued', async () => {
  const db = seed();
  const result = await enqueueEnvelopeBalances(db, OTHER, { goalIds: 'all', origin: ORIGIN, now: NOW });
  assert.equal(result.skipped, 'no_identity');
  assert.equal(db.rows('integration_outbox').length, 0);
});

test('a newer change replaces the queued payload instead of adding a row', async () => {
  const db = seed();
  await enqueueEnvelopeBalances(db, ME, { goalIds: [TRIP_GOAL], origin: ORIGIN, now: NOW });
  db.seed('savings_allocations', [{ goal_id: TRIP_GOAL, user_id: ME, amount: 9.75, allocated_on: '2026-10-05' }]);
  await enqueueEnvelopeBalances(db, ME, { goalIds: [TRIP_GOAL], origin: ORIGIN, now: NOW });
  const rows = db.rows('integration_outbox');
  assert.equal(rows.length, 1);
  assert.equal(payloadOf(db, TRIP_GOAL)!.balance, '250.00');
});

test('deleting or unlinking a goal that was sent retires it with is_active false', async () => {
  const db = seed();
  await enqueueEnvelopeBalances(db, ME, { goalIds: 'all', origin: ORIGIN, now: NOW });
  db.tables.savings_goals = db.rows('savings_goals').filter((g) => g.id !== TRIP_GOAL);
  const afterDelete = await enqueueEnvelopeBalances(db, ME, { goalIds: [TRIP_GOAL], origin: ORIGIN, now: NOW });
  assert.equal(afterDelete.retired, 1);
  assert.equal(payloadOf(db, TRIP_GOAL)!.is_active, false);
  assert.equal(payloadOf(db, TRIP_GOAL)!.link_id, TRIP, 'the retirement still names what it was linked to');

  const bike = db.rows('savings_goals').find((g) => g.id === BIKE_GOAL)!;
  bike.linked_equipment_id = null;
  const resync = await enqueueEnvelopeBalances(db, ME, { goalIds: 'all', origin: ORIGIN, now: NOW });
  assert.equal(resync.retired, 1, 'the already-retired trip goal is not retired again');
  assert.equal(payloadOf(db, BIKE_GOAL)!.is_active, false);
});

test('a goal that was never sent and is not linked queues nothing', async () => {
  const db = seed();
  const result = await enqueueEnvelopeBalances(db, ME, { goalIds: [HOUSE_GOAL], origin: ORIGIN, now: NOW });
  assert.deepEqual([result.queued, result.skipped], [0, null]);
});

test('before migration 217 the emitter reports missing_table and writes nothing', async () => {
  const db = seed();
  db.missingTables = ['integration_outbox'];
  const result = await enqueueEnvelopeBalances(db, ME, { goalIds: 'all', origin: ORIGIN, now: NOW });
  assert.equal(result.skipped, 'missing_table');
});

// ── Delivery ────────────────────────────────────────────────────────────────

function recordingFetch(answer: { status: number; body: unknown } | 'throw') {
  const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, headers: init.headers, body: init.body ?? '' });
    if (answer === 'throw') throw new Error('ECONNREFUSED');
    return { ok: answer.status < 300, status: answer.status, text: async () => JSON.stringify(answer.body) };
  };
  return { calls, fetchImpl };
}

test('drain sends one signed batch and marks the rows sent', async () => {
  const db = seed();
  await enqueueEnvelopeBalances(db, ME, { goalIds: 'all', origin: ORIGIN, now: NOW });
  const { calls, fetchImpl } = recordingFetch({ status: 200, body: { accepted: 2, rejected: [] } });
  const result = await drain(db, { env: ENV, fetchImpl, now: NOW, userId: ME });
  assert.deepEqual(result.receivers, [{ receiver: ENVELOPE_RECEIVER, sent: 2, retrying: 0, failed: 0, skipped: 0, note: null }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ENV.ENVELOPE_BALANCE_EVENTS_URL);
  const sent = JSON.parse(calls[0].body);
  assert.equal(sent.events.length, 2);
  assert.equal(calls[0].headers['X-Witus-Source'], 'centenarianos');
  assert.equal(calls[0].headers['X-Witus-Signature'], `sha256=${witusSignature(SECRET, calls[0].headers['X-Witus-Timestamp'], calls[0].body)}`);
  assert.ok(db.rows('integration_outbox').every((r) => r.status === 'sent'));

  const again = recordingFetch({ status: 200, body: {} });
  await drain(db, { env: ENV, fetchImpl: again.fetchImpl, now: NOW });
  assert.equal(again.calls.length, 0, 'sent rows are not sent twice');
});

test('missing URL or secret: drain is a no-op that leaves rows pending', async () => {
  const db = seed();
  await enqueueEnvelopeBalances(db, ME, { goalIds: 'all', origin: ORIGIN, now: NOW });
  const { calls, fetchImpl } = recordingFetch({ status: 200, body: {} });
  const result = await drain(db, { env: { ENVELOPE_BALANCE_EVENTS_URL: ENV.ENVELOPE_BALANCE_EVENTS_URL }, fetchImpl, now: NOW });
  assert.equal(calls.length, 0);
  assert.deepEqual(result.receivers[0], { receiver: ENVELOPE_RECEIVER, sent: 0, retrying: 0, failed: 0, skipped: 2, note: 'not_configured' });
  assert.ok(db.rows('integration_outbox').every((r) => r.status === 'pending'));
});

test('a network failure reschedules on the backoff and gives up after the last delay', async () => {
  const db = seed();
  await enqueueEnvelopeBalances(db, ME, { goalIds: [TRIP_GOAL], origin: ORIGIN, now: NOW });
  const { calls, fetchImpl } = recordingFetch('throw');
  const sleeps: number[] = [];
  const r1 = await drain(db, { env: ENV, fetchImpl, now: NOW, quickRetries: 2, sleep: async (ms) => void sleeps.push(ms) });
  assert.equal(calls.length, 3, 'one try plus two quick retries');
  assert.deepEqual(sleeps, [500, 1000]);
  assert.equal(r1.receivers[0].retrying, 1);
  const row = db.rows('integration_outbox')[0];
  assert.equal(row.attempts, 1);
  assert.equal(row.next_attempt_at, new Date(NOW.getTime() + RETRY_DELAYS_MS[0]).toISOString());
  assert.equal(row.last_error, 'network_error');

  // Not due yet: nothing is sent.
  const early = await drain(db, { env: ENV, fetchImpl, now: NOW });
  assert.deepEqual(early.receivers, []);

  // Each later due drain fails again, until the last delay is used up.
  let t = NOW.getTime();
  for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
    t += RETRY_DELAYS_MS[i];
    await drain(db, { env: ENV, fetchImpl, now: new Date(t) });
  }
  assert.equal(db.rows('integration_outbox')[0].status, 'failed');
});

test('per-row refusals: unknown_subject waits, other reasons fail, the rest are sent', async () => {
  const db = seed();
  await enqueueEnvelopeBalances(db, ME, { goalIds: 'all', origin: ORIGIN, now: NOW });
  const { fetchImpl } = recordingFetch({
    status: 200,
    body: { accepted: 0, rejected: [{ event_id: `envelope:${TRIP_GOAL}`, reason: 'unknown_subject' }, `envelope:${BIKE_GOAL}: invalid link_id`] },
  });
  const result = await drain(db, { env: ENV, fetchImpl, now: NOW });
  assert.deepEqual([result.receivers[0].sent, result.receivers[0].retrying, result.receivers[0].failed], [0, 1, 1]);
  const trip = db.rows('integration_outbox').find((r) => r.event_id === `envelope:${TRIP_GOAL}`)!;
  const bike = db.rows('integration_outbox').find((r) => r.event_id === `envelope:${BIKE_GOAL}`)!;
  assert.deepEqual([trip.status, trip.last_error], ['pending', 'unknown_subject']);
  assert.deepEqual([bike.status, bike.last_error], ['failed', 'invalid link_id']);
});

test('rejectedIds reads both object and string forms', () => {
  const ids = ['envelope:a', 'envelope:b'];
  const got = rejectedIds({ rejected: [{ event_id: 'envelope:a', reason: 'unknown_subject' }, 'envelope:b unknown_subject'] }, ids);
  assert.deepEqual([...got], [['envelope:a', 'unknown_subject'], ['envelope:b', 'unknown_subject']]);
  assert.equal(rejectedIds({ rejected: 'nope' }, ids).size, 0);
  assert.equal(rejectedIds(null, ids).size, 0);
});

test('enqueue with nothing to send makes no request', async () => {
  const db = new FakeDb();
  assert.deepEqual(await enqueue(db, []), { queued: 0, missingTable: false, error: null });
  assert.equal(db.calls.length, 0);
});

// ── Resync ──────────────────────────────────────────────────────────────────

test('parseResyncBody: defaults to every scope, refuses unknown scopes and bad input', () => {
  const all = parseResyncBody({ witus_sub: 'sub-me' });
  assert.ok(all.ok);
  assert.deepEqual(all.ok && all.value.scopes, ['calendar', 'matches', 'envelopes']);
  const one = parseResyncBody({ witus_sub: 'sub-me', scopes: ['envelopes', 'envelopes'], since: '2026-09-01' });
  assert.deepEqual(one.ok && one.value, { witusSub: 'sub-me', scopes: ['envelopes'], since: '2026-09-01' });
  assert.equal(!parseResyncBody({ witus_sub: 'sub-me', scopes: ['bank'] }).ok && 'refused', 'refused');
  const bad = parseResyncBody({ scopes: [] });
  assert.equal(!bad.ok && bad.code, 'invalid_subject');
  const badSince = parseResyncBody({ witus_sub: 's', since: 'yesterday' });
  assert.equal(!badSince.ok && badSince.code, 'invalid_since');
  const notObject = parseResyncBody([1]);
  assert.equal(!notObject.ok && notObject.code, 'invalid_body');
});

test('ResyncRateLimiter: one per key per window', () => {
  const limiter = new ResyncRateLimiter(300_000);
  assert.deepEqual(limiter.check('sub-me', 0), { ok: true });
  assert.deepEqual(limiter.check('sub-me', 60_000), { ok: false, retryAfterSeconds: 240 });
  assert.deepEqual(limiter.check('sub-other', 60_000), { ok: true });
  assert.deepEqual(limiter.check('sub-me', 300_000), { ok: true });
});

test('runResync: envelopes re-queued, calendar and matches not available yet', async () => {
  const db = seed();
  const report = await runResync(
    { db, userId: ME, witusSub: 'sub-me', since: null, origin: ORIGIN, now: NOW, receiverReady: () => true },
    ['envelopes', 'calendar', 'matches'],
  );
  assert.deepEqual(report.envelopes, { status: 'queued', queued: 2, detail: { active: 2, retired: 0 } });
  assert.equal(report.calendar.status, 'not_available');
  assert.equal(report.matches.status, 'not_available');
  assert.equal(db.rows('integration_outbox').length, 2);
});

test('runResync: an unconfigured receiver skips its scope and queues nothing', async () => {
  const db = seed();
  const report = await runResync(
    { db, userId: ME, witusSub: 'sub-me', since: null, origin: ORIGIN, now: NOW, receiverReady: () => false },
    ['envelopes'],
  );
  assert.deepEqual(report.envelopes, { status: 'skipped', queued: 0, note: 'not_configured' });
  assert.equal(db.rows('integration_outbox').length, 0);
});

test('the calendar hook: a registered handler runs, and a throwing one reports error', async () => {
  const before = resyncHandlerFor('calendar');
  try {
    registerResyncHandler('calendar', async (ctx) => ({ status: 'queued', queued: 3, detail: { since: ctx.since } }));
    const ok = await runResync({ db: seed(), userId: ME, witusSub: 'sub-me', since: '2026-09-21', origin: ORIGIN, now: NOW }, ['calendar']);
    assert.deepEqual(ok.calendar, { status: 'queued', queued: 3, detail: { since: '2026-09-21' } });
    registerResyncHandler('calendar', async () => {
      throw new Error('boom');
    });
    const failed = await runResync({ db: seed(), userId: ME, witusSub: 'sub-me', since: null, origin: ORIGIN, now: NOW }, ['calendar']);
    assert.equal(failed.calendar.status, 'error');
  } finally {
    if (before) registerResyncHandler('calendar', before);
  }
});
