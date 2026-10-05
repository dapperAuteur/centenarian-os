// app/api/finance/insurance/[id]/route.ts
// PATCH: change a policy (same fields as POST, all optional). DELETE: remove it.
// Premium planner tasks already created stay in the planner.

import { NextRequest, NextResponse } from 'next/server';
import { deletePolicy, parsePolicyInput, updatePolicy } from '@/lib/finance/insurance/server';
import { errorResponse, readJson, sessionUser, unauthorized } from '@/lib/finance/retirement/request';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { db, userId } = await sessionUser();
  if (!userId) return unauthorized();
  try {
    const { id } = await params;
    const policy = await updatePolicy(db, userId, id, parsePolicyInput(await readJson(request), true));
    return NextResponse.json({ policy });
  } catch (err) {
    return errorResponse(err, 'api/finance/insurance/[id]');
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { db, userId } = await sessionUser();
  if (!userId) return unauthorized();
  try {
    const { id } = await params;
    await deletePolicy(db, userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 'api/finance/insurance/[id]');
  }
}
