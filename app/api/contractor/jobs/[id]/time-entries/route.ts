// app/api/contractor/jobs/[id]/time-entries/route.ts
// GET: list time entries for a job
// POST: create a time entry (one per work-day)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();

  const { data, error } = await db
    .from('job_time_entries')
    .select('*')
    .eq('job_id', id)
    .eq('user_id', user.id)
    .order('work_date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ time_entries: data ?? [] });
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await request.json();
  const {
    work_date, time_in, time_out, adjusted_in, adjusted_out,
    break_minutes, total_hours, st_hours, ot_hours, dt_hours,
    meal_provided, notes,
  } = body;

  if (!work_date) {
    return NextResponse.json({ error: 'work_date is required' }, { status: 400 });
  }

  // Verify job ownership
  const db = getDb();
  const { data: job } = await db
    .from('contractor_jobs')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const { data, error } = await db
    .from('job_time_entries')
    .insert({
      job_id: id,
      user_id: user.id,
      work_date,
      time_in: time_in ?? null,
      time_out: time_out ?? null,
      adjusted_in: adjusted_in ?? null,
      adjusted_out: adjusted_out ?? null,
      break_minutes: break_minutes ?? 0,
      total_hours: total_hours ?? null,
      st_hours: st_hours ?? null,
      ot_hours: ot_hours ?? null,
      dt_hours: dt_hours ?? null,
      meal_provided: meal_provided ?? false,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `Time entry already exists for ${work_date}` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
