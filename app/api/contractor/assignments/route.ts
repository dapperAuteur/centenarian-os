// app/api/contractor/assignments/route.ts
// GET: list assignments (as lister or worker)
// POST: create assignment (lister only)

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
  const role = searchParams.get('role') ?? 'worker'; // 'worker' or 'lister'
  const status = searchParams.get('status');

  const db = getDb();
  let query = db
    .from('contractor_job_assignments')
    .select('*')
    .order('assigned_at', { ascending: false });

  if (role === 'lister') {
    query = query.eq('assigned_by', user.id);
  } else {
    query = query.eq('assigned_to', user.id);
  }

  if (status) query = query.eq('status', status);

  const { data: assignments, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with job details and usernames
  const jobIds = [...new Set((assignments ?? []).map((a) => a.job_id))];
  const userIds = [...new Set((assignments ?? []).flatMap((a) => [a.assigned_by, a.assigned_to]))];

  const jobMap: Record<string, { job_number: string; client_name: string; event_name: string | null; start_date: string | null; location_name: string | null }> = {};
  if (jobIds.length > 0) {
    const { data: jobs } = await db
      .from('contractor_jobs')
      .select('id, job_number, client_name, event_name, start_date, location_name')
      .in('id', jobIds);
    for (const j of jobs ?? []) jobMap[j.id] = j;
  }

  const usernameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, username')
      .in('id', userIds);
    for (const p of profiles ?? []) usernameMap[p.id] = p.username ?? 'Anonymous';
  }

  const enriched = (assignments ?? []).map((a) => ({
    ...a,
    job: jobMap[a.job_id] ?? null,
    assigned_by_username: usernameMap[a.assigned_by] ?? 'Unknown',
    assigned_to_username: usernameMap[a.assigned_to] ?? 'Unknown',
  }));

  return NextResponse.json({ assignments: enriched });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify user is a lister
  const { data: profile } = await db
    .from('profiles')
    .select('contractor_role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !['lister', 'union_leader'].includes(profile.contractor_role)) {
    return NextResponse.json({ error: 'Lister role required' }, { status: 403 });
  }

  const body = await request.json();
  const { job_id, assigned_to, message } = body;

  if (!job_id || !assigned_to) {
    return NextResponse.json({ error: 'job_id and assigned_to are required' }, { status: 400 });
  }

  // Verify the job belongs to this lister
  const { data: job } = await db
    .from('contractor_jobs')
    .select('id')
    .eq('id', job_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: 'Job not found or not yours' }, { status: 404 });
  }

  const { data, error } = await db
    .from('contractor_job_assignments')
    .insert({
      job_id,
      assigned_by: user.id,
      assigned_to,
      message: message?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already assigned to this job' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
