// app/api/finance/transfers/pay/route.ts
// POST: "This is a payment to <account>", for a transfer with one side only.
//
// Body: { transaction_id, to_account_id }
//
// The transaction is money that left an account (an expense) and went to
// another account of the same person that has no row for it: a car loan with
// no statement, say. This links the existing row and adds ONLY the missing
// side: one income row on the destination account, same amount and date,
// source = 'transfer', same transfer_group_id. An income row lowers what is
// owed on a card or loan and raises the balance of a bank account, so the
// destination moves the right way and the original account doesn't move at all.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { accountLabel, kindForDestination } from '@/lib/finance/transfers/pairing';
import {
  missingTransferColumn,
  TRANSFERS_NOT_READY,
  withOptionalKind,
} from '@/lib/finance/transfers/schema';
import {
  ACCOUNT_SELECT,
  getServiceDb,
  insertTransferEntries,
  TRANSFER_ROW_SELECT,
  type AccountRecord,
  type TransferRowRecord,
} from '@/lib/finance/transfers/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const transactionId: unknown = body?.transaction_id;
  const toAccountId: unknown = body?.to_account_id;
  if (typeof transactionId !== 'string' || !transactionId || typeof toAccountId !== 'string' || !toAccountId) {
    return NextResponse.json({ error: 'transaction_id and to_account_id are required' }, { status: 400 });
  }

  const db = getServiceDb();

  const { data: found, error: findError } = await db
    .from('financial_transactions')
    .select(TRANSFER_ROW_SELECT)
    .eq('user_id', user.id)
    .eq('id', transactionId)
    .maybeSingle();
  if (findError) {
    if (missingTransferColumn(findError)) return NextResponse.json(TRANSFERS_NOT_READY, { status: 503 });
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }
  const row = found as unknown as TransferRowRecord | null;
  if (!row) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  if (row.transfer_group_id) {
    return NextResponse.json(
      { error: 'This transaction is already part of a transfer. Unlink it first.' },
      { status: 409 },
    );
  }
  if (row.type !== 'expense') {
    return NextResponse.json(
      {
        error:
          'Only money going out can be recorded as a payment to another account. ' +
          'For money coming in, link it to the matching transaction on the account it came from.',
      },
      { status: 400 },
    );
  }
  if (row.account_id === toAccountId) {
    return NextResponse.json(
      { error: 'Pick a different account: this transaction is already on that one.' },
      { status: 400 },
    );
  }

  const accountIds = [toAccountId, ...(row.account_id ? [row.account_id] : [])];
  const { data: accountRows, error: accountError } = await db
    .from('financial_accounts')
    .select(ACCOUNT_SELECT)
    .eq('user_id', user.id)
    .in('id', accountIds);
  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
  const accounts = (accountRows ?? []) as unknown as AccountRecord[];
  const toAccount = accounts.find((account) => account.id === toAccountId);
  if (!toAccount) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  const fromAccount = accounts.find((account) => account.id === row.account_id) ?? null;

  const kind = kindForDestination(toAccount.account_type);
  const groupId = crypto.randomUUID();

  // 1. Add the missing side.
  const { data: inserted, error: insertError } = await insertTransferEntries(
    db,
    [
      {
        userId: user.id,
        accountId: toAccount.id,
        amount: Number(row.amount),
        type: 'income',
        date: row.transaction_date,
        description: `Payment from ${fromAccount ? accountLabel(fromAccount) : 'an account not set on the original transaction'}`,
        groupId,
      },
    ],
    kind,
  );
  if (insertError) {
    if (missingTransferColumn(insertError)) return NextResponse.json(TRANSFERS_NOT_READY, { status: 503 });
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }
  const counterEntry = (inserted ?? [])[0] ?? null;

  // 2. Link the existing row. `.is('transfer_group_id', null)` guards against
  //    a second request grouping it in the meantime.
  const { data: linked, error: linkError } = await withOptionalKind((kindColumnExists) =>
    db
      .from('financial_transactions')
      .update(
        kindColumnExists
          ? { transfer_group_id: groupId, transfer_kind: kind }
          : { transfer_group_id: groupId },
      )
      .eq('user_id', user.id)
      .eq('id', row.id)
      .is('transfer_group_id', null)
      .select('id'),
  );
  if (linkError || (linked ?? []).length !== 1) {
    // Take the counter-entry back out so a failed link never changes a balance.
    await db
      .from('financial_transactions')
      .delete()
      .eq('user_id', user.id)
      .eq('transfer_group_id', groupId)
      .eq('source', 'transfer');
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
    return NextResponse.json(
      { error: 'This transaction was just linked to another transfer. Reload and try again.' },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      transfer_group_id: groupId,
      transfer_kind: kind,
      transaction_id: row.id,
      counter_entry: counterEntry,
      to_account_label: accountLabel(toAccount),
    },
    { status: 201 },
  );
}
