#!/usr/bin/env node
// scripts/backfill-work-schedule-events.mjs
// Seeds the work_schedule_events projection (migration 197) from contractor_jobs and
// contractor_job_assignments, so the planner has full history the moment it stops reading those
// tables. Stage 2, Phase 2b — see plans/55-stage2-db-split.md.
//
// Idempotent. event_id is `job:<id>` / `assignment:<id>`, the SAME scheme Work.WitUS's emitter
// uses, so a backfilled row is later updated by the emitter rather than duplicated.
//
// Usage:
//   node --env-file=.env.local scripts/backfill-work-schedule-events.mjs --dry
//   node --env-file=.env.local scripts/backfill-work-schedule-events.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.argv.includes('--dry');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE env vars. Run with: node --env-file=.env.local scripts/backfill-work-schedule-events.mjs');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const JOB_COLS = 'id, user_id, job_number, client_name, event_name, location_name, status, start_date, end_date, is_multi_day, scheduled_dates, pay_rate, rate_type, brand_id, notes';

const shape = (j, userId, eventId, source, assignerName) => ({
  event_id: eventId,
  user_id: userId,
  source_app: 'backfill',
  source,
  assigner_name: assignerName,
  job_id: j.id,
  job_number: j.job_number ?? null,
  client_name: j.client_name ?? null,
  event_name: j.event_name ?? null,
  location_name: j.location_name ?? null,
  status: j.status ?? null,
  start_date: j.start_date ?? null,
  end_date: j.end_date ?? null,
  is_multi_day: j.is_multi_day === true,
  scheduled_dates: j.scheduled_dates ?? null,
  pay_rate: j.pay_rate == null ? null : Number(j.pay_rate),
  rate_type: j.rate_type ?? null,
  brand_id: j.brand_id ?? null,
  notes: j.notes ?? null,
  // Mirrors what both consumers filtered out when they read the tables directly.
  is_active: !['cancelled', 'paid'].includes(j.status ?? ''),
  updated_at: new Date().toISOString(),
});

const payload = [];
const skipped = [];

// --- own jobs ---
const { data: jobs, error: jobErr } = await db.from('contractor_jobs').select(JOB_COLS);
if (jobErr) {
  console.error(`Could not read contractor_jobs: ${jobErr.message}`);
  process.exit(1);
}
for (const j of jobs ?? []) {
  if (!j.user_id) { skipped.push(`job ${j.id}: no user_id`); continue; }
  if (!j.start_date && !j.end_date) { skipped.push(`job ${j.id}: no dates`); continue; }
  payload.push(shape(j, j.user_id, `job:${j.id}`, 'own', null));
}

// --- assigned jobs. Only 'accepted' assignments occupied the calendar before, so only those
//     are projected; the consumers filtered on exactly this. ---
// NOTE: do NOT try to embed the assigner as
//   assigner:profiles!contractor_job_assignments_assigned_by_fkey(display_name)
// PostgREST cannot resolve it: assigned_by references auth.users(id), and there is no foreign key
// from contractor_job_assignments to profiles, so the relationship does not exist in the schema
// cache. The route this backfill replaces used exactly that join and swallowed the error with
// `if (error) return []`, which is why assigned jobs silently never reached the planner.
// profiles.id IS auth.users.id, so a second keyed lookup gets the same data honestly.
const { data: assigns, error: asgErr } = await db
  .from('contractor_job_assignments')
  .select(`id, assigned_to, assigned_by, status, job:contractor_jobs!inner(${JOB_COLS})`)
  .eq('status', 'accepted');
if (asgErr) {
  console.error(`Could not read contractor_job_assignments: ${asgErr.message}`);
  console.error('(If that table does not exist here, own jobs alone may be enough.)');
} else {
  // Resolve assigner display names in one round trip.
  const assignerIds = [...new Set((assigns ?? []).map((a) => a.assigned_by).filter(Boolean))];
  const assignerName = new Map();
  if (assignerIds.length > 0) {
    const { data: profs, error: profErr } = await db
      .from('profiles')
      .select('id, display_name')
      .in('id', assignerIds);
    if (profErr) {
      // Cosmetic only — the label is nice to have, the booking is not.
      console.warn(`Could not resolve assigner names: ${profErr.message} (continuing without them)`);
    } else {
      for (const pr of profs ?? []) assignerName.set(pr.id, pr.display_name ?? null);
    }
  }

  for (const a of assigns ?? []) {
    const j = a.job;
    if (!j) { skipped.push(`assignment ${a.id}: no job`); continue; }
    if (!a.assigned_to) { skipped.push(`assignment ${a.id}: no assignee`); continue; }
    if (!j.start_date && !j.end_date) { skipped.push(`assignment ${a.id}: job has no dates`); continue; }
    payload.push(shape(j, a.assigned_to, `assignment:${a.id}`, 'assigned', assignerName.get(a.assigned_by) ?? null));
  }
}

const users = new Set(payload.map((p) => p.user_id));
console.log(`Prepared ${payload.length} schedule events across ${users.size} user(s).`);
console.log(`  own: ${payload.filter((p) => p.source === 'own').length}, assigned: ${payload.filter((p) => p.source === 'assigned').length}`);
if (skipped.length) {
  console.log(`\nSkipped ${skipped.length}:`);
  for (const s of skipped.slice(0, 10)) console.log(`  - ${s}`);
  if (skipped.length > 10) console.log(`  ...and ${skipped.length - 10} more`);
}

if (DRY) {
  console.log('\n[dry] Nothing written. Re-run without --dry to apply.');
  process.exit(0);
}
if (payload.length === 0) {
  console.log('Nothing to write.');
  process.exit(0);
}

const BATCH = 500;
let written = 0;
for (let i = 0; i < payload.length; i += BATCH) {
  const { data, error } = await db
    .from('work_schedule_events')
    .upsert(payload.slice(i, i + BATCH), { onConflict: 'user_id,event_id' })
    .select('id');
  if (error) {
    console.error(`\nBatch at ${i} failed: ${error.message}`);
    console.error(`${written} written before this point. Re-running is safe.`);
    process.exit(1);
  }
  written += data?.length ?? 0;
  process.stdout.write(`\rUpserted ${written}/${payload.length}...`);
}
console.log(`\nDone. ${written} events in work_schedule_events.`);
console.log('Verify: the planner and /api/planner/availability should show the same jobs as before.');
