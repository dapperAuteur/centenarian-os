// app/api/finance/accounts/route.ts
// GET: list user's financial accounts (with computed balance)
// POST: create a new account

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

  const { data: accounts, error } = await db
    .from('financial_accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Compute balance for each account: opening_balance + income - expenses
  const accountsWithBalance = await Promise.all(
    (accounts ?? []).map(async (acct) => {
      const { data: totals } = await db
        .from('financial_transactions')
        .select('type, amount')
        .eq('user_id', user.id)
        .eq('account_id', acct.id);

      const income = (totals ?? []).filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expenses = (totals ?? []).filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      const balance = Number(acct.opening_balance) + income - expenses;

      return { ...acct, balance };
    })
  );

  return NextResponse.json(accountsWithBalance);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    name, account_type, institution_name, last_four,
    interest_rate, credit_limit, opening_balance = 0,
    monthly_fee, due_date, statement_date, notes,
  } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!account_type) return NextResponse.json({ error: 'Account type is required' }, { status: 400 });

  const db = getDb();
  const { data, error } = await db
    .from('financial_accounts')
    .insert({
      user_id: user.id,
      name: name.trim(),
      account_type,
      institution_name: institution_name ?? null,
      last_four: last_four ?? null,
      interest_rate: interest_rate != null ? Number(interest_rate) : null,
      credit_limit: credit_limit != null ? Number(credit_limit) : null,
      opening_balance: Number(opening_balance),
      monthly_fee: monthly_fee != null ? Number(monthly_fee) : null,
      due_date: due_date != null ? Number(due_date) : null,
      statement_date: statement_date != null ? Number(statement_date) : null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ...data, balance: Number(opening_balance) }, { status: 201 });
}
