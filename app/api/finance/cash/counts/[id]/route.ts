// app/api/finance/cash/counts/[id]/route.ts
// DELETE: undo a count. Only the latest count of its account can be undone
//         (409 not_latest otherwise). Deletes its adjustment transaction, then
//         the count, so the balance goes back to what it was before the count.
//         -> { ok: true, adjustment_deleted }
//
// Writes: lib/finance/cash/server.ts.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { undoLatestCount } from '@/lib/finance/cash/server';
import { errorResponse } from '@/lib/finance/cash/request';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { adjustmentDeleted } = await undoLatestCount(supabase, user.id, id);
    return NextResponse.json({ ok: true, adjustment_deleted: adjustmentDeleted });
  } catch (err) {
    return errorResponse(err);
  }
}
