// app/api/academy/assignments/[assignmentId]/submissions/route.ts
// GET: list submissions (teacher sees all; student sees own)
// POST: submit or update an assignment

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ assignmentId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { assignmentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const { data: assignment } = await db
    .from('assignments')
    .select('course_id, courses(teacher_id)')
    .eq('id', assignmentId)
    .single();

  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isTeacher = (assignment.courses as any)?.teacher_id === user.id || user.email === process.env.ADMIN_EMAIL;

  let query = db
    .from('assignment_submissions')
    .select('id, student_id, content, media_urls, submitted_at, status, grade, teacher_feedback, metric_snapshot, profiles(username, display_name)')
    .eq('assignment_id', assignmentId);

  if (!isTeacher) {
    query = query.eq('student_id', user.id);
  }

  const { data, error } = await query.order('submitted_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { assignmentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { content, media_urls, status = 'submitted' } = await request.json();

  if (status !== 'draft' && status !== 'submitted') {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // If this assignment asks for health metrics, capture a snapshot of the student's
  // own logged metrics at submit time, server-side, so the teacher sees the data as it
  // was even if the student keeps logging. Never blocks the submission if it fails.
  let metricSnapshot: Record<string, unknown> | null = null;
  try {
    const { data: assignment } = await db
      .from('assignments')
      .select('requires_metrics')
      .eq('id', assignmentId)
      .maybeSingle();
    const req = assignment?.requires_metrics as { metrics?: string[]; days?: number } | null;
    if (req && Array.isArray(req.metrics) && req.metrics.length > 0) {
      const days = [7, 30, 90].includes(Number(req.days)) ? Number(req.days) : 7;
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().split('T')[0];
      const cols = req.metrics.filter((c) => /^[a-z_]+$/.test(c));
      if (cols.length > 0) {
        const { data: rows } = await db
          .from('user_health_metrics')
          .select(cols.join(', ') + ', logged_date')
          .eq('user_id', user.id)
          .eq('source', 'manual')
          .gte('logged_date', sinceStr);
        const list = (rows ?? []) as unknown as Record<string, number | null>[];
        const averages: Record<string, number | null> = {};
        for (const c of cols) {
          const vals = list.map((r) => r[c]).filter((v): v is number => typeof v === 'number');
          averages[c] = vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
        }
        metricSnapshot = { days, log_count: list.length, averages, captured_at: new Date().toISOString() };
      }
    }
  } catch {
    metricSnapshot = null;
  }

  const { data, error } = await db
    .from('assignment_submissions')
    .upsert({
      assignment_id: assignmentId,
      student_id: user.id,
      content: content ?? null,
      media_urls: media_urls ?? [],
      status,
      submitted_at: status === 'submitted' ? new Date().toISOString() : null,
      ...(metricSnapshot ? { metric_snapshot: metricSnapshot } : {}),
    }, { onConflict: 'assignment_id,student_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  // Teacher grades a specific submission
  const { assignmentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { submission_id, grade, teacher_feedback } = await request.json();

  const { data: assignment } = await db
    .from('assignments')
    .select('courses(teacher_id)')
    .eq('id', assignmentId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((assignment?.courses as any)?.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await db
    .from('assignment_submissions')
    .update({ grade: grade ?? null, teacher_feedback: teacher_feedback ?? null })
    .eq('id', submission_id)
    .eq('assignment_id', assignmentId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
