// app/api/academy/courses/[id]/glossary/[termId]/route.ts
// PATCH: update a glossary term (teacher only)
// DELETE: delete a glossary term (teacher only)

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string; termId: string }> };

async function checkAccess(userId: string, userEmail: string | undefined, courseId: string) {
  const db = getDb();
  const { data: course } = await db
    .from('courses')
    .select('teacher_id')
    .eq('id', courseId)
    .maybeSingle();

  if (!course) return { allowed: false, status: 404, message: 'Course not found' };

  const isAdmin = userEmail === process.env.ADMIN_EMAIL;
  if (course.teacher_id !== userId && !isAdmin) {
    return { allowed: false, status: 403, message: 'Forbidden' };
  }

  return { allowed: true, status: 200, message: '' };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: courseId, termId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await checkAccess(user.id, user.email ?? undefined, courseId);
  if (!access.allowed) return NextResponse.json({ error: access.message }, { status: access.status });

  const body = await req.json();
  const allowed = ['term', 'phonetic', 'definition', 'definition_format', 'sort_order', 'lesson_id'];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const key of allowed) {
    if (key in body) {
      updates[key] = body[key] === '' ? null : body[key];
    }
  }

  const db = getDb();
  const { data, error } = await db
    .from('course_glossary_terms')
    .update(updates)
    .eq('id', termId)
    .eq('course_id', courseId)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A term with that name already exists in this course' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: courseId, termId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await checkAccess(user.id, user.email ?? undefined, courseId);
  if (!access.allowed) return NextResponse.json({ error: access.message }, { status: access.status });

  const db = getDb();
  const { error } = await db
    .from('course_glossary_terms')
    .delete()
    .eq('id', termId)
    .eq('course_id', courseId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
