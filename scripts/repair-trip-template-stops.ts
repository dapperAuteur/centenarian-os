// scripts/repair-trip-template-stops.ts
// Repairs multi-stop trip templates whose stops were saved one stop early, so
// Quick log dropped distance and time (fix/trip-template-distance-time).
//
// For each multi-stop template it finds the route the template was saved from
// (trip_routes.template_id, created just before the template) and compares the
// stops with what each old writer produced from that route's legs
// (lib/travel/template-stop-repair.ts). Only stops that still match a broken
// writer exactly are rewritten, in place, from the route's legs. Everything
// else is listed for a manual fix in Edit Template, with any leg that goes by
// the template's mode but has no vehicle (Quick log logs it with none; a leg
// fixed by hand before Edit Template had a vehicle per leg). Nothing is deleted.
//
// Dry run by default (reads only):
//   node --env-file=.env.local --experimental-strip-types scripts/repair-trip-template-stops.ts
// Only one person's templates:
//   ... scripts/repair-trip-template-stops.ts --user=<auth user id>
// Write the repairs:
//   ... scripts/repair-trip-template-stops.ts --apply [--user=<id>]
// Also repair the pre-2026-03-17 pattern (Work.WitUS writes it too; the
// database is shared, so look at the dry run first):
//   ... --include-original
//
// Routes already logged from a broken template are listed, never changed.
// Safe to re-run: a repaired template matches the right pattern and is skipped.
// Stops are updated one request each, so a run that fails or stops part way
// can leave a template partly repaired; the next run recognises it (each stop
// still broken or already right) and finishes it.

import { createClient } from '@supabase/supabase-js';
import { findOriginalRoute, legsWithoutVehicle, planStopRepair, type StopRepairPlan } from '../lib/travel/template-stop-repair.ts';
import { templateStopsToLegs, type TemplateLegInput, type TemplateStop } from '../lib/travel/template-stops.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const INCLUDE_ORIGINAL = process.argv.includes('--include-original');
const USER = process.argv.find((a) => a.startsWith('--user='))?.slice('--user='.length) || null;
const PAGE = 500;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars. Run with: node --env-file=.env.local --experimental-strip-types scripts/repair-trip-template-stops.ts');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const startedAt = Date.now();

interface TemplateRow {
  id: string;
  user_id: string;
  name: string;
  mode: string | null;
  vehicle_id: string | null;
  purpose: string | null;
  is_round_trip: boolean | null;
  created_at: string;
}

interface RouteRow {
  id: string;
  name: string | null;
  date: string;
  created_at: string;
}

type StopRow = TemplateStop & { id: string };

function fail(what: string, message: string): never {
  console.error(`Could not read ${what}: ${message}`);
  process.exit(1);
}

/** "5/12, null/null": each leg's miles/minutes as Quick log would record them. */
function legsLine(stops: readonly TemplateStop[], tmpl: TemplateRow): string {
  const legs = templateStopsToLegs(stops, tmpl);
  if (legs.length === 0) return '(no legs)';
  return legs.map((l) => `${l.distance_miles ?? '-'} mi/${l.duration_min ?? '-'} min`).join(', ');
}

async function loadTemplates(): Promise<TemplateRow[]> {
  const rows: TemplateRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db
      .from('trip_templates')
      .select('id, user_id, name, mode, vehicle_id, purpose, is_round_trip, created_at')
      .eq('is_multi_stop', true)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (USER) q = q.eq('user_id', USER);
    const { data, error } = await q;
    if (error) fail('trip_templates', error.message);
    rows.push(...((data ?? []) as TemplateRow[]));
    if (!data || data.length < PAGE) return rows;
  }
}

const templates = await loadTemplates();
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: ${templates.length} multi-stop template(s)${USER ? ` for user ${USER}` : ''}.`);
if (!APPLY) console.log('Nothing is written. Rerun with --apply to repair.\n');

const counts = { none: 0, repair: 0, repaired: 0, failed: 0, manual: 0 };
const manual: string[] = [];
const loggedRoutes: string[] = [];

for (const tmpl of templates) {
  const { data: stopData, error: stopErr } = await db
    .from('trip_template_stops')
    .select('id, stop_order, location_name, mode, vehicle_id, distance_miles, duration_min, cost, purpose, notes')
    .eq('template_id', tmpl.id)
    .order('stop_order', { ascending: true });
  if (stopErr) fail(`stops of template ${tmpl.id}`, stopErr.message);
  const stops = (stopData ?? []) as StopRow[];

  const { data: routeData, error: routeErr } = await db
    .from('trip_routes')
    .select('id, name, date, created_at')
    .eq('template_id', tmpl.id)
    .eq('user_id', tmpl.user_id)
    .order('created_at', { ascending: true });
  if (routeErr) fail(`routes of template ${tmpl.id}`, routeErr.message);
  const routes = (routeData ?? []) as RouteRow[];

  const original = findOriginalRoute(routes, tmpl.created_at);
  let legs: TemplateLegInput[] = [];
  if (original) {
    const { data: legData, error: legErr } = await db
      .from('trips')
      .select('origin, destination, mode, vehicle_id, distance_miles, duration_min, cost, purpose, notes, leg_order')
      .eq('route_id', original.id)
      .eq('user_id', tmpl.user_id)
      .order('leg_order', { ascending: true });
    if (legErr) fail(`legs of route ${original.id}`, legErr.message);
    legs = (legData ?? []) as TemplateLegInput[];
  }

  const plan: StopRepairPlan = planStopRepair(stops, legs, { includeOriginal: INCLUDE_ORIGINAL });
  const label = `"${tmpl.name}" (template ${tmpl.id}, user ${tmpl.user_id}, saved ${tmpl.created_at.slice(0, 10)})`;

  if (plan.action === 'none') {
    counts.none++;
    continue;
  }

  // Routes logged from this template before the repair carry its stops' values.
  for (const r of routes) {
    if (r.id === original?.id || Date.parse(r.created_at) >= startedAt) continue;
    loggedRoutes.push(`${label}: route ${r.id} on ${r.date}${r.name ? ` "${r.name}"` : ''}`);
  }

  if (plan.action === 'manual') {
    counts.manual++;
    // Edited by hand: legs with the template's mode and no vehicle log with none.
    const noVehicle = legsWithoutVehicle(stops, tmpl);
    const vehicleNote = noVehicle.length > 0
      ? ` Leg${noVehicle.length > 1 ? 's' : ''} ${noVehicle.join(', ')} go${noVehicle.length > 1 ? '' : 'es'} by ${tmpl.mode ?? 'car'} with no vehicle; pick one in Edit Template if one of theirs was driven.`
      : '';
    manual.push(`${label}: ${plan.reason}. Quick log now records ${legsLine(stops, tmpl)}.${vehicleNote}`);
    continue;
  }

  counts.repair++;
  const after = plan.updates.map((u) => ({ stop_order: u.stop_order, ...u.values }));
  console.log(`REPAIR ${label}: ${plan.reason}.`);
  console.log(`  Quick log before: ${legsLine(stops, tmpl)}`);
  console.log(`  Quick log after:  ${legsLine(after, tmpl)}`);
  if (!APPLY) continue;

  let ok = true;
  for (const u of plan.updates) {
    const { error } = await db
      .from('trip_template_stops')
      .update(u.values)
      .eq('id', u.id)
      .eq('template_id', tmpl.id);
    if (error) {
      ok = false;
      console.error(`  Stop ${u.stop_order} (${u.id}) not updated: ${error.message}`);
    }
  }
  if (ok) counts.repaired++;
  else {
    counts.failed++;
    console.error('  Partly repaired: rerun with --apply to finish it.');
  }
}

console.log('');
if (manual.length > 0) {
  console.log(`Fix by hand in Edit Template (${manual.length}):`);
  for (const line of manual) console.log(`  - ${line}`);
  console.log('');
}
if (loggedRoutes.length > 0) {
  console.log(`Routes already logged from these templates (not changed; their legs may carry shifted miles and minutes) (${loggedRoutes.length}):`);
  for (const line of loggedRoutes) console.log(`  - ${line}`);
  console.log('');
}
console.log(
  `Already right: ${counts.none}. ${APPLY ? `Repaired: ${counts.repaired}, failed: ${counts.failed}` : `Would repair: ${counts.repair}`}. Manual: ${counts.manual}.`,
);
if (counts.failed > 0) process.exit(1);
