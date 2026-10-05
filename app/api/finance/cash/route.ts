// app/api/finance/cash/route.ts
// GET: cash on hand. Every active cash account (financial_accounts.account_type
//      = 'cash') with its recorded balance in its own currency, its last count
//      and how fresh it is ('never' | 'stale' after 30 days | 'fresh'), plus the
//      cash account used most recently (forms start on it). Accounts in another
//      currency than the home currency also get balance_home and fx (today's
//      rate). ?today=YYYY-MM-DD is the person's local date (default the server's).
//      Before migration 213: ready false, and every account reads "never counted".
//
// Rules: lib/finance/cash/logic.ts. Reads: lib/finance/cash/server.ts.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadCashOverview } from '@/lib/finance/cash/server';
import { resolveToday } from '@/lib/finance/cash/request';
import { convert } from '@/lib/finance/fx/math';
import { getRate } from '@/lib/finance/fx/rates';
import { loadHomeCurrency } from '@/lib/finance/fx/server';
import { getServiceDb } from '@/lib/finance/transfers/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = resolveToday(request.nextUrl.searchParams.get('today'));
  const { overview, error } = await loadCashOverview(supabase, user.id, today);
  if (error || !overview) {
    return NextResponse.json({ error: error?.message || 'Could not load your cash accounts.' }, { status: 500 });
  }

  const db = getServiceDb();
  const home = await loadHomeCurrency(db, user.id);
  const accounts = await Promise.all(
    overview.accounts.map(async (account) => {
      if (account.currency === home) return { ...account, home_currency: home, balance_home: null, fx: null };
      const { rate } = await getRate(db, user.id, account.currency, home, today);
      return {
        ...account,
        home_currency: home,
        balance_home: rate ? convert(account.balance, rate.rate) : null,
        fx: rate,
      };
    }),
  );
  return NextResponse.json({ ...overview, home_currency: home, accounts });
}
