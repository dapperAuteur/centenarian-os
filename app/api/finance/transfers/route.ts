// app/api/finance/transfers/route.ts
// POST: create a paired transfer between two accounts (the Transfer Funds form).
//
// Writes two rows that share a transfer_group_id: an expense on the account
// the money leaves and an income on the account it reaches. Both carry
// source = 'transfer' and a transfer_kind taken from the destination account
// (a credit card makes it a card payment, a loan a loan payment).
//
// Linking two rows that already exist, undoing a link, and recording a payment
// whose other side has no row are in ./link, ./unlink and ./pay.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { kindForDestination } from '@/lib/finance/transfers/pairing';
import { missingTransferColumn, TRANSFERS_NOT_READY } from '@/lib/finance/transfers/schema';
import { getServiceDb, insertTransferEntries } from '@/lib/finance/transfers/server';

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

  const db = getServiceDb();

  // Validate both accounts belong to the user and are active
  const { data: accounts } = await db
    .from('financial_accounts')
    .select('id, name, account_type, is_active')
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
  const entry = { userId: user.id, amount: Number(amount), date, description: desc, groupId: transferGroupId };

  const { data, error } = await insertTransferEntries(
    db,
    [
      { ...entry, accountId: from_account_id, type: 'expense' },
      { ...entry, accountId: to_account_id, type: 'income' },
    ],
    kindForDestination(toAcct.account_type),
  );

  if (error) {
    if (missingTransferColumn(error)) return NextResponse.json(TRANSFERS_NOT_READY, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
