// app/api/recipes/[id]/save/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/recipes/[id]/save
 * Toggle save for the authenticated user on a recipe.
 * Returns: { saved: boolean, save_count: number }
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase.rpc('toggle_recipe_save', {
    p_recipe_id: id,
  });

  if (error) {
    console.error('[Recipes Save API] toggle_recipe_save RPC failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
