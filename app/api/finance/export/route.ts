// app/api/finance/export/route.ts
// GET: export all transactions as CSV

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  const rows = data || [];

  // Build CSV
  const header = 'Date,Type,Amount,Description,Vendor,Category,Notes';
  const csvRows = rows.map((tx) => {
    const cat = tx.budget_categories as { name: string } | null;
    return [
      tx.transaction_date,
      tx.type,
      tx.amount,
      csvEscape(tx.description || ''),
      csvEscape(tx.vendor || ''),
      csvEscape(cat?.name || ''),
      csvEscape(tx.notes || ''),
    ].join(',');
  });

  const csv = [header, ...csvRows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="centenarianos-finance-export.csv"`,
    },
  });
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
