// app/api/blog/[id]/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { estimateReadingTime } from '@/lib/blog/reading-time';
import type { PostVisibility } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/blog/[id]
 * Fetch a single blog post by ID. Auth required — returns only the author's own post.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/blog/[id]
 * Update a blog post. Auth required — author only.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Fetch current post to check published_at state
  const { data: existing } = await supabase
    .from('blog_posts')
    .select('published_at, visibility')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const newVisibility: PostVisibility = body.visibility || existing.visibility;
  const isNowPublishing =
    (newVisibility !== 'draft' && newVisibility !== 'private') &&
    !existing.published_at;

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) updates.title = body.title;
  if (body.slug !== undefined) updates.slug = body.slug;
  if (body.excerpt !== undefined) updates.excerpt = body.excerpt;
  if (body.cover_image_url !== undefined) updates.cover_image_url = body.cover_image_url;
  if (body.cover_image_public_id !== undefined) updates.cover_image_public_id = body.cover_image_public_id;
  if (body.visibility !== undefined) updates.visibility = body.visibility;
  if (body.scheduled_at !== undefined) updates.scheduled_at = body.scheduled_at;
  if (body.tags !== undefined) updates.tags = body.tags;

  if (body.content !== undefined) {
    updates.content = body.content;
    updates.reading_time_minutes = estimateReadingTime(body.content);
  }

  if (isNowPublishing) {
    updates.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
    }
    console.error('[Blog API] PATCH failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/blog/[id]
 * Delete a blog post. Auth required — author only.
 * If a Cloudinary cover image exists, it is deleted first.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch the post to get the cover image public_id
  const { data: post } = await supabase
    .from('blog_posts')
    .select('cover_image_public_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Delete Cloudinary cover image if present
  if (post.cover_image_public_id) {
    try {
      await deleteCloudinaryAsset(post.cover_image_public_id);
    } catch (err) {
      console.error('[Blog API] Cloudinary delete failed (continuing):', err);
    }
  }

  const { error } = await supabase
    .from('blog_posts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[Blog API] DELETE failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * Delete a Cloudinary asset using the REST API with a signed request.
 * Cloudinary signature: SHA1("public_id=X&timestamp=Y" + apiSecret)
 */
async function deleteCloudinaryAsset(publicId: string) {
  const { createHash } = await import('crypto');

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  const timestamp = Math.round(Date.now() / 1000);
  // Params sorted alphabetically: public_id (p) < timestamp (t)
  const paramString = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash('sha1').update(paramString + apiSecret).digest('hex');

  const form = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature,
  });

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    { method: 'POST', body: form }
  );

  if (!res.ok) {
    throw new Error(`Cloudinary destroy failed: ${res.status}`);
  }
}
