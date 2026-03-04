// app/api/academy/courses/[id]/prerequisites/requests/route.ts
// GET: list override requests (teacher sees all, student sees own)
// POST: student submits override request
// PATCH: teacher approves/rejects a request

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isTeacher = course.teacher_id === user.id || user.email === process.env.ADMIN_EMAIL;

  if (isTeacher) {
    // Teacher sees all requests for this course
    const { data: requests } = await db
      .from('prerequisite_override_requests')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });

    // Resolve student profiles
    const resolved = await Promise.all(
      (requests ?? []).map(async (r) => {
        const { data: profile } = await db
          .from('profiles')
          .select('username, display_name, avatar_url')
          .eq('id', r.student_id)
          .maybeSingle();
        return {
          ...r,
          student_name: profile?.display_name ?? profile?.username ?? 'Unknown',
          student_avatar: profile?.avatar_url ?? null,
        };
      }),
    );

    return NextResponse.json(resolved);
  }

  // Student sees only their own requests
  const { data: requests } = await db
    .from('prerequisite_override_requests')
    .select('*')
    .eq('course_id', courseId)
    .eq('student_id', user.id)
    .order('created_at', { ascending: false });

  return NextResponse.json(requests ?? []);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const body = await request.json();
  const { answers, reason } = body;

  const { data, error } = await db
    .from('prerequisite_override_requests')
    .insert({
      course_id: courseId,
      student_id: user.id,
      answers: answers ?? {},
      reason: reason?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'You already have a pending request' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify teacher ownership
  const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { request_id, action, teacher_response } = body;

  if (!request_id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'request_id and action (approve/reject) required' }, { status: 400 });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  const { data: req, error } = await db
    .from('prerequisite_override_requests')
    .update({
      status: newStatus,
      teacher_response: teacher_response?.trim() || null,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', request_id)
    .eq('course_id', courseId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!req) return NextResponse.json({ error: 'Request not found or already decided' }, { status: 404 });

  // On approval, auto-create the prerequisite override
  if (action === 'approve') {
    await db
      .from('prerequisite_overrides')
      .upsert({
        course_id: courseId,
        user_id: req.student_id,
        granted_by: user.id,
        notes: `Auto-granted from override request. ${teacher_response?.trim() || ''}`.trim(),
      }, { onConflict: 'course_id,user_id' });
  }

  return NextResponse.json(req);
}
