// app/api/brands/[id]/summary/route.ts
// GET ?today=YYYY-MM-DD: one business page (/dashboard/finance/brands/[id]).
//
// -> 200 {
//      brand, home_currency, today,
//      this_year: { money_in, money_out, net, unconverted, transfers },
//      cash_flow: { month | quarter | year: { granularity, rows: [{ key, label, from, to,
//                   money_in, money_out, net }], totals, unconverted } },     // newest period first
//      invoices: { owed_to_you, owed_to_you_count, you_owe, you_owe_count },
//      expected_income: { total, count, until },
//      tagged: { transactions, invoices, trips }
//    }
// -> 404 when the business isn't the caller's, or the id isn't a UUID.
// -> 500 with a plain message; the database error is logged, never sent.
// Home currency; transfers left out; every page of rows read. Rules: lib/finance/brands/logic.ts.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceDb } from '@/lib/finance/debt/route-helpers';
import { requestToday } from '@/lib/finance/debt/server';
import { loadHomeCurrency } from '@/lib/finance/fx/server';
import { loadBrandPage } from '@/lib/finance/brands/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceDb();
  const today = requestToday(request.nextUrl.searchParams.get('today'));
  try {
    const home = await loadHomeCurrency(db, user.id);
    const { page, error } = await loadBrandPage(db, user.id, id, today, home);
    if (error) {
      console.error('[api/brands/summary]', error.code ?? '', error.message ?? 'Unknown error');
      return NextResponse.json({ error: 'Could not load the business. Nothing was changed.' }, { status: 500 });
    }
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(page);
  } catch (err) {
    console.error('[api/brands/summary]', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: 'Could not load the business. Nothing was changed.' }, { status: 500 });
  }
}
