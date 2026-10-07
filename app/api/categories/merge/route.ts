// app/api/categories/merge/route.ts
// POST { level: 'budget' | 'life', from_id, into_id }: merge two categories of the same level
// in the one category tree (plans/63 E). Both must be the caller's own.
//
//   level 'budget'  everything that uses `from_id` (transactions, recurring payments, invoices
//                   and invoice templates, vendors' default categories, cash counts, insurance
//                   premiums, schedule pay settings) moves to `into_id`, then `from_id` is
//                   deleted. `into_id` keeps its own budgets by month; `from_id`'s are dropped.
//                   Moved transactions get their automatic life area re-synced.
//                   -> { moved: { 'table.column': n }, transactions }
//   level 'life'    budget categories and tags under `from_id` move to `into_id` (a tag a person
//                   added stays theirs), then `from_id` is deleted.
//                   -> { budget_categories, tags }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { mergeBudgetCategories, mergeLifeAreas } from '@/lib/categories/server';

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
  const level = body?.level;
  if (level !== 'budget' && level !== 'life') {
    return NextResponse.json({ error: "level must be 'budget' or 'life'" }, { status: 400 });
  }

  // Service role: the merge moves rows across several tables in one go. Every id is checked
  // against the caller first (lib/auth/ownership.ts), and every write is scoped by user_id.
  const db = getDb();
  if (level === 'budget') {
    const result = await mergeBudgetCategories(db, user.id, body.from_id, body.into_id);
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
    return NextResponse.json(result.value);
  }
  const result = await mergeLifeAreas(db, user.id, body.from_id, body.into_id);
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ budget_categories: result.value.budgetCategories, tags: result.value.tags });
}
