// app/api/academy/teachers/[username]/route.ts
// GET — public teacher profile + their published courses (no auth required).

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ username: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { username } = await params;
  const db = getDb();

  // Look up teacher profile by username
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url')
    .eq('username', username)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
  }

  // Get all published courses by this teacher.
  // Sort featured first (by teacher_featured_order asc) then everything by
  // newest. Featured rows come back at the top of the array; the page can
  // split them into a separate strip without re-sorting.
  const { data: courses } = await db
    .from('courses')
    .select('id, title, description, cover_image_url, category, tags, price, price_type, navigation_mode, like_count, created_at, teacher_is_featured, teacher_featured_order')
    .eq('teacher_id', profile.id)
    .eq('is_published', true)
    .order('teacher_is_featured', { ascending: false })
    .order('teacher_featured_order', { ascending: true })
    .order('created_at', { ascending: false });

  // If the caller is logged in, also return their liked/saved state for each course
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let likedIds: string[] = [];
  let savedIds: string[] = [];

  if (user && (courses ?? []).length > 0) {
    const courseIds = (courses ?? []).map((c) => c.id);
    const [likesRes, savesRes] = await Promise.all([
      db.from('course_likes').select('course_id').eq('user_id', user.id).in('course_id', courseIds),
      db.from('course_saves').select('course_id').eq('user_id', user.id).in('course_id', courseIds),
    ]);
    likedIds = (likesRes.data ?? []).map((r) => r.course_id);
    savedIds = (savesRes.data ?? []).map((r) => r.course_id);
  }

  const enrichedCourses = (courses ?? []).map((c) => ({
    ...c,
    liked: likedIds.includes(c.id),
    saved: savedIds.includes(c.id),
  }));

  return NextResponse.json({ profile, courses: enrichedCourses });
}
