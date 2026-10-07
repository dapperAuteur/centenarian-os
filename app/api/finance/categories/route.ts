// app/api/finance/categories/route.ts
// GET: list budget categories for the authenticated user (with life_category_id, the life area
//      each sits under, once migration 223 is applied)
// POST: create a new budget category; optional life_category_id places it under one of the
//      caller's life areas (before migration 223 it is created unplaced, with a notice)
// PATCH: update a category. life_category_id (null to clear) moves it to another life area and
//      re-syncs the automatic life-area tags of its transactions; answers 409 "Run migration 223
//      first" before that migration.
// DELETE: delete a category. Its transactions become uncategorized and lose the automatic
//      life-area tag that came from it (tags a person added stay).
//
// One category tree: plans/63 E, lib/categories/*.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkLifeAreaReference, placeBudgetCategory, TREE_NOT_READY } from '@/lib/categories/server';
import { syncAutoLifeAreas, transactionIdsWhere } from '@/lib/categories/life-areas';
import { isMissingColumn } from '@/lib/finance/transfers/schema';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, monthly_budget, color } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const life = await checkLifeAreaReference(supabase, user.id, body.life_category_id);
  if (!life.ok) return NextResponse.json({ error: life.error }, { status: life.status });

  const row = {
    user_id: user.id,
    name: name.trim(),
    monthly_budget: monthly_budget || null,
    color: color || '#6366f1',
  };
  let notice: string | undefined;
  let { data, error } = await supabase
    .from('budget_categories')
    .insert(life.value ? { ...row, life_category_id: life.value } : row)
    .select()
    .single();
  // Before migration 223 the category is still created, just not under a life area.
  if (error && life.value && isMissingColumn(error, 'life_category_id')) {
    ({ data, error } = await supabase.from('budget_categories').insert(row).select().single());
    notice = 'Created. Run migration 223 first to place it under a life area.';
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data, ...(notice ? { notice } : {}) });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, name, monthly_budget, color } = body;

  if (!id) return NextResponse.json({ error: 'Category ID required' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (monthly_budget !== undefined) updates.monthly_budget = monthly_budget || null;
  if (color !== undefined) updates.color = color;
  const placing = Object.prototype.hasOwnProperty.call(body, 'life_category_id');

  if (Object.keys(updates).length === 0 && !placing) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  let category: unknown = null;
  if (Object.keys(updates).length > 0) {
    const { data, error } = await supabase
      .from('budget_categories')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    category = data;
  }

  if (!placing) return NextResponse.json({ category });

  const placed = await placeBudgetCategory(supabase, user.id, id, body.life_category_id);
  if (!placed.ok) {
    const status = placed.code === TREE_NOT_READY.code ? 409 : placed.status;
    return NextResponse.json({ error: placed.error, code: placed.code }, { status });
  }
  return NextResponse.json({
    category: placed.value.category,
    retagged: {
      transactions: placed.value.transactions,
      added: placed.value.tagsAdded,
      removed: placed.value.tagsRemoved,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Category ID required' }, { status: 400 });

  // The transactions that lose this category also lose the automatic life area it gave them.
  const { ids: affected } = await transactionIdsWhere(supabase, user.id, 'category_id', id);

  const { error } = await supabase
    .from('budget_categories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (affected.length > 0) await syncAutoLifeAreas(supabase, user.id, affected);
  return NextResponse.json({ ok: true });
}
