// app/api/finance/transfers/unlink/route.ts
// POST: undo a transfer link.
//
// Body: { transfer_group_id, remove_counter_entry?: boolean }
//
// Clears transfer_group_id and transfer_kind on the group's rows, which puts
// them back into spending and income totals. Nothing is deleted, with one
// exception the caller has to ask for: `remove_counter_entry: true` also
// deletes the counter-entry that "This is a payment to..." added (a
// source = 'transfer' row in a group that also holds a row from somewhere
// else). A transfer made with the Transfer Funds form has no counter-entry
// (both of its rows are source = 'transfer'), so the flag removes nothing there.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { missingTransferColumn, TRANSFERS_NOT_READY } from '@/lib/finance/transfers/schema';
import { clearTransferGroup, getServiceDb, loadGroupRows } from '@/lib/finance/transfers/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const groupId: unknown = body?.transfer_group_id;
  if (typeof groupId !== 'string' || !groupId) {
    return NextResponse.json({ error: 'transfer_group_id is required' }, { status: 400 });
  }
  const removeCounterEntry = body.remove_counter_entry === true;

  const db = getServiceDb();

  const { rows, error: loadError } = await loadGroupRows(db, user.id, [groupId]);
  if (loadError) {
    if (missingTransferColumn(loadError)) return NextResponse.json(TRANSFERS_NOT_READY, { status: 503 });
    return NextResponse.json({ error: loadError.message ?? 'Could not load the transfer' }, { status: 500 });
  }
  if (rows.length === 0) return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });

  const hasOutsideRow = rows.some((row) => row.source !== 'transfer');
  const counterEntries = removeCounterEntry && hasOutsideRow
    ? rows.filter((row) => row.source === 'transfer')
    : [];
  const removedIds = counterEntries.map((row) => row.id);
  const keptIds = rows.filter((row) => !removedIds.includes(row.id)).map((row) => row.id);

  // Unlink first. If the delete then fails, the worst case is an ungrouped
  // counter-entry the person can delete by hand, never a half-linked transfer.
  const { error: clearError } = await clearTransferGroup(db, user.id, keptIds);
  if (clearError) {
    if (missingTransferColumn(clearError)) return NextResponse.json(TRANSFERS_NOT_READY, { status: 503 });
    return NextResponse.json({ error: clearError.message ?? 'Could not unlink the transfer' }, { status: 500 });
  }

  if (removedIds.length > 0) {
    const { error: deleteError } = await db
      .from('financial_transactions')
      .delete()
      .eq('user_id', user.id)
      .eq('source', 'transfer')
      .in('id', removedIds);
    if (deleteError) {
      // Leave the entry ungrouped too, so the transfer is fully undone either way.
      await clearTransferGroup(db, user.id, removedIds);
      return NextResponse.json(
        {
          error: `The transfer was unlinked, but the payment entry could not be removed: ${deleteError.message}. Delete it from the transactions list.`,
          unlinked: keptIds,
          removed: [],
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ unlinked: keptIds, removed: removedIds });
}
