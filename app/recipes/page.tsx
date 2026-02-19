// app/recipes/page.tsx
// Public recipe listing with ISR and pagination.

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import RecipeCard from '@/components/recipes/RecipeCard';
import { ChefHat, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Recipe, Profile } from '@/lib/types';

export const revalidate = 60;

const PER_PAGE = 20;

interface PageProps {
  searchParams: Promise<{ page?: string; tag?: string }>;
}

export default async function RecipesPage({ searchParams }: PageProps) {
  const { page: pageParam, tag } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || '1'));
  const offset = (page - 1) * PER_PAGE;

  const supabase = await createClient();

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
    .range(offset, offset + PER_PAGE - 1);

  if (tag) {
    query = query.contains('tags', [tag]);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('[/recipes] Supabase error:', error);
    notFound();
  }

  const recipes = data || [];
  const totalPages = Math.ceil((count || 0) / PER_PAGE);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {tag ? `Recipes tagged "${tag}"` : 'All Recipes'}
          </h1>
          <p className="mt-1 text-gray-500">
            {count ?? 0} {(count ?? 0) === 1 ? 'recipe' : 'recipes'}.{' '}
            <Link href="/recipes/cooks" className="text-orange-600 hover:underline">
              Browse cooks →
            </Link>
          </p>
        </div>
        {tag && (
          <Link
            href="/recipes"
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear filter
          </Link>
        )}
      </div>

      {recipes.length === 0 ? (
        <div className="py-20 text-center space-y-4">
          <ChefHat className="w-12 h-12 text-gray-300 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-500">No recipes yet</h2>
          <p className="text-gray-400">Be the first to share a recipe!</p>
          <Link
            href="/dashboard/recipes/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition"
          >
            Create a recipe
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map((row) => {
              const profileData = (row as { profiles: Pick<Profile, 'username' | 'display_name' | 'avatar_url'> }).profiles;
              return (
                <RecipeCard
                  key={row.id}
                  recipe={row as unknown as Recipe}
                  author={profileData}
                />
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-3">
              {page > 1 && (
                <Link
                  href={`/recipes?page=${page - 1}${tag ? `&tag=${tag}` : ''}`}
                  className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Link>
              )}
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/recipes?page=${page + 1}${tag ? `&tag=${tag}` : ''}`}
                  className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
