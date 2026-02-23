// app/api/academy/courses/[id]/route.ts
// GET: single course detail (with modules + lessons)
// PATCH: update course (teacher/admin only)
// DELETE: delete course (teacher/admin only)

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
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const db = getDb();

  const { data: course, error } = await db
    .from('courses')
    .select(`
      id, title, description, cover_image_url, category, tags,
      price, price_type, is_published, navigation_mode, like_count,
      avg_rating, review_count, trial_period_days,
      created_at, teacher_id,
      profiles(username, display_name, avatar_url),
      course_modules(id, title, order,
        lessons(id, title, lesson_type, duration_seconds, order, is_free_preview, content_url, text_content)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !course) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Block unpublished courses from non-owners
  if (!course.is_published && user?.id !== course.teacher_id && user?.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Determine enrollment status, liked, and saved
  let enrolled = false;
  let liked = false;
  let saved = false;
  if (user) {
    const [enrollmentRes, likeRes, saveRes] = await Promise.all([
      db.from('enrollments').select('status').eq('user_id', user.id).eq('course_id', id).maybeSingle(),
      db.from('course_likes').select('user_id').eq('user_id', user.id).eq('course_id', id).maybeSingle(),
      db.from('course_saves').select('user_id').eq('user_id', user.id).eq('course_id', id).maybeSingle(),
    ]);
    enrolled = enrollmentRes.data?.status === 'active';
    liked = !!likeRes.data;
    saved = !!saveRes.data;
  }

  return NextResponse.json({ ...course, enrolled, liked, saved });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: course } = await db.from('courses').select('teacher_id').eq('id', id).single();
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const allowed = ['title', 'description', 'cover_image_url', 'category', 'tags', 'price', 'price_type', 'is_published', 'navigation_mode', 'visibility', 'published_at', 'trial_period_days'];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  if ('price_type' in updates && updates.price_type === 'free') updates.price = 0;
  if ('trial_period_days' in updates) {
    updates.trial_period_days = Math.max(0, Math.min(30, Number(updates.trial_period_days) || 0));
  }

  const { data, error } = await db
    .from('courses')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: course } = await db.from('courses').select('teacher_id').eq('id', id).single();
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await db.from('courses').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
