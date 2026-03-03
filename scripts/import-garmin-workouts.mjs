#!/usr/bin/env node
// scripts/import-garmin-workouts.mjs
// Import Garmin activities into workout_logs table
// Usage: node --env-file=.env.local scripts/import-garmin-workouts.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bam@awews.com';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE env vars. Run with: node --env-file=.env.local scripts/import-garmin-workouts.mjs');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Map Garmin activity types to workout categories
const CATEGORY_MAP = {
  running: 'cardio',
  treadmill_running: 'cardio',
  cycling: 'cardio',
  indoor_cycling: 'cardio',
  lap_swimming: 'cardio',
  hiking: 'cardio',
  walking: 'cardio',
  floor_climbing: 'cardio',
  indoor_cardio: 'cardio',
  strength_training: 'strength',
  hiit: 'hiit',
  yoga: 'flexibility',
  pilates: 'flexibility',
  breathwork: 'other',
  golf: 'other',
  other: 'other',
};

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

async function main() {
  // Look up user ID
  const { data: userData, error: userErr } = await db.auth.admin.listUsers();
  if (userErr) { console.error('Failed to list users:', userErr); process.exit(1); }

  const adminUser = userData.users.find(u => u.email === ADMIN_EMAIL);
  if (!adminUser) { console.error(`User ${ADMIN_EMAIL} not found`); process.exit(1); }

  const userId = adminUser.id;
  console.log(`Target user: ${ADMIN_EMAIL} (${userId})\n`);

  const fitnessDir = join(
    process.cwd(),
    'docs/garmin-data/body/garmin-data-2026-02-24/DI_CONNECT/DI-Connect-Fitness',
  );

  console.log('Parsing Garmin activities...');
  const activities = parseActivities(fitnessDir);
  console.log(`  Found ${activities.length} activities\n`);

  // Build workout_logs payloads
  const payloads = [];
  const seen = new Set(); // de-dup by activityId

  for (const act of activities) {
    if (!act.activityId || !act.name || seen.has(act.activityId)) continue;
    seen.add(act.activityId);

    const actType = act.activityType || 'other';
    const category = CATEGORY_MAP[actType] || 'other';

    // Convert beginTimestamp (ms) to date string
    const date = new Date(act.beginTimestamp).toISOString().split('T')[0];
    const startedAt = new Date(act.beginTimestamp).toISOString();

    // Duration in minutes
    const durationMin = act.duration
      ? Math.round(act.duration / 60)
      : null;

    const finishedAt = act.duration
      ? new Date(act.beginTimestamp + act.duration * 1000).toISOString()
      : null;

    // Build notes with key stats
    const noteParts = [];
    if (act.activityType) noteParts.push(`Type: ${act.activityType}`);
    if (act.distance > 0) {
      const miles = Math.round(act.distance / 1609.34 * 100) / 100;
      noteParts.push(`Distance: ${miles} mi`);
    }
    if (act.avgHr > 0) noteParts.push(`Avg HR: ${Math.round(act.avgHr)} bpm`);
    if (act.maxHr > 0) noteParts.push(`Max HR: ${Math.round(act.maxHr)} bpm`);
    if (act.calories > 0) noteParts.push(`Calories: ${Math.round(act.calories)}`);
    if (act.elevationGain > 0) {
      noteParts.push(`Elevation: +${Math.round(act.elevationGain * 3.28084)} ft`);
    }
    if (act.locationName) noteParts.push(`Location: ${act.locationName}`);

    payloads.push({
      user_id: userId,
      name: act.name,
      date,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_min: durationMin,
      notes: noteParts.join(' | ') || null,
    });
  }

  // Sort by date
  payloads.sort((a, b) => a.date.localeCompare(b.date));

  console.log(`Prepared ${payloads.length} workout logs`);
  if (payloads.length) {
    console.log(`Date range: ${payloads[0].date} → ${payloads[payloads.length - 1].date}`);
  }

  // Preview
  console.log('\nSample rows:');
  for (const p of payloads.slice(-3)) {
    const { user_id, ...rest } = p;
    console.log(`  ${JSON.stringify(rest)}`);
  }

  // Check for existing workout logs to avoid duplicates
  const { count: existingCount } = await db
    .from('workout_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (existingCount > 0) {
    console.log(`\nNote: User already has ${existingCount} workout logs. Inserting only new ones (matching on name+date).`);

    // Fetch existing name+date combos
    const { data: existing } = await db
      .from('workout_logs')
      .select('name, date')
      .eq('user_id', userId);

    const existingKeys = new Set((existing || []).map(e => `${e.name}|${e.date}`));
    const newPayloads = payloads.filter(p => !existingKeys.has(`${p.name}|${p.date}`));
    console.log(`  ${payloads.length - newPayloads.length} duplicates skipped, ${newPayloads.length} new to insert`);

    if (newPayloads.length === 0) {
      console.log('\nNothing new to import. Done!');
      return;
    }

    payloads.length = 0;
    payloads.push(...newPayloads);
  }

  // Insert in batches
  const BATCH = 200;
  let total = 0;
  for (let i = 0; i < payloads.length; i += BATCH) {
    const batch = payloads.slice(i, i + BATCH);
    const { data, error } = await db
      .from('workout_logs')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} failed:`, error.message);
    } else {
      total += data.length;
      console.log(`  Batch ${Math.floor(i / BATCH) + 1}: ${data.length} rows inserted`);
    }
  }

  console.log(`\nDone! ${total} workout logs imported from Garmin.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
