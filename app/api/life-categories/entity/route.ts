// app/api/life-categories/entity/route.ts
// GET ?entity_type=&entity_id=: the life areas an item is tagged with.
//   -> { tags: [{ id, life_category_id, name, icon, color, auto?, derived?, from_category? }] }
//
// For a transaction (one category tree, migration 223) the answer also carries the life area its
// budget category sits under: `auto: true` marks a tag the app added from the category (it
// follows the category; the person can't remove it by hand), `derived: true` marks one that
// has no tag row yet (counted on read), and `from_category` names the budget category.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AUTO_SOURCE, loadLifeAreaByCategory } from '@/lib/categories/life-areas';
import { isMissingColumn } from '@/lib/finance/transfers/schema';

interface TagView {
  id: string;
  life_category_id: string;
  name?: string;
  icon?: string;
  color?: string;
  auto?: boolean;
  derived?: boolean;
  from_category?: string;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const entityType = request.nextUrl.searchParams.get('entity_type');
  const entityId = request.nextUrl.searchParams.get('entity_id');

  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entity_type and entity_id are required' }, { status: 400 });
  }

  const query = (columns: string) =>
    supabase
      .from('entity_life_categories')
      .select(columns)
      .eq('user_id', user.id)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

  // auto_source arrives with migration 223.
  let { data, error } = await query('id, life_category_id, auto_source, life_categories(id, name, icon, color)');
  if (error && isMissingColumn(error, 'auto_source')) {
    ({ data, error } = await query('id, life_category_id, life_categories(id, name, icon, color)'));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tags: TagView[] = ((data || []) as any[]).map((row) => ({
    id: row.id,
    life_category_id: row.life_category_id,
    ...row.life_categories,
    ...(row.auto_source === AUTO_SOURCE ? { auto: true } : {}),
  }));

  if (entityType === 'transaction') {
    const { data: tx } = await supabase
      .from('financial_transactions')
      .select('category_id, budget_categories(name)')
      .eq('id', entityId)
      .eq('user_id', user.id)
      .maybeSingle();
    const categoryId = (tx?.category_id as string | null) ?? null;
    if (categoryId) {
      const { map } = await loadLifeAreaByCategory(supabase, user.id, [categoryId]);
      const lifeId = map.get(categoryId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const categoryName = ((tx as any)?.budget_categories?.name as string | undefined) ?? undefined;
      if (lifeId) {
        const existing = tags.find((tag) => tag.life_category_id === lifeId);
        if (existing) {
          if (existing.auto) existing.from_category = categoryName;
        } else {
          const { data: area } = await supabase
            .from('life_categories')
            .select('id, name, icon, color')
            .eq('id', lifeId)
            .eq('user_id', user.id)
            .maybeSingle();
          if (area) {
            tags.push({
              id: `derived:${lifeId}`,
              life_category_id: lifeId,
              name: area.name,
              icon: area.icon,
              color: area.color,
              auto: true,
              derived: true,
              from_category: categoryName,
            });
          }
        }
      }
    }
  }

  return NextResponse.json({ tags });
}
