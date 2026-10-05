// app/api/finance/savings/goals/[id]/route.ts
// PATCH: change a goal (any field POST /api/finance/savings takes, plus status:
//        active | paused | done | archived). Archiving releases what the goal
//        holds back to unallocated; the response says how much ({ released }).
//        Raising the starting amount or switching accounts must fit in that
//        account's unallocated money. Optional today: 'YYYY-MM-DD'.
// DELETE: delete a goal and its allocations (the money returns to unallocated).
//
// Rules: lib/finance/savings/logic.ts.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deleteGoal, parseGoalInput, updateGoal } from '@/lib/finance/savings/server';
import { errorResponse, resolveToday } from '@/lib/finance/savings/request';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) ?? {};
  } catch {
    return NextResponse.json({ error: 'The request body must be JSON.' }, { status: 400 });
  }
  try {
    const { today, ...fields } = body;
    const result = await updateGoal(supabase, user.id, id, parseGoalInput(fields, true), resolveToday(today));
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await deleteGoal(supabase, user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
