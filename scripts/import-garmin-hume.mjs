#!/usr/bin/env node
// scripts/import-garmin-hume.mjs
// One-time script to import Garmin export data + Hume Health CSV into user_health_metrics
// Usage: node --env-file=.env.local scripts/import-garmin-hume.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bam@awews.com';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE env vars. Run with: node --env-file=.env.local scripts/import-garmin-hume.mjs');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// --- Helpers ---

function toDateStr(ts) {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  return d.toISOString().split('T')[0];
}

function kgToLbs(grams) {
  return Math.round((grams / 453.592) * 100) / 100;
}

function mergeDayMetric(dayMap, date, metrics) {
  if (!dayMap.has(date)) dayMap.set(date, {});
  const existing = dayMap.get(date);
  for (const [k, v] of Object.entries(metrics)) {
    if (v != null && existing[k] == null) {
      existing[k] = v;
    }
  }
}

// Simple CSV parser for quoted fields
function parseCsv(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

// --- Garmin Sleep Parser ---

function parseGarminSleep(wellnessDir) {
  const dayMap = new Map();
  const sleepFiles = readdirSync(wellnessDir).filter(f => f.includes('sleepData.json'));

  for (const file of sleepFiles) {
    const data = JSON.parse(readFileSync(join(wellnessDir, file), 'utf8'));
    for (const entry of data) {
      const date = entry.calendarDate;
      if (!date) continue;

      const metrics = {};

      // Sleep duration (exclude awake time)
      const totalSleepSec =
        (entry.deepSleepSeconds || 0) +
        (entry.lightSleepSeconds || 0) +
        (entry.remSleepSeconds || 0);
      if (totalSleepSec > 0) {
        metrics.sleep_hours = Math.round((totalSleepSec / 3600) * 10) / 10;
      }

      // Sleep score
      if (entry.sleepScores?.overallScore != null) {
        metrics.sleep_score = entry.sleepScores.overallScore;
      }

      // SpO2 from sleep
      if (entry.spo2SleepSummary?.averageSPO2 != null) {
        metrics.spo2_pct = Math.round(entry.spo2SleepSummary.averageSPO2 * 100) / 100;
      }

      // Resting HR from sleep summary
      if (entry.spo2SleepSummary?.averageHR != null) {
        metrics.resting_hr = Math.round(entry.spo2SleepSummary.averageHR);
      }

      mergeDayMetric(dayMap, date, metrics);
    }
  }

  console.log(`  Garmin sleep: ${dayMap.size} days parsed`);
  return dayMap;
}

// --- Garmin Activity Parser (UDS = User Daily Summary) ---

function parseGarminActivity(aggregatorDir) {
  const dayMap = new Map();
  const udsFiles = readdirSync(aggregatorDir).filter(f => f.startsWith('UDSFile_'));

  for (const file of udsFiles) {
    const data = JSON.parse(readFileSync(join(aggregatorDir, file), 'utf8'));
    for (const entry of data) {
      const date = entry.calendarDate;
      if (!date) continue;

      const metrics = {};

      if (entry.totalSteps > 0) metrics.steps = entry.totalSteps;
      if (entry.activeKilocalories > 0) {
        metrics.active_calories = Math.round(entry.activeKilocalories);
      }

      // Activity minutes = moderate + vigorous intensity
      const mod = entry.moderateIntensityMinutes || 0;
      const vig = entry.vigorousIntensityMinutes || 0;
      if (mod + vig > 0) metrics.activity_min = mod + vig;

      // Resting HR from daily summary (may complement sleep-derived RHR)
      if (entry.restingHeartRate > 0) metrics.resting_hr = entry.restingHeartRate;

      // Stress score (if available on this device)
      if (entry.averageStressLevel != null && entry.averageStressLevel > 0) {
        metrics.stress_score = Math.round(entry.averageStressLevel);
      }

      if (Object.keys(metrics).length > 0) {
        mergeDayMetric(dayMap, date, metrics);
      }
    }
  }

  console.log(`  Garmin activity: ${dayMap.size} days parsed from ${udsFiles.length} UDS files`);
  return dayMap;
}

// --- Garmin Weight Parser ---

function parseGarminWeight(wellnessDir) {
  const dayMap = new Map();
  const bioFile = join(wellnessDir, '89828466_userBioMetrics.json');

  try {
    const data = JSON.parse(readFileSync(bioFile, 'utf8'));
    const weightEntries = data.filter(d => d.weight?.weight != null);

    // Group by date, keep latest per day
    const byDate = new Map();
    for (const entry of weightEntries) {
      const date = entry.weight.timestampGMT
        ? toDateStr(entry.weight.timestampGMT)
        : toDateStr(entry.metaData.calendarDate);
      if (!byDate.has(date) || entry.version > byDate.get(date).version) {
        byDate.set(date, entry);
      }
    }

    for (const [date, entry] of byDate) {
      // Garmin stores weight in grams
      mergeDayMetric(dayMap, date, {
        weight_lbs: kgToLbs(entry.weight.weight),
      });
    }

    console.log(`  Garmin weight: ${byDate.size} days parsed`);
  } catch (err) {
    console.log(`  Garmin weight: skipped (${err.message})`);
  }

  return dayMap;
}

// --- Hume Health CSV Parser ---

function parseHumeHealth(csvPath) {
  const dayMap = new Map();
  const raw = readFileSync(csvPath, 'utf8');
  const records = parseCsv(raw);

  // Group by date, keep latest per day
  const byDate = new Map();
  for (const row of records) {
    const date = toDateStr(row.time);
    if (!byDate.has(date) || new Date(row.time) > new Date(byDate.get(date).time)) {
      byDate.set(date, row);
    }
  }

  for (const [date, row] of byDate) {
    const metrics = {};

    // Weight: Hume Health reports in kg, convert to lbs
    if (row.weight) {
      metrics.weight_lbs = Math.round(parseFloat(row.weight) * 2.20462 * 100) / 100;
    }
    if (row.bmi) metrics.bmi = parseFloat(row.bmi);
    if (row.fatRate) metrics.body_fat_pct = parseFloat(row.fatRate);
    // Hume Health "muscleMass" is lean soft tissue mass (FFM minus bone), not skeletal
    // muscle mass. Apply 0.60 factor to estimate skeletal muscle mass, then convert kg→lbs.
    if (row.muscleMass) {
      const leanSoftTissueKg = parseFloat(row.muscleMass);
      const estimatedSmmKg = leanSoftTissueKg * 0.60;
      metrics.muscle_mass_lbs = Math.round(estimatedSmmKg * 2.20462 * 100) / 100;
    }

    mergeDayMetric(dayMap, date, metrics);
  }

  console.log(`  Hume Health: ${dayMap.size} days parsed`);
  return dayMap;
}

// --- Main ---

async function main() {
  // Look up user ID
  const { data: userData, error: userErr } = await db.auth.admin.listUsers();
  if (userErr) { console.error('Failed to list users:', userErr); process.exit(1); }

  const adminUser = userData.users.find(u => u.email === ADMIN_EMAIL);
  if (!adminUser) { console.error(`User ${ADMIN_EMAIL} not found`); process.exit(1); }

  const userId = adminUser.id;
  console.log(`Target user: ${ADMIN_EMAIL} (${userId})\n`);

  const BASE = 'docs/garmin-data/body/garmin-data-2026-02-24/DI_CONNECT';
  const wellnessDir = join(process.cwd(), BASE, 'DI-Connect-Wellness');
  const aggregatorDir = join(process.cwd(), BASE, 'DI-Connect-Aggregator');
  const humeCsv = join(process.cwd(), 'docs/hume-health/hume_health_awews.com-2026-02-23T11_24_15.774Z.csv');

  // Parse all sources
  console.log('Parsing data sources...');
  const garminSleep = parseGarminSleep(wellnessDir);
  const garminWeight = parseGarminWeight(wellnessDir);
  const garminActivity = parseGarminActivity(aggregatorDir);
  const humeHealth = parseHumeHealth(humeCsv);

  // Merge Garmin sources into one day map
  const garminMerged = new Map();
  for (const source of [garminSleep, garminWeight, garminActivity]) {
    for (const [date, metrics] of source) {
      mergeDayMetric(garminMerged, date, metrics);
    }
  }

  // Build per-source payloads (separate rows for garmin vs hume_health)
  const payloads = [];

  // Garmin rows
  for (const [date, metrics] of garminMerged) {
    if (Object.keys(metrics).length === 0) continue;
    payloads.push({ user_id: userId, logged_date: date, source: 'garmin', ...metrics });
  }

  // Hume Health rows
  for (const [date, metrics] of humeHealth) {
    if (Object.keys(metrics).length === 0) continue;
    payloads.push({ user_id: userId, logged_date: date, source: 'hume_health', ...metrics });
  }

  // Sort by date
  payloads.sort((a, b) => a.logged_date.localeCompare(b.logged_date));

  const garminCount = payloads.filter(p => p.source === 'garmin').length;
  const humeCount = payloads.filter(p => p.source === 'hume_health').length;
  console.log(`\nPayloads: ${garminCount} garmin + ${humeCount} hume_health = ${payloads.length} total`);
  if (payloads.length) {
    console.log(`Date range: ${payloads[0].logged_date} → ${payloads[payloads.length - 1].logged_date}`);
  }

  // Preview a few rows
  console.log('\nSample rows:');
  for (const p of payloads.slice(-3)) {
    const { user_id, ...rest } = p;
    console.log(`  ${JSON.stringify(rest)}`);
  }

  // Upsert in batches of 200 (conflict on user_id + logged_date + source)
  const BATCH = 200;
  let total = 0;
  for (let i = 0; i < payloads.length; i += BATCH) {
    const batch = payloads.slice(i, i + BATCH);
    const { data, error } = await db
      .from('user_health_metrics')
      .upsert(batch, { onConflict: 'user_id,logged_date,source' })
      .select('logged_date');

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} failed:`, error.message);
    } else {
      total += data.length;
      console.log(`  Batch ${Math.floor(i / BATCH) + 1}: ${data.length} rows upserted`);
    }
  }

  console.log(`\nDone! ${total} total rows upserted into user_health_metrics.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
