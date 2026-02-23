// app/api/finance/import/route.ts
// POST: bulk import financial transactions from parsed CSV rows

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ImportRow {
  transaction_date: string;
  amount: string | number;
  type?: string;
  description?: string;
  vendor?: string;
  category_name?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: { rows?: ImportRow[] } = await request.json();
  const rows = body.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
  }
  if (rows.length > 1000) {
    return NextResponse.json({ error: 'Maximum 1000 rows per import' }, { status: 400 });
  }

  // Fetch existing categories for name matching
  const { data: categories } = await supabase
    .from('budget_categories')
    .select('id, name')
    .eq('user_id', user.id);

  const catMap = new Map<string, string>();
  for (const c of categories || []) {
    catMap.set(c.name.toLowerCase(), c.id);
  }

  const payloads: Record<string, unknown>[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Validate date
    if (!row.transaction_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.transaction_date)) {
      errors.push(`Row ${i + 1}: invalid date "${row.transaction_date}"`);
      continue;
    }

    // Validate amount
    const amount = typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount;
    if (isNaN(amount) || amount === 0) {
      errors.push(`Row ${i + 1}: invalid amount`);
      continue;
    }

    // Determine type from amount sign if not specified
    const type = row.type || (amount < 0 ? 'expense' : amount > 0 ? 'income' : 'expense');

    // Match category by name
    const categoryId = row.category_name
      ? catMap.get(row.category_name.toLowerCase()) || null
      : null;

    payloads.push({
      user_id: user.id,
      transaction_date: row.transaction_date,
      amount: Math.abs(amount),
      type: type === 'income' ? 'income' : 'expense',
      description: row.description?.trim() || null,
      vendor: row.vendor?.trim() || null,
      category_id: categoryId,
      source: 'csv_import',
    });
  }

  if (payloads.length === 0) {
    return NextResponse.json({ error: 'No valid rows', details: errors }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('financial_transactions')
    .insert(payloads)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    imported: data?.length || 0,
    skipped: rows.length - payloads.length,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  });
}
