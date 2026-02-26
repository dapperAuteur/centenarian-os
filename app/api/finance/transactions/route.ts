// app/api/finance/transactions/route.ts
// GET: list transactions with filters (date range, category, type)
// POST: create a new transaction
// PATCH: update a transaction
// DELETE: delete a transaction

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const from = params.get('from');
  const to = params.get('to');
  const type = params.get('type'); // 'expense' | 'income'
  const categoryId = params.get('category_id');
  const accountId = params.get('account_id');
  const brandId = params.get('brand_id');
  const sourceModule = params.get('source_module');
  const limit = parseInt(params.get('limit') || '100');
  const offset = parseInt(params.get('offset') || '0');

  let query = supabase
    .from('financial_transactions')
    .select('*, budget_categories(id, name, color)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (from) query = query.gte('transaction_date', from);
  if (to) query = query.lte('transaction_date', to);
  if (type) query = query.eq('type', type);
  if (categoryId) query = query.eq('category_id', categoryId);
  if (accountId) query = query.eq('account_id', accountId);
  if (brandId) query = query.eq('brand_id', brandId);
  if (sourceModule) query = query.eq('source_module', sourceModule);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transactions: data || [], total: count || 0 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { amount, type, description, vendor, transaction_date, category_id, account_id, brand_id, tags, notes } = body;

  if (!amount || !transaction_date) {
    return NextResponse.json({ error: 'Amount and date are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('financial_transactions')
    .insert({
      user_id: user.id,
      amount: Math.abs(parseFloat(amount)),
      type: type || 'expense',
      description: description?.trim() || null,
      vendor: vendor?.trim() || null,
      transaction_date,
      category_id: category_id || null,
      account_id: account_id || null,
      brand_id: brand_id || null,
      tags: tags || null,
      notes: notes?.trim() || null,
      source: 'manual',
    })
    .select('*, budget_categories(id, name, color)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transaction: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });

  const allowed = ['amount', 'type', 'description', 'vendor', 'transaction_date', 'category_id', 'account_id', 'brand_id', 'transaction_id', 'source_module', 'source_module_id', 'tags', 'notes'];
  const payload: Record<string, unknown> = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) payload[key] = updates[key];
  }
  if (payload.amount) payload.amount = Math.abs(parseFloat(String(payload.amount)));

  const { data, error } = await supabase
    .from('financial_transactions')
    .update(payload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*, budget_categories(id, name, color)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transaction: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Accept id from query param OR request body
  let id = request.nextUrl.searchParams.get('id');
  if (!id) {
    try {
      const body = await request.json();
      id = body.id ?? null;
    } catch { /* no body */ }
  }
  if (!id) return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });

  const { error } = await supabase
    .from('financial_transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
