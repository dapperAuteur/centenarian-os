// lib/planner/work-schedule-source.ts
// Single read path for "contractor jobs occupying my calendar".
//
// Stage 2, Phase 2b (plans/55-stage2-db-split.md). /api/planner/work-feed and
// /api/planner/availability read contractor_jobs and contractor_job_assignments DIRECTLY today.
// Those are Work.WitUS tables and the last thing tying CentOS to them. This routes both consumers
// through the local work_schedule_events projection, with a fallback to the direct reads while the
// projection is being populated.
//
// Every consumer goes through here so the Phase 3 cutover is one edit, not several.

import type { SupabaseClient } from '@supabase/supabase-js';

/** Shape both the projection and the legacy direct reads produce. */
export interface WorkScheduleRow {
  job_id: string | null;
  job_number: string | null;
  client_name: string | null;
  event_name: string | null;
  location_name: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  is_multi_day: boolean;
  scheduled_dates: unknown;
  pay_rate: number | null;
  rate_type: string | null;
  brand_id: string | null;
  notes: string | null;
  /** 'own' = the user's own job; 'assigned' = assigned to them by a lister. */
  source: string;
  assigner_name: string | null;
  [key: string]: unknown;
}

const COLUMNS =
  'job_id, job_number, client_name, event_name, location_name, status, start_date, end_date, ' +
  'is_multi_day, scheduled_dates, pay_rate, rate_type, brand_id, notes, source, assigner_name';

/** Both consumers exclude these; keeping the list here stops it drifting between them. */
const HIDDEN_STATUSES = new Set(['cancelled', 'paid']);

/** A job occupies [start, end]; either end may be missing and the other stands in for it. */
function overlaps(row: { start_date: string | null; end_date: string | null }, from: string, to: string): boolean {
  const s = row.start_date ?? row.end_date;
  const e = row.end_date ?? row.start_date;
  if (!s) return false;
  return s <= to && (e ?? s) >= from;
}

/**
 * Jobs overlapping [fromDate, toDate], newest-first by start date.
 *
 * Reads the projection; falls back to the legacy direct reads while it is empty, so this can ship
 * before Work.WitUS's emitter is deployed without blanking the planner.
 *
 * TRANSITIONAL: delete `readLegacyTables` and its call site in Phase 3, once the emitter is live.
 */
export async function getWorkSchedule(
  db: SupabaseClient,
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<WorkScheduleRow[]> {
  const projection = await readProjection(db, userId, fromDate, toDate);
  if (projection.length > 0) return projection;
  return readLegacyTables(db, userId, fromDate, toDate);
}

async function readProjection(
  db: SupabaseClient,
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<WorkScheduleRow[]> {
  try {
    // Date overlap cannot be expressed as a single range filter, so fetch the plausible window
    // and narrow in JS — the same approach the legacy code uses, kept for identical results.
    const { data, error } = await db
      .from('work_schedule_events')
      .select(COLUMNS)
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`start_date.lte.${toDate},end_date.lte.${toDate}`)
      .order('start_date', { ascending: true });
    if (error) return [];
    return ((data ?? []) as unknown as WorkScheduleRow[]).filter((r) => overlaps(r, fromDate, toDate));
  } catch {
    // Table may not exist yet if migration 197 has not been applied here.
    return [];
  }
}

/** TRANSITIONAL — see getWorkSchedule. Removed in Phase 3. */
async function readLegacyTables(
  db: SupabaseClient,
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<WorkScheduleRow[]> {
  const shape = (j: Record<string, unknown>, source: string, assigner: string | null): WorkScheduleRow => ({
    job_id: (j.id as string) ?? null,
    job_number: (j.job_number as string) ?? null,
    client_name: (j.client_name as string) ?? null,
    event_name: (j.event_name as string) ?? null,
    location_name: (j.location_name as string) ?? null,
    status: (j.status as string) ?? null,
    start_date: (j.start_date as string) ?? null,
    end_date: (j.end_date as string) ?? null,
    is_multi_day: j.is_multi_day === true,
    scheduled_dates: j.scheduled_dates ?? null,
    pay_rate: j.pay_rate == null ? null : Number(j.pay_rate),
    rate_type: (j.rate_type as string) ?? null,
    brand_id: (j.brand_id as string) ?? null,
    notes: (j.notes as string) ?? null,
    source,
    assigner_name: assigner,
  });

  const own = await (async () => {
    try {
      const { data, error } = await db
        .from('contractor_jobs')
        .select('id, job_number, client_name, event_name, location_name, status, start_date, end_date, is_multi_day, scheduled_dates, pay_rate, rate_type, brand_id, notes')
        .eq('user_id', userId)
        .not('status', 'in', '("cancelled","paid")')
        .order('start_date', { ascending: true });
      if (error) return [];
      return (data ?? []).map((j) => shape(j as Record<string, unknown>, 'own', null));
    } catch {
      return [];
    }
  })();

  const assigned = await (async () => {
    try {
      // The route this replaced embedded the assigner as
      //   assigner:profiles!contractor_job_assignments_assigned_by_fkey(display_name)
      // which PostgREST cannot resolve: assigned_by references auth.users(id) and there is no
      // foreign key from contractor_job_assignments to profiles. That query always errored, and
      // the old code's `if (error) return []` swallowed it — so assigned jobs have silently never
      // reached the planner. Fixed here rather than reproduced, so this fallback and the
      // projection agree instead of diverging the day the projection fills up.
      const { data, error } = await db
        .from('contractor_job_assignments')
        .select(`
          status,
          assigned_by,
          job:contractor_jobs!inner(id, job_number, client_name, event_name, location_name, status, start_date, end_date, is_multi_day, scheduled_dates, pay_rate, rate_type, brand_id, notes)
        `)
        .eq('assigned_to', userId)
        .eq('status', 'accepted');
      if (error) return [];

      const rows = data ?? [];
      // profiles.id IS auth.users.id, so resolve the names in one keyed lookup.
      const assignerIds = [...new Set(
        rows.map((a) => (a as Record<string, unknown>).assigned_by as string | null).filter(Boolean),
      )] as string[];
      const nameById = new Map<string, string | null>();
      if (assignerIds.length > 0) {
        const { data: profs } = await db
          .from('profiles')
          .select('id, display_name')
          .in('id', assignerIds);
        for (const pr of profs ?? []) {
          const rec = pr as { id: string; display_name: string | null };
          nameById.set(rec.id, rec.display_name ?? null);
        }
      }

      return rows
        .map((a) => {
          const rec = a as Record<string, unknown>;
          const job = rec.job as Record<string, unknown> | null;
          const by = rec.assigned_by as string | null;
          return job ? shape(job, 'assigned', (by ? nameById.get(by) : null) ?? null) : null;
        })
        .filter((r): r is WorkScheduleRow => r !== null);
    } catch {
      return [];
    }
  })();

  return [...own, ...assigned]
    .filter((r) => !HIDDEN_STATUSES.has(r.status ?? ''))
    .filter((r) => overlaps(r, fromDate, toDate));
}
