// app/api/ocr/match-items/route.ts
// Fuzzy-match scanned line items against existing item_prices, recipe_ingredients, and equipment.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

interface ItemToMatch {
  name: string;
  unit_price?: number;
  category_hint?: string;
}

interface MatchResult {
  original_name: string;
  normalized_name: string;
  matches: {
    id: string;
    name: string;
    last_price: number | null;
    last_date: string | null;
    vendor_name: string | null;
    source_table: string;
  }[];
  is_new: boolean;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { items } = (await request.json()) as { items: ItemToMatch[] };
  if (!items?.length) {
    return NextResponse.json({ error: 'No items to match' }, { status: 400 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const results: MatchResult[] = [];

  for (const item of items.slice(0, 100)) {
    const normalized = item.name.toLowerCase().trim();
    const matches: MatchResult['matches'] = [];

    // 1. Check item_prices for existing price records (fuzzy via ILIKE)
    const { data: priceMatches } = await serviceClient
      .from('item_prices')
      .select('id, item_name, price, recorded_date, vendor_name')
      .eq('user_id', user.id)
      .ilike('item_name', `%${normalized}%`)
      .order('recorded_date', { ascending: false })
      .limit(3);

    if (priceMatches) {
      for (const pm of priceMatches) {
        matches.push({
          id: pm.id,
          name: pm.item_name,
          last_price: pm.price,
          last_date: pm.recorded_date,
          vendor_name: pm.vendor_name,
          source_table: 'item_prices',
        });
      }
    }

    // 2. Check recipe_ingredients for matching ingredient names
    if (!item.category_hint || ['grocery', 'produce', 'dairy', 'meat', 'bakery', 'beverage'].includes(item.category_hint)) {
      const { data: ingredientMatches } = await serviceClient
        .from('recipe_ingredients')
        .select('id, name')
        .ilike('name', `%${normalized}%`)
        .limit(3);

      if (ingredientMatches) {
        // Deduplicate by name
        const seen = new Set(matches.map((m) => m.name.toLowerCase()));
        for (const im of ingredientMatches) {
          if (!seen.has(im.name.toLowerCase())) {
            matches.push({
              id: im.id,
              name: im.name,
              last_price: null,
              last_date: null,
              vendor_name: null,
              source_table: 'recipe_ingredients',
            });
            seen.add(im.name.toLowerCase());
          }
        }
      }
    }

    // 3. Check equipment for matching item names
    if (item.category_hint && ['equipment', 'tools', 'electronics', 'hardware'].includes(item.category_hint)) {
      const { data: equipMatches } = await serviceClient
        .from('equipment')
        .select('id, name, purchase_price')
        .eq('user_id', user.id)
        .ilike('name', `%${normalized}%`)
        .limit(3);

      if (equipMatches) {
        for (const em of equipMatches) {
          matches.push({
            id: em.id,
            name: em.name,
            last_price: em.purchase_price,
            last_date: null,
            vendor_name: null,
            source_table: 'equipment',
          });
        }
      }
    }

    results.push({
      original_name: item.name,
      normalized_name: normalized,
      matches,
      is_new: matches.length === 0,
    });
  }

  return NextResponse.json({ results });
}
