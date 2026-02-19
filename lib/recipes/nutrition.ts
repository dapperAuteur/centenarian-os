import { RecipeIngredient } from '@/lib/types';

export type NCVScore = 'Green' | 'Yellow' | 'Red';

interface NutritionTotals {
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
  ncv_score: NCVScore;
}

/**
 * Aggregates nutrition totals from recipe ingredients and computes the NCV score.
 * NCV (Nutritional Caloric Value) uses the same formula as the fuel module:
 *   nutrientDensity = (protein + fiber) / calories
 *   Green > 0.15, Yellow > 0.08, Red otherwise
 */
export function calculateRecipeNutrition(ingredients: RecipeIngredient[]): NutritionTotals {
  const totals = ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + (ing.calories ?? 0),
      protein: acc.protein + (ing.protein_g ?? 0),
      carbs: acc.carbs + (ing.carbs_g ?? 0),
      fat: acc.fat + (ing.fat_g ?? 0),
      fiber: acc.fiber + (ing.fiber_g ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  const nutrientDensity = (totals.protein + totals.fiber) / (totals.calories || 1);
  const ncv_score: NCVScore =
    nutrientDensity > 0.15 ? 'Green' : nutrientDensity > 0.08 ? 'Yellow' : 'Red';

  return {
    total_calories: Math.round(totals.calories * 100) / 100,
    total_protein_g: Math.round(totals.protein * 100) / 100,
    total_carbs_g: Math.round(totals.carbs * 100) / 100,
    total_fat_g: Math.round(totals.fat * 100) / 100,
    total_fiber_g: Math.round(totals.fiber * 100) / 100,
    ncv_score,
  };
}

/**
 * Calculates per-serving nutrition from total recipe nutrition.
 */
export function perServing(totals: NutritionTotals, servings: number): NutritionTotals {
  if (servings <= 0) return totals;
  return {
    total_calories: Math.round((totals.total_calories / servings) * 100) / 100,
    total_protein_g: Math.round((totals.total_protein_g / servings) * 100) / 100,
    total_carbs_g: Math.round((totals.total_carbs_g / servings) * 100) / 100,
    total_fat_g: Math.round((totals.total_fat_g / servings) * 100) / 100,
    total_fiber_g: Math.round((totals.total_fiber_g / servings) * 100) / 100,
    ncv_score: totals.ncv_score,
  };
}

/**
 * Calculates nutrition for a single ingredient given 100g values and a quantity in grams.
 * Use this when the unit is grams; for other units the caller must handle conversion.
 */
export function nutritionForQuantity(
  per100g: { calories: number; protein: number; carbs: number; fat: number; fiber: number },
  quantityGrams: number
): { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number } {
  const factor = quantityGrams / 100;
  return {
    calories: Math.round(per100g.calories * factor * 100) / 100,
    protein_g: Math.round(per100g.protein * factor * 100) / 100,
    carbs_g: Math.round(per100g.carbs * factor * 100) / 100,
    fat_g: Math.round(per100g.fat * factor * 100) / 100,
    fiber_g: Math.round(per100g.fiber * factor * 100) / 100,
  };
}
