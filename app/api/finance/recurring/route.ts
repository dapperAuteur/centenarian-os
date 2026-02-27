// app/api/finance/recurring/route.ts
// CRUD for recurring payments

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data, error } = await db
    .from('recurring_payments')
    .select('*, financial_accounts(id, name, account_type), budget_categories(id, name, color)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { account_id, description, amount, type = 'expense', category_id, day_of_month } = await request.json();

  if (!account_id) return NextResponse.json({ error: 'Account is required' }, { status: 400 });
  if (!description?.trim()) return NextResponse.json({ error: 'Description is required' }, { status: 400 });
  if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
  if (!day_of_month || day_of_month < 1 || day_of_month > 28) {
    return NextResponse.json({ error: 'Day of month must be 1–28' }, { status: 400 });
  }

  const db = getDb();

  // Verify account belongs to user
  const { data: acct } = await db
    .from('financial_accounts')
    .select('id')
    .eq('id', account_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!acct) return NextResponse.json({ error: 'Account not found' }, { status: 400 });

  const { data, error } = await db
    .from('recurring_payments')
    .insert({
      user_id: user.id,
      account_id,
      description: description.trim(),
      amount: Math.abs(Number(amount)),
      type: ['expense', 'income'].includes(type) ? type : 'expense',
      category_id: category_id || null,
      day_of_month: Number(day_of_month),
    })
    .select('*, financial_accounts(id, name, account_type), budget_categories(id, name, color)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const allowed = ['account_id', 'description', 'amount', 'type', 'category_id', 'day_of_month', 'is_active'];
  const payload: Record<string, unknown> = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) payload[key] = updates[key];
  }
  if (payload.amount) payload.amount = Math.abs(Number(payload.amount));

  const db = getDb();
  const { data, error } = await db
    .from('recurring_payments')
    .update(payload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*, financial_accounts(id, name, account_type), budget_categories(id, name, color)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const db = getDb();
  const { error } = await db
    .from('recurring_payments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
