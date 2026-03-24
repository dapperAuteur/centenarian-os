// app/api/planner/availability/route.ts
// GET: check if a date has contractor job conflicts and task count.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const date = request.nextUrl.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'date query param is required' }, { status: 400 });
  }

  const db = getDb();

  const [jobsResult, taskCountResult] = await Promise.all([
    // Jobs overlapping this date (own + assigned)
    (async () => {
      try {
        const { data: ownJobs } = await db
          .from('contractor_jobs')
          .select('id, client_name, event_name, start_date, end_date')
          .eq('user_id', user.id)
          .not('status', 'in', '("cancelled","paid")')
          .lte('start_date', date)
          .or(`end_date.gte.${date},end_date.is.null`);

        const { data: assignedRaw } = await db
          .from('contractor_job_assignments')
          .select(`
            job:contractor_jobs!inner(id, client_name, event_name, start_date, end_date, status)
          `)
          .eq('assigned_to', user.id)
          .eq('status', 'accepted');

        const assignedJobs = (assignedRaw ?? [])
          .map((a: Record<string, unknown>) => a.job as Record<string, string | null>)
          .filter((j: Record<string, string | null>) => {
            if (!j || j.status === 'cancelled' || j.status === 'paid') return false;
            const s = j.start_date;
            const e = j.end_date ?? j.start_date;
            return s && s <= date && (e ?? s) >= date;
          });

        const all = [
          ...(ownJobs ?? []).filter((j: Record<string, string | null>) => {
            const e = j.end_date ?? j.start_date;
            return (e ?? j.start_date!) >= date;
          }),
          ...assignedJobs,
        ];

        return all.map((j: Record<string, string | null>) => ({
          id: j.id,
          client_name: j.client_name,
          start_date: j.start_date,
          end_date: j.end_date,
        }));
      } catch {
        return [];
      }
    })(),

    // Task count for this date
    (async () => {
      await db
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('date', date)
        .eq('status', 'active')
        .or(`milestone_id.not.is.null`);
      // Filter to user's tasks via milestone→goal→roadmap chain
      // For simplicity, use a direct query joining through the hierarchy
      // Actually, tasks don't have user_id directly — we need to join through milestones→goals→roadmaps
      // Use a simpler approach: query tasks and filter
      const { data } = await db
        .from('tasks')
        .select('id, milestone_id, milestones!inner(goal_id, goals!inner(roadmap_id, roadmaps!inner(user_id)))')
        .eq('date', date)
        .eq('status', 'active')
        .eq('milestones.goals.roadmaps.user_id', user.id);
      return data?.length ?? 0;
    })(),
  ]);

  return NextResponse.json({
    date,
    has_jobs: jobsResult.length > 0,
    jobs: jobsResult,
    task_count: taskCountResult,
  });
}
