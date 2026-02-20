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
    .select('id, student_id, content, media_urls, submitted_at, status, grade, teacher_feedback, profiles(username, display_name)')
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

  const { data, error } = await db
    .from('assignment_submissions')
    .upsert({
      assignment_id: assignmentId,
      student_id: user.id,
      content: content ?? null,
      media_urls: media_urls ?? [],
      status,
      submitted_at: status === 'submitted' ? new Date().toISOString() : null,
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
