// app/api/finance/transfers/link/route.ts
// POST: mark two existing transactions as the two sides of one transfer.
//
// Body: { transaction_ids: [a, b], kind?: 'transfer' | 'card_payment' | 'loan_payment' }
//
// Both rows stay exactly as they are (amount, type, account), so account
// balances don't move. They get a shared transfer_group_id and a
// transfer_kind, which is what takes them out of spending and income totals.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkPair, isTransferKind, toCents } from '@/lib/finance/transfers/pairing';
import {
  missingTransferColumn,
  TRANSFERS_NOT_READY,
  withOptionalKind,
} from '@/lib/finance/transfers/schema';
import {
  clearTransferGroup,
  getServiceDb,
  TRANSFER_ROW_SELECT,
  type TransferRowRecord,
} from '@/lib/finance/transfers/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ids: unknown = body?.transaction_ids;
  if (
    !Array.isArray(ids) ||
    ids.length !== 2 ||
    !ids.every((id) => typeof id === 'string' && id) ||
    ids[0] === ids[1]
  ) {
    return NextResponse.json({ error: 'transaction_ids must be two different transaction IDs' }, { status: 400 });
  }
  if (body.kind !== undefined && body.kind !== null && !isTransferKind(body.kind)) {
    return NextResponse.json(
      { error: 'kind must be transfer, card_payment or loan_payment' },
      { status: 400 },
    );
  }

  const db = getServiceDb();

  const { data: found, error: findError } = await db
    .from('financial_transactions')
    .select(TRANSFER_ROW_SELECT)
    .eq('user_id', user.id)
    .in('id', ids);
  if (findError) {
    if (missingTransferColumn(findError)) return NextResponse.json(TRANSFERS_NOT_READY, { status: 503 });
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }
  const rows = (found ?? []) as unknown as TransferRowRecord[];
  if (rows.length !== 2) {
    return NextResponse.json({ error: 'One or both transactions were not found' }, { status: 404 });
  }
  if (rows.some((row) => row.transfer_group_id)) {
    return NextResponse.json(
      { error: 'One of these transactions is already part of a transfer. Unlink it first.' },
      { status: 409 },
    );
  }

  const accountIds = rows.map((row) => row.account_id).filter((id): id is string => Boolean(id));
  const { data: accounts, error: accountError } = accountIds.length
    ? await db.from('financial_accounts').select('id, account_type').eq('user_id', user.id).in('id', accountIds)
    : { data: [], error: null };
  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
  const accountTypes = new Map((accounts ?? []).map((a) => [a.id as string, a.account_type as string]));

  const [a, b] = rows.map((row) => ({
    id: row.id,
    account_id: row.account_id,
    amountCents: toCents(row.amount),
    type: row.type,
  }));
  const pair = checkPair(a, b, accountTypes);
  if (!pair.ok) return NextResponse.json({ error: pair.error }, { status: 400 });

  const kind = isTransferKind(body.kind) ? body.kind : pair.kind;
  const groupId = crypto.randomUUID();

  // `.is('transfer_group_id', null)` guards against a second request grouping
  // one of the rows between the check above and this write.
  const { data: updated, error: updateError } = await withOptionalKind((kindColumnExists) =>
    db
      .from('financial_transactions')
      .update(
        kindColumnExists
          ? { transfer_group_id: groupId, transfer_kind: kind }
          : { transfer_group_id: groupId },
      )
      .eq('user_id', user.id)
      .in('id', ids)
      .is('transfer_group_id', null)
      .select('id'),
  );
  if (updateError) {
    if (missingTransferColumn(updateError)) return NextResponse.json(TRANSFERS_NOT_READY, { status: 503 });
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if ((updated ?? []).length !== 2) {
    // Only one row was still free: undo it so no half-linked transfer is left behind.
    await clearTransferGroup(db, user.id, (updated ?? []).map((row) => row.id as string));
    return NextResponse.json(
      { error: 'One of these transactions was just linked to another transfer. Reload and try again.' },
      { status: 409 },
    );
  }

  return NextResponse.json({
    transfer_group_id: groupId,
    transfer_kind: kind,
    from_id: pair.fromId,
    to_id: pair.toId,
  });
}
