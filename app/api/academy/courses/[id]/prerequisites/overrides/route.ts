// app/api/academy/courses/[id]/prerequisites/overrides/route.ts
// GET: list overrides for a course (teacher only)
// POST: grant a prerequisite override for a student
// DELETE: revoke an override

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

  // Verify teacher ownership
  const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: overrides } = await db
    .from('prerequisite_overrides')
    .select('id, user_id, granted_by, notes, created_at')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false });

  // Resolve student names
  const resolved = await Promise.all(
    (overrides ?? []).map(async (o) => {
      const { data: profile } = await db
        .from('profiles')
        .select('username, display_name, avatar_url')
        .eq('id', o.user_id)
        .maybeSingle();
      return {
        ...o,
        student_name: profile?.display_name ?? profile?.username ?? 'Unknown',
        student_avatar: profile?.avatar_url ?? null,
      };
    }),
  );

  return NextResponse.json(resolved);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, notes } = body;

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const { data, error } = await db
    .from('prerequisite_overrides')
    .insert({
      course_id: courseId,
      user_id,
      granted_by: user.id,
      notes: notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Override already exists' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await db.from('prerequisite_overrides').delete().eq('id', id).eq('course_id', courseId);

  return NextResponse.json({ deleted: true });
}
