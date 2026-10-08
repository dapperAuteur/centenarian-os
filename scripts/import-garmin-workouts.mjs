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
// Every *_summarizedActivities.json file in --dir is read. The numbers in those file names change
// between exports (0/1001/2002/3003 in one, 1/301/.../3601 in the 2026-10-07 one), and the old
// fixed list found none of the newer export's files.
//
// Units in the export (checked against the 2026-10-07 export): duration in milliseconds, distance
// and elevation in centimetres. The old version read them as seconds and metres, so its
// duration_min and the distance in its notes were too large; scripts/report-fitness-duplicates.mjs
// lists those rows. The `calories` unit was not confirmed and is kept as exported. The rules live
// in lib/fitness-import/garmin-export.ts (tested in tests/unit/fitness-dedupe.test.ts).

import { createClient } from '@supabase/supabase-js';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { chunk, readAllRows } from '../lib/fitness-import/db.ts';
import {
  activitiesFromExport,
  exportWorkoutRow,
  planExportWorkouts,
  summarizedActivityFiles,
} from '../lib/fitness-import/garmin-export.ts';

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

/** Every activity in every *_summarizedActivities.json file of the folder (the file numbers vary by export). */
function parseActivities(fitnessDir) {
  let names;
  try {
    names = readdirSync(fitnessDir);
  } catch (err) {
    console.error(`Cannot read ${fitnessDir}: ${err.message}. Pass --dir <DI_CONNECT/DI-Connect-Fitness folder of your export>.`);
    process.exit(1);
  }
  const files = summarizedActivityFiles(names);
  if (files.length === 0) {
    console.error(`No *_summarizedActivities.json files in ${fitnessDir}. Pass --dir <DI_CONNECT/DI-Connect-Fitness folder of your export>.`);
    process.exit(1);
  }
  const activities = [];
  for (const file of files) {
    try {
      const found = activitiesFromExport(JSON.parse(readFileSync(join(fitnessDir, file), 'utf8')));
      activities.push(...found);
      console.log(`  ${file}: ${found.length} activities`);
    } catch (err) {
      console.error(`  Could not read ${file}: ${err.message}`);
      process.exitCode = 1;
    }
  }
  return activities;
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

  const rows = [];
  let unreadable = 0;
  for (const act of activities) {
    const row = exportWorkoutRow(userId, act);
    if (row) rows.push(row);
    else unreadable++;
  }
  if (rows.length === 0) {
    console.log(`Nothing to import (${unreadable} unreadable activities).`);
    return;
  }

  const dates = rows.map((row) => row.date).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];
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

  const { toInsert, counts } = planExportWorkouts(rows, existing, INCLUDE_POSSIBLE_MATCHES);
  console.log(`  ${counts.new} new · ${counts.already} already imported · ${counts.repeated_in_export} listed twice in the export · ${unreadable} unreadable · ${counts.possible} possible matches with workouts you logged${INCLUDE_POSSIBLE_MATCHES ? ' (imported anyway)' : ' (skipped)'}`);

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
