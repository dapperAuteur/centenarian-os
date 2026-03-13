// app/api/finance/transactions/bulk/route.ts
// POST: Apply bulk updates to multiple transactions at once.
// Supports: category_id, brand_id (via updates{}), life_category_id (tags all IDs).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { ids, updates, life_category_id } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 });
  }
  if (ids.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 IDs per bulk operation' }, { status: 400 });
  }

  const db = getDb();
  let updated = 0;
  let tagged = 0;

  // Bulk field update (category_id, brand_id)
  if (updates && typeof updates === 'object') {
    const allowed = ['category_id', 'brand_id'];
    const payload: Record<string, unknown> = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) payload[key] = updates[key] || null;
    }
    if (Object.keys(payload).length > 0) {
      const { error } = await db
        .from('financial_transactions')
        .update(payload)
        .in('id', ids)
        .eq('user_id', user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      updated = ids.length;
    }
  }

  // Bulk life category tagging (upsert, ignore duplicates)
  if (life_category_id) {
    const rows = ids.map((entity_id: string) => ({
      user_id: user.id,
      life_category_id,
      entity_type: 'transaction',
      entity_id,
    }));
    const { error } = await db
      .from('entity_life_categories')
      .upsert(rows, { onConflict: 'user_id,entity_type,entity_id,life_category_id', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    tagged = ids.length;
  }

  return NextResponse.json({ updated, tagged });
}
