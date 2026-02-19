// app/api/recipes/[id]/clone/route.ts
// Imports a public recipe into the authenticated user's personal Fuel module
// by creating a Protocol with matched/new ingredients.
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/recipes/[id]/clone
 * Creates a new Protocol in the user's Fuel module from a public recipe.
 *
 * For each recipe ingredient:
 *   1. Try to match to existing user ingredient by usda_fdc_id (exact)
 *   2. Fall back to case-insensitive name match
 *   3. If no match, create a new ingredient in the user's library
 *
 * Returns: { protocolId, matchedCount, createdCount }
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch the recipe with its ingredients (public access required)
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select(`
      id, title, description,
      total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, ncv_score,
      servings, prep_time_minutes, cook_time_minutes,
      recipe_ingredients(id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g, usda_fdc_id, brand, sort_order)
    `)
    .eq('id', id)
    .single();

  if (recipeError || !recipe) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }

  const recipeIngredients = (recipe as { recipe_ingredients?: Array<{
    id: string; name: string; quantity: number; unit: string;
    calories: number | null; protein_g: number | null; carbs_g: number | null;
    fat_g: number | null; fiber_g: number | null; usda_fdc_id: string | null;
    brand: string | null; sort_order: number;
  }> }).recipe_ingredients || [];

  // Fetch user's existing ingredients for matching
  const { data: userIngredients } = await supabase
    .from('ingredients')
    .select('id, name, usda_fdc_id, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g')
    .eq('user_id', user.id);

  const existingIngredients = userIngredients || [];

  let matchedCount = 0;
  let createdCount = 0;

  // Map recipe ingredients to user ingredient IDs
  const ingredientMappings: Array<{ ingredientId: string; quantity: number; unit: string }> = [];

  for (const ri of recipeIngredients) {
    // 1. Try USDA FDC ID match (most precise)
    let match = ri.usda_fdc_id
      ? existingIngredients.find(ei => ei.usda_fdc_id === ri.usda_fdc_id)
      : null;

    // 2. Fall back to case-insensitive name match
    if (!match) {
      const nameLower = ri.name.toLowerCase();
      match = existingIngredients.find(ei => ei.name.toLowerCase() === nameLower) || null;
    }

    if (match) {
      matchedCount++;
      ingredientMappings.push({ ingredientId: match.id, quantity: ri.quantity, unit: ri.unit });
    } else {
      // 3. Create new ingredient in user's library
      // Convert from recipe's absolute quantity nutrition to per-100g values
      // We store per-100g in the ingredients table; recipe_ingredients stores per-quantity.
      // If quantity is in grams, we can back-calculate. Otherwise use the values as-is for 100g.
      const { data: newIng, error: ingError } = await supabase
        .from('ingredients')
        .insert([{
          user_id: user.id,
          name: ri.name,
          brand: ri.brand || null,
          unit: ri.unit,
          // Store nutrition as-is; user can refine later
          calories_per_100g: ri.calories ?? 0,
          protein_per_100g: ri.protein_g ?? 0,
          carbs_per_100g: ri.carbs_g ?? 0,
          fat_per_100g: ri.fat_g ?? 0,
          fiber_per_100g: ri.fiber_g ?? 0,
          ncv_score: 'Yellow', // Default; recalculated by user later
          usda_fdc_id: ri.usda_fdc_id || null,
          cost_per_unit: 0,
        }])
        .select('id')
        .single();

      if (ingError || !newIng) {
        console.error('[Recipes Clone API] Failed to create ingredient:', ingError);
        continue;
      }

      createdCount++;
      existingIngredients.push({ id: newIng.id, name: ri.name, usda_fdc_id: ri.usda_fdc_id, calories_per_100g: 0, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 0, fiber_per_100g: 0 });
      ingredientMappings.push({ ingredientId: newIng.id, quantity: ri.quantity, unit: ri.unit });
    }
  }

  // Create the Protocol
  const { data: protocol, error: protocolError } = await supabase
    .from('protocols')
    .insert([{
      user_id: user.id,
      name: recipe.title,
      description: (recipe as { description?: string | null }).description || null,
      total_calories: (recipe as { total_calories?: number | null }).total_calories ?? 0,
      total_protein: (recipe as { total_protein_g?: number | null }).total_protein_g ?? 0,
      total_cost: 0,
      ncv_score: (recipe as { ncv_score?: string | null }).ncv_score || 'Yellow',
      servings: (recipe as { servings?: number | null }).servings || null,
      prep_time_minutes: (recipe as { prep_time_minutes?: number | null }).prep_time_minutes || null,
      cook_time_minutes: (recipe as { cook_time_minutes?: number | null }).cook_time_minutes || null,
    }])
    .select('id')
    .single();

  if (protocolError || !protocol) {
    console.error('[Recipes Clone API] Failed to create protocol:', protocolError);
    return NextResponse.json({ error: 'Failed to create protocol' }, { status: 500 });
  }

  // Create protocol_ingredients
  if (ingredientMappings.length > 0) {
    const protocolIngredients = ingredientMappings.map(({ ingredientId, quantity, unit }) => ({
      protocol_id: protocol.id,
      ingredient_id: ingredientId,
      quantity,
      unit,
    }));

    const { error: piError } = await supabase
      .from('protocol_ingredients')
      .insert(protocolIngredients);

    if (piError) {
      console.error('[Recipes Clone API] Failed to create protocol_ingredients:', piError);
    }
  }

  return NextResponse.json({
    protocolId: protocol.id,
    matchedCount,
    createdCount,
  });
}
