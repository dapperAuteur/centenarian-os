'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Heart, Bookmark, ExternalLink } from 'lucide-react';

interface RecipeItem {
  recipe_id: string;
  created_at: string;
  title: string;
  slug: string;
  description: string | null;
  published_at: string | null;
  author_username: string;
  author_display_name: string | null;
}

interface Props {
  userId: string;
  mode: 'liked' | 'saved';
}

export default function LikedSavedRecipes({ userId, mode }: Props) {
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const table = mode === 'liked' ? 'recipe_likes' : 'recipe_saves';

    async function load() {
      // Step 1: get junction rows + recipe data
      // NOTE: recipes.user_id → auth.users (not profiles), so profiles cannot be auto-joined.
      // We fetch profiles separately in step 2.
      const { data: rows } = await supabase
        .from(table)
        .select('recipe_id, created_at, recipes(id, title, slug, description, published_at, user_id)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!rows?.length) {
        setRecipes([]);
        setLoading(false);
        return;
      }

      // Step 2: collect unique author user_ids from the recipes
      const authorIds = [
        ...new Set(
          rows
            .map((r) => (r.recipes as { user_id?: string } | null)?.user_id)
            .filter(Boolean) as string[]
        ),
      ];

      // Step 3: batch-fetch profiles by those user_ids
      const { data: profiles } = authorIds.length
        ? await supabase.from('profiles').select('id, username, display_name').in('id', authorIds)
        : { data: [] };

      const profileMap: Record<string, { username: string; display_name: string | null }> = {};
      for (const p of profiles ?? []) {
        profileMap[p.id] = { username: p.username, display_name: p.display_name };
      }

      // Step 4: merge into a flat list
      const merged: RecipeItem[] = rows
        .map((r) => {
          const recipe = r.recipes as unknown as {
            id: string; title: string; slug: string;
            description: string | null; published_at: string | null; user_id: string;
          } | null;
          if (!recipe) return null;
          const prof = profileMap[recipe.user_id];
          if (!prof) return null;
          return {
            recipe_id: r.recipe_id,
            created_at: r.created_at,
            title: recipe.title,
            slug: recipe.slug,
            description: recipe.description,
            published_at: recipe.published_at,
            author_username: prof.username,
            author_display_name: prof.display_name,
          };
        })
        .filter(Boolean) as RecipeItem[];

      setRecipes(merged);
      setLoading(false);
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mode]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-6 w-6 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const Icon = mode === 'liked' ? Heart : Bookmark;
  const emptyLabel = mode === 'liked' ? 'liked recipes' : 'saved recipes';

  if (recipes.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400 space-y-2">
        <Icon className="w-10 h-10 mx-auto text-gray-300" />
        <p className="text-sm">No {emptyLabel} yet.</p>
        <p className="text-xs text-gray-400">
          Visit a recipe and click the{' '}
          {mode === 'liked' ? '♥ like' : '🔖 save'} button to add it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recipes.map((recipe) => (
        <div
          key={recipe.recipe_id}
          className="flex items-start justify-between gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-orange-200 hover:bg-orange-50 transition"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 truncate">{recipe.title}</p>
            {recipe.description && (
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{recipe.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
              <span>by {recipe.author_display_name || `@${recipe.author_username}`}</span>
              {recipe.published_at && (
                <>
                  <span>·</span>
                  <span>{new Date(recipe.published_at).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
          <Link
            href={`/recipes/cooks/${recipe.author_username}/${recipe.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-gray-400 hover:text-orange-600 transition"
            title="Open recipe"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      ))}
    </div>
  );
}
