// app/api/finance/recurring/route.ts
// CRUD for recurring payments

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { checkReferences, invalidReferenceMessage, withOwnEmbeds } from '@/lib/auth/ownership';

// The embeds carry user_id so withOwnEmbeds() can drop another user's account
// or category that a row saved before reference checks might still name.
const RECURRING_SELECT = '*, financial_accounts(id, name, account_type, user_id), budget_categories(id, name, color, user_id)';
const RECURRING_EMBEDS = ['financial_accounts', 'budget_categories'];

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
    .select(RECURRING_SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map((row) => withOwnEmbeds(row, RECURRING_EMBEDS, user.id)));
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

  const refs = await checkReferences(db, user.id, [{ field: 'category_id', table: 'budget_categories', id: category_id }]);
  if (refs.failed) return NextResponse.json({ error: 'Could not verify references' }, { status: 500 });
  if (!refs.ok) return NextResponse.json({ error: invalidReferenceMessage(refs.invalid) }, { status: 400 });

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
    .select(RECURRING_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(withOwnEmbeds(data, RECURRING_EMBEDS, user.id), { status: 201 });
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

  // A new account or category must be the caller's own.
  const refs = await checkReferences(db, user.id, [
    { field: 'account_id', table: 'financial_accounts', id: payload.account_id },
    { field: 'category_id', table: 'budget_categories', id: payload.category_id },
  ]);
  if (refs.failed) return NextResponse.json({ error: 'Could not verify references' }, { status: 500 });
  if (!refs.ok) return NextResponse.json({ error: invalidReferenceMessage(refs.invalid) }, { status: 400 });

  const { data, error } = await db
    .from('recurring_payments')
    .update(payload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(RECURRING_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(withOwnEmbeds(data, RECURRING_EMBEDS, user.id));
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
