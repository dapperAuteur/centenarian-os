// tests/unit/calendar-records.test.ts
// Run: npm run test:unit
//
// Records created from tagged Google Calendar events (plans/59, 4.4): event -> record mapping
// per kind, update only while untouched, cancel never deletes a transaction, idempotent retries,
// and #trip creating no trip. Uses the in-memory FakeDb; no network, no database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FakeDb, type Row } from './fake-supabase.ts';
import { TRIP_NOTE, eventToTaskFields, type EventTaskFields } from '../../lib/calendar/event-fields.ts';
import type { GoogleEvent } from '../../lib/google/calendar-client.ts';
import {
  CALENDAR_TRANSACTION_TAG,
  EMPTY_RECORD_STATE,
  desiredRecord,
  syncEventRecord,
  type RecordState,
  type SyncRecordInput,
} from '../../lib/capture/calendar-records.ts';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ACCOUNT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TASK = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const RECORD_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function fieldsFor(summary: string, start = '2026-10-05T19:30:00Z'): EventTaskFields {
  const event: GoogleEvent = { id: 'evt', etag: '"1"', status: 'confirmed', summary, start: { dateTime: start } };
  const fields = eventToTaskFields(event, 'UTC');
  assert.ok(fields);
  return fields;
}

function newDb(): FakeDb {
  const db = new FakeDb();
  db.seed('financial_accounts', [{ id: ACCOUNT, user_id: USER, name: 'Checking', currency: 'USD' }]);
  return db;
}

/** Runs syncEventRecord and keeps what `persist` saved, like the sync row would. */
async function run(
  db: FakeDb,
  overrides: Partial<SyncRecordInput> & Pick<SyncRecordInput, 'mode'>,
): Promise<{ outcome: Awaited<ReturnType<typeof syncEventRecord>>; persisted: RecordState[] }> {
  const persisted: RecordState[] = [];
  const outcome = await syncEventRecord(db as unknown as SupabaseClient, {
    userId: USER,
    taskId: TASK,
    fields: null,
    state: EMPTY_RECORD_STATE,
    accountId: ACCOUNT,
    persist: async (state) => {
      persisted.push(state);
    },
    newId: () => RECORD_ID,
    ...overrides,
  });
  return { outcome, persisted };
}

// ── Mapping ─────────────────────────────────────────────────────────────────────

test('desiredRecord: #expense and #income become transactions on the default account', () => {
  assert.deepEqual(desiredRecord(fieldsFor('Lunch at Chipotle #expense $12.40'), ACCOUNT), {
    type: 'transaction',
    values: {
      amount: '12.40',
      type: 'expense',
      vendor: 'Chipotle',
      description: 'Lunch at Chipotle',
      transaction_date: '2026-10-05',
      account_id: ACCOUNT,
    },
  });
  const income = desiredRecord(fieldsFor('Client invoice #income 500'), null);
  assert.equal(income?.type, 'transaction');
  assert.equal(income?.values.type, 'income');
  assert.equal(income?.values.amount, '500.00');
  assert.equal(income?.values.account_id, null);
});

test('desiredRecord: #meal becomes a meal log, #workout a workout log', () => {
  assert.deepEqual(desiredRecord(fieldsFor('Dinner salmon #meal'), ACCOUNT), {
    type: 'meal',
    values: { date: '2026-10-05', time: '19:30', meal_type: 'dinner', notes: 'Dinner salmon' },
  });
  assert.deepEqual(desiredRecord(fieldsFor('Leg day #workout 45min', '2026-10-05T07:00:00Z'), ACCOUNT), {
    type: 'workout',
    values: { name: 'Leg day', date: '2026-10-05', duration_min: 45 },
  });
});

test('desiredRecord: #trip, untagged and missing data create no record', () => {
  assert.equal(desiredRecord(fieldsFor('Drive to Tucson #trip 115mi'), ACCOUNT), null);
  assert.equal(desiredRecord(fieldsFor('Call the plumber'), ACCOUNT), null);
  const noAmount = fieldsFor('Coffee #expense');
  assert.equal(noAmount.parseStatus, 'flagged');
  assert.equal(desiredRecord(noAmount, ACCOUNT), null);
});

test('#trip: the task says the trip goes to RideWitUS, and no record is written', async () => {
  const fields = fieldsFor('Drive to Tucson #trip 115mi');
  assert.ok(fields.description?.includes(TRIP_NOTE));
  assert.equal(fields.parsed.distanceMiles, 115);
  const db = newDb();
  const { outcome } = await run(db, { mode: 'create', fields });
  assert.deepEqual(outcome, { ...EMPTY_RECORD_STATE, review: null, created: false });
  assert.equal(db.rows('trips').length, 0);
  assert.equal(db.writes().length, 0);
});

// ── Create ──────────────────────────────────────────────────────────────────────

test('create #expense: a manual transaction tagged google-calendar, linked to the task, id saved first', async () => {
  const db = newDb();
  let insertedBeforePersist = false;
  const persisted: RecordState[] = [];
  const outcome = await syncEventRecord(db as unknown as SupabaseClient, {
    userId: USER,
    taskId: TASK,
    mode: 'create',
    fields: fieldsFor('Lunch at Chipotle #expense $12.40'),
    state: EMPTY_RECORD_STATE,
    accountId: ACCOUNT,
    newId: () => RECORD_ID,
    persist: async (state) => {
      insertedBeforePersist = db.rows('financial_transactions').length > 0;
      persisted.push(state);
    },
  });
  assert.equal(insertedBeforePersist, false);
  assert.equal(persisted[0].record_id, RECORD_ID);
  assert.equal(outcome.created, true);
  assert.equal(outcome.record_type, 'transaction');
  assert.equal(outcome.record_id, RECORD_ID);

  const [tx] = db.rows('financial_transactions');
  assert.equal(tx.id, RECORD_ID);
  assert.equal(tx.user_id, USER);
  assert.equal(tx.source, 'manual');
  assert.deepEqual(tx.tags, [CALENDAR_TRANSACTION_TAG]);
  assert.equal(tx.account_id, ACCOUNT);
  assert.equal(tx.amount, 12.4);
  assert.equal(tx.vendor, 'Chipotle');

  const [link] = db.rows('activity_links');
  assert.equal(link.source_type, 'task');
  assert.equal(link.source_id, TASK);
  assert.equal(link.target_type, 'transaction');
  assert.equal(link.target_id, RECORD_ID);
});

test('create #meal: a meal log, no activity link (activity_links has no meal type)', async () => {
  const db = newDb();
  const { outcome } = await run(db, { mode: 'create', fields: fieldsFor('Dinner salmon #meal') });
  assert.equal(outcome.record_type, 'meal');
  const [meal] = db.rows('meal_logs');
  assert.equal(meal.meal_type, 'dinner');
  assert.equal(meal.time, '19:30');
  assert.equal(meal.user_id, USER);
  assert.equal(db.rows('activity_links').length, 0);
});

test('create #workout: a workout log linked to the task', async () => {
  const db = newDb();
  const { outcome } = await run(db, { mode: 'create', fields: fieldsFor('Leg day #workout 45min') });
  assert.equal(outcome.record_type, 'workout');
  const [log] = db.rows('workout_logs');
  assert.equal(log.name, 'Leg day');
  assert.equal(log.duration_min, 45);
  assert.equal(db.rows('activity_links')[0].target_type, 'workout');
});

test('create: a default account that is not the user\'s is never written', async () => {
  const db = newDb();
  db.seed('financial_accounts', [{ id: '99999999-9999-4999-8999-999999999999', user_id: OTHER }]);
  const { outcome } = await run(db, {
    mode: 'create',
    fields: fieldsFor('Lunch #expense $9'),
    accountId: '99999999-9999-4999-8999-999999999999',
  });
  assert.equal(outcome.record_id, null);
  assert.ok(outcome.review?.includes('Invalid reference'));
  assert.equal(db.rows('financial_transactions').length, 0);
});

// ── Idempotency ─────────────────────────────────────────────────────────────────

test('idempotent: a resumed create reuses the record already inserted under the saved id', async () => {
  const db = newDb();
  const fields = fieldsFor('Lunch at Chipotle #expense $12.40');
  const first = await run(db, { mode: 'create', fields });
  // The run died before the etag was saved: the next run sees the row with the record id.
  const again = await run(db, { mode: 'create', fields, state: first.outcome, newId: () => 'never-used' });
  assert.equal(db.rows('financial_transactions').length, 1);
  assert.equal(db.rows('activity_links').length, 1);
  assert.equal(again.outcome.record_id, RECORD_ID);
  assert.equal(again.outcome.created, false);
});

test('idempotent: an id saved but never inserted is inserted under that same id', async () => {
  const db = newDb();
  const fields = fieldsFor('Dinner salmon #meal');
  const planned = { record_type: 'meal' as const, record_id: RECORD_ID, snapshot: desiredRecord(fields, null)!.values };
  const { outcome } = await run(db, { mode: 'create', fields, state: planned, newId: () => 'never-used' });
  assert.equal(outcome.created, true);
  assert.deepEqual(db.rows('meal_logs').map((r) => r.id), [RECORD_ID]);
});

test('idempotent: the same event processed again changes nothing', async () => {
  const db = newDb();
  const fields = fieldsFor('Lunch at Chipotle #expense $12.40');
  const first = await run(db, { mode: 'create', fields });
  const writesBefore = db.writes().length;
  const again = await run(db, { mode: 'update', fields, state: first.outcome });
  assert.equal(again.outcome.review, null);
  assert.equal(db.writes().length, writesBefore);
});

test('idempotent: an update that ran but whose snapshot was not saved is not mistaken for a user edit', async () => {
  const db = newDb();
  const first = await run(db, { mode: 'create', fields: fieldsFor('Lunch at Chipotle #expense $12.40') });
  const changed = fieldsFor('Lunch at Chipotle #expense $15');
  await run(db, { mode: 'update', fields: changed, state: first.outcome });
  // The sync row still holds the old snapshot; the event is processed again.
  const writesBefore = db.writes().length;
  const again = await run(db, { mode: 'update', fields: changed, state: first.outcome });
  assert.equal(again.outcome.review, null);
  assert.equal(again.outcome.snapshot?.amount, '15.00');
  assert.equal(db.writes().length, writesBefore);
});

// ── Update ──────────────────────────────────────────────────────────────────────

test('update: an untouched transaction follows the event (new amount and date)', async () => {
  const db = newDb();
  const first = await run(db, { mode: 'create', fields: fieldsFor('Lunch at Chipotle #expense $12.40') });
  db.tick(60_000);
  const moved = fieldsFor('Lunch at Chipotle #expense $15', '2026-10-06T19:30:00Z');
  const { outcome } = await run(db, { mode: 'update', fields: moved, state: first.outcome });
  assert.equal(outcome.review, null);
  const [tx] = db.rows('financial_transactions');
  assert.equal(tx.amount, 15);
  assert.equal(tx.transaction_date, '2026-10-06');
  assert.equal(outcome.snapshot?.amount, '15.00');
});

test('update: a transaction edited in CentenarianOS is left alone and flagged', async () => {
  const db = newDb();
  const first = await run(db, { mode: 'create', fields: fieldsFor('Lunch at Chipotle #expense $12.40') });
  db.rows('financial_transactions')[0].amount = 13.1; // the user corrected it
  const { outcome } = await run(db, {
    mode: 'update',
    fields: fieldsFor('Lunch at Chipotle #expense $15'),
    state: first.outcome,
  });
  assert.ok(outcome.review?.includes('edited in CentenarianOS'));
  assert.equal(db.rows('financial_transactions')[0].amount, 13.1);
  assert.deepEqual(outcome.snapshot, first.outcome.snapshot);
});

test('update: a category the user picked does not count as an edit', async () => {
  const db = newDb();
  const first = await run(db, { mode: 'create', fields: fieldsFor('Lunch at Chipotle #expense $12.40') });
  db.rows('financial_transactions')[0].category_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const { outcome } = await run(db, { mode: 'update', fields: fieldsFor('Lunch at Chipotle #expense $15'), state: first.outcome });
  assert.equal(outcome.review, null);
  assert.equal(db.rows('financial_transactions')[0].amount, 15);
});

test('update: a record the user deleted is not brought back', async () => {
  const db = newDb();
  const first = await run(db, { mode: 'create', fields: fieldsFor('Dinner salmon #meal') });
  db.tables.meal_logs = [];
  const { outcome } = await run(db, { mode: 'update', fields: fieldsFor('Dinner tuna #meal'), state: first.outcome });
  assert.equal(db.rows('meal_logs').length, 0);
  assert.equal(outcome.review, null);
});

test('update: a tag added later creates the record then', async () => {
  const db = newDb();
  const { outcome } = await run(db, { mode: 'update', fields: fieldsFor('Coffee #expense 4.50') });
  assert.equal(outcome.created, true);
  assert.equal(db.rows('financial_transactions').length, 1);
});

test('update: a title that loses its tag flags the record and keeps it', async () => {
  const db = newDb();
  const first = await run(db, { mode: 'create', fields: fieldsFor('Coffee #expense 4.50') });
  const { outcome } = await run(db, { mode: 'update', fields: fieldsFor('Coffee'), state: first.outcome });
  assert.ok(outcome.review);
  assert.equal(db.rows('financial_transactions').length, 1);
});

// ── Cancel ──────────────────────────────────────────────────────────────────────

test('cancel: a transaction is never deleted, even untouched; the item is flagged', async () => {
  const db = newDb();
  const first = await run(db, { mode: 'create', fields: fieldsFor('Lunch at Chipotle #expense $12.40') });
  const { outcome } = await run(db, { mode: 'cancel', state: first.outcome });
  assert.equal(db.rows('financial_transactions').length, 1);
  assert.equal(db.writes().filter((w) => w.table === 'financial_transactions' && w.op === 'delete').length, 0);
  assert.ok(outcome.review?.includes('never deletes money records'));
  assert.equal(outcome.record_id, RECORD_ID);
});

test('cancel: an untouched meal is removed with the event', async () => {
  const db = newDb();
  const first = await run(db, { mode: 'create', fields: fieldsFor('Dinner salmon #meal') });
  const { outcome } = await run(db, { mode: 'cancel', state: first.outcome });
  assert.equal(db.rows('meal_logs').length, 0);
  assert.deepEqual(outcome, { ...EMPTY_RECORD_STATE, review: null, created: false });
});

test('cancel: an edited meal, or a workout with exercises added, is kept and flagged', async () => {
  const db = newDb();
  const meal = await run(db, { mode: 'create', fields: fieldsFor('Dinner salmon #meal') });
  db.rows('meal_logs')[0].notes = 'Dinner salmon and rice';
  const mealCancel = await run(db, { mode: 'cancel', state: meal.outcome });
  assert.equal(db.rows('meal_logs').length, 1);
  assert.ok(mealCancel.outcome.review);

  const db2 = newDb();
  const workout = await run(db2, { mode: 'create', fields: fieldsFor('Leg day #workout 45min') });
  db2.seed('workout_log_exercises', [{ log_id: RECORD_ID, name: 'Squat' } as Row]);
  const workoutCancel = await run(db2, { mode: 'cancel', state: workout.outcome });
  assert.equal(db2.rows('workout_logs').length, 1);
  assert.ok(workoutCancel.outcome.review);
});

test('cancel then restore: a removed meal is created again', async () => {
  const db = newDb();
  const fields = fieldsFor('Dinner salmon #meal');
  const first = await run(db, { mode: 'create', fields });
  const cancelled = await run(db, { mode: 'cancel', state: first.outcome });
  const restored = await run(db, { mode: 'update', fields, state: cancelled.outcome });
  assert.equal(restored.outcome.created, true);
  assert.equal(db.rows('meal_logs').length, 1);
});
