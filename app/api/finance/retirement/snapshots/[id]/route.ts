// app/api/finance/retirement/snapshots/[id]/route.ts
// DELETE: remove one recorded balance.

import { NextRequest, NextResponse } from 'next/server';
import { deleteSnapshot } from '@/lib/finance/retirement/server';
import { errorResponse, sessionUser, unauthorized } from '@/lib/finance/retirement/request';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { db, userId } = await sessionUser();
  if (!userId) return unauthorized();
  try {
    const { id } = await params;
    await deleteSnapshot(db, userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 'api/finance/retirement/snapshots/[id]');
  }
}
