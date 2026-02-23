// app/api/academy/courses/[id]/reviews/route.ts
// GET: list reviews for a course
// POST: create or update a review (enrolled students only)
// DELETE: remove own review

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
  const db = getDb();

  const [{ data: reviews }, { data: course }] = await Promise.all([
    db
      .from('course_reviews')
      .select('id, course_id, student_id, rating, body, created_at, updated_at, profiles:student_id(username, display_name, avatar_url)')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false }),
    db
      .from('courses')
      .select('avg_rating, review_count')
      .eq('id', courseId)
      .single(),
  ]);

  return NextResponse.json({
    reviews: reviews ?? [],
    avg_rating: Number(course?.avg_rating ?? 0),
    review_count: course?.review_count ?? 0,
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Must be enrolled
  const { data: enrollment } = await db
    .from('enrollments')
    .select('status')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .eq('status', 'active')
    .maybeSingle();

  if (!enrollment) {
    return NextResponse.json({ error: 'You must be enrolled to leave a review' }, { status: 403 });
  }

  const body = await request.json();
  const rating = Number(body.rating);
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
  }

  const reviewBody = typeof body.body === 'string' ? body.body.trim() || null : null;

  const { data: review, error } = await db
    .from('course_reviews')
    .upsert({
      course_id: courseId,
      student_id: user.id,
      rating,
      body: reviewBody,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'course_id,student_id' })
    .select('id, course_id, student_id, rating, body, created_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch updated stats
  const { data: course } = await db
    .from('courses')
    .select('avg_rating, review_count')
    .eq('id', courseId)
    .single();

  return NextResponse.json({
    review,
    avg_rating: Number(course?.avg_rating ?? 0),
    review_count: course?.review_count ?? 0,
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { error } = await db
    .from('course_reviews')
    .delete()
    .eq('course_id', courseId)
    .eq('student_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
