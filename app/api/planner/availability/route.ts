// app/api/planner/availability/route.ts
// GET: check if a date has contractor job conflicts and task count.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getWorkSchedule } from '@/lib/planner/work-schedule-source';

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
    // Jobs overlapping this date, from the local work_schedule_events projection (falling back
    // to the contractor tables while Phase 2b is in flight). A single date is just a one-day
    // window. See lib/planner/work-schedule-source.ts.
    (async () => {
      const rows = await getWorkSchedule(db, user.id, date, date);
      return rows.map((r) => ({
        id: r.job_id,
        client_name: r.client_name,
        start_date: r.start_date,
        end_date: r.end_date,
      }));
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
