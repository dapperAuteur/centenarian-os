// app/api/brands/[id]/pl/route.ts
// GET: P&L summary for a brand within a date range
// Returns: { brand, income, expenses, net, transactions[] }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  let query = supabase
    .from('financial_transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('brand_id', id)
    .order('transaction_date', { ascending: false });

  if (from) query = query.gte('transaction_date', from);
  if (to) query = query.lte('transaction_date', to);

  const { data: transactions, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const txs = transactions || [];
  const income = txs.filter((t) => t.type === 'income').reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const expenses = txs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + (t.amount ?? 0), 0);

  return NextResponse.json({
    brand,
    income: parseFloat(income.toFixed(2)),
    expenses: parseFloat(expenses.toFixed(2)),
    net: parseFloat((income - expenses).toFixed(2)),
    transactions: txs,
  });
}
