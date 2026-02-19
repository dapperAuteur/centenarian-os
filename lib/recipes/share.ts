import { Recipe } from '@/lib/types';

interface RecipeShareUrls {
  recipeUrl: string;
  email: string;
  linkedin: string;
}

/**
 * Builds share URLs for a recipe.
 * Requires NEXT_PUBLIC_APP_URL to be set in environment variables.
 * Recipe public URL: /recipes/cooks/[username]/[slug]
 */
export function buildRecipeShareUrls(
  recipe: Pick<Recipe, 'title' | 'slug'>,
  username: string
): RecipeShareUrls {
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  const recipeUrl = `${base}/recipes/cooks/${username}/${recipe.slug}`;

  return {
    recipeUrl,
    email: `mailto:?subject=${encodeURIComponent(recipe.title)}&body=${encodeURIComponent(recipeUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(recipeUrl)}`,
  };
}
