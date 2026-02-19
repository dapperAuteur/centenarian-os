// app/recipes/cooks/page.tsx
// Directory of all cooks who have at least one public recipe.

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import CookCard from '@/components/recipes/CookCard';
import { ChefHat } from 'lucide-react';
import type { Profile } from '@/lib/types';

export const revalidate = 60;

export default async function CooksPage() {
  const supabase = await createClient();

  // Get user_ids that have at least one public (or live-scheduled) recipe
  const { data: recipeRows } = await supabase
    .from('recipes')
    .select('user_id')
    .or('visibility.eq.public,and(visibility.eq.scheduled,scheduled_at.lte.now())');

  if (!recipeRows?.length) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <ChefHat className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Cooks</h1>
        <p className="text-gray-400">No cooks have published recipes yet.</p>
        <Link
          href="/dashboard/recipes/new"
          className="mt-4 inline-block text-sm text-orange-600 hover:underline"
        >
          Share your first recipe →
        </Link>
      </main>
    );
  }

  // Count recipes per cook
  const countMap: Record<string, number> = {};
  for (const row of recipeRows) {
    countMap[row.user_id] = (countMap[row.user_id] || 0) + 1;
  }
  const cookIds = Object.keys(countMap);

  // Fetch profiles for those cooks
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, created_at, updated_at')
    .in('id', cookIds)
    .order('username', { ascending: true });

  // Sort by recipe count descending
  const sorted = (profiles || []).sort(
    (a, b) => (countMap[b.id] || 0) - (countMap[a.id] || 0)
  );

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Cooks</h1>
        <p className="mt-1 text-gray-500">
          {sorted.length} {sorted.length === 1 ? 'cook' : 'cooks'} sharing recipes on CentenarianOS.{' '}
          <Link href="/recipes" className="text-orange-600 hover:underline">
            ← All recipes
          </Link>
        </p>
      </div>

      {/* Cook grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sorted.map((profile) => (
          <CookCard
            key={profile.id}
            profile={profile as Profile}
            recipeCount={countMap[profile.id] || 0}
          />
        ))}
      </div>
    </main>
  );
}
