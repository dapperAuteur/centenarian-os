// app/api/blog/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { estimateReadingTime } from '@/lib/blog/reading-time';
import { generateSlug, makeUniqueSlug } from '@/lib/blog/slug';
import type { PostVisibility } from '@/lib/types';

/**
 * GET /api/blog
 * Returns publicly visible posts from all users.
 * Optional query params: ?tag=longevity, ?page=1, ?limit=12
 * No auth required.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const tag = searchParams.get('tag');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '12'));
  const offset = (page - 1) * limit;

  let query = supabase
    .from('blog_posts')
    .select(`
      id, slug, title, excerpt, cover_image_url,
      published_at, tags, reading_time_minutes, view_count, user_id,
      profiles!inner(username, display_name)
    `, { count: 'exact' })
    .or('visibility.eq.public,and(visibility.eq.scheduled,scheduled_at.lte.now())')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (tag) {
    query = query.contains('tags', [tag]);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[Blog API] GET failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ posts: data, total: count, page, limit });
}

/**
 * POST /api/blog
 * Create a new blog post. Auth required.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  // Generate or use provided slug
  const baseSlug = body.slug ? body.slug : generateSlug(body.title);

  const slug = await makeUniqueSlug(baseSlug, async (candidate) => {
    const { data } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('user_id', user.id)
      .eq('slug', candidate)
      .maybeSingle();
    return !!data;
  });

  const content = body.content || {};
  const visibility: PostVisibility = body.visibility || 'draft';
  const isPublishing = visibility !== 'draft' && visibility !== 'private';

  const { data, error } = await supabase
    .from('blog_posts')
    .insert([{
      user_id: user.id,
      title: body.title,
      slug,
      excerpt: body.excerpt || null,
      content,
      cover_image_url: body.cover_image_url || null,
      cover_image_public_id: body.cover_image_public_id || null,
      visibility,
      scheduled_at: body.scheduled_at || null,
      tags: body.tags || [],
      reading_time_minutes: estimateReadingTime(content),
      published_at: isPublishing ? new Date().toISOString() : null,
    }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
    }
    console.error('[Blog API] POST failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
