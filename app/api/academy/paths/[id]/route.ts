// app/api/academy/paths/[id]/route.ts
// GET   — fetch a single learning path with full course list + student progress
// PATCH — update path metadata or course list (teacher only)
// DELETE — delete path (teacher only)

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const db = getDb();
  const { data: path, error } = await db
    .from('learning_paths')
    .select(`
      *,
      profiles(username, display_name, avatar_url),
      learning_path_courses(
        course_id, order_index, is_required,
        courses(id, title, description, cover_image_url, category, price, price_type, is_published)
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!path) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // If path is not published, only the teacher can view it
  if (!path.is_published && (!user || (user.id !== path.teacher_id && user.email !== process.env.ADMIN_EMAIL))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // If user is authenticated, attach their completion status for each course
  let completedCourseIds: string[] = [];
  let pathCompleted = false;
  if (user) {
    const [{ data: enrollments }, { data: completion }] = await Promise.all([
      db
        .from('enrollments')
        .select('course_id')
        .eq('user_id', user.id)
        .eq('status', 'active'),
      db
        .from('learning_path_completions')
        .select('id')
        .eq('user_id', user.id)
        .eq('path_id', id)
        .maybeSingle(),
    ]);
    completedCourseIds = (enrollments || []).map((e: { course_id: string }) => e.course_id);
    pathCompleted = !!completion;
  }

  return NextResponse.json({ data: path, completedCourseIds, pathCompleted });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    title?: string;
    description?: string;
    cover_image_url?: string;
    is_published?: boolean;
    courses?: { course_id: string; order_index: number; is_required?: boolean }[];
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const db = getDb();

  // Verify ownership
  const { data: path } = await db
    .from('learning_paths')
    .select('teacher_id')
    .eq('id', id)
    .maybeSingle();

  if (!path) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (path.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Update metadata
  const metaUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) metaUpdate.title = body.title;
  if (body.description !== undefined) metaUpdate.description = body.description;
  if (body.cover_image_url !== undefined) metaUpdate.cover_image_url = body.cover_image_url;
  if (body.is_published !== undefined) metaUpdate.is_published = body.is_published;

  const { data: updated, error: updateError } = await db
    .from('learning_paths')
    .update(metaUpdate)
    .eq('id', id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Replace course list if provided
  if (body.courses !== undefined) {
    await db.from('learning_path_courses').delete().eq('path_id', id);
    if (body.courses.length > 0) {
      const rows = body.courses.map((c) => ({
        path_id: id,
        course_id: c.course_id,
        order_index: c.order_index,
        is_required: c.is_required ?? true,
      }));
      const { error: insertError } = await db.from('learning_path_courses').insert(rows);
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: path } = await db
    .from('learning_paths')
    .select('teacher_id')
    .eq('id', id)
    .maybeSingle();

  if (!path) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (path.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await db.from('learning_paths').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
