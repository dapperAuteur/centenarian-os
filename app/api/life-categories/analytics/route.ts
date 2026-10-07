// app/api/life-categories/analytics/route.ts
// GET ?period=<days>: per life area, how many items and how much spending in the period.
//
// One category tree (plans/63 E, migration 223): a transaction counts toward the life area its
// budget category sits under, plus any life area it is tagged with, once each
// (lib/categories/life-areas.ts rollUpLifeAreas). That is worked out here on read, so spending
// is right even for transactions categorized before their category was placed under a life area.
//
// The period: transactions count by transaction date (spending in the last N days); other items
// count by when they were tagged, as before. Transfers between the person's own accounts are
// not spending. Amounts are in the home currency (lib/finance/fx/totals.ts).
//   -> { analytics: [{ id, name, icon, color, entity_count, spending, entity_breakdown,
//                      from_budget_category }] }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { excludingTransfers, withoutTransfers } from '@/lib/finance/transfers/schema';
import { amountForTotals, FX_TOTALS_COLUMNS, withOptionalFx } from '@/lib/finance/fx/totals';
import { loadHomeCurrency } from '@/lib/finance/fx/server';
import { loadLifeAreaByCategory, rollUpLifeAreas, type RollUpTransaction } from '@/lib/categories/life-areas';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Rows per page, and the most pages read for one period. */
const PAGE = 1000;
const MAX_PAGES = 20;
const ID_CHUNK = 200;

type TxRow = {
  id: string;
  type: string;
  amount: number;
  category_id: string | null;
  amount_home?: number | null;
  currency?: string | null;
  financial_accounts?: { currency?: string | null } | null;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const period = parseInt(request.nextUrl.searchParams.get('period') || '30', 10);
  const since = new Date();
  since.setDate(since.getDate() - period);
  const sinceStr = since.toISOString();
  const sinceDate = sinceStr.slice(0, 10);

  const db = getDb();

  // Life areas, and tags on everything that is not a transaction (by when they were tagged).
  const [catRes, tagsRes, lifeMap, homeCurrency] = await Promise.all([
    db.from('life_categories').select('*').eq('user_id', user.id).order('sort_order'),
    db
      .from('entity_life_categories')
      .select('life_category_id, entity_type, entity_id')
      .eq('user_id', user.id)
      .neq('entity_type', 'transaction')
      .gte('created_at', sinceStr),
    loadLifeAreaByCategory(db, user.id),
    loadHomeCurrency(db, user.id),
  ]);
  if (catRes.error) return NextResponse.json({ error: catRes.error.message }, { status: 500 });
  const categories = catRes.data || [];

  // The period's transactions, transfers left out. Only the caller's own rows: this client
  // bypasses RLS. Works before migrations 202 and 210 (see excludingTransfers, withOptionalFx).
  const transactions: RollUpTransaction[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE;
    const { data: txns, error } = await withOptionalFx((fxColumnsExist) =>
      excludingTransfers((groupColumnExists) =>
        withoutTransfers(
          db
            .from('financial_transactions')
            .select(fxColumnsExist ? `id, amount, type, category_id, ${FX_TOTALS_COLUMNS}` : 'id, amount, type, category_id')
            .eq('user_id', user.id)
            .gte('transaction_date', sinceDate),
          groupColumnExists,
        )
          .order('id')
          .range(from, from + PAGE - 1),
      ),
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = (txns || []) as unknown as TxRow[];
    for (const tx of rows) {
      // A foreign amount with no rate yet adds nothing rather than its face value.
      transactions.push({ id: tx.id, type: tx.type, category_id: tx.category_id, amount: amountForTotals(tx, homeCurrency) ?? 0 });
    }
    if (rows.length < PAGE) break;
  }

  // Every tag on those transactions, whenever it was added.
  const transactionTags: { life_category_id: string; entity_id: string }[] = [];
  const ids = transactions.map((tx) => tx.id);
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await db
      .from('entity_life_categories')
      .select('life_category_id, entity_id')
      .eq('user_id', user.id)
      .eq('entity_type', 'transaction')
      .in('entity_id', ids.slice(i, i + ID_CHUNK));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    transactionTags.push(...((data || []) as { life_category_id: string; entity_id: string }[]));
  }

  const totals = rollUpLifeAreas({
    lifeAreaIds: categories.map((cat) => cat.id as string),
    otherTags: (tagsRes.data || []) as { life_category_id: string; entity_type: string; entity_id: string }[],
    transactions,
    transactionTags,
    lifeAreaByCategory: lifeMap.map,
  });

  const analytics = categories.map((cat) => {
    const t = totals.get(cat.id);
    return {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      entity_count: t?.entity_count ?? 0,
      spending: t?.spending ?? 0,
      entity_breakdown: t?.entity_breakdown ?? {},
      from_budget_category: t?.from_budget_category ?? 0,
    };
  });

  return NextResponse.json({ analytics });
}
