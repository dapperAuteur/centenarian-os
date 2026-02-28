import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Active equipment with category info
  const { data: items, error } = await supabase
    .from('equipment')
    .select('id, purchase_price, current_value, category_id, equipment_categories(name)')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = items || [];
  const totalItems = list.length;
  const totalPurchaseValue = list.reduce((s, i) => s + (Number(i.purchase_price) || 0), 0);
  const totalCurrentValue = list.reduce((s, i) => s + (Number(i.current_value) || 0), 0);
  const depreciation = totalPurchaseValue - totalCurrentValue;

  // Category breakdown
  const catMap = new Map<string, { name: string; count: number; purchase: number; current: number }>();
  for (const item of list) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const catName = (item.equipment_categories as any)?.name || 'Uncategorized';
    const entry = catMap.get(catName) || { name: catName, count: 0, purchase: 0, current: 0 };
    entry.count += 1;
    entry.purchase += Number(item.purchase_price) || 0;
    entry.current += Number(item.current_value) || 0;
    catMap.set(catName, entry);
  }

  // ROI: find income transactions linked to equipment via activity_links
  let totalAttributedRevenue = 0;
  if (list.length > 0) {
    const equipIds = list.map((i) => i.id);

    // Get all activity links where equipment is source/target and the other end is a transaction
    const { data: links } = await supabase
      .from('activity_links')
      .select('source_type, source_id, target_type, target_id')
      .eq('user_id', user.id)
      .or(
        `and(source_type.eq.equipment,target_type.eq.transaction),and(target_type.eq.equipment,source_type.eq.transaction)`,
      );

    if (links && links.length > 0) {
      // Filter to links that involve our active equipment
      const txIds = new Set<string>();
      for (const link of links) {
        if (link.source_type === 'equipment' && equipIds.includes(link.source_id)) {
          txIds.add(link.target_id);
        } else if (link.target_type === 'equipment' && equipIds.includes(link.target_id)) {
          txIds.add(link.source_id);
        }
      }

      if (txIds.size > 0) {
        const { data: txs } = await supabase
          .from('financial_transactions')
          .select('amount, type')
          .in('id', Array.from(txIds))
          .eq('type', 'income');

        totalAttributedRevenue = (txs || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);
      }
    }
  }

  return NextResponse.json({
    totalItems,
    totalPurchaseValue,
    totalCurrentValue,
    depreciation,
    roi: totalPurchaseValue > 0
      ? ((totalAttributedRevenue - totalPurchaseValue) / totalPurchaseValue) * 100
      : 0,
    totalAttributedRevenue,
    categories: Array.from(catMap.values()).sort((a, b) => b.current - a.current),
  });
}
