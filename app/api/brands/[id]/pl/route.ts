// app/api/brands/[id]/pl/route.ts
// GET: P&L summary for a brand within a date range
// Returns: { brand, income, expenses, net, transactions[], transfers_excluded }
//
// Transfers between the person's own accounts (and card or loan payments) are
// not income or expenses, so they are left out of the totals and of the
// transaction list, which has to add up to those totals. `transfers_excluded`
// says how many of the brand's rows were left out for that reason.
//
// Totals are in the user's home currency (`home_currency`; lib/finance/fx/totals.ts); rows keep
// their own amount and currency. Foreign rows with no rate yet are left out of the totals and
// counted in `unconverted`.
//
// Rows are read 1000 at a time until the last page (lib/finance/brands/server.ts), so a business
// with more than 1000 transactions in the range is no longer cut short.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { countsTowardTotals } from '@/lib/finance/transfers/schema';
import { getServiceDb } from '@/lib/finance/transfers/server';
import { amountForTotals } from '@/lib/finance/fx/totals';
import { loadHomeCurrency } from '@/lib/finance/fx/server';
import { loadBrandTransactions } from '@/lib/finance/brands/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify brand belongs to user
  const { data: brand } = await supabase
    .from('user_brands')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  // Every page of the business's rows; the account's currency comes along once migration 210 is in.
  const [{ rows: transactions, error }, homeCurrency] = await Promise.all([
    loadBrandTransactions(supabase, user.id, { brandId: id, from, to }),
    loadHomeCurrency(getServiceDb(), user.id),
  ]);
  if (error) return NextResponse.json({ error: error.message ?? 'Could not load transactions.' }, { status: 500 });

  // `select('*')` returns transfer_group_id only once migration 202 has added
  // it, and countsTowardTotals() reads a missing value as "not a transfer",
  // so this works on a database with or without the column.
  type PlRow = {
    type: string;
    amount: number;
    amount_home?: number | null;
    currency?: string | null;
    transfer_group_id?: string | null;
    source?: string | null;
    financial_accounts?: { currency?: string | null } | null;
  };
  const allRows = (transactions || []) as unknown as PlRow[];
  const txs = allRows.filter(countsTowardTotals);
  let unconverted = 0;
  const total = (type: 'income' | 'expense') =>
    txs.filter((t) => t.type === type).reduce((sum, t) => {
      const amount = amountForTotals(t, homeCurrency);
      if (amount === null) {
        unconverted += 1;
        return sum;
      }
      return sum + amount;
    }, 0);
  const income = total('income');
  const expenses = total('expense');

  return NextResponse.json({
    brand,
    income: parseFloat(income.toFixed(2)),
    expenses: parseFloat(expenses.toFixed(2)),
    net: parseFloat((income - expenses).toFixed(2)),
    transactions: txs,
    transfers_excluded: allRows.length - txs.length,
    home_currency: homeCurrency,
    unconverted,
  });
}
