import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const period = parseInt(request.nextUrl.searchParams.get('period') || '30', 10);
  const since = new Date();
  since.setDate(since.getDate() - period);
  const sinceStr = since.toISOString();

  const db = getDb();

  // Fetch life categories and all tags in parallel
  const [catRes, tagsRes] = await Promise.all([
    db.from('life_categories').select('*').eq('user_id', user.id).order('sort_order'),
    db.from('entity_life_categories').select('*').eq('user_id', user.id).gte('created_at', sinceStr),
  ]);

  const categories = catRes.data || [];
  const allTags = tagsRes.data || [];

  // Get transaction IDs that are tagged, to compute spending per category
  const taggedTransactionIds = allTags
    .filter((t) => t.entity_type === 'transaction')
    .map((t) => ({ category_id: t.life_category_id, entity_id: t.entity_id }));

  let transactionAmounts: Record<string, number> = {};

  if (taggedTransactionIds.length > 0) {
    const uniqueIds = [...new Set(taggedTransactionIds.map((t) => t.entity_id))];
    const { data: txns } = await db
      .from('financial_transactions')
      .select('id, amount, type')
      .in('id', uniqueIds);

    const txMap = new Map((txns || []).map((t) => [t.id, t]));
    transactionAmounts = {};

    for (const tagged of taggedTransactionIds) {
      const tx = txMap.get(tagged.entity_id);
      if (tx) {
        const amt = tx.type === 'expense' ? Number(tx.amount) : -Number(tx.amount);
        transactionAmounts[tagged.category_id] = (transactionAmounts[tagged.category_id] || 0) + amt;
      }
    }
  }

  // Build per-category analytics
  const analytics = categories.map((cat) => {
    const catTags = allTags.filter((t) => t.life_category_id === cat.id);

    // Group by entity_type
    const entityBreakdown: Record<string, number> = {};
    for (const tag of catTags) {
      entityBreakdown[tag.entity_type] = (entityBreakdown[tag.entity_type] || 0) + 1;
    }

    return {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      entity_count: catTags.length,
      spending: transactionAmounts[cat.id] || 0,
      entity_breakdown: entityBreakdown,
    };
  });

  return NextResponse.json({ analytics });
}
