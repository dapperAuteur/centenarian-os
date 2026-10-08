#!/usr/bin/env node
// scripts/import-garmin-workouts.mjs
// Import Garmin activities (full account export, summarizedActivities JSON) into workout_logs.
//
// Usage:
//   node --experimental-strip-types --env-file=.env.local scripts/import-garmin-workouts.mjs [--dry-run]
//        [--include-possible-matches] [--dir <DI-Connect-Fitness folder>]
//
// Needs migration 224 (workout_logs.external_id + its unique index). Safe to re-run:
//   - each activity's identity is its local start time, `garmin:start:<YYYY-MM-DD HH:MM:SS>`
//     (the key Garmin trips use too), stored in external_id and written with
//     ON CONFLICT (user_id, external_id) DO NOTHING;
//   - an activity listed twice in the export (Garmin can upload one recording twice) counts once;
//   - rows this script wrote before external_id existed are recognised by started_at (the same
//     instant), so they are not added again;
//   - a workout you logged yourself with the same name on the same local day is a possible
//     match and is skipped unless --include-possible-matches;
//   - existing rows are read page by page (the old check stopped at the 1000-row cap).
//
// Units in the export (checked against one): duration in milliseconds, distance and elevation in
// centimetres. The old version read them as seconds and metres, so its duration_min and the
// distance in its notes were too large; scripts/report-fitness-duplicates.mjs lists those rows.
// The `calories` unit was not confirmed and is kept as exported.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { garminStartKey, localStartFromWallClockMs } from '../lib/fitness-import/activity-keys.ts';
import { chunk, readAllRows } from '../lib/fitness-import/db.ts';
import { workoutIdentity } from '../lib/fitness-import/workouts.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bam@awews.com';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const INCLUDE_POSSIBLE_MATCHES = args.includes('--include-possible-matches');
const dirFlag = args.indexOf('--dir');
const FITNESS_DIR = dirFlag !== -1 && args[dirFlag + 1]
  ? args[dirFlag + 1]
  : join(process.cwd(), 'docs/garmin-data/body/garmin-data-2026-02-24/DI_CONNECT/DI-Connect-Fitness');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE env vars. Run with: node --experimental-strip-types --env-file=.env.local scripts/import-garmin-workouts.mjs');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function parseActivities(fitnessDir) {
  const activities = [];
  const offsets = [0, 1001, 2002, 3003];

  for (const offset of offsets) {
    const path = join(fitnessDir, `fitness@awews.com_${offset}_summarizedActivities.json`);
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8'));
      for (const item of raw) {
        if (item.summarizedActivitiesExport) {
          activities.push(...item.summarizedActivitiesExport);
        } else if (item.activityId) {
          activities.push(item);
        }
      }
    } catch (err) {
      console.log(`  Skipped ${offset}: ${err.message}`);
    }
  }

  return activities;
}

/** The local start of an export activity, "YYYY-MM-DD HH:MM:SS". */
function localStart(act) {
  if (typeof act.startTimeLocal === 'number') return localStartFromWallClockMs(act.startTimeLocal);
  return null;
}

function buildPayload(userId, act) {
  const start = localStart(act);
  const key = garminStartKey(start);
  if (!key || !act.name || typeof act.beginTimestamp !== 'number') return null;

  const durationMs = typeof act.duration === 'number' && act.duration > 0 ? act.duration : null;
  const noteParts = [];
  if (act.activityType) noteParts.push(`Type: ${act.activityType}`);
  if (act.distance > 0) noteParts.push(`Distance: ${Math.round((act.distance / 160934.4) * 100) / 100} mi`);
  if (act.avgHr > 0) noteParts.push(`Avg HR: ${Math.round(act.avgHr)} bpm`);
  if (act.maxHr > 0) noteParts.push(`Max HR: ${Math.round(act.maxHr)} bpm`);
  if (act.calories > 0) noteParts.push(`Calories: ${Math.round(act.calories)}`);
  if (act.elevationGain > 0) noteParts.push(`Elevation: +${Math.round((act.elevationGain / 100) * 3.28084)} ft`);
  if (act.locationName) noteParts.push(`Location: ${act.locationName}`);
  if (act.activityId) noteParts.push(`Garmin activity ${act.activityId}`);

  return {
    user_id: userId,
    name: act.name,
    date: start.slice(0, 10),
    started_at: new Date(act.beginTimestamp).toISOString(),
    finished_at: durationMs ? new Date(act.beginTimestamp + durationMs).toISOString() : null,
    duration_min: durationMs ? Math.round(durationMs / 60000) : null,
    notes: noteParts.join(' | ') || null,
    external_id: key,
  };
}

async function main() {
  const { data: userData, error: userErr } = await db.auth.admin.listUsers();
  if (userErr) { console.error('Failed to list users:', userErr.message); process.exit(1); }

  const adminUser = userData.users.find(u => u.email === ADMIN_EMAIL);
  if (!adminUser) { console.error(`User ${ADMIN_EMAIL} not found`); process.exit(1); }

  const userId = adminUser.id;
  console.log(`Target user: ${ADMIN_EMAIL}${DRY_RUN ? ' (dry run: nothing is written)' : ''}\n`);

  // Migration 224 must be there: external_id is the duplicate guard.
  const probe = await db.from('workout_logs').select('external_id').limit(1);
  if (probe.error) {
    console.error(`workout_logs.external_id is not available (${probe.error.message}). Apply supabase/migrations/224_fitness_import_identity.sql first.`);
    process.exit(1);
  }

  console.log('Parsing Garmin activities...');
  const activities = parseActivities(FITNESS_DIR);
  console.log(`  Found ${activities.length} activities\n`);

  const payloads = [];
  const seen = new Set();
  let repeatedInExport = 0;
  let unreadable = 0;
  for (const act of activities) {
    const payload = buildPayload(userId, act);
    if (!payload) { unreadable++; continue; }
    if (seen.has(payload.external_id)) { repeatedInExport++; continue; }
    seen.add(payload.external_id);
    payloads.push(payload);
  }
  payloads.sort((a, b) => a.external_id.localeCompare(b.external_id));
  console.log(`Prepared ${payloads.length} workout logs (${repeatedInExport} listed twice in the export, ${unreadable} unreadable)`);
  if (payloads.length === 0) return;

  const from = payloads[0].date;
  const to = payloads[payloads.length - 1].date;
  console.log(`Date range: ${from} → ${to}`);

  // Existing logs in the range (a day wider: rows from the old version carry the UTC date), every page.
  const shift = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  const existing = await readAllRows('read existing workout logs', (start, end) =>
    db.from('workout_logs')
      .select('id, name, date, started_at, external_id')
      .eq('user_id', userId)
      .gte('date', shift(from, -1))
      .lte('date', shift(to, 1))
      .order('id', { ascending: true })
      .range(start, end),
  );
  const knownKeys = new Set(existing.map((row) => row.external_id).filter(Boolean));
  const knownStarts = new Set(existing.map((row) => (row.started_at ? Date.parse(row.started_at) : NaN)).filter((t) => !Number.isNaN(t)));
  // Checked after the two above, so an old row of this script never counts as hand-logged.
  const handLogged = new Set(existing.filter((row) => !row.external_id).map((row) => workoutIdentity(row.name, row.date)));

  const counts = { new: 0, already: 0, possible: 0 };
  const toInsert = [];
  for (const payload of payloads) {
    if (knownKeys.has(payload.external_id) || knownStarts.has(Date.parse(payload.started_at))) {
      counts.already++;
      continue;
    }
    if (handLogged.has(workoutIdentity(payload.name, payload.date))) {
      counts.possible++;
      if (!INCLUDE_POSSIBLE_MATCHES) continue;
    } else {
      counts.new++;
    }
    toInsert.push(payload);
  }
  console.log(`  ${counts.new} new · ${counts.already} already imported · ${counts.possible} possible matches with workouts you logged${INCLUDE_POSSIBLE_MATCHES ? ' (imported anyway)' : ' (skipped)'}`);

  if (DRY_RUN || toInsert.length === 0) {
    console.log(DRY_RUN ? '\nDry run: nothing written.' : '\nNothing new to import.');
    return;
  }

  let total = 0;
  let failed = 0;
  for (const [index, batch] of chunk(toInsert, 200).entries()) {
    const { data, error } = await db
      .from('workout_logs')
      .upsert(batch, { onConflict: 'user_id,external_id', ignoreDuplicates: true })
      .select('id');
    if (error) {
      failed += batch.length;
      console.error(`Batch ${index + 1} failed: ${error.message}`);
    } else {
      total += data.length;
      console.log(`  Batch ${index + 1}: ${data.length} rows inserted`);
    }
  }

  console.log(`\nDone. ${total} workout logs imported from Garmin${failed > 0 ? `, ${failed} not written (see errors above)` : ''}.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error('Fatal error:', err.message ?? err);
  process.exit(1);
});
