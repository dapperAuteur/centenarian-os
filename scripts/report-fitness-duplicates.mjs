#!/usr/bin/env node
// scripts/report-fitness-duplicates.mjs
// READ-ONLY report of fitness and wearable records that were brought in more than once.
// It runs SELECTs only and prints counts and row ids. Nothing is changed or deleted; any
// clean-up goes through a screen where each merge or delete is confirmed.
//
// Usage:
//   node --experimental-strip-types --env-file=.env.local scripts/report-fitness-duplicates.mjs
//        [--email <account email>] [--json]
//
// Checks (the same ones, as SQL for the Supabase SQL editor:
// supabase/sql-snippets/find-fitness-duplicates.sql):
//   1. user_health_metrics has the `source` column from migration 080 (run the SQL file's first
//      query to see the unique key itself; PostgREST cannot read pg_constraint).
//   2. Garmin trips with the same start time: imported twice, or renamed in Garmin Connect
//      between imports.
//   3. Garmin trips that look like a trip logged another way, by the import's rule: same mode,
//      distance within max(0.1 mi, 5%) or duration within 5 min (a round trip compared both
//      ways, a multi-stop route's legs added up), a same-day trip with no distance or time, or
//      a close one a day either side (a template logged with the UTC date).
//   4. Workout logs with the same name on the same day (same started_at = certain duplicate).
//   5. Workout logs over 24 hours long (the old Garmin workout script's unit bug).
//   6. Manual daily metrics identical to a device row that day (informational).
//
// The trips table is shared with Work.WitUS; its Garmin import writes the same rows, so they
// show up here too. Rows are read page by page, past PostgREST's row cap.

import { createClient } from '@supabase/supabase-js';
import { isMissingColumn, readAllRows } from '../lib/fitness-import/db.ts';
import { DAILY_METRIC_FIELDS } from '../lib/fitness-import/daily-metrics.ts';
import {
  garminVsOtherTrips,
  implausibleWorkoutDurations,
  manualCopiesOfDevice,
  sameNameSameDayWorkouts,
  sameStartTrips,
} from '../lib/fitness-import/duplicate-report.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE env vars. Run with: node --experimental-strip-types --env-file=.env.local scripts/report-fitness-duplicates.mjs');
  process.exit(1);
}

const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const emailFlag = args.indexOf('--email');
const EMAIL = emailFlag !== -1 ? args[emailFlag + 1] : null;

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

/** Every row of a table (optionally for one user), page by page, in id order. */
function readTable(table, columns, userId) {
  return readAllRows(`read ${table}`, (from, to) => {
    let query = db.from(table).select(columns);
    if (userId) query = query.eq('user_id', userId);
    return query.order('id', { ascending: true }).range(from, to);
  });
}

async function hasColumn(table, column) {
  const { error } = await db.from(table).select(column).limit(1);
  if (!error) return true;
  if (isMissingColumn(error, column)) return false;
  throw new Error(`Could not read ${table}: ${error.message}`);
}

async function resolveUser() {
  if (!EMAIL) return null;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    const found = data.users.find((u) => u.email === EMAIL);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  throw new Error(`No account with the email ${EMAIL}`);
}

async function main() {
  const userId = await resolveUser();
  const scope = userId ? `one account (${EMAIL})` : 'all accounts';

  const has080 = await hasColumn('user_health_metrics', 'source');
  const has224Trips = await hasColumn('trips', 'external_id');
  const has224Logs = await hasColumn('workout_logs', 'external_id');

  const trips = await readTable(
    'trips',
    `id, user_id, date, mode, distance_miles, duration_min, source, garmin_activity_id, is_round_trip, route_id, leg_order, created_at${has224Trips ? ', external_id' : ''}`,
    userId,
  );
  const roundTripRouteIds = new Set(
    (await readTable('trip_routes', 'id, is_round_trip', userId)).filter((route) => route.is_round_trip === true).map((route) => route.id),
  );
  const logs = await readTable(
    'workout_logs',
    `id, user_id, name, date, started_at, duration_min, created_at${has224Logs ? ', external_id' : ''}`,
    userId,
  );
  const health = has080
    ? await readTable('user_health_metrics', `id, user_id, logged_date, source, ${DAILY_METRIC_FIELDS.join(', ')}`, userId)
    : [];

  const report = {
    scope,
    migrations: { '080_health_metrics_source': has080, '224_fitness_import_identity': has224Trips && has224Logs },
    rows_read: { trips: trips.length, workout_logs: logs.length, user_health_metrics: health.length },
    garmin_trips_same_start: sameStartTrips(trips),
    garmin_trips_like_other_trips: garminVsOtherTrips(trips, roundTripRouteIds),
    workouts_same_name_same_day: sameNameSameDayWorkouts(logs),
    workouts_over_24_hours: implausibleWorkoutDurations(logs).map((log) => ({ id: log.id, user_id: log.user_id, date: log.date, duration_min: log.duration_min })),
    manual_days_copying_a_device: manualCopiesOfDevice(health),
  };

  if (AS_JSON) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const extra = (group) => group.length - 1;
  const sameStart = report.garmin_trips_same_start;
  const workouts = report.workouts_same_name_same_day;
  console.log(`Fitness duplicate report (read-only) for ${scope}`);
  console.log(`Read ${trips.length} trips, ${logs.length} workout logs, ${health.length} daily metric rows.\n`);
  console.log(`Migration 080 (health metrics source): ${has080 ? 'applied' : 'NOT applied'}`);
  console.log(`Migration 224 (external_id): ${report.migrations['224_fitness_import_identity'] ? 'applied' : 'not applied yet'}\n`);

  console.log(`1. Garmin trips with the same start time: ${sameStart.length} groups, ${sameStart.reduce((n, g) => n + g.trip_ids.length - 1, 0)} extra copies (${sameStart.filter((g) => g.renamed).length} renamed between imports)`);
  for (const g of sameStart.slice(0, 50)) {
    console.log(`   ${g.key}  first: ${g.trip_ids[0]}  later copies: ${g.trip_ids.slice(1).join(', ')}${g.renamed ? '  (renamed)' : ''}`);
  }
  console.log(`\n2. Garmin trips that look like a trip logged another way: ${report.garmin_trips_like_other_trips.length} pairs`);
  for (const p of report.garmin_trips_like_other_trips.slice(0, 50)) {
    const how = { as_logged: '', round_trip: '  (round trip, both ways)', route_total: '  (route legs added up)', no_values: '  (no distance or time)' }[p.basis] ?? '';
    console.log(`   ${p.date} ${p.mode}  garmin ${p.garmin_trip_id}  ~  ${p.other_source ?? 'unknown'} ${p.other_trip_id}${p.other_date !== p.date ? ` on ${p.other_date}` : ''}${how}`);
  }
  console.log(`\n3. Workouts with the same name on the same day: ${workouts.length} groups, ${workouts.reduce((n, g) => n + extra(g.log_ids), 0)} extra logs (${workouts.filter((g) => g.same_start).length} with the same start time = certain)`);
  for (const g of workouts.slice(0, 50)) {
    console.log(`   ${g.date} "${g.name}"  ${g.log_ids.join(', ')}${g.same_start ? '  (same start)' : '  (maybe two sessions)'}`);
  }
  console.log(`\n4. Workouts over 24 hours long (old script unit bug): ${report.workouts_over_24_hours.length}`);
  for (const w of report.workouts_over_24_hours.slice(0, 20)) console.log(`   ${w.date}  ${w.id}  ${w.duration_min} min`);
  console.log(`\n5. Manual days identical to a device row (informational): ${report.manual_days_copying_a_device.length}`);
  for (const c of report.manual_days_copying_a_device.slice(0, 20)) {
    console.log(`   ${c.logged_date}  manual ${c.manual_row_id} = ${c.device_source} ${c.device_row_id}`);
  }
  console.log('\nNothing was changed. Use --json for the full lists.');
}

main().catch((err) => {
  console.error('Report failed:', err.message ?? err);
  process.exit(1);
});
