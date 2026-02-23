// app/api/academy/courses/[id]/like/route.ts
// POST: toggle like on a course. Returns { liked: bool, like_count: number }.

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

export async function POST(_req: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const { data: existing } = await db
    .from('course_likes')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle();

  if (existing) {
    await db.from('course_likes').delete().eq('user_id', user.id).eq('course_id', courseId);
  } else {
    await db.from('course_likes').insert({ user_id: user.id, course_id: courseId });
  }

  const { data: course } = await db.from('courses').select('like_count').eq('id', courseId).single();
  return NextResponse.json({ liked: !existing, like_count: course?.like_count ?? 0 });
}
