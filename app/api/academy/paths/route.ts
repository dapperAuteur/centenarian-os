// app/api/academy/paths/route.ts
// GET  — list published learning paths (with course counts + teacher info)
// POST — create a new learning path (teachers only)

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mine = searchParams.get('mine') === 'true';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const db = getDb();
  let query = db
    .from('learning_paths')
    .select(`
      id, title, description, cover_image_url, is_published, created_at, teacher_id,
      profiles(username, display_name, avatar_url),
      learning_path_courses(course_id, order_index, is_required,
        courses(id, title, cover_image_url, category, price, price_type))
    `)
    .order('created_at', { ascending: false });

  if (mine && user) {
    query = query.eq('teacher_id', user.id);
  } else {
    query = query.eq('is_published', true);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'teacher' && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Teacher account required' }, { status: 403 });
  }

  let body: { title?: string; description?: string; cover_image_url?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('learning_paths')
    .insert({
      teacher_id: user.id,
      title: body.title.trim(),
      description: body.description?.trim() ?? null,
      cover_image_url: body.cover_image_url ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
