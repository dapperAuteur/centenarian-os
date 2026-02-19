// app/api/fuel/protocols/[id]/publish/route.ts
// Converts a user's private Protocol (Fuel module) into a draft Recipe
// in the public Recipes module. The user is then redirected to the recipe
// editor to add instructions, a cover image, and adjust visibility.

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { generateSlug, makeUniqueSlug } from '@/lib/recipes/slug';
import { calculateRecipeNutrition } from '@/lib/recipes/nutrition';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch the protocol with all ingredients (joined to the ingredient library)
  const { data: protocol, error: protocolError } = await supabase
    .from('protocols')
    .select(`
      *,
      protocol_ingredients (
        *,
        ingredient:ingredients (*)
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (protocolError || !protocol) {
    return NextResponse.json({ error: 'Protocol not found' }, { status: 404 });
  }

  // Build recipe_ingredients rows from protocol_ingredients
  // Nutrition is denormalized: stored per-quantity (not per-100g)
  type DraftRecipeIngredient = {
    name: string;
    quantity: number;
    unit: string;
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    fiber_g: number | null;
    usda_fdc_id: string | null;
    brand: string | null;
    sort_order: number;
  };

  const recipeIngredients: DraftRecipeIngredient[] = (protocol.protocol_ingredients || []).map(
    (pi: { quantity: number; unit: string; ingredient: { name: string; calories_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number; fiber_per_100g: number; usda_fdc_id: string | null; brand: string | null } | null }, index: number) => {
      const ing = pi.ingredient;
      if (!ing) {
        return {
          name: 'Unknown ingredient',
          quantity: pi.quantity,
          unit: pi.unit,
          calories: null,
          protein_g: null,
          carbs_g: null,
          fat_g: null,
          fiber_g: null,
          usda_fdc_id: null,
          brand: null,
          sort_order: index,
        };
      }

      // Scale from per-100g to per-quantity when unit is grams; otherwise use raw per-100g values
      const isGrams = pi.unit === 'g';
      const factor = isGrams ? pi.quantity / 100 : 1;

      return {
        name: ing.name,
        quantity: pi.quantity,
        unit: pi.unit,
        calories: Math.round(ing.calories_per_100g * factor * 100) / 100,
        protein_g: Math.round(ing.protein_per_100g * factor * 100) / 100,
        carbs_g: Math.round(ing.carbs_per_100g * factor * 100) / 100,
        fat_g: Math.round(ing.fat_per_100g * factor * 100) / 100,
        fiber_g: Math.round(ing.fiber_per_100g * factor * 100) / 100,
        usda_fdc_id: ing.usda_fdc_id ?? null,
        brand: ing.brand ?? null,
        sort_order: index,
      };
    }
  );

  // Calculate totals from ingredients
  const nutrition = recipeIngredients.length > 0 ? calculateRecipeNutrition(recipeIngredients) : null;

  // Generate a unique slug from the protocol name
  const baseSlug = generateSlug(protocol.name);
  const slug = await makeUniqueSlug(baseSlug, async (candidate) => {
    const { data } = await supabase
      .from('recipes')
      .select('id')
      .eq('user_id', user.id)
      .eq('slug', candidate)
      .maybeSingle();
    return !!data;
  });

  // Insert the recipe as a draft
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert([{
      user_id: user.id,
      title: protocol.name,
      slug,
      description: protocol.description ?? null,
      content: {},                    // user fills instructions in the editor
      visibility: 'draft',
      tags: [],
      servings: protocol.servings ?? null,
      prep_time_minutes: protocol.prep_time_minutes ?? null,
      cook_time_minutes: protocol.cook_time_minutes ?? null,
      total_calories: nutrition?.total_calories ?? protocol.total_calories ?? null,
      total_protein_g: nutrition?.total_protein_g ?? protocol.total_protein ?? null,
      total_carbs_g: nutrition?.total_carbs_g ?? null,
      total_fat_g: nutrition?.total_fat_g ?? null,
      total_fiber_g: nutrition?.total_fiber_g ?? null,
      ncv_score: nutrition?.ncv_score ?? protocol.ncv_score ?? null,
      published_at: null,
    }])
    .select('id')
    .single();

  if (recipeError || !recipe) {
    console.error('[publish protocol] recipe insert failed:', recipeError);
    return NextResponse.json({ error: 'Failed to create recipe' }, { status: 500 });
  }

  // Bulk insert ingredients (if any)
  if (recipeIngredients.length > 0) {
    const { error: ingError } = await supabase
      .from('recipe_ingredients')
      .insert(recipeIngredients.map((ri) => ({ ...ri, recipe_id: recipe.id })));

    if (ingError) {
      console.error('[publish protocol] ingredient insert failed:', ingError);
      // Recipe was created — return it anyway so user can fix in editor
    }
  }

  return NextResponse.json({ recipeId: recipe.id }, { status: 201 });
}
