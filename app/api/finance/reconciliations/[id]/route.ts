// app/api/finance/reconciliations/[id]/route.ts
// PATCH { action: 'unreconcile', remove_adjustment?: boolean }
//      Marks a reconciliation open again, so its period is no longer treated as reconciled.
//      With remove_adjustment, its adjustment transaction (tag reconcile-adjustment) is deleted too.
//      A starting-balance change is not undone. -> { reconciliation, adjustment_deleted }
//      Someone else's reconciliation answers 404. Before migration 221: 503.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { unreconcile } from '@/lib/finance/reconciliation/server';
import { reconcileErrorResponse } from '@/lib/finance/reconciliation/request';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
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
  if (body.action !== 'unreconcile') {
    return NextResponse.json({ error: "action must be 'unreconcile'." }, { status: 400 });
  }
  try {
    const result = await unreconcile(supabase, user.id, id, { removeAdjustment: body.remove_adjustment === true });
    return NextResponse.json(result);
  } catch (err) {
    return reconcileErrorResponse(err);
  }
}
