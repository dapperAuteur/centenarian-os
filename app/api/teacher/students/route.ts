// app/api/teacher/students/route.ts
// GET: list all students enrolled in the calling teacher's courses

import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify teacher role
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'teacher' && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get teacher's courses
  const { data: courses } = await db
    .from('courses')
    .select('id, title')
    .eq('teacher_id', user.id);

  if (!courses || courses.length === 0) {
    return NextResponse.json([]);
  }

  const courseIds = courses.map((c) => c.id);
  const courseMap = Object.fromEntries(courses.map((c) => [c.id, c.title]));

  // Get enrollments for those courses
  const { data: enrollments, error } = await db
    .from('enrollments')
    .select('id, user_id, course_id, status, enrolled_at, profiles(username, display_name)')
    .in('course_id', courseIds)
    .eq('status', 'active')
    .order('enrolled_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get emails via admin API
  const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = Object.fromEntries(users.map((u) => [u.id, u.email ?? null]));

  const enriched = (enrollments ?? []).map((e) => ({
    ...e,
    email: emailMap[e.user_id] ?? null,
    course_title: courseMap[e.course_id] ?? e.course_id,
  }));

  return NextResponse.json(enriched);
}
