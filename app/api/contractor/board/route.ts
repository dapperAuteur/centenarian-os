// app/api/contractor/board/route.ts
// GET: list public jobs available for replacement (excludes own jobs)

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

  const { searchParams } = new URL(request.url);
  const union = searchParams.get('union');
  const department = searchParams.get('department');

  const db = getDb();
  let query = db
    .from('contractor_jobs')
    .select('id, job_number, client_name, event_name, location_name, status, start_date, end_date, pay_rate, ot_rate, dt_rate, rate_type, union_local, department, benefits_eligible, distance_from_home_miles, share_contacts, user_id, created_at')
    .eq('is_public', true)
    .neq('user_id', user.id)
    .in('status', ['assigned', 'confirmed'])
    .order('start_date', { ascending: true });

  if (union) query = query.eq('union_local', union);
  if (department) query = query.eq('department', department);

  const { data: jobs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Check which jobs the current user has already requested
  const jobIds = (jobs ?? []).map((j) => j.id);
  let myRequests: Record<string, string> = {};
  if (jobIds.length > 0) {
    const { data: reqs } = await db
      .from('job_replacement_requests')
      .select('job_id, status')
      .eq('requester_id', user.id)
      .in('job_id', jobIds);
    for (const r of reqs ?? []) {
      myRequests[r.job_id] = r.status;
    }
  }

  // Get poster profiles (username) for display
  const posterIds = [...new Set((jobs ?? []).map((j) => j.user_id))];
  let posterMap: Record<string, string> = {};
  if (posterIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, username')
      .in('id', posterIds);
    for (const p of profiles ?? []) {
      posterMap[p.id] = p.username ?? 'Anonymous';
    }
  }

  const enriched = (jobs ?? []).map((j) => ({
    ...j,
    poster_username: posterMap[j.user_id] ?? 'Anonymous',
    my_request_status: myRequests[j.id] ?? null,
  }));

  return NextResponse.json({ jobs: enriched });
}
