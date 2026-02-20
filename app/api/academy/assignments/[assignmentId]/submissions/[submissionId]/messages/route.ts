// app/api/academy/assignments/[assignmentId]/submissions/[submissionId]/messages/route.ts
// GET: thread messages on a submission
// POST: add a message to the thread

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ assignmentId: string; submissionId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { submissionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify the user is the student or the teacher
  const { data: sub } = await db
    .from('assignment_submissions')
    .select('student_id, assignments(courses(teacher_id))')
    .eq('id', submissionId)
    .single();

  if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teacherId = (sub.assignments as any)?.courses?.teacher_id;
  const isAllowed = user.id === sub.student_id || user.id === teacherId || user.email === process.env.ADMIN_EMAIL;
  if (!isAllowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await db
    .from('submission_messages')
    .select('id, sender_id, is_teacher, body, media_url, created_at, profiles(username, display_name, avatar_url)')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { submissionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const { data: sub } = await db
    .from('assignment_submissions')
    .select('student_id, assignments(courses(teacher_id))')
    .eq('id', submissionId)
    .single();

  if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teacherId = (sub.assignments as any)?.courses?.teacher_id;
  const isTeacher = user.id === teacherId || user.email === process.env.ADMIN_EMAIL;
  const isStudent = user.id === sub.student_id;
  if (!isTeacher && !isStudent) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { body, media_url } = await request.json();
  if (!body?.trim()) return NextResponse.json({ error: 'Message body required' }, { status: 400 });

  const { data, error } = await db
    .from('submission_messages')
    .insert({
      submission_id: submissionId,
      sender_id: user.id,
      is_teacher: isTeacher,
      body: body.trim(),
      media_url: media_url ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
