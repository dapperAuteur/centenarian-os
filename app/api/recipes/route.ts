// app/api/recipes/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { generateSlug, makeUniqueSlug } from '@/lib/recipes/slug';
import { calculateRecipeNutrition } from '@/lib/recipes/nutrition';
import type { RecipeVisibility, RecipeIngredient } from '@/lib/types';

/**
 * GET /api/recipes
 * Returns publicly visible recipes from all users.
 * Optional query params: ?tag=vegan, ?page=1, ?limit=20
 * No auth required.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const tag = searchParams.get('tag');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));
  const offset = (page - 1) * limit;

  let query = supabase
    .from('recipes')
    .select(`
      id, slug, title, description, cover_image_url,
      published_at, tags, view_count, like_count, save_count, user_id,
      total_calories, total_protein_g, ncv_score,
      servings, prep_time_minutes, cook_time_minutes,
      profiles!inner(username, display_name, avatar_url)
    `, { count: 'exact' })
    .or('visibility.eq.public,and(visibility.eq.scheduled,scheduled_at.lte.now())')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (tag) {
    query = query.contains('tags', [tag]);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[Recipes API] GET failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ recipes: data, total: count, page, limit });
}

/**
 * POST /api/recipes
 * Create a new recipe. Auth required.
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

  const baseSlug = body.slug ? body.slug : generateSlug(body.title);

  const slug = await makeUniqueSlug(baseSlug, async (candidate) => {
    const { data } = await supabase
      .from('recipes')
      .select('id')
      .eq('user_id', user.id)
      .eq('slug', candidate)
      .maybeSingle();
    return !!data;
  });

  const content = body.content || {};
  const visibility: RecipeVisibility = body.visibility || 'draft';
  const isPublishing = visibility !== 'draft' && visibility !== 'private';

  // Calculate nutrition from provided ingredients if any
  const ingredients: RecipeIngredient[] = body.ingredients || [];
  const nutrition = ingredients.length > 0 ? calculateRecipeNutrition(ingredients) : null;

  const { data: recipe, error } = await supabase
    .from('recipes')
    .insert([{
      user_id: user.id,
      title: body.title,
      slug,
      description: body.description || null,
      content,
      cover_image_url: body.cover_image_url || null,
      cover_image_public_id: body.cover_image_public_id || null,
      visibility,
      scheduled_at: body.scheduled_at || null,
      tags: body.tags || [],
      servings: body.servings || null,
      prep_time_minutes: body.prep_time_minutes || null,
      cook_time_minutes: body.cook_time_minutes || null,
      ...(nutrition ? {
        total_calories: nutrition.total_calories,
        total_protein_g: nutrition.total_protein_g,
        total_carbs_g: nutrition.total_carbs_g,
        total_fat_g: nutrition.total_fat_g,
        total_fiber_g: nutrition.total_fiber_g,
        ncv_score: nutrition.ncv_score,
      } : {}),
      published_at: isPublishing ? new Date().toISOString() : null,
    }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
    }
    console.error('[Recipes API] POST failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(recipe, { status: 201 });
}
