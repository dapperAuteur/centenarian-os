// app/api/finance/export/route.ts
// GET: export all transactions as CSV

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildCsvResponse } from '@/lib/csv/helpers';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const from = params.get('from');
  const to = params.get('to');

  let query = supabase
    .from('financial_transactions')
    .select('*, budget_categories(name)')
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: true });

  if (from) query = query.gte('transaction_date', from);
  if (to) query = query.lte('transaction_date', to);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((tx) => {
    const cat = tx.budget_categories as { name: string } | null;
    return [
      tx.transaction_date || '',
      tx.type || '',
      String(tx.amount ?? ''),
      tx.description || '',
      tx.vendor || '',
      cat?.name || '',
      tx.notes || '',
    ];
  });

  return buildCsvResponse(
    ['Date', 'Type', 'Amount', 'Description', 'Vendor', 'Category', 'Notes'],
    rows,
    'centenarianos-finance-export.csv',
  );
}
