// app/api/categories/tree/route.ts
// GET: the one category tree (plans/63 E, migration 223) for the signed-in user.
//   -> { life_areas: [{ id, name, icon, color, sort_order }],
//        budget_categories: [{ id, name, color, monthly_budget, sort_order, life_category_id }],
//        ready: boolean,        // false until migration 223 is applied ("Run migration 223 first")
//        suggestions: { [budget_category_id]: { lifeAreaId, lifeAreaName, reason } } }
// Life areas are the top level; a budget category's life_category_id is its parent (null = not
// placed yet). Suggestions are for unplaced categories only and are never applied here.
// Seeds the default life areas the first time, as GET /api/life-categories does.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadCategoryTree } from '@/lib/categories/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await loadCategoryTree(supabase, user.id, { seed: true });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const { lifeAreas, budgetCategories, ready, suggestions } = result.value;
  return NextResponse.json({
    life_areas: lifeAreas,
    budget_categories: budgetCategories,
    ready,
    suggestions,
  });
}
