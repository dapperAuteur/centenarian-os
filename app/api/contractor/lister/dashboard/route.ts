// app/api/contractor/lister/dashboard/route.ts
// GET: lister overview — jobs, fill rates, pending responses

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify lister role
  const { data: profile } = await db
    .from('profiles')
    .select('contractor_role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !['lister', 'union_leader'].includes(profile.contractor_role)) {
    return NextResponse.json({ error: 'Lister role required' }, { status: 403 });
  }

  // Jobs listed by this user
  const { data: jobs } = await db
    .from('contractor_jobs')
    .select('id, status, start_date, event_name, client_name')
    .eq('user_id', user.id)
    .eq('is_lister_job', true)
    .order('start_date', { ascending: false });

  const totalJobs = (jobs ?? []).length;

  // Job status breakdown
  const statusCounts: Record<string, number> = {};
  for (const j of jobs ?? []) {
    statusCounts[j.status] = (statusCounts[j.status] ?? 0) + 1;
  }

  // Upcoming jobs (start_date >= today)
  const today = new Date().toISOString().split('T')[0];
  const upcomingJobs = (jobs ?? []).filter((j) => j.start_date && j.start_date >= today);

  // All assignments for lister's jobs
  const { data: assignments } = await db
    .from('contractor_job_assignments')
    .select('id, status, job_id, assigned_to')
    .eq('assigned_by', user.id);

  const totalAssignments = (assignments ?? []).length;
  const assignmentStatusCounts: Record<string, number> = {};
  for (const a of assignments ?? []) {
    assignmentStatusCounts[a.status] = (assignmentStatusCounts[a.status] ?? 0) + 1;
  }

  const pendingOffers = assignmentStatusCounts['offered'] ?? 0;
  const accepted = assignmentStatusCounts['accepted'] ?? 0;
  const declined = assignmentStatusCounts['declined'] ?? 0;

  const fillRate = totalAssignments > 0
    ? Math.round((accepted / totalAssignments) * 100)
    : 0;

  // Roster count
  const { count: rosterCount } = await db
    .from('user_contacts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_contractor', true);

  // Unread messages (replies from contractors)
  const { count: unreadCount } = await db
    .from('lister_messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .eq('is_read', false);

  // Groups count
  const { count: groupCount } = await db
    .from('lister_message_groups')
    .select('*', { count: 'exact', head: true })
    .eq('lister_id', user.id);

  return NextResponse.json({
    summary: {
      total_jobs: totalJobs,
      upcoming_jobs: upcomingJobs.length,
      job_status: statusCounts,
      total_assignments: totalAssignments,
      pending_offers: pendingOffers,
      accepted,
      declined,
      fill_rate: fillRate,
      roster_size: rosterCount ?? 0,
      unread_messages: unreadCount ?? 0,
      group_count: groupCount ?? 0,
    },
    upcoming: upcomingJobs.slice(0, 5),
  });
}
