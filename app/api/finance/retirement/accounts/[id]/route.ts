// app/api/finance/retirement/accounts/[id]/route.ts
// PATCH: change an investment account (same fields as POST, all optional).
// DELETE: remove it and its balance history.

import { NextRequest, NextResponse } from 'next/server';
import { deleteAccount, parseAccountInput, updateAccount } from '@/lib/finance/retirement/server';
import { errorResponse, readJson, sessionUser, unauthorized } from '@/lib/finance/retirement/request';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { db, userId } = await sessionUser();
  if (!userId) return unauthorized();
  try {
    const { id } = await params;
    const account = await updateAccount(db, userId, id, parseAccountInput(await readJson(request), true));
    return NextResponse.json({ account });
  } catch (err) {
    return errorResponse(err, 'api/finance/retirement/accounts/[id]');
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { db, userId } = await sessionUser();
  if (!userId) return unauthorized();
  try {
    const { id } = await params;
    await deleteAccount(db, userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 'api/finance/retirement/accounts/[id]');
  }
}
