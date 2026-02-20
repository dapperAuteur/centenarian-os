// app/api/academy/courses/route.ts
// GET: public course catalog (or teacher's own courses with ?mine=true)
// POST: create a new course (teachers only)

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mine = searchParams.get('mine') === 'true';
  const category = searchParams.get('category');
  const q = searchParams.get('q');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const db = getDb();
  let query = db
    .from('courses')
    .select('id, title, description, cover_image_url, category, tags, price, price_type, is_published, navigation_mode, created_at, teacher_id, profiles(username, display_name, avatar_url)')
    .order('created_at', { ascending: false });

  if (mine && user) {
    query = query.eq('teacher_id', user.id);
  } else {
    query = query.eq('is_published', true);
    if (category) query = query.eq('category', category);
    if (q) query = query.ilike('title', `%${q}%`);
  }

  const { data, error } = await query.limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify teacher role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'teacher' && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Teacher account required' }, { status: 403 });
  }

  const body = await request.json();
  const {
    title, description, cover_image_url, category, tags,
    price = 0, price_type = 'free', navigation_mode = 'linear',
  } = body;

  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const db = getDb();
  const { data, error } = await db
    .from('courses')
    .insert({
      teacher_id: user.id,
      title: title.trim(),
      description: description ?? null,
      cover_image_url: cover_image_url ?? null,
      category: category ?? null,
      tags: tags ?? [],
      price: price_type === 'free' ? 0 : Number(price),
      price_type,
      navigation_mode,
      is_published: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
