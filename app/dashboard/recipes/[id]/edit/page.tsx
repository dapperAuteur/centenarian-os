import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import RecipeForm from '@/components/recipes/RecipeForm';
import type { Recipe, RecipeIngredient, RecipeMedia, Profile } from '@/lib/types';

type Props = { params: Promise<{ id: string }> };

export default async function EditRecipePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch recipe (with ingredients and media) and profile in parallel
  const [recipeResult, profileResult] = await Promise.all([
    supabase
      .from('recipes')
      .select(`
        *,
        recipe_ingredients(*),
        recipe_media(*)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .order('sort_order', { referencedTable: 'recipe_ingredients', ascending: true })
      .order('sort_order', { referencedTable: 'recipe_media', ascending: true })
      .single(),
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
  ]);

  if (!recipeResult.data) notFound();
  if (!profileResult.data) redirect('/dashboard/recipes');

  const recipe = recipeResult.data as Recipe & {
    recipe_ingredients: RecipeIngredient[];
    recipe_media: RecipeMedia[];
  };
  const profile = profileResult.data as Profile;

  return <RecipeForm recipe={recipe} username={profile.username} />;
}
