import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const db = getDb();
  const url = new URL(request.url);

  const category = url.searchParams.get('category');
  const difficulty = url.searchParams.get('difficulty');
  const muscle = url.searchParams.get('muscle');
  const search = url.searchParams.get('search');
  const sort = url.searchParams.get('sort') || 'like_count';
  const dir = url.searchParams.get('dir') || 'desc';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  let query = db
    .from('exercises')
    .select('id, name, difficulty, primary_muscles, video_url, media_url, like_count, copy_count, done_count, exercise_categories(id, name, icon, color)', { count: 'exact' })
    .eq('visibility', 'public')
    .eq('is_active', true);

  if (category) query = query.eq('exercise_categories.name', category);
  if (difficulty) query = query.eq('difficulty', difficulty);
  if (muscle) query = query.contains('primary_muscles', [muscle]);
  if (search) query = query.ilike('name', `%${search}%`);

  const validSorts = ['like_count', 'done_count', 'copy_count', 'name', 'created_at'];
  const sortCol = validSorts.includes(sort) ? sort : 'like_count';
  query = query.order(sortCol, { ascending: dir === 'asc' });
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    exercises: data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}
