// app/api/academy/courses/[id]/modules/[moduleId]/route.ts
// PATCH: rename or reorder a module (teacher/admin only)
// DELETE: delete a module and all its lessons (teacher/admin only)

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string; moduleId: string }> };

async function authorize(courseId: string, userId: string, email: string | undefined | null) {
  const db = getDb();
  const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
  return course && (course.teacher_id === userId || email === process.env.ADMIN_EMAIL);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: courseId, moduleId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await authorize(courseId, user.id, user.email);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const allowed = ['title', 'order'];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const db = getDb();
  const { data, error } = await db
    .from('course_modules')
    .update(updates)
    .eq('id', moduleId)
    .eq('course_id', courseId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: courseId, moduleId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await authorize(courseId, user.id, user.email);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = getDb();
  // Delete all lessons in this module first
  await db.from('lessons').delete().eq('module_id', moduleId).eq('course_id', courseId);
  const { error } = await db.from('course_modules').delete().eq('id', moduleId).eq('course_id', courseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
