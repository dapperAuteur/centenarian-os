// app/api/finance/transactions/similar/route.ts
// POST: "Find similar". Which of the caller's transactions share the chosen details.
//
// Body { criteria, page?, page_size? }
//   criteria: { vendor?, words?, amount?, amount_tolerance?, account_id?, category_id?, type?, from?, to? }
//   (see lib/finance/similar/criteria.ts; a detail that is left out is not checked)
//   -> { total, ids, transfer_count, truncated, capped, rows, home_currency }
//      ids: every match, newest first (at most 10,000; `capped` when there are more);
//      rows: one page of them with category and account, for the list;
//      truncated: more than 30,000 transactions passed the filters and the rest were not read.
// Body { page_ids } -> { rows }: another page of a list the client already has.
//
// POST, not GET, so the criteria never sit in a cached URL. Read-only.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/auth/ownership';
import { parseCriteria } from '@/lib/finance/similar/criteria';
import { findSimilarIds } from '@/lib/finance/similar/server';
import { withOptionalFx } from '@/lib/finance/fx/totals';
import { loadHomeCurrency } from '@/lib/finance/fx/server';
import { getServiceDb } from '@/lib/finance/transfers/server';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** The rows of `ids` that are the caller's, in the order given, ready for the list. */
async function loadRows(supabase: ServerClient, userId: string, ids: string[]) {
  if (ids.length === 0) return { rows: [], error: null };
  const { data, error } = await withOptionalFx((fxColumnsExist) =>
    supabase
      .from('financial_transactions')
      .select(
        fxColumnsExist
          ? '*, budget_categories(id, name, color), financial_accounts(id, name, institution_name, last_four, currency)'
          : '*, budget_categories(id, name, color), financial_accounts(id, name, institution_name, last_four)',
      )
      .eq('user_id', userId)
      .in('id', ids),
  );
  if (error) return { rows: [], error };
  const byId = new Map(((data ?? []) as unknown as { id: string }[]).map((row) => [row.id, row]));
  return { rows: ids.map((id) => byId.get(id)).filter(Boolean), error: null };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  // Another page of matches the client already has.
  if (Array.isArray(body?.page_ids)) {
    const ids = (body.page_ids as unknown[]).filter(isUuid).slice(0, MAX_PAGE_SIZE);
    const { rows, error } = await loadRows(supabase, user.id, ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rows });
  }

  const parsed = parseCriteria(body?.criteria);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const pageSize = Math.min(Math.max(parseInt(String(body?.page_size ?? DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const page = Math.max(parseInt(String(body?.page ?? 0), 10) || 0, 0);

  const [found, homeCurrency] = await Promise.all([
    findSimilarIds(supabase, user.id, parsed.criteria),
    loadHomeCurrency(getServiceDb(), user.id),
  ]);
  if (found.error) return NextResponse.json({ error: found.error.message ?? 'Could not search transactions' }, { status: 500 });

  const { rows, error } = await loadRows(supabase, user.id, found.ids.slice(page * pageSize, (page + 1) * pageSize));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    total: found.total,
    ids: found.ids,
    transfer_count: found.transferCount,
    truncated: found.truncated,
    capped: found.total > found.ids.length,
    rows,
    home_currency: homeCurrency,
  });
}
