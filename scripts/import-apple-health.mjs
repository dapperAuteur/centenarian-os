#!/usr/bin/env node
// scripts/import-apple-health.mjs
// Import Apple Health XML export into user_health_metrics
// Usage: node --env-file=.env.local scripts/import-apple-health.mjs

import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bam@awews.com';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE env vars. Run with: node --env-file=.env.local scripts/import-apple-health.mjs');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const XML_PATH = 'docs/BAM apple_health_export/BAM apple_health_export-export.xml';

// --- Helpers ---

function extractAttr(line, attr) {
  const m = line.match(new RegExp(`${attr}="([^"]*)"`));
  return m ? m[1] : null;
}

function toDateStr(dateStr) {
  // Apple Health format: "2026-03-02 10:42:59 -0500"
  return dateStr.split(' ')[0];
}

function durationHours(startStr, endStr) {
  const s = new Date(startStr.replace(/ ([+-]\d{4})$/, '$1'));
  const e = new Date(endStr.replace(/ ([+-]\d{4})$/, '$1'));
  return Math.round(((e - s) / 3600000) * 10) / 10;
}

// --- Streaming XML parser ---

async function parseAppleHealth() {
  const dayMap = new Map();

  function getDay(date) {
    if (!dayMap.has(date)) {
      dayMap.set(date, {
        steps: 0,
        active_calories: null,
        activity_min: null,
        resting_hr: null,
        sleep_hours: 0,
        weight_lbs: null,
        spo2_pct: null,
      });
    }
    return dayMap.get(date);
  }

  console.log('Streaming Apple Health XML (this may take a moment)...');

  const rl = createInterface({
    input: createReadStream(XML_PATH, 'utf8'),
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  let recordCount = 0;

  for await (const line of rl) {
    lineCount++;
    const trimmed = line.trim();

    // ActivitySummary — daily aggregates
    if (trimmed.startsWith('<ActivitySummary ')) {
      const date = extractAttr(trimmed, 'dateComponents');
      if (!date) continue;
      const day = getDay(date);
      const cal = extractAttr(trimmed, 'activeEnergyBurned');
      const exMin = extractAttr(trimmed, 'appleExerciseTime');
      if (cal) day.active_calories = Math.round(parseFloat(cal));
      if (exMin) day.activity_min = parseInt(exMin, 10);
      continue;
    }

    // Records
    if (!trimmed.startsWith('<Record ')) continue;
    recordCount++;

    const type = extractAttr(trimmed, 'type');
    const value = extractAttr(trimmed, 'value');
    const startDate = extractAttr(trimmed, 'startDate');
    if (!type || !startDate) continue;

    const date = toDateStr(startDate);

    switch (type) {
      case 'HKQuantityTypeIdentifierStepCount': {
        if (value) {
          const day = getDay(date);
          day.steps += parseInt(value, 10);
        }
        break;
      }
      case 'HKQuantityTypeIdentifierRestingHeartRate': {
        if (value) {
          const day = getDay(date);
          // Keep latest per day (last write wins)
          day.resting_hr = Math.round(parseFloat(value));
        }
        break;
      }
      case 'HKQuantityTypeIdentifierBodyMass': {
        if (value) {
          const day = getDay(date);
          const unit = extractAttr(trimmed, 'unit');
          // Apple Health may report in lb or kg
          const lbs = unit === 'lb' ? parseFloat(value) : parseFloat(value) * 2.20462;
          day.weight_lbs = Math.round(lbs * 100) / 100;
        }
        break;
      }
      case 'HKQuantityTypeIdentifierOxygenSaturation': {
        if (value) {
          const day = getDay(date);
          const pct = parseFloat(value);
          // Apple Health stores as 0-1 fraction
          day.spo2_pct = pct <= 1 ? Math.round(pct * 10000) / 100 : Math.round(pct * 100) / 100;
        }
        break;
      }
      case 'HKCategoryTypeIdentifierSleepAnalysis': {
        // Only count "InBed" or "Asleep" records
        if (value && (value.includes('InBed') || value.includes('Asleep'))) {
          const endDate = extractAttr(trimmed, 'endDate');
          if (endDate) {
            const hours = durationHours(startDate, endDate);
            if (hours > 0 && hours < 24) {
              // Attribute sleep to the start date
              const day = getDay(date);
              // Take the longest sleep session per day (main sleep)
              if (hours > day.sleep_hours) {
                day.sleep_hours = hours;
              }
            }
          }
        }
        break;
      }
    }
  }

  console.log(`  Lines processed: ${lineCount.toLocaleString()}`);
  console.log(`  Records processed: ${recordCount.toLocaleString()}`);
  console.log(`  Unique days: ${dayMap.size}`);

  return dayMap;
}

// --- Main ---

async function main() {
  const { data: userData, error: userErr } = await db.auth.admin.listUsers();
  if (userErr) { console.error('Failed to list users:', userErr); process.exit(1); }

  const adminUser = userData.users.find(u => u.email === ADMIN_EMAIL);
  if (!adminUser) { console.error(`User ${ADMIN_EMAIL} not found`); process.exit(1); }

  const userId = adminUser.id;
  console.log(`Target user: ${ADMIN_EMAIL} (${userId})\n`);

  const dayMap = await parseAppleHealth();

  // Build payloads — only include non-null/non-zero fields
  const payloads = [];
  for (const [date, metrics] of dayMap) {
    const row = { user_id: userId, logged_date: date, source: 'apple_health' };
    let hasData = false;

    if (metrics.steps > 0) { row.steps = metrics.steps; hasData = true; }
    if (metrics.active_calories != null) { row.active_calories = metrics.active_calories; hasData = true; }
    if (metrics.activity_min != null && metrics.activity_min > 0) { row.activity_min = metrics.activity_min; hasData = true; }
    if (metrics.resting_hr != null) { row.resting_hr = metrics.resting_hr; hasData = true; }
    if (metrics.sleep_hours > 0) { row.sleep_hours = metrics.sleep_hours; hasData = true; }
    if (metrics.weight_lbs != null) { row.weight_lbs = metrics.weight_lbs; hasData = true; }
    if (metrics.spo2_pct != null) { row.spo2_pct = metrics.spo2_pct; hasData = true; }

    if (hasData) payloads.push(row);
  }

  payloads.sort((a, b) => a.logged_date.localeCompare(b.logged_date));

  console.log(`\nPayloads to upsert: ${payloads.length}`);
  console.log(`Date range: ${payloads[0]?.logged_date} → ${payloads[payloads.length - 1]?.logged_date}`);

  // Preview
  console.log('\nSample rows:');
  for (const p of payloads.slice(-3)) {
    const { user_id, ...rest } = p;
    console.log(`  ${JSON.stringify(rest)}`);
  }

  // Upsert in batches of 200
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
