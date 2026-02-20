// app/api/recipes/[id]/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import type { RecipeVisibility } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/recipes/[id]
 * Fetch a single recipe by ID. Auth required — returns only the author's own recipe.
 * Also returns associated ingredients and media.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients(* order by sort_order asc),
      recipe_media(* order by sort_order asc)
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/recipes/[id]
 * Update a recipe. Auth required — author only.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const { data: existing } = await supabase
    .from('recipes')
    .select('published_at, visibility')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const newVisibility: RecipeVisibility = body.visibility || existing.visibility;
  const isNowPublishing = newVisibility !== 'draft' && !existing.published_at;

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) updates.title = body.title;
  if (body.slug !== undefined) updates.slug = body.slug;
  if (body.description !== undefined) updates.description = body.description;
  if (body.content !== undefined) updates.content = body.content;
  if (body.cover_image_url !== undefined) updates.cover_image_url = body.cover_image_url;
  if (body.cover_image_public_id !== undefined) updates.cover_image_public_id = body.cover_image_public_id;
  if (body.visibility !== undefined) updates.visibility = body.visibility;
  if (body.scheduled_at !== undefined) updates.scheduled_at = body.scheduled_at;
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.servings !== undefined) updates.servings = body.servings;
  if (body.prep_time_minutes !== undefined) updates.prep_time_minutes = body.prep_time_minutes;
  if (body.cook_time_minutes !== undefined) updates.cook_time_minutes = body.cook_time_minutes;
  if (body.total_calories !== undefined) updates.total_calories = body.total_calories;
  if (body.total_protein_g !== undefined) updates.total_protein_g = body.total_protein_g;
  if (body.total_carbs_g !== undefined) updates.total_carbs_g = body.total_carbs_g;
  if (body.total_fat_g !== undefined) updates.total_fat_g = body.total_fat_g;
  if (body.total_fiber_g !== undefined) updates.total_fiber_g = body.total_fiber_g;
  if (body.ncv_score !== undefined) updates.ncv_score = body.ncv_score;
  if (body.source_url !== undefined) updates.source_url = body.source_url || null;

  if (isNowPublishing) {
    updates.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('recipes')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
    }
    console.error('[Recipes API] PATCH failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/recipes/[id]
 * Delete a recipe. Auth required — author only.
 * Deletes all Cloudinary assets (cover image + media gallery) before removing the record.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: recipe } = await supabase
    .from('recipes')
    .select('cover_image_public_id, recipe_media(public_id, resource_type)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!recipe) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Delete all Cloudinary assets (fire and forget errors — don't block deletion)
  const assetsToDelete: Array<{ publicId: string; resourceType: 'image' | 'video' }> = [];

  if (recipe.cover_image_public_id) {
    assetsToDelete.push({ publicId: recipe.cover_image_public_id, resourceType: 'image' });
  }

  const media = (recipe as { recipe_media?: Array<{ public_id: string; resource_type: 'image' | 'video' }> }).recipe_media || [];
  for (const m of media) {
    assetsToDelete.push({ publicId: m.public_id, resourceType: m.resource_type });
  }

  await Promise.allSettled(
    assetsToDelete.map(({ publicId, resourceType }) =>
      deleteCloudinaryAsset(publicId, resourceType)
    )
  );

  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[Recipes API] DELETE failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function deleteCloudinaryAsset(publicId: string, resourceType: 'image' | 'video' = 'image') {
  const { createHash } = await import('crypto');

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  const timestamp = Math.round(Date.now() / 1000);
  const paramString = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash('sha1').update(paramString + apiSecret).digest('hex');

  const form = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature,
  });

  const endpoint = resourceType === 'video' ? 'video/destroy' : 'image/destroy';
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${endpoint}`,
    { method: 'POST', body: form }
  );

  if (!res.ok) {
    throw new Error(`Cloudinary destroy failed: ${res.status}`);
  }
}
