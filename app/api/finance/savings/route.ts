// app/api/finance/savings/route.ts
// GET: savings goals as envelopes, per funding account: the account's balance,
//      what its goals hold (allocated), what is left (unallocated, negative
//      when over-allocated), each goal's progress, monthly needed, pace,
//      projected date and whether it fits the monthly surplus, and deposits
//      into the account not yet allocated. Also the accounts a goal can draw
//      from and the planned trips / equipment a goal can link to.
//        ?window=3|6|12 (default 6) &method=average|median (default average)
//        &today=YYYY-MM-DD (the person's local date; default the server's)
//      Before migration 212: { ready: false, ... } with the pickers filled.
// POST: create a goal.
//        { name, kind, target_amount, funding_account_id, target_date?, starting_amount?,
//          priority?, linked_trip_id?, linked_equipment_id?, milestone_tasks?, notes? }
//
// Goals linked to a trip or equipment item are sent to RideWitUS as envelope.balance after
// every write (lib/integrations/ridewitus/envelope.ts); a no-op until its env vars are set.
//
// Rules: lib/finance/savings/logic.ts.

import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseMethod, parseWindow } from '@/lib/finance/budgets/logic';
import { createGoal, loadSavingsOverview, parseGoalInput } from '@/lib/finance/savings/server';
import { errorResponse, resolveToday } from '@/lib/finance/savings/request';
import { emitEnvelopeChanges } from '@/lib/integrations/ridewitus/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const { overview, error } = await loadSavingsOverview(supabase, user.id, {
    today: resolveToday(params.get('today')),
    window: parseWindow(params.get('window')),
    method: parseMethod(params.get('method')),
  });
  if (error || !overview) {
    return NextResponse.json({ error: error?.message || 'Could not load savings goals.' }, { status: 500 });
  }
  return NextResponse.json(overview);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'The request body must be JSON.' }, { status: 400 });
  }
  try {
    const goal = await createGoal(supabase, user.id, parseGoalInput(body, false));
    // A goal linked to a trip or equipment item is sent to RideWitUS (envelope.balance), after the response.
    after(() => emitEnvelopeChanges(user.id, [goal.id], request.nextUrl.origin));
    return NextResponse.json({ goal }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
