// app/api/finance/transfers/route.ts
// POST: create a paired transfer between two accounts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { from_account_id, to_account_id, amount, date, description } = await request.json();

  if (!from_account_id || !to_account_id) {
    return NextResponse.json({ error: 'Both accounts are required' }, { status: 400 });
  }
  if (from_account_id === to_account_id) {
    return NextResponse.json({ error: 'Cannot transfer to the same account' }, { status: 400 });
  }
  if (!amount || Number(amount) <= 0) {
    return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
  }
  if (!date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  }

  const db = getDb();

  // Validate both accounts belong to the user and are active
  const { data: accounts } = await db
    .from('financial_accounts')
    .select('id, name, is_active')
    .eq('user_id', user.id)
    .in('id', [from_account_id, to_account_id]);

  if (!accounts || accounts.length !== 2) {
    return NextResponse.json({ error: 'One or both accounts not found' }, { status: 400 });
  }
  const inactive = accounts.find((a) => !a.is_active);
  if (inactive) {
    return NextResponse.json({ error: `Account "${inactive.name}" is inactive` }, { status: 400 });
  }

  const fromAcct = accounts.find((a) => a.id === from_account_id)!;
  const toAcct = accounts.find((a) => a.id === to_account_id)!;
  const transferGroupId = crypto.randomUUID();
  const desc = description?.trim() || `Transfer: ${fromAcct.name} → ${toAcct.name}`;

  const { data, error } = await db
    .from('financial_transactions')
    .insert([
      {
        user_id: user.id,
        amount: Math.abs(Number(amount)),
        type: 'expense',
        description: desc,
        transaction_date: date,
        account_id: from_account_id,
        source: 'transfer',
        transfer_group_id: transferGroupId,
      },
      {
        user_id: user.id,
        amount: Math.abs(Number(amount)),
        type: 'income',
        description: desc,
        transaction_date: date,
        account_id: to_account_id,
        source: 'transfer',
        transfer_group_id: transferGroupId,
      },
    ])
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
