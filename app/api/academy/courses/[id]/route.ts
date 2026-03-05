// app/api/academy/courses/[id]/route.ts
// GET: single course detail (with modules + lessons)
// PATCH: update course (teacher/admin only)
// DELETE: delete course (teacher/admin only)

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createShortLink, updateShortLink, toSwitchySlug } from '@/lib/switchy';

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
      avg_rating, review_count, trial_period_days, is_sequential,
      override_questions, allow_cross_course_cyoa,
      created_at, teacher_id,
      profiles(username, display_name, avatar_url),
      course_modules(id, title, order,
        lessons(id, title, lesson_type, duration_seconds, order, is_free_preview, content_url, text_content, created_at, updated_at)
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
      db.from('enrollments').select('status, last_content_seen_at').eq('user_id', user.id).eq('course_id', id).maybeSingle(),
      db.from('course_likes').select('user_id').eq('user_id', user.id).eq('course_id', id).maybeSingle(),
      db.from('course_saves').select('user_id').eq('user_id', user.id).eq('course_id', id).maybeSingle(),
    ]);
    enrolled = enrollmentRes.data?.status === 'active';
    liked = !!likeRes.data;
    saved = !!saveRes.data;

    // Annotate lessons with new/updated flags for enrolled users
    if (enrolled && course.course_modules) {
      const seenAtRaw = enrollmentRes.data?.last_content_seen_at;
      const seenAt = seenAtRaw ? new Date(seenAtRaw) : null;
      /* eslint-disable @typescript-eslint/no-explicit-any */
      course.course_modules = (course.course_modules as any[]).map((mod: any) => ({
        ...mod,
        lessons: (mod.lessons ?? []).map((lesson: any) => {
          const created = new Date(lesson.created_at);
          const updated = new Date(lesson.updated_at);
          const is_new = !seenAt || created > seenAt;
          const is_updated = !is_new && !!seenAt && updated > seenAt;
          return { ...lesson, is_new, is_updated };
        }),
      }));
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }
  }

  // Fetch prerequisites + recommendations
  const [prereqRes, recRes] = await Promise.all([
    db
      .from('course_prerequisites')
      .select('id, prerequisite_course_id, enforcement, sort_order, courses!course_prerequisites_prerequisite_course_id_fkey(title, cover_image_url)')
      .eq('course_id', id)
      .order('sort_order'),
    db
      .from('course_recommendations')
      .select('id, recommended_course_id, direction, sort_order, notes, courses!course_recommendations_recommended_course_id_fkey(title, cover_image_url)')
      .eq('course_id', id)
      .order('sort_order'),
  ]);

  const prerequisites = await Promise.all(
    (prereqRes.data ?? []).map(async (p) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = (p as any).courses as { title: string; cover_image_url: string | null } | null;
      let completed = false;
      if (user) {
        const { data: mods } = await db.from('course_modules').select('id').eq('course_id', p.prerequisite_course_id);
        const modIds = (mods ?? []).map((m) => m.id);
        if (modIds.length > 0) {
          const { data: lessons } = await db.from('lessons').select('id').in('module_id', modIds);
          const lessonIds = (lessons ?? []).map((l) => l.id);
          if (lessonIds.length > 0) {
            const { count: done } = await db
              .from('lesson_progress')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .in('lesson_id', lessonIds)
              .not('completed_at', 'is', null);
            completed = (done ?? 0) >= lessonIds.length;
          }
        }
      }
      return {
        id: p.id,
        prerequisite_course_id: p.prerequisite_course_id,
        enforcement: p.enforcement,
        sort_order: p.sort_order,
        title: c?.title ?? 'Unknown Course',
        cover_image_url: c?.cover_image_url ?? null,
        completed,
      };
    }),
  );

  const recommendations = (recRes.data ?? []).map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (r as any).courses as { title: string; cover_image_url: string | null } | null;
    return {
      id: r.id,
      recommended_course_id: r.recommended_course_id,
      direction: r.direction,
      sort_order: r.sort_order,
      notes: r.notes,
      title: c?.title ?? 'Unknown Course',
      cover_image_url: c?.cover_image_url ?? null,
    };
  });

  // Check for prerequisite override
  let has_prerequisite_override = false;
  if (user) {
    const { data: override } = await db
      .from('prerequisite_overrides')
      .select('id')
      .eq('course_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    has_prerequisite_override = !!override;
  }

  // Check for pending override request
  let pending_override_request = null;
  if (user && !enrolled) {
    const { data: req } = await db
      .from('prerequisite_override_requests')
      .select('id, status, created_at')
      .eq('course_id', id)
      .eq('student_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();
    pending_override_request = req;
  }

  return NextResponse.json({ ...course, enrolled, liked, saved, prerequisites, recommendations, has_prerequisite_override, pending_override_request });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: course } = await db.from('courses').select('teacher_id, is_published, title, short_link_id, description, cover_image_url').eq('id', id).single();
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const allowed = ['title', 'description', 'cover_image_url', 'category', 'tags', 'price', 'price_type', 'is_published', 'navigation_mode', 'visibility', 'published_at', 'trial_period_days', 'is_sequential', 'override_questions', 'allow_cross_course_cyoa'];
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

  // Switchy short link — fire and forget
  const isNowPublishing = body.is_published === true && !course.is_published;
  if (data && isNowPublishing && !course.short_link_id) {
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    createShortLink({
      url: `${siteUrl}/academy/${id}`,
      slug: toSwitchySlug('c', data.title || course.title),
      title: data.title || course.title,
      description: data.description || course.description || undefined,
      image: data.cover_image_url || course.cover_image_url || undefined,
      tags: ['course'],
    }).then(async (link) => {
      if (link) {
        await db.from('courses')
          .update({ short_link_id: link.id, short_link_url: link.short_url })
          .eq('id', id);
      }
    }).catch(() => { /* non-critical */ });
  } else if (data && course.short_link_id) {
    const changed = body.title !== undefined || body.cover_image_url !== undefined || body.description !== undefined;
    if (changed) {
      updateShortLink({
        linkId: course.short_link_id,
        title: data.title || course.title,
        description: data.description || course.description || undefined,
        image: data.cover_image_url || course.cover_image_url || undefined,
      }).catch(() => { /* non-critical */ });
    }
  }

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
