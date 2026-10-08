// tests/unit/fitness-dedupe.test.ts
// Unit tests for the fitness import dedupe (lib/fitness-import/): daily health
// metrics (CSV, Data Hub, InBody copy, wearable syncs), Garmin activities to
// trips, workout logs, the Garmin start-time key, the Garmin account export
// and Apple Health steps used by the scripts, and the sync day keys and
// windows.
// Run: npm run test:unit
//
// Every user id, date and value here is SYNTHETIC. Nothing touches a database:
// FakeFitnessDb (fake-fitness-db.ts) models the Postgres behaviour the old
// code tripped over (21000, 42P10, NULL-fill on upsert, the row cap).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  HEALTH_SOURCES,
  classifyDay,
  cleanDayValues,
  dedupeFileRows,
  describeDailyCounts,
  importDailyMetrics,
  isHealthSource,
  isIsoDate,
  mergeDay,
  normalizeField,
  planDailyMetrics,
  type DayInput,
} from '../../lib/fitness-import/daily-metrics.ts';
import {
  findLoggedTripMatch,
  garminStartKey,
  isPossibleSameTrip,
  legacyGarminId,
  loggedTripCandidates,
  localStartFromEpoch,
  localStartFromWallClockMs,
  normalizeLocalStart,
  startKeyFromLegacyId,
  storedStartKey,
} from '../../lib/fitness-import/activity-keys.ts';
import {
  describeGarminCounts,
  importGarminActivities,
  parseDurationMinutes,
  parseGarminActivitiesCsv,
  planGarminActivities,
  splitCsvLine,
  type ExistingTrip,
} from '../../lib/fitness-import/garmin-trips.ts';
import { describeWorkoutCounts, loadLoggedWorkouts, splitLoggedWorkouts, workoutIdentity } from '../../lib/fitness-import/workouts.ts';
import { dedupeScans, importInBodyScans, latestScanDays, type ScanRow } from '../../lib/fitness-import/inbody.ts';
import { FitnessImportError, groupByKeySet, isMissingColumn, readAllRows } from '../../lib/fitness-import/db.ts';
import {
  WHOOP_MAX_PAGES,
  daysFrom,
  garminDayOf,
  garminDays,
  localDateFromIso,
  ouraDays,
  readAllWhoopPages,
  splitRange,
  syncWindowStart,
  wholeDaySyncWindow,
  whoopDays,
} from '../../lib/fitness-import/wearable-days.ts';
import {
  garminVsOtherTrips,
  implausibleWorkoutDurations,
  manualCopiesOfDevice,
  sameNameSameDayWorkouts,
  sameStartTrips,
  type ReportTrip,
} from '../../lib/fitness-import/duplicate-report.ts';
import {
  activitiesFromExport,
  exportWorkoutRow,
  planExportWorkouts,
  summarizedActivityFiles,
  type ExportActivity,
} from '../../lib/fitness-import/garmin-export.ts';
import { addDeviceSteps, daySteps } from '../../lib/fitness-import/device-steps.ts';
import { FakeFitnessDb } from './fake-fitness-db.ts';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';

function fake(): { db: FakeFitnessDb; client: SupabaseClient } {
  const db = new FakeFitnessDb();
  return { db, client: db as unknown as SupabaseClient };
}

const day = (logged_date: string, values: Record<string, unknown>): DayInput => ({ logged_date, values: cleanDayValues(values) });

// ─── Daily metrics: pure rules ───────────────────────────────────────────────

test('sources: only the values migration 080 allows', () => {
  assert.equal(isHealthSource('garmin'), true);
  assert.equal(isHealthSource('apple_health'), true);
  assert.equal(isHealthSource('fitbit'), false);
  assert.equal(isHealthSource(''), false);
  assert.equal(isHealthSource(undefined), false);
  assert.equal(HEALTH_SOURCES.length, 9);
});

test('dates: only real YYYY-MM-DD days', () => {
  assert.equal(isIsoDate('2026-02-28'), true);
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('02/28/2026'), false);
});

test('values: integers rounded, decimals to 2 places, blanks and unknown keys dropped', () => {
  assert.equal(normalizeField('steps', '9432.4'), 9432);
  assert.equal(normalizeField('resting_hr', 58.6), 59);
  assert.equal(normalizeField('sleep_hours', '7.456'), 7.46);
  assert.equal(normalizeField('steps', ''), null);
  assert.equal(normalizeField('steps', 'n/a'), null);
  assert.equal(normalizeField('notes', '  hi  '), 'hi');
  assert.equal(normalizeField('notes', '   '), null);
  assert.deepEqual(cleanDayValues({ steps: '100', bogus: 5, sleep_hours: '', notes: 'x', user_id: OTHER_USER }), { steps: 100, notes: 'x' });
});

test('merge (add only): blanks are filled, stored values are kept, a different value is a conflict', () => {
  const merged = mergeDay({ steps: 9000, resting_hr: 60 }, { steps: 9500, sleep_hours: 7.5 }, 'add_only');
  assert.deepEqual(merged.values, { steps: 9000, resting_hr: 60, sleep_hours: 7.5 });
  assert.deepEqual(merged.filled, ['sleep_hours']);
  assert.deepEqual(merged.conflicts, ['steps']);
  assert.deepEqual(merged.replaced, []);
});

test('merge (replace): incoming values win, but a field it leaves out is never erased', () => {
  const merged = mergeDay({ steps: 9000, resting_hr: 60 }, { steps: 9500 }, 'replace');
  assert.deepEqual(merged.values, { steps: 9500, resting_hr: 60 });
  assert.deepEqual(merged.replaced, ['steps']);
});

test('merge: the same value written differently is not a conflict', () => {
  const merged = mergeDay({ steps: 9000, sleep_hours: 7.5 }, { steps: '9000.0' as unknown as number, sleep_hours: 7.5 }, 'add_only');
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(merged.filled, []);
});

test('file: a date listed twice becomes one day, later values win, earlier values stay where the later row is blank', () => {
  const { days, repeatedDates } = dedupeFileRows([
    day('2026-01-01', { steps: 100, resting_hr: 60 }),
    day('2026-01-02', { steps: 200 }),
    day('2026-01-01', { steps: 150, sleep_hours: 7 }),
  ]);
  assert.deepEqual(repeatedDates, ['2026-01-01']);
  assert.equal(days.length, 2);
  assert.deepEqual(days.find((d) => d.logged_date === '2026-01-01')?.values, { steps: 150, resting_hr: 60, sleep_hours: 7 });
});

test('classify: new, unchanged, filled, conflict, replaced', () => {
  const incoming = day('2026-01-01', { steps: 100, sleep_hours: 7 });
  assert.equal(classifyDay(null, incoming, 'add_only').status, 'new');
  assert.equal(classifyDay({ steps: 100, sleep_hours: 7 }, incoming, 'add_only').status, 'unchanged');
  assert.equal(classifyDay({ steps: 100, sleep_hours: 7 }, incoming, 'add_only').write, null);
  const filled = classifyDay({ steps: 100 }, incoming, 'add_only');
  assert.equal(filled.status, 'filled');
  assert.deepEqual(filled.write, { steps: 100, sleep_hours: 7 });
  const conflict = classifyDay({ steps: 90 }, incoming, 'add_only');
  assert.equal(conflict.status, 'conflict');
  // The conflicting field keeps its stored value; the blank one is still filled.
  assert.deepEqual(conflict.write, { steps: 90, sleep_hours: 7 });
  assert.equal(classifyDay({ steps: 90, sleep_hours: 7 }, incoming, 'add_only').write, null);
  assert.equal(classifyDay({ steps: 90 }, incoming, 'replace').status, 'replaced');
});

test('plan: counts each kind of day', () => {
  const stored = new Map([
    ['2026-01-02', { steps: 200 }],
    ['2026-01-03', { steps: 300 }],
    ['2026-01-04', { steps: 400 }],
  ]);
  const plan = planDailyMetrics(
    [
      day('2026-01-01', { steps: 100 }),
      day('2026-01-02', { steps: 200 }),
      day('2026-01-03', { steps: 300, sleep_hours: 6 }),
      day('2026-01-04', { steps: 999 }),
      day('2026-01-01', { resting_hr: 55 }),
    ],
    stored,
    'add_only',
  );
  assert.deepEqual(plan.counts, { inserted: 1, filled: 1, unchanged: 1, conflicts: 1, replaced: 0, repeated_in_file: 1 });
  const text = describeDailyCounts(plan.counts, true);
  assert.match(text, /1 new day to add/);
  assert.match(text, /1 already imported \(skipped\)/);
  assert.match(text, /existing values kept/);
});

// ─── Daily metrics: against the fake database ────────────────────────────────

test('old behaviour (documented): a repeated date fails a bulk upsert with 21000; the import merges it first', async () => {
  const { db, client } = fake();
  const rows = [
    { user_id: USER, logged_date: '2026-01-01', source: 'garmin', steps: 100 },
    { user_id: USER, logged_date: '2026-01-01', source: 'garmin', steps: 150 },
  ];
  const old = await client.from('user_health_metrics').upsert(rows, { onConflict: 'user_id,logged_date,source' });
  assert.equal(old.error?.code, '21000');

  const result = await importDailyMetrics(client, {
    userId: USER,
    source: 'garmin',
    rows: [day('2026-01-01', { steps: 100 }), day('2026-01-01', { steps: 150 })],
  });
  assert.equal(result.counts.inserted, 1);
  assert.equal(result.counts.repeated_in_file, 1);
  assert.equal(db.rows('user_health_metrics').length, 1);
  assert.equal(db.rows('user_health_metrics')[0].steps, 150);
});

test('old behaviour (documented): the syncs targeted (user_id, logged_date), which 080 dropped -> 42P10', async () => {
  const { client } = fake();
  const { error } = await client
    .from('user_health_metrics')
    .upsert([{ user_id: USER, logged_date: '2026-01-01', steps: 1 }], { onConflict: 'user_id,logged_date' });
  assert.equal(error?.code, '42P10');
});

test('old behaviour (documented): a partial bulk re-import erased stored values with NULL', async () => {
  const { db, client } = fake();
  db.seed('user_health_metrics', [{ user_id: USER, logged_date: '2026-01-01', source: 'garmin', steps: 100, resting_hr: 60 }]);
  await client.from('user_health_metrics').upsert(
    [
      { user_id: USER, logged_date: '2026-01-01', source: 'garmin', steps: 120 },
      { user_id: USER, logged_date: '2026-01-02', source: 'garmin', resting_hr: 58 },
    ],
    { onConflict: 'user_id,logged_date,source' },
  );
  assert.equal(db.rows('user_health_metrics')[0].resting_hr, null);
});

test('import (add only): a partial re-import never erases or changes stored values', async () => {
  const { db, client } = fake();
  db.seed('user_health_metrics', [{ user_id: USER, logged_date: '2026-01-01', source: 'garmin', steps: 100, resting_hr: 60 }]);
  const result = await importDailyMetrics(client, {
    userId: USER,
    source: 'garmin',
    rows: [day('2026-01-01', { steps: 120, sleep_hours: 7 }), day('2026-01-02', { resting_hr: 58 })],
  });
  assert.equal(result.counts.inserted, 1);
  assert.equal(result.counts.conflicts, 1);
  const first = db.rows('user_health_metrics').find((r) => r.logged_date === '2026-01-01')!;
  assert.equal(first.steps, 100, 'stored value kept');
  assert.equal(first.resting_hr, 60, 'never erased');
  assert.equal(first.sleep_hours, 7, 'blank field filled');
  const second = db.rows('user_health_metrics').find((r) => r.logged_date === '2026-01-02')!;
  assert.equal(second.resting_hr, 58);
});

test('import (replace): incoming values win, fields the file leaves out stay', async () => {
  const { db, client } = fake();
  db.seed('user_health_metrics', [{ user_id: USER, logged_date: '2026-01-01', source: 'garmin', steps: 100, resting_hr: 60 }]);
  const result = await importDailyMetrics(client, {
    userId: USER,
    source: 'garmin',
    rows: [day('2026-01-01', { steps: 120 })],
    mode: 'replace',
  });
  assert.equal(result.counts.replaced, 1);
  const row = db.rows('user_health_metrics')[0];
  assert.equal(row.steps, 120);
  assert.equal(row.resting_hr, 60);
});

test('import: re-importing the same file adds nothing and changes nothing', async () => {
  const { db, client } = fake();
  const rows = [day('2026-01-01', { steps: 100 }), day('2026-01-02', { steps: 200, notes: 'easy day' })];
  await importDailyMetrics(client, { userId: USER, source: 'apple_health', rows });
  const writesBefore = db.writes().length;
  const again = await importDailyMetrics(client, { userId: USER, source: 'apple_health', rows });
  assert.equal(again.counts.unchanged, 2);
  assert.equal(again.written, 0);
  assert.equal(db.writes().length, writesBefore, 'no write request at all');
  assert.equal(db.rows('user_health_metrics').length, 2);
});

test('import: sources stay apart (a Garmin day never lands on the manual row)', async () => {
  const { db, client } = fake();
  db.seed('user_health_metrics', [{ user_id: USER, logged_date: '2026-01-01', source: 'manual', steps: 5000 }]);
  await importDailyMetrics(client, { userId: USER, source: 'garmin', rows: [day('2026-01-01', { steps: 9000 })] });
  const rows = db.rows('user_health_metrics');
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.source === 'manual')?.steps, 5000);
  assert.equal(rows.find((r) => r.source === 'garmin')?.steps, 9000);
});

test('import: a dry run classifies without writing', async () => {
  const { db, client } = fake();
  db.seed('user_health_metrics', [{ user_id: USER, logged_date: '2026-01-01', source: 'garmin', steps: 100 }]);
  const result = await importDailyMetrics(client, {
    userId: USER,
    source: 'garmin',
    rows: [day('2026-01-01', { steps: 100, sleep_hours: 7 }), day('2026-01-02', { steps: 50 })],
    dryRun: true,
  });
  assert.equal(result.dryRun, true);
  assert.equal(result.counts.inserted, 1);
  assert.equal(result.counts.filled, 1);
  assert.equal(db.writes().length, 0);
});

test('import: stored days past the row cap are still found (paged read)', async () => {
  const { db, client } = fake();
  db.maxRows = 3;
  const stored = Array.from({ length: 10 }, (_, i) => ({
    user_id: USER, logged_date: `2026-01-${String(i + 1).padStart(2, '0')}`, source: 'garmin', steps: 1000 + i,
  }));
  db.seed('user_health_metrics', stored);
  const rows = stored.map((r) => day(r.logged_date, { steps: r.steps }));
  const result = await importDailyMetrics(client, { userId: USER, source: 'garmin', rows });
  assert.equal(result.counts.unchanged, 10);
  assert.equal(db.rows('user_health_metrics').length, 10);
});

test('import: another person\'s days are never read or touched', async () => {
  const { db, client } = fake();
  db.seed('user_health_metrics', [{ user_id: OTHER_USER, logged_date: '2026-01-01', source: 'garmin', steps: 1 }]);
  const result = await importDailyMetrics(client, { userId: USER, source: 'garmin', rows: [day('2026-01-01', { steps: 2 })] });
  assert.equal(result.counts.inserted, 1);
  assert.equal(db.rows('user_health_metrics').find((r) => r.user_id === OTHER_USER)?.steps, 1);
});

test('import: a failed write throws instead of reporting success', async () => {
  const { db, client } = fake();
  db.rejectInsert = () => ({ code: '23514', message: 'violates check constraint' });
  await assert.rejects(
    importDailyMetrics(client, { userId: USER, source: 'garmin', rows: [day('2026-01-01', { steps: 2 })] }),
    (error: unknown) => error instanceof FitnessImportError && error.status === 500 && /save the health metrics/.test(error.message),
  );
});

test('write groups: rows with different columns never share a request', () => {
  const groups = groupByKeySet([{ a: 1, b: 2 }, { b: 3, a: 4 }, { a: 5 }]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.length).sort(), [1, 2]);
});

test('paged read: stops on an empty page and throws (never a partial list) on an error', async () => {
  let calls = 0;
  const rows = await readAllRows<number>('read', (from) => {
    calls += 1;
    return Promise.resolve({ data: from < 4 ? [from, from + 1] : [], error: null });
  });
  assert.deepEqual(rows, [0, 1, 2, 3]);
  assert.equal(calls, 3);
  await assert.rejects(
    readAllRows('read things', () => Promise.resolve({ data: null, error: { code: '42703', message: 'column trips.external_id does not exist' } })),
    (error: unknown) => error instanceof FitnessImportError && isMissingColumn(error.details.dbError as never, 'external_id'),
  );
});

// ─── InBody ──────────────────────────────────────────────────────────────────

const scan = (measured_at: string, values: Record<string, unknown>): ScanRow => ({
  user_id: USER, measured_at, logged_date: measured_at.slice(0, 10), ...values,
});

test('InBody: a measured_at listed twice becomes one scan (no 21000)', () => {
  const { scans, repeated } = dedupeScans([
    scan('2026-01-01T07:00:00Z', { weight_lbs: 180, bmi: 24 }),
    scan('2026-01-01T07:00:00Z', { weight_lbs: 181 }),
  ]);
  assert.equal(scans.length, 1);
  assert.deepEqual(repeated, ['2026-01-01T07:00:00Z']);
  assert.equal(scans[0].weight_lbs, 181);
  assert.equal(scans[0].bmi, 24);
});

test('InBody: the health-metrics copy uses each day\'s latest scan', () => {
  const days = latestScanDays([
    { logged_date: '2026-01-01', measured_at: '2026-01-01T07:00:00Z', weight_lbs: 180, body_fat_pct: null, skeletal_muscle_mass_lbs: 80, bmi: null },
    { logged_date: '2026-01-01', measured_at: '2026-01-01T19:00:00Z', weight_lbs: 182, body_fat_pct: 20, skeletal_muscle_mass_lbs: null, bmi: null },
  ]);
  assert.deepEqual(days, [{ logged_date: '2026-01-01', values: { weight_lbs: 182, body_fat_pct: 20 } }]);
});

test('InBody import: re-import with blanks keeps stored values; the copy follows the latest stored scan', async () => {
  const { db, client } = fake();
  await importInBodyScans(client, USER, [
    scan('2026-01-01T19:00:00Z', { weight_lbs: 182, bmi: 24.1 }),
    scan('2026-01-01T07:00:00Z', { weight_lbs: 180, bmi: 24 }),
  ]);
  // A later file lists only the morning scan, with a blank BMI.
  const second = await importInBodyScans(client, USER, [scan('2026-01-01T07:00:00Z', { weight_lbs: 180 })]);
  const morning = db.rows('inbody_scans').find((r) => r.measured_at === '2026-01-01T07:00:00Z')!;
  assert.equal(morning.bmi, 24, 'blank cell did not erase the stored BMI');
  const copy = db.rows('user_health_metrics');
  assert.equal(copy.length, 1);
  assert.equal(copy[0].source, 'inbody');
  assert.equal(copy[0].weight_lbs, 182, 'still the evening (latest) scan');
  assert.equal(second.healthMetrics.counts.unchanged, 1);
});

// ─── Garmin start-time key ───────────────────────────────────────────────────

test('start key: the local start time, whatever way it is written', () => {
  assert.equal(normalizeLocalStart('2025-06-08 17:20:53'), '2025-06-08 17:20:53');
  assert.equal(normalizeLocalStart('2025-06-08T17:20:53'), '2025-06-08 17:20:53');
  assert.equal(normalizeLocalStart(' 2025-06-08 7:20 '), '2025-06-08 07:20:00');
  assert.equal(normalizeLocalStart('2025-06-08 17:20:53.000'), '2025-06-08 17:20:53');
  assert.equal(normalizeLocalStart('2025-02-30 10:00:00'), null);
  assert.equal(normalizeLocalStart('2025-06-08 24:00:00'), null);
  assert.equal(normalizeLocalStart('June 8'), null);
  assert.equal(garminStartKey('2025-06-08 17:20:53'), 'garmin:start:2025-06-08 17:20:53');
  assert.equal(garminStartKey(''), null);
});

test('start key: CSV, export JSON and API give the same key for one activity', () => {
  // 2025-06-08 17:20:53 local at UTC-5 (synthetic).
  const utcSeconds = Date.UTC(2025, 5, 8, 22, 20, 53) / 1000;
  const fromApi = localStartFromEpoch(utcSeconds, -5 * 3600);
  const fromExport = localStartFromWallClockMs(Date.UTC(2025, 5, 8, 17, 20, 53));
  assert.equal(fromApi, '2025-06-08 17:20:53');
  assert.equal(fromExport, '2025-06-08 17:20:53');
  assert.equal(garminStartKey(fromApi), garminStartKey('2025-06-08 17:20:53'));
});

test('start key: a renamed activity still matches its old garmin_activity_id', () => {
  const old = legacyGarminId('2025-06-08 17:20:53', 'Morning Ride');
  assert.equal(old, '2025-06-08 17:20:53|Morning Ride');
  assert.equal(startKeyFromLegacyId(old), garminStartKey('2025-06-08 17:20:53'));
  assert.equal(startKeyFromLegacyId('2025-06-08 17:20:53|Renamed: Commute | home'), 'garmin:start:2025-06-08 17:20:53');
  assert.equal(startKeyFromLegacyId('|no date'), null);
  assert.equal(storedStartKey({ external_id: 'garmin:start:2025-06-08 17:20:53', garmin_activity_id: null }), 'garmin:start:2025-06-08 17:20:53');
  assert.equal(storedStartKey({ external_id: null, garmin_activity_id: null }), null);
});

test('possible match: same date and mode, distance within max(0.1 mi, 5%) or duration within 5 min', () => {
  const base = { date: '2026-01-01', mode: 'bike', distance_miles: 10, duration_min: 40 };
  assert.equal(isPossibleSameTrip(base, { ...base, distance_miles: 10.5, duration_min: null }), true);
  assert.equal(isPossibleSameTrip(base, { ...base, distance_miles: 10.6, duration_min: null }), false);
  assert.equal(isPossibleSameTrip({ ...base, distance_miles: 1 }, { ...base, distance_miles: 1.1, duration_min: null }), true);
  assert.equal(isPossibleSameTrip(base, { ...base, distance_miles: 20, duration_min: 45 }), true);
  assert.equal(isPossibleSameTrip(base, { ...base, distance_miles: 20, duration_min: 46 }), false);
  assert.equal(isPossibleSameTrip(base, { ...base, mode: 'walk' }), false);
  assert.equal(isPossibleSameTrip(base, { ...base, date: '2026-01-02' }), false);
  // Row against row, nothing to compare is no match; the import's rule
  // (findLoggedTripMatch) flags such a trip on its own, see below.
  assert.equal(isPossibleSameTrip(base, { ...base, distance_miles: null, duration_min: null }), false);
});

// Trips logged from templates: round trips are stored one way, multi-stop
// templates are one row per leg, a template can carry no distance or time, and
// the Travel dashboard's Quick log used the server's UTC date.
const logged = (id: string, extra: Partial<ExistingTrip>): ExistingTrip => ({
  id, date: '2026-10-01', mode: 'bike', distance_miles: null, duration_min: null, source: 'manual', garmin_activity_id: null, ...extra,
});

test('possible match: a round-trip template trip is compared both ways', () => {
  const { activities } = parseGarminActivitiesCsv(csv('Cycling,2026-10-01 07:00:00,false,Commute loop,10.0,400,01:00:00,120,--'));
  // Before: |10 - 5| > 0.5 mi and |60 - 30| > 5 min, so this was "new".
  const plan = planGarminActivities(activities, [logged('rt', { distance_miles: 5, duration_min: 30, is_round_trip: true })]);
  assert.equal(plan[0].status, 'possible_match');
  assert.equal(plan[0].matchTripId, 'rt');
  assert.equal(plan[0].matchReason, 'round_trip');
  // The same values without the round-trip flag are a different, shorter outing.
  assert.equal(planGarminActivities(activities, [logged('one', { distance_miles: 5, duration_min: 30 })])[0].status, 'new');
});

test('possible match: a multi-stop trip\'s legs are added up, and doubled for a round-trip route', () => {
  const { activities } = parseGarminActivitiesCsv(csv(
    'Walking,2026-10-02 07:00:00,false,Errands,3.0,200,00:50:00,110,4000',
    'Walking,2026-10-03 07:00:00,false,Out and back,4.0,250,01:10:00,110,5000',
  ));
  const existing = [
    logged('l1', { date: '2026-10-02', mode: 'walk', distance_miles: 1.2, duration_min: 20, route_id: 'r1', leg_order: 0 }),
    logged('l2', { date: '2026-10-02', mode: 'walk', distance_miles: '1.8', duration_min: 30, route_id: 'r1', leg_order: 1 }),
    // A round-trip route from a template, legs one way only: 2.0 mi, 35 min.
    logged('r2b', { date: '2026-10-03', mode: 'walk', distance_miles: 0.8, duration_min: 15, route_id: 'r2', leg_order: 1 }),
    logged('r2a', { date: '2026-10-03', mode: 'walk', distance_miles: 1.2, duration_min: 20, route_id: 'r2', leg_order: 0 }),
  ];
  const plan = planGarminActivities(activities, existing, { roundTripRouteIds: new Set(['r2']) });
  assert.deepEqual(plan.map((a) => [a.status, a.matchTripId, a.matchReason]), [
    ['possible_match', 'l1', 'route_total'],
    ['possible_match', 'r2a', 'route_total'],
  ]);
  // Without the route's round-trip flag the 4.0 mi walk is not 2.0 mi of legs.
  assert.equal(planGarminActivities(activities, existing)[1].status, 'new');
});

test('possible match: a same-day trip with no distance or time is flagged, not ignored', () => {
  const { activities } = parseGarminActivitiesCsv(csv(
    'Running,2026-10-03 07:00:00,false,Run,4.0,300,00:40:00,150,--',
    'Running,2026-10-05 07:00:00,false,Run,4.0,300,00:40:00,150,--',
  ));
  const plan = planGarminActivities(activities, [
    logged('blank', { date: '2026-10-03', mode: 'run' }),
    // Nothing to compare a day away is too loose to flag.
    logged('blank-next-day', { date: '2026-10-06', mode: 'run' }),
    logged('bike', { date: '2026-10-05', mode: 'bike' }),
  ]);
  assert.deepEqual(plan.map((a) => [a.status, a.matchTripId, a.matchReason]), [
    ['possible_match', 'blank', 'no_values'],
    ['new', null, null],
  ]);
});

test('possible match: a template trip dated a day off (UTC date) is flagged; the same day wins', () => {
  const { activities } = parseGarminActivitiesCsv(csv(
    'Cycling,2026-10-04 20:00:00,false,Evening ride,5.0,300,00:30:00,150,--',
    'Cycling,2026-10-10 20:00:00,false,Evening ride,5.0,300,00:30:00,150,--',
  ));
  const plan = planGarminActivities(activities, [
    logged('utc', { date: '2026-10-05', distance_miles: 5, duration_min: 30 }),
    logged('next', { date: '2026-10-11', distance_miles: 5, duration_min: 30 }),
    logged('same', { date: '2026-10-10', distance_miles: 5.1, duration_min: null }),
  ]);
  assert.deepEqual(plan.map((a) => [a.status, a.matchTripId, a.matchDate]), [
    ['possible_match', 'utc', '2026-10-05'],
    ['possible_match', 'same', '2026-10-10'],
  ]);
  assert.equal(findLoggedTripMatch(
    { date: '2026-10-04', mode: 'bike', distance_miles: 5, duration_min: 30 },
    loggedTripCandidates([logged('far', { date: '2026-10-06', distance_miles: 5, duration_min: 30 })]),
  ), null, 'two days away is not a match');
});

// ─── Garmin Activities CSV -> trips ──────────────────────────────────────────

const HEADER = 'Activity Type,Date,Favorite,Title,Distance,Calories,Total Time,Avg HR,Steps';
const csv = (...lines: string[]) => [HEADER, ...lines].join('\n');

test('CSV line: quoted commas and doubled quotes', () => {
  assert.deepEqual(splitCsvLine('Cycling,"2025-06-08 17:20:53",false,"Ride, ""fast""","1,234.5",,'), [
    'Cycling', '2025-06-08 17:20:53', 'false', 'Ride, "fast"', '1,234.5', '', '',
  ]);
  assert.equal(parseDurationMinutes('01:02:30'), 63);
  assert.equal(parseDurationMinutes('45:12'), 45);
  assert.equal(parseDurationMinutes('--'), null);
});

test('CSV: unsupported types and unreadable rows are counted apart', () => {
  const parsed = parseGarminActivitiesCsv(
    '﻿' + csv(
      'Cycling,2025-06-08 17:20:53,false,Ride,12.5,400,00:45:00,120,--',
      'Strength Training,2025-06-08 18:00:00,false,Lift,0,200,00:30:00,100,--',
      'Walking,,false,Walk,1.2,80,00:20:00,90,2400',
      'Running,2025-13-01 07:00:00,false,Run,3,300,00:30:00,150,--',
    ).replace(/\n/g, '\r\n'),
  );
  assert.equal(parsed.activities.length, 1);
  assert.equal(parsed.unsupported, 1);
  assert.deepEqual(parsed.invalid.map((i) => i.line), [4, 5]);
  assert.equal(parsed.activities[0].key, 'garmin:start:2025-06-08 17:20:53');
  assert.equal(parsed.activities[0].date, '2025-06-08');
  assert.throws(() => parseGarminActivitiesCsv('Title,Distance\nx,1'), FitnessImportError);
  assert.throws(() => parseGarminActivitiesCsv(''), FitnessImportError);
});

test('plan: renamed activity, a repeat in the file, and a hand-logged trip', () => {
  const { activities } = parseGarminActivitiesCsv(csv(
    'Cycling,2025-06-08 17:20:53,false,Renamed Ride,12.5,400,00:45:00,120,--',
    'Cycling,2025-06-09 07:00:00,false,Commute,5.0,200,00:20:00,110,--',
    'Cycling,2025-06-09 07:00:00,false,Commute,5.0,200,00:20:00,110,--',
    'Walking,2025-06-10 12:00:00,false,Lunch walk,1.0,80,00:20:00,90,2400',
    'Running,2025-06-10 18:00:00,false,Run,3.1,300,00:28:00,150,--',
  ));
  const existing: ExistingTrip[] = [
    { id: 't1', date: '2025-06-08', mode: 'bike', distance_miles: 12.5, duration_min: 45, source: 'garmin_import', garmin_activity_id: '2025-06-08 17:20:53|Morning Ride' },
    { id: 't2', date: '2025-06-10', mode: 'walk', distance_miles: '1.03', duration_min: null, source: 'manual', garmin_activity_id: null },
    // A Garmin trip is never a "possible match": it has its own key.
    { id: 't3', date: '2025-06-10', mode: 'run', distance_miles: 3.1, duration_min: 28, source: 'garmin_import', garmin_activity_id: '2025-06-10 06:00:00|Other run' },
  ];
  const plan = planGarminActivities(activities, existing);
  assert.deepEqual(plan.map((a) => a.status), ['already_imported', 'new', 'duplicate_in_file', 'possible_match', 'new']);
  assert.equal(plan[3].matchTripId, 't2');
});

test('import: first run inserts with both keys; a second run adds nothing', async () => {
  const { db, client } = fake();
  const text = csv(
    'Cycling,2025-06-08 17:20:53,false,Ride,12.5,400,00:45:00,120,--',
    'Walking,2025-06-09 12:00:00,false,Walk,1.0,80,00:20:00,90,2400',
  );
  const first = await importGarminActivities(client, { userId: USER, text });
  assert.equal(first.counts.inserted, 2);
  assert.equal(first.needsMigration, false);
  const trip = db.rows('trips').find((r) => r.mode === 'bike')!;
  assert.equal(trip.external_id, 'garmin:start:2025-06-08 17:20:53');
  assert.equal(trip.garmin_activity_id, '2025-06-08 17:20:53|Ride', 'old format kept for display and Work.WitUS');
  assert.equal(trip.source, 'garmin_import');

  const second = await importGarminActivities(client, { userId: USER, text: text.replace(',Ride,', ',Renamed,') });
  assert.equal(second.counts.inserted, 0);
  assert.equal(second.counts.already_imported, 2);
  assert.equal(db.rows('trips').length, 2);
  assert.match(describeGarminCounts(second.counts, false), /0 trips added · 2 already imported/);
});

test('import: before migration 224 it still works, matching on the old key', async () => {
  const { db, client } = fake();
  db.missingColumns = { trips: ['external_id'] };
  db.seed('trips', [{ user_id: USER, date: '2025-06-08', mode: 'bike', source: 'garmin_import', garmin_activity_id: '2025-06-08 17:20:53|Morning Ride' }]);
  const result = await importGarminActivities(client, {
    userId: USER,
    text: csv(
      'Cycling,2025-06-08 17:20:53,false,Renamed Ride,12.5,400,00:45:00,120,--',
      'Cycling,2025-06-09 07:00:00,false,Commute,5.0,200,00:20:00,110,--',
    ),
  });
  assert.equal(result.needsMigration, true);
  assert.equal(result.counts.already_imported, 1);
  assert.equal(result.counts.inserted, 1);
  const added = db.rows('trips').find((r) => r.date === '2025-06-09')!;
  assert.equal('external_id' in added, false);
});

test('import: existing trips past the row cap are still found', async () => {
  const { db, client } = fake();
  db.maxRows = 5;
  const lines: string[] = [];
  const seeded = [];
  for (let i = 0; i < 12; i++) {
    const start = `2025-06-${String(i + 1).padStart(2, '0')} 07:00:00`;
    lines.push(`Cycling,${start},false,Ride ${i},5,200,00:20:00,110,--`);
    seeded.push({ user_id: USER, date: start.slice(0, 10), mode: 'bike', source: 'garmin_import', garmin_activity_id: `${start}|Ride ${i}`, external_id: `garmin:start:${start}` });
  }
  db.seed('trips', seeded);
  const result = await importGarminActivities(client, { userId: USER, text: csv(...lines) });
  assert.equal(result.counts.already_imported, 12);
  assert.equal(result.counts.inserted, 0);
  assert.equal(db.rows('trips').length, 12);
});

test('import: an imported trip whose date was edited since is still recognised (no date window)', async () => {
  const { db, client } = fake();
  db.seed('trips', [
    // Imported before migration 224 (external_id NULL), then moved back by hand.
    { user_id: USER, date: '2026-09-25', mode: 'walk', distance_miles: 1.5, duration_min: 30, source: 'garmin_import', garmin_activity_id: '2026-09-30 23:10:00|Night walk', external_id: null },
    // Imported after 224, then moved a week back.
    { user_id: USER, date: '2026-09-24', mode: 'bike', distance_miles: 8, duration_min: 40, source: 'garmin_import', garmin_activity_id: '2026-10-01 07:00:00|Ride', external_id: 'garmin:start:2026-10-01 07:00:00' },
    // Another person's trip with the same start time is not this person's.
    { user_id: OTHER_USER, date: '2026-10-02', mode: 'run', distance_miles: 3, duration_min: 30, source: 'garmin_import', garmin_activity_id: '2026-10-02 06:00:00|Run', external_id: 'garmin:start:2026-10-02 06:00:00' },
  ]);
  const text = csv(
    'Walking,2026-09-30 23:10:00,false,Night walk,1.5,90,00:30:00,95,3000',
    'Cycling,2026-10-01 07:00:00,false,Ride,8.0,300,00:40:00,120,--',
    'Running,2026-10-02 06:00:00,false,Run,3.0,300,00:30:00,150,--',
    'Cycling,2026-10-07 07:00:00,false,Ride,8.0,300,00:40:00,120,--',
  );
  // Check file and Import agree.
  const preview = await importGarminActivities(client, { userId: USER, text, dryRun: true });
  assert.deepEqual(preview.activities.map((a) => a.status), ['already_imported', 'already_imported', 'new', 'new']);
  const result = await importGarminActivities(client, { userId: USER, text });
  assert.equal(result.counts.already_imported, 2);
  assert.equal(result.counts.inserted, 2);
  assert.equal(db.rows('trips').filter((r) => r.user_id === USER).length, 4);
});

test('import: before migration 224, an edited legacy trip is still recognised by its old key', async () => {
  const { db, client } = fake();
  db.missingColumns = { trips: ['external_id'] };
  db.seed('trips', [{ user_id: USER, date: '2026-09-25', mode: 'walk', source: 'garmin_import', garmin_activity_id: '2026-09-30 23:10:00|Night walk' }]);
  const result = await importGarminActivities(client, {
    userId: USER,
    text: csv('Walking,2026-09-30 23:10:00,false,Renamed walk,1.5,90,00:30:00,95,3000'),
  });
  assert.equal(result.needsMigration, true);
  assert.equal(result.counts.already_imported, 1);
  assert.equal(result.counts.inserted, 0);
  assert.equal(db.rows('trips').length, 1);
});

test('import: possible matches are skipped unless asked for', async () => {
  const { db, client } = fake();
  db.seed('trips', [{ user_id: USER, date: '2025-06-10', mode: 'walk', distance_miles: 1.02, duration_min: null, source: 'manual', garmin_activity_id: null }]);
  const text = csv('Walking,2025-06-10 12:00:00,false,Lunch walk,1.0,80,00:20:00,90,2400');
  const skipped = await importGarminActivities(client, { userId: USER, text });
  assert.equal(skipped.counts.possible_matches, 1);
  assert.equal(skipped.counts.inserted, 0);
  assert.equal(db.rows('trips').length, 1);
  const anyway = await importGarminActivities(client, { userId: USER, text, includePossibleMatches: true });
  assert.equal(anyway.counts.possible_matches_imported, 1);
  assert.equal(db.rows('trips').length, 2);
});

test('import: a round-trip route logged from a template is checked against its legs both ways', async () => {
  const { db, client } = fake();
  const [route] = db.seed('trip_routes', [{ user_id: USER, date: '2026-10-07', is_round_trip: true }]);
  db.seed('trip_routes', [{ user_id: OTHER_USER, date: '2026-10-07', is_round_trip: true }]);
  db.seed('trips', [
    // Logged the evening of 10-06 local, stored with the next (UTC) day.
    { user_id: USER, date: '2026-10-07', mode: 'walk', distance_miles: 1.2, duration_min: 20, source: 'manual', garmin_activity_id: null, route_id: route.id, leg_order: 0 },
    { user_id: USER, date: '2026-10-07', mode: 'walk', distance_miles: 0.8, duration_min: 15, source: 'manual', garmin_activity_id: null, route_id: route.id, leg_order: 1 },
  ]);
  const text = csv('Walking,2026-10-06 19:30:00,false,Evening loop,4.0,250,01:10:00,110,5000');
  const result = await importGarminActivities(client, { userId: USER, text, dryRun: true });
  assert.equal(result.counts.possible_matches, 1);
  assert.equal(result.counts.inserted, 0);
  assert.equal(result.activities[0].matchReason, 'route_total');
  assert.equal(result.activities[0].matchDate, '2026-10-07');
  assert.equal(db.writes().length, 0);
});

test('import: a dry run reads but never writes', async () => {
  const { db, client } = fake();
  const result = await importGarminActivities(client, {
    userId: USER,
    dryRun: true,
    text: csv('Cycling,2025-06-08 17:20:53,false,Ride,12.5,400,00:45:00,120,--'),
  });
  assert.equal(result.counts.inserted, 1);
  assert.equal(db.writes().length, 0);
});

test('import: one bad row no longer loses its chunk', async () => {
  const { db, client } = fake();
  db.rejectInsert = (table, row) => (table === 'trips' && row.date === '2025-06-09' ? { code: '22003', message: 'numeric field overflow' } : null);
  const result = await importGarminActivities(client, {
    userId: USER,
    text: csv(
      'Cycling,2025-06-08 17:20:53,false,Ride,12.5,400,00:45:00,120,--',
      'Cycling,2025-06-09 07:00:00,false,Huge,999999999,200,00:20:00,110,--',
      'Cycling,2025-06-10 07:00:00,false,Commute,5.0,200,00:20:00,110,--',
    ),
  });
  assert.equal(result.counts.inserted, 2);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Line 3/);
  assert.equal(db.rows('trips').length, 2);
});

test('import: a trip added between the check and the write is not added twice', async () => {
  const { db, client } = fake();
  let raced = false;
  db.beforeRun = (table, op) => {
    if (table === 'trips' && op === 'upsert' && !raced) {
      raced = true;
      db.seed('trips', [{ user_id: USER, date: '2025-06-08', mode: 'bike', source: 'garmin_import', garmin_activity_id: '2025-06-08 17:20:53|Ride', external_id: 'garmin:start:2025-06-08 17:20:53' }]);
    }
  };
  const result = await importGarminActivities(client, {
    userId: USER,
    text: csv('Cycling,2025-06-08 17:20:53,false,Ride,12.5,400,00:45:00,120,--'),
  });
  assert.equal(result.counts.inserted, 0);
  assert.equal(result.counts.already_imported, 1);
  assert.equal(db.rows('trips').length, 1);
});

test('migration 224 index: rows with no external_id never clash (Work.WitUS inserts are unaffected)', async () => {
  const { db, client } = fake();
  const row = { user_id: USER, date: '2025-06-08', mode: 'bike', source: 'garmin_import', garmin_activity_id: 'x|y' };
  assert.equal((await client.from('trips').insert(row)).error, null);
  assert.equal((await client.from('trips').insert(row)).error, null);
  assert.equal(db.rows('trips').length, 2);
  const keyed = { ...row, external_id: 'garmin:start:2025-06-08 17:20:53' };
  assert.equal((await client.from('trips').insert(keyed)).error, null);
  assert.equal((await client.from('trips').insert(keyed)).error?.code, '23505');
});

// ─── Workouts ────────────────────────────────────────────────────────────────

test('workouts: identity is the name (any case) and the date', () => {
  assert.equal(workoutIdentity('  Leg Day ', '2026-01-01'), workoutIdentity('leg day', '2026-01-01'));
  assert.notEqual(workoutIdentity('Leg Day', '2026-01-01'), workoutIdentity('Leg Day', '2026-01-02'));
});

test('workouts: already logged ones are skipped unless "import anyway"', () => {
  const groups = [{ name: 'Leg Day', date: '2026-01-01' }, { name: 'Walk', date: '2026-01-01' }];
  const existing = [{ id: 'w1', name: 'leg day', date: '2026-01-01' }];
  const skip = splitLoggedWorkouts(groups, existing, false);
  assert.deepEqual(skip.toInsert.map((g) => g.name), ['Walk']);
  assert.deepEqual(skip.alreadyLogged.map((g) => g.name), ['Leg Day']);
  const anyway = splitLoggedWorkouts(groups, existing, true);
  assert.equal(anyway.toInsert.length, 2);
  assert.match(describeWorkoutCounts({ inserted: 1, already_logged: 1, imported_anyway: 0, invalid: 0 }, false), /1 workout added · 1 already logged that day \(skipped\)/);
});

test('workouts: logs past the row cap are still read', async () => {
  const { db, client } = fake();
  db.maxRows = 2;
  db.seed('workout_logs', Array.from({ length: 7 }, (_, i) => ({ user_id: USER, name: `W${i}`, date: '2026-01-01' })));
  db.seed('workout_logs', [{ user_id: OTHER_USER, name: 'W0', date: '2026-01-01' }]);
  const logs = await loadLoggedWorkouts(client, USER, '2026-01-01', '2026-01-01');
  assert.equal(logs.length, 7);
});

// ─── Garmin account export -> workout logs (scripts/import-garmin-workouts.mjs) ──

test('export files: every *_summarizedActivities.json, whatever the numbers in the names', () => {
  const older = ['x_0_summarizedActivities.json', 'x_2002_summarizedActivities.json', 'x_1001_summarizedActivities.json'];
  const newer = ['x_301_summarizedActivities.json', 'x_1_summarizedActivities.json', 'x_3601_summarizedActivities.json', 'x_userBioMetrics.json'];
  assert.deepEqual(summarizedActivityFiles(older), ['x_0_summarizedActivities.json', 'x_1001_summarizedActivities.json', 'x_2002_summarizedActivities.json']);
  // The old fixed list (0, 1001, 2002, 3003) matched none of these.
  assert.deepEqual(summarizedActivityFiles(newer), ['x_1_summarizedActivities.json', 'x_301_summarizedActivities.json', 'x_3601_summarizedActivities.json']);
});

test('export JSON: activities come out of summarizedActivitiesExport; junk is ignored', () => {
  const raw = [{ summarizedActivitiesExport: [{ activityId: 1 }, null, { activityId: 2 }] }, { activityId: 3 }, 'junk', null];
  assert.deepEqual(activitiesFromExport(raw).map((a) => a.activityId), [1, 2, 3]);
  assert.deepEqual(activitiesFromExport({ not: 'a list' }), []);
});

// A synthetic activity: starts 2026-01-01 23:30:00 local at UTC-5 (04:30 UTC the next day).
const exportActivity = (over: Partial<ExportActivity> = {}): ExportActivity => ({
  activityId: 111,
  name: 'Evening Walk',
  activityType: 'walking',
  startTimeLocal: Date.UTC(2026, 0, 1, 23, 30, 0),
  beginTimestamp: Date.UTC(2026, 0, 2, 4, 30, 0),
  duration: 1_263_264, // milliseconds (21 min)
  distance: 267_812, // centimetres (1.66 mi)
  elevationGain: 1_000, // centimetres (33 ft)
  ...over,
});

test('export row: local day, milliseconds and centimetres, start-time key', () => {
  const row = exportWorkoutRow(USER, exportActivity());
  assert.ok(row);
  assert.equal(row.date, '2026-01-01'); // the local day, not the UTC one
  assert.equal(row.external_id, 'garmin:start:2026-01-01 23:30:00');
  assert.equal(row.duration_min, 21);
  assert.equal(row.started_at, '2026-01-02T04:30:00.000Z');
  assert.equal(row.finished_at, new Date(Date.UTC(2026, 0, 2, 4, 30, 0) + 1_263_264).toISOString());
  assert.match(row.notes ?? '', /Distance: 1\.66 mi/);
  assert.match(row.notes ?? '', /Elevation: \+33 ft/);
  assert.match(row.notes ?? '', /Garmin activity 111/);
  // The same activity seen through the trips CSV gives the same key.
  assert.equal(row.external_id, garminStartKey('2026-01-01 23:30:00'));
});

test('export row: no name or no start time -> unreadable', () => {
  assert.equal(exportWorkoutRow(USER, exportActivity({ name: '' })), null);
  assert.equal(exportWorkoutRow(USER, exportActivity({ startTimeLocal: undefined })), null);
  assert.equal(exportWorkoutRow(USER, exportActivity({ beginTimestamp: undefined })), null);
});

test('export plan: a recording listed twice counts once; a second run adds nothing', () => {
  // Two activity ids, one start second (seen in a real export).
  const rows = [exportActivity(), exportActivity({ activityId: 222 }), exportActivity({ name: 'Run', startTimeLocal: Date.UTC(2026, 0, 3, 7, 0, 0), beginTimestamp: Date.UTC(2026, 0, 3, 12, 0, 0) })]
    .map((a) => exportWorkoutRow(USER, a)!);
  const first = planExportWorkouts(rows, [], false);
  assert.deepEqual(first.counts, { new: 2, already: 0, possible: 0, repeated_in_export: 1 });
  const second = planExportWorkouts(rows, first.toInsert, false);
  assert.deepEqual(second.counts, { new: 0, already: 2, possible: 0, repeated_in_export: 1 });
  assert.equal(second.toInsert.length, 0);
});

test('export plan: rows from the old script (no external_id, UTC date) match on started_at', () => {
  const row = exportWorkoutRow(USER, exportActivity())!;
  const oldScriptRow = { name: 'Evening Walk', date: '2026-01-02', started_at: '2026-01-02T04:30:00+00:00', external_id: null };
  const plan = planExportWorkouts([row], [oldScriptRow], false);
  assert.deepEqual(plan.counts, { new: 0, already: 1, possible: 0, repeated_in_export: 0 });
});

test('export plan: a hand-logged workout with the same name that day is a possible match, skipped unless asked', () => {
  const row = exportWorkoutRow(USER, exportActivity())!;
  const handLogged = { name: 'evening walk', date: '2026-01-01', started_at: null, external_id: null };
  const skip = planExportWorkouts([row], [handLogged], false);
  assert.deepEqual(skip.counts, { new: 0, already: 0, possible: 1, repeated_in_export: 0 });
  assert.equal(skip.toInsert.length, 0);
  const anyway = planExportWorkouts([row], [handLogged], true);
  assert.equal(anyway.toInsert.length, 1);
});

// ─── Apple Health steps (scripts/import-apple-health.mjs) ───────────────────

test('Apple steps: added per device, and the day takes the largest device, never the sum', () => {
  const bySource = new Map<string, number>();
  addDeviceSteps(bySource, 'iPhone', 4000);
  addDeviceSteps(bySource, 'Apple Watch', 5000);
  addDeviceSteps(bySource, 'iPhone', 2500);
  addDeviceSteps(bySource, 'Garmin Connect', 6000);
  addDeviceSteps(bySource, null, 100);
  addDeviceSteps(bySource, 'iPhone', Number.NaN);
  assert.equal(bySource.get('iPhone'), 6500);
  assert.equal(bySource.get('unknown'), 100);
  assert.equal(daySteps(bySource), 6500); // the old code reported 17,600
  assert.equal(daySteps(new Map()), 0);
});

// ─── Wearable syncs: day keys and windows ────────────────────────────────────

test('Garmin sync: the day is calendarDate, not the UTC date of the start time', () => {
  // A late-evening summary at UTC-5: the UTC date is the next day.
  const lateStart = Date.UTC(2026, 0, 2, 3, 0, 0) / 1000;
  assert.equal(garminDayOf({ calendarDate: '2026-01-01', startTimeInSeconds: lateStart }), '2026-01-01');
  assert.equal(garminDayOf({ startTimeInSeconds: lateStart, startTimeOffsetInSeconds: -5 * 3600 }), '2026-01-01');
  assert.equal(garminDayOf({}), null);
  const days = garminDays(
    [{ calendarDate: '2026-01-01', steps: 9000, restingHeartRateInBeatsPerMinute: 58, stressQualifier: 'calm', averageStressLevel: -1 }],
    [{ calendarDate: '2026-01-01', durationInSeconds: 27000, overallSleepScore: { value: 80 } }],
  );
  assert.deepEqual(days, [{ logged_date: '2026-01-01', values: { steps: 9000, resting_hr: 58, sleep_hours: 7.5, sleep_score: 80 } }]);
});

test('Garmin sync and Garmin CSV land on one row (source garmin)', async () => {
  const { db, client } = fake();
  await importDailyMetrics(client, { userId: USER, source: 'garmin', rows: [day('2026-01-01', { steps: 9000, weight_lbs: 180 })] });
  const synced = garminDays([{ calendarDate: '2026-01-01', steps: 9100, restingHeartRateInBeatsPerMinute: 58 }], []);
  const result = await importDailyMetrics(client, { userId: USER, source: 'garmin', rows: synced, mode: 'replace' });
  assert.equal(result.counts.replaced, 1);
  const rows = db.rows('user_health_metrics');
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].steps, rows[0].resting_hr, rows[0].weight_lbs], [9100, 58, 180]);
});

test('Oura and WHOOP sync: provider day, offsets applied, missing values left out', () => {
  assert.deepEqual(
    ouraDays({ data: [{ day: '2026-01-01', score: 80, contributors: { total_sleep: 90 } }] }, { data: [{ day: '2026-01-01', steps: 7000 }] }, { data: [] }),
    [{ logged_date: '2026-01-01', values: { sleep_score: 80, steps: 7000 } }],
  );
  assert.equal(localDateFromIso('2026-01-02T02:00:00.000Z', '-05:00'), '2026-01-01');
  assert.equal(localDateFromIso('2026-01-02T02:00:00.000Z', null), '2026-01-02');
  assert.equal(localDateFromIso('not a date', '-05:00'), null);
  const whoop = whoopDays({ records: [] }, { records: [{ start: '2026-01-02T03:30:00.000Z', timezone_offset: '-05:00', score: { sleep_performance_percentage: 91.4 } }] }, { records: [] });
  assert.deepEqual(whoop, [{ logged_date: '2026-01-01', values: { sleep_score: 91 } }]);
});

test('sync window: last sync minus 2 days, never more than 30 days back', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  assert.equal(syncWindowStart(null, now).toISOString(), '2026-09-08T12:00:00.000Z');
  assert.equal(syncWindowStart('2026-10-07T12:00:00Z', now).toISOString(), '2026-10-05T12:00:00.000Z');
  assert.equal(syncWindowStart('2025-01-01T00:00:00Z', now).toISOString(), '2026-09-08T12:00:00.000Z');
  assert.equal(syncWindowStart('garbage', now).toISOString(), '2026-09-08T12:00:00.000Z');
  assert.equal(syncWindowStart('2026-12-01T00:00:00Z', now).toISOString(), now.toISOString());
  assert.deepEqual(splitRange(0, 250, 100), [[0, 100], [100, 200], [200, 250]]);
  assert.deepEqual(splitRange(10, 10, 100), []);
});

// WHOOP adds a day's steps and calories up from its workouts and syncs in
// replace mode, so a day fetched in part would overwrite the full value.
const whoopWorkout = (start: string, distance_meter: number, kilojoule: number) => ({
  start, timezone_offset: '-05:00', score: { distance_meter, kilojoule },
});
/** What WHOOP returns for a fetch from `from`: workouts that started at or after it. */
const whoopSince = (records: ReturnType<typeof whoopWorkout>[], from: Date) => ({
  records: records.filter((r) => Date.parse(r.start) >= from.getTime()),
});

test('WHOOP: every workout of a day adds to its steps and active calories', () => {
  const days = whoopDays({ records: [] }, { records: [] }, {
    records: [whoopWorkout('2026-10-05T12:00:00.000Z', 5000, 1000), whoopWorkout('2026-10-05T23:00:00.000Z', 1000, 500)],
  });
  // 1000 kJ = 239 kcal, 500 kJ = 120 kcal: before, the day kept one workout's 120.
  assert.deepEqual(days, [{ logged_date: '2026-10-05', values: { active_calories: 359, steps: 7874 } }]);
});

test('WHOOP sync: the first day of the window is fetched whole, so a later sync never shrinks it', async () => {
  const { db, client } = fake();
  const workouts = [whoopWorkout('2026-10-05T12:00:00.000Z', 5000, 1000), whoopWorkout('2026-10-05T23:00:00.000Z', 1000, 500)];
  const sync = async (lastSyncedAt: string | null, now: string) => {
    const { fetchFrom, firstDay } = wholeDaySyncWindow(syncWindowStart(lastSyncedAt, new Date(now)));
    const rows = daysFrom(whoopDays({ records: [] }, { records: [] }, whoopSince(workouts, fetchFrom)), firstDay);
    return importDailyMetrics(client, { userId: USER, source: 'whoop', rows, mode: 'replace' });
  };
  await sync(null, '2026-10-06T12:00:00Z');
  assert.equal(db.rows('user_health_metrics')[0].steps, 7874);

  // The window starts 2026-10-05T18:00Z, after the morning workout. The old
  // fetch began there and replaced 7874 steps with the evening's 1312.
  const exact = syncWindowStart('2026-10-07T18:00:00Z', new Date('2026-10-08T12:00:00Z'));
  assert.equal(exact.toISOString(), '2026-10-05T18:00:00.000Z');
  const partial = whoopDays({ records: [] }, { records: [] }, whoopSince(workouts, exact));
  assert.equal(partial[0].values.steps, 1312, 'what the old window fetched');

  const second = await sync('2026-10-07T18:00:00Z', '2026-10-08T12:00:00Z');
  assert.equal(second.counts.replaced, 0);
  const stored = db.rows('user_health_metrics');
  assert.equal(stored.length, 1);
  assert.deepEqual([stored[0].steps, stored[0].active_calories], [7874, 359]);
});

test('WHOOP sync window: a day early from midnight UTC; days before the window\'s UTC day are left out', () => {
  const { fetchFrom, firstDay } = wholeDaySyncWindow(new Date('2026-10-05T18:00:00Z'));
  assert.equal(fetchFrom.toISOString(), '2026-10-04T00:00:00.000Z');
  assert.equal(firstDay, '2026-10-05');
  // East of UTC (+09:00) local 2026-10-04 began 2026-10-03T15:00Z, before the
  // fetch: written, it would be a part-day sum.
  const days = whoopDays({ records: [] }, { records: [] }, {
    records: [
      { start: '2026-10-04T01:00:00.000Z', timezone_offset: '+09:00', score: { distance_meter: 762 } },
      { start: '2026-10-04T16:00:00.000Z', timezone_offset: '+09:00', score: { distance_meter: 762 } },
    ],
  });
  assert.deepEqual(days.map((d) => d.logged_date), ['2026-10-04', '2026-10-05']);
  assert.deepEqual(daysFrom(days, firstDay).map((d) => d.logged_date), ['2026-10-05']);
  // At +14:00, local 2026-10-05 begins 2026-10-04T10:00Z: inside the fetch.
  assert.ok(Date.parse('2026-10-04T10:00:00Z') >= fetchFrom.getTime());
});

test('WHOOP pages: every page is read; one past the limit throws instead of writing part of a day', async () => {
  const tokens: Array<string | null> = [];
  const pages: Record<string, { records: unknown[]; next_token?: string }> = {
    first: { records: [{ id: 1 }, { id: 2 }], next_token: 'b' },
    b: { records: [{ id: 3 }], next_token: '' },
  };
  const all = await readAllWhoopPages(async (token) => {
    tokens.push(token);
    return pages[token ?? 'first'];
  });
  assert.deepEqual(all.records.map((r) => r.id), [1, 2, 3]);
  assert.deepEqual(tokens, [null, 'b']);
  let calls = 0;
  await assert.rejects(readAllWhoopPages(async () => ({ records: [{ id: calls++ }], next_token: 'more' })), /more than 40 pages/);
  assert.equal(calls, WHOOP_MAX_PAGES);
});

// ─── Read-only duplicate report ──────────────────────────────────────────────

test('report: Garmin trips with one start time, including renamed ones, oldest first', () => {
  const trip = (id: string, created_at: string, garmin_activity_id: string | null, extra: Partial<ReportTrip> = {}): ReportTrip => ({
    id, user_id: USER, date: '2025-06-08', mode: 'bike', distance_miles: 12.5, duration_min: 45,
    source: garmin_activity_id ? 'garmin_import' : 'manual', garmin_activity_id, created_at, ...extra,
  });
  const groups = sameStartTrips([
    trip('b', '2025-07-02', '2025-06-08 17:20:53|Renamed'),
    trip('a', '2025-07-01', '2025-06-08 17:20:53|Morning Ride'),
    trip('c', '2025-07-03', null, { external_id: 'garmin:start:2025-06-08 17:20:53', source: 'garmin_import' }),
    trip('d', '2025-07-01', '2025-06-09 07:00:00|Commute'),
    trip('e', '2025-07-01', '2025-06-08 17:20:53|Morning Ride', { user_id: OTHER_USER }),
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].trip_ids, ['a', 'b', 'c']);
  assert.equal(groups[0].renamed, true);
});

test('report: Garmin trips paired with trips logged another way', () => {
  const pairs = garminVsOtherTrips([
    { id: 'g', user_id: USER, date: '2025-06-10', mode: 'walk', distance_miles: 1, duration_min: 20, source: 'garmin_import', garmin_activity_id: '2025-06-10 12:00:00|Walk' },
    { id: 'm', user_id: USER, date: '2025-06-10', mode: 'walk', distance_miles: 1.03, duration_min: null, source: 'manual', garmin_activity_id: null },
    { id: 'x', user_id: OTHER_USER, date: '2025-06-10', mode: 'walk', distance_miles: 1, duration_min: 20, source: 'manual', garmin_activity_id: null },
    { id: 'far', user_id: USER, date: '2025-06-10', mode: 'walk', distance_miles: 3, duration_min: 60, source: 'csv_import', garmin_activity_id: null },
  ]);
  assert.deepEqual(pairs.map((p) => [p.garmin_trip_id, p.other_trip_id]), [['g', 'm']]);
});

test('report: round trips, route legs and trips with no values pair up like the import', () => {
  const garmin = (id: string, date: string, mode: string, distance_miles: number, duration_min: number): ReportTrip => ({
    id, user_id: USER, date, mode, distance_miles, duration_min, source: 'garmin_import', garmin_activity_id: `${date} 07:00:00|${id}`,
  });
  const other = (id: string, extra: Partial<ReportTrip>): ReportTrip => ({
    id, user_id: USER, date: '2026-10-01', mode: 'bike', distance_miles: null, duration_min: null, source: 'manual', garmin_activity_id: null, ...extra,
  });
  const pairs = garminVsOtherTrips([
    garmin('g1', '2026-10-01', 'bike', 10, 60),
    other('rt', { distance_miles: 5, duration_min: 30, is_round_trip: true }),
    garmin('g2', '2026-10-02', 'walk', 3, 50),
    other('leg1', { date: '2026-10-02', mode: 'walk', distance_miles: 1.2, duration_min: 20, route_id: 'r', leg_order: 0 }),
    other('leg2', { date: '2026-10-02', mode: 'walk', distance_miles: 1.8, duration_min: 30, route_id: 'r', leg_order: 1 }),
    garmin('g3', '2026-10-03', 'run', 4, 40),
    other('blank', { date: '2026-10-03', mode: 'run' }),
    garmin('g4', '2026-10-04', 'bike', 5, 30),
    other('utc', { date: '2026-10-05', distance_miles: 5, duration_min: 30 }),
  ]);
  assert.deepEqual(pairs.map((p) => [p.garmin_trip_id, p.other_trip_id, p.basis, p.other_date]), [
    ['g1', 'rt', 'round_trip', '2026-10-01'],
    ['g2', 'leg1', 'route_total', '2026-10-02'],
    ['g3', 'blank', 'no_values', '2026-10-03'],
    ['g4', 'utc', 'as_logged', '2026-10-05'],
  ]);
});

test('report: workouts with one name on one day; same start = certain', () => {
  const groups = sameNameSameDayWorkouts([
    { id: '1', user_id: USER, name: 'Leg Day', date: '2026-01-01', started_at: '2026-01-01T12:00:00Z', duration_min: 60, created_at: '1' },
    { id: '2', user_id: USER, name: 'leg day ', date: '2026-01-01', started_at: '2026-01-01T12:00:00+00:00', duration_min: 60, created_at: '2' },
    { id: '3', user_id: USER, name: 'Walk', date: '2026-01-01', started_at: '2026-01-01T07:00:00Z', duration_min: 20, created_at: '1' },
    { id: '4', user_id: USER, name: 'Walk', date: '2026-01-01', started_at: '2026-01-01T19:00:00Z', duration_min: 20, created_at: '2' },
    { id: '5', user_id: USER, name: 'Run', date: '2026-01-01', started_at: null, duration_min: 20000, created_at: '1' },
  ]);
  assert.deepEqual(groups.map((g) => [g.name, g.log_ids, g.same_start]), [['leg day', ['1', '2'], true], ['walk', ['3', '4'], false]]);
  assert.deepEqual(implausibleWorkoutDurations([
    { id: '5', user_id: USER, name: 'Run', date: '2026-01-01', started_at: null, duration_min: 20000 },
    { id: '6', user_id: USER, name: 'Run', date: '2026-01-01', started_at: null, duration_min: 90 },
  ]).map((w) => w.id), ['5']);
});

test('report: manual days that copy a device row', () => {
  const copies = manualCopiesOfDevice([
    { id: 'm1', user_id: USER, logged_date: '2026-01-01', source: 'manual', steps: 9000, resting_hr: 58 },
    { id: 'g1', user_id: USER, logged_date: '2026-01-01', source: 'garmin', steps: 9000, resting_hr: 58 },
    { id: 'm2', user_id: USER, logged_date: '2026-01-02', source: 'manual', steps: 9000 },
    { id: 'g2', user_id: USER, logged_date: '2026-01-02', source: 'garmin', steps: 9000 },
    { id: 'm3', user_id: USER, logged_date: '2026-01-03', source: 'manual', steps: 9000, resting_hr: 58 },
    { id: 'g3', user_id: USER, logged_date: '2026-01-03', source: 'garmin', steps: 9001, resting_hr: 58 },
  ]);
  assert.deepEqual(copies.map((c) => [c.manual_row_id, c.device_row_id]), [['m1', 'g1']]);
});
