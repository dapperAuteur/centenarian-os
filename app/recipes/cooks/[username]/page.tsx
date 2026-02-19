// app/recipes/cooks/[username]/page.tsx
// Individual cook's public recipe listing.

import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import RecipeCard from '@/components/recipes/RecipeCard';
import type { Recipe, Profile } from '@/lib/types';

export const revalidate = 60;

type Params = { params: Promise<{ username: string }> };

export default async function CookPage({ params }: Params) {
  const { username } = await params;
  const supabase = await createClient();

  // Look up the profile by username
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, created_at, updated_at')
    .eq('username', username)
    .single();

  if (!profile) notFound();

  // Fetch this cook's public recipes
  const { data: recipes } = await supabase
    .from('recipes')
    .select(`
      id, slug, title, description, cover_image_url,
      published_at, tags, view_count, like_count, save_count, user_id,
      total_calories, total_protein_g, ncv_score,
      servings, prep_time_minutes, cook_time_minutes
    `)
    .eq('user_id', profile.id)
    .or('visibility.eq.public,and(visibility.eq.scheduled,scheduled_at.lte.now())')
    .order('published_at', { ascending: false });

  const p = profile as Profile;
  const recipeList = (recipes || []) as unknown as Recipe[];

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Cook profile header */}
      <div className="flex items-start gap-5 mb-10 pb-8 border-b border-gray-200">
        <div className="shrink-0">
          {p.avatar_url ? (
            <Image
              src={p.avatar_url}
              alt={p.display_name || p.username}
              width={72}
              height={72}
              className="w-18 h-18 rounded-full object-cover"
            />
          ) : (
            <div className="w-18 h-18 rounded-full bg-gradient-to-br from-orange-100 to-amber-200 flex items-center justify-center">
              <ChefHat className="w-8 h-8 text-orange-500" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">
            {p.display_name || p.username}
          </h1>
          <p className="text-sm text-gray-500 mb-2">@{p.username}</p>
          {p.bio && <p className="text-gray-600">{p.bio}</p>}
          <p className="text-sm text-gray-400 mt-2">
            {recipeList.length} {recipeList.length === 1 ? 'recipe' : 'recipes'}
          </p>
        </div>
      </div>

      {recipeList.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-gray-400">This cook hasn&apos;t published any recipes yet.</p>
          <Link href="/recipes" className="mt-3 inline-block text-sm text-orange-600 hover:underline">
            ← Browse all recipes
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {recipeList.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              author={{ username: p.username, display_name: p.display_name, avatar_url: p.avatar_url }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
