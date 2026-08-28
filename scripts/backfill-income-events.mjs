#!/usr/bin/env node
// scripts/backfill-income-events.mjs
// Seeds the income_events projection (migration 196) from the legacy cross-app
// expected_payments VIEW, so CentOS's forecast and planner have full history the moment
// they switch off the view. Stage 2, Phase 2 — see plans/55-stage2-db-split.md.
//
// Idempotent. event_id is derived deterministically as `${source_type}:${source_id}`, which
// is the SAME scheme Work.WitUS's emitter uses. So when the emitter later sends an update for
// an invoice that was backfilled here, it updates that row rather than creating a duplicate.
//
// Usage:
//   node --env-file=.env.local scripts/backfill-income-events.mjs --dry
//   node --env-file=.env.local scripts/backfill-income-events.mjs
//
// Run AFTER migration 196 and BEFORE relying on the projection. Safe to re-run.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.argv.includes('--dry');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE env vars. Run with: node --env-file=.env.local scripts/backfill-income-events.mjs');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const BATCH = 500;

const { data: rows, error } = await db
  .from('expected_payments')
  .select('*')
  .order('expected_date');

if (error) {
  console.error(`Could not read expected_payments: ${error.message}`);
  console.error('If the view no longer exists, the backfill has already served its purpose.');
  process.exit(1);
}

if (!rows || rows.length === 0) {
  console.log('expected_payments returned no rows. Nothing to backfill.');
  process.exit(0);
}

const skipped = [];
const payload = [];

for (const r of rows) {
  // source_id is what makes the event id stable across re-runs and across the emitter.
  // A row without one cannot be de-duplicated, so it is reported rather than guessed at.
  if (!r.source_id || !r.source_type) {
    skipped.push(`${r.label ?? 'unlabelled'} on ${r.expected_date}: missing source_type/source_id`);
    continue;
  }
  if (!r.user_id || !r.expected_date) {
    skipped.push(`${r.label ?? 'unlabelled'}: missing user_id/expected_date`);
    continue;
  }
  payload.push({
    event_id: `${r.source_type}:${r.source_id}`,
    user_id: r.user_id,
    source_app: 'backfill',
    source_type: r.source_type,
    source_id: r.source_id,
    expected_date: r.expected_date,
    label: r.label ?? null,
    reference_number: r.reference_number ?? null,
    expected_amount: Number(r.expected_amount ?? 0),
    status: r.status ?? null,
    start_date: r.start_date ?? null,
    end_date: r.end_date ?? null,
    brand_id: r.brand_id ?? null,
    is_active: true,
    updated_at: new Date().toISOString(),
  });
}

const users = new Set(payload.map((p) => p.user_id));
console.log(`Read ${rows.length} rows from expected_payments.`);
console.log(`Prepared ${payload.length} events across ${users.size} user(s).`);
if (skipped.length > 0) {
  console.log(`\nSkipped ${skipped.length}:`);
  for (const s of skipped.slice(0, 10)) console.log(`  - ${s}`);
  if (skipped.length > 10) console.log(`  ...and ${skipped.length - 10} more`);
}

if (DRY) {
  console.log('\n[dry] Nothing written. Re-run without --dry to apply.');
  process.exit(0);
}

let written = 0;
for (let i = 0; i < payload.length; i += BATCH) {
  const chunk = payload.slice(i, i + BATCH);
  const { data, error: upsertErr } = await db
    .from('income_events')
    .upsert(chunk, { onConflict: 'user_id,event_id' })
    .select('id');
  if (upsertErr) {
    console.error(`\nBatch starting at ${i} failed: ${upsertErr.message}`);
    console.error(`${written} events were written before this point. Re-running is safe.`);
    process.exit(1);
  }
  written += data?.length ?? 0;
  process.stdout.write(`\rUpserted ${written}/${payload.length}...`);
}

console.log(`\nDone. ${written} events in income_events.`);
console.log('Verify: the planner and /api/finance/forecast should show the same totals as before.');
