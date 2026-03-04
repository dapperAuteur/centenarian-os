// app/api/academy/courses/[id]/prerequisites/route.ts
// GET: list prerequisites + recommendations for a course
// POST: add a prerequisite or recommendation (teacher only)
// DELETE: remove a prerequisite or recommendation (teacher only)

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

  const db = getDb();

  // Fetch prerequisites with joined course info
  const { data: prereqs } = await db
    .from('course_prerequisites')
    .select('id, prerequisite_course_id, enforcement, sort_order, courses!course_prerequisites_prerequisite_course_id_fkey(title, cover_image_url)')
    .eq('course_id', courseId)
    .order('sort_order');

  // Fetch recommendations with joined course info
  const { data: recs } = await db
    .from('course_recommendations')
    .select('id, recommended_course_id, direction, sort_order, notes, courses!course_recommendations_recommended_course_id_fkey(title, cover_image_url)')
    .eq('course_id', courseId)
    .order('sort_order');

  // For authenticated users, check completion status of each prerequisite course
  const prerequisites = await Promise.all(
    (prereqs ?? []).map(async (p) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const course = (p as any).courses as { title: string; cover_image_url: string | null } | null;
      let completed = false;

      if (user) {
        // Get all lesson IDs in the prerequisite course
        const { data: modules } = await db
          .from('course_modules')
          .select('id')
          .eq('course_id', p.prerequisite_course_id);

        const moduleIds = (modules ?? []).map((m) => m.id);

        if (moduleIds.length > 0) {
          const { data: lessons } = await db
            .from('lessons')
            .select('id')
            .in('module_id', moduleIds);

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
        title: course?.title ?? 'Unknown Course',
        cover_image_url: course?.cover_image_url ?? null,
        completed,
      };
    }),
  );

  const recommendations = (recs ?? []).map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const course = (r as any).courses as { title: string; cover_image_url: string | null } | null;
    return {
      id: r.id,
      recommended_course_id: r.recommended_course_id,
      direction: r.direction,
      sort_order: r.sort_order,
      notes: r.notes,
      title: course?.title ?? 'Unknown Course',
      cover_image_url: course?.cover_image_url ?? null,
    };
  });

  return NextResponse.json({ prerequisites, recommendations });
}

export async function POST(request: NextRequest, { params }: Params) {
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
  const { type, target_course_id, enforcement, direction, notes } = body;

  if (!target_course_id) {
    return NextResponse.json({ error: 'target_course_id required' }, { status: 400 });
  }

  if (type === 'prerequisite') {
    const { data, error } = await db
      .from('course_prerequisites')
      .insert({
        course_id: courseId,
        prerequisite_course_id: target_course_id,
        enforcement: enforcement || 'recommended',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Already added' }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  }

  if (type === 'recommendation') {
    const { data, error } = await db
      .from('course_recommendations')
      .insert({
        course_id: courseId,
        recommended_course_id: target_course_id,
        direction: direction || 'after',
        notes: notes?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Already added' }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  }

  return NextResponse.json({ error: 'type must be "prerequisite" or "recommendation"' }, { status: 400 });
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
  const { type, id } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  if (type === 'prerequisite') {
    await db.from('course_prerequisites').delete().eq('id', id).eq('course_id', courseId);
  } else if (type === 'recommendation') {
    await db.from('course_recommendations').delete().eq('id', id).eq('course_id', courseId);
  } else {
    return NextResponse.json({ error: 'type must be "prerequisite" or "recommendation"' }, { status: 400 });
  }

  return NextResponse.json({ deleted: true });
}
