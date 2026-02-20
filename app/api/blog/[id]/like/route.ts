// app/api/blog/[id]/like/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/blog/[id]/like
 * Toggle like for the authenticated user on a blog post.
 * Returns: { liked: boolean, like_count: number }
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase.rpc('toggle_blog_like', {
    p_post_id: id,
  });

  if (error) {
    console.error('[Blog Like API] toggle_blog_like RPC failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
