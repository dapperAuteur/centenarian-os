// app/api/finance/wallet/route.ts
// GET ?today=YYYY-MM-DD: the Wallet (plans/66 Part 2, W1).
//
// -> 200 {
//      today, home_currency,
//      net_worth: { total, cash, bank, retirement, policy_cash_value, assets, debts },
//      cash:   { total, pockets: [{ id, name, currency, balance, home, overdrawn, count_status,
//                days_since_count, needs_count }], needs_count, counts_ready },
//      bank:   { total, checking, savings, set_aside, accounts: [...] },
//      credit: { threshold, used, limit_total, available, percent, warn, lines: [...],
//                no_limit_count, no_limit_owed },
//      loans:  { owed, minimums, no_payment_count, limit_on_account: [{ id, name }],
//                loans: [{ ..., starting_amount, starting_date,
//                owed, as_of, apr, minimum, minimum_source ('statement' | 'last_payment' | null),
//                minimum_date, at_minimum: { months, payoff_date, total_interest,
//                never_pays_off, over_max } | null }] },
//      assets: { total, your_value_total, book_value_total, top, no_value, ... },
//      retirement: { ready, funds, years_left, retirement_age, age_assumed, gap, on_track, ... } | null,
//      insurance: { ready, coverage, counts, other_currency },
//      unconverted: [{ section, id, name, currency, amount }],
//      brands: { home_currency, brands: [...], totals } | null,
//      warnings: string[]
//    }
// Amounts are in the home currency except where a row also carries its own currency. Formulas:
// lib/finance/wallet/logic.ts; business rows: lib/finance/brands/server.ts. Estimates, not advice.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceDb } from '@/lib/finance/debt/route-helpers';
import { requestToday } from '@/lib/finance/debt/server';
import { loadHomeCurrency } from '@/lib/finance/fx/server';
import { loadRetirementOverview } from '@/lib/finance/retirement/server';
import { bookValueMaps, loadBookValues } from '@/lib/equipment/book-values';
import { loadWalletInput } from '@/lib/finance/wallet/server';
import { buildWallet, retirementFromOverview } from '@/lib/finance/wallet/logic';
import { loadBrandSummaries } from '@/lib/finance/brands/server';

const message = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceDb();
  const today = requestToday(request.nextUrl.searchParams.get('today'));
  const warnings: string[] = [];

  try {
    const home = await loadHomeCurrency(db, user.id);
    const [walletRes, retirement, books, brands] = await Promise.all([
      loadWalletInput(db, user.id, today, home),
      // The Retirement page's own loader (RLS session client), so both pages show the same funds.
      loadRetirementOverview(supabase, user.id, today).catch((err) => {
        warnings.push(`Retirement could not be loaded: ${message(err, 'unknown error')}`);
        return null;
      }),
      loadBookValues(supabase, user.id).catch((err) => {
        warnings.push(`Book values could not be loaded: ${message(err, 'unknown error')}`);
        return null;
      }),
      loadBrandSummaries(db, user.id, today, home),
    ]);
    if (walletRes.error || !walletRes.input) {
      return NextResponse.json({ error: walletRes.error?.message ?? 'Could not load your accounts.' }, { status: 500 });
    }
    if (brands.error) warnings.push(`Businesses could not be loaded: ${brands.error.message ?? 'unknown error'}`);

    const view = buildWallet({
      ...walletRes.input,
      retirement: retirement ? retirementFromOverview(retirement) : null,
      bookValues: books ? bookValueMaps(books) : null,
    });
    return NextResponse.json({ ...view, brands: brands.summaries, warnings });
  } catch (err) {
    console.error('[api/finance/wallet]', message(err, 'Unknown error'));
    return NextResponse.json({ error: 'Could not load the Wallet. Nothing was changed.' }, { status: 500 });
  }
}
