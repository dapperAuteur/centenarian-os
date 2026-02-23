import { Recipe } from '@/lib/types';

interface RecipeShareUrls {
  recipeUrl: string;
  email: string;
  linkedin: string;
  facebook: string;
}

/**
 * Builds share URLs for a recipe.
 * Uses the Switchy short link when available, falling back to the full URL.
 */
export function buildRecipeShareUrls(
  recipe: Pick<Recipe, 'title' | 'slug'> & { short_link_url?: string | null },
  username: string,
): RecipeShareUrls {
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  const fullUrl = `${base}/recipes/cooks/${username}/${recipe.slug}`;
  const recipeUrl = recipe.short_link_url ?? fullUrl;

  return {
    recipeUrl,
    email: `mailto:?subject=${encodeURIComponent(recipe.title)}&body=${encodeURIComponent(recipeUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(recipeUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(recipeUrl)}`,
  };
}
