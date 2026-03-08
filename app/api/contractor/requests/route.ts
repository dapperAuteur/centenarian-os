// app/api/contractor/requests/route.ts
// GET: list replacement requests (incoming for poster, outgoing for requester)
// POST: create a new replacement request

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

  const direction = request.nextUrl.searchParams.get('direction') ?? 'incoming';
  const db = getDb();

  const col = direction === 'outgoing' ? 'requester_id' : 'poster_id';
  const { data, error } = await db
    .from('job_replacement_requests')
    .select('*')
    .eq(col, user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with job info + user profiles
  const jobIds = [...new Set((data ?? []).map((r) => r.job_id))];
  const userIds = [...new Set((data ?? []).flatMap((r) => [r.poster_id, r.requester_id]))];

  const [jobsRes, profilesRes] = await Promise.all([
    jobIds.length > 0
      ? db.from('contractor_jobs').select('id, job_number, client_name, event_name, start_date, status').in('id', jobIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? db.from('profiles').select('id, username').in('id', userIds)
      : Promise.resolve({ data: [] }),
  ]);

  const jobMap = new Map((jobsRes.data ?? []).map((j) => [j.id, j]));
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.username ?? 'Anonymous']));

  const enriched = (data ?? []).map((r) => ({
    ...r,
    job: jobMap.get(r.job_id) ?? null,
    poster_username: profileMap.get(r.poster_id) ?? 'Anonymous',
    requester_username: profileMap.get(r.requester_id) ?? 'Anonymous',
  }));

  return NextResponse.json({ requests: enriched });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { job_id, message } = await request.json();
  if (!job_id) return NextResponse.json({ error: 'job_id required' }, { status: 400 });

  const db = getDb();

  // Verify the job exists, is public, and isn't the requester's own job
  const { data: job } = await db
    .from('contractor_jobs')
    .select('id, user_id, is_public')
    .eq('id', job_id)
    .maybeSingle();

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (!job.is_public) return NextResponse.json({ error: 'Job is not available' }, { status: 400 });
  if (job.user_id === user.id) return NextResponse.json({ error: 'Cannot request your own job' }, { status: 400 });

  const { data, error } = await db
    .from('job_replacement_requests')
    .insert({
      job_id,
      poster_id: job.user_id,
      requester_id: user.id,
      message: message?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You have already requested this job' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
