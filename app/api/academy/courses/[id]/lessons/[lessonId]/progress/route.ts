// app/api/academy/courses/[id]/lessons/[lessonId]/progress/route.ts
// POST: upsert lesson progress for the current user

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string; lessonId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id: courseId, lessonId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify enrollment
  const { data: enrollment } = await db
    .from('enrollments')
    .select('status')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle();

  if (enrollment?.status !== 'active') {
    // Also allow teachers/admin to mark progress
    const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
    if (course?.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });
    }
  }

  const { completed = false, watch_seconds = 0 } = await request.json();

  const { error } = await db
    .from('lesson_progress')
    .upsert({
      user_id: user.id,
      lesson_id: lessonId,
      watch_seconds,
      completed_at: completed ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,lesson_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
