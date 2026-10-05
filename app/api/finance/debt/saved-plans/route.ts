// app/api/finance/debt/saved-plans/route.ts
// GET:  the user's saved debt-free plans, newest first.
//       -> 200 { plans: [{ id, name, strategy, extra_monthly, custom_order, protect_promos,
//                          baseline, created_at, updated_at }] }
// POST { name?, strategy?, extra_monthly?, custom_order?, protect_promos? } ?today=YYYY-MM-DD
//       Saves a plan with a baseline snapshot of its planned payments from today, so progress can
//       be tracked against linked payments later. Defaults: avalanche, $0, promos protected.
//       -> 201 { plan }   · 400 invalid input
// Both -> 503 { error, code: 'migration_required' } until migration 211 is applied.

import { NextRequest, NextResponse } from 'next/server';
import { DEBT_NOT_READY, isMissingTable, loadDebtData, requestToday } from '@/lib/finance/debt/server';
import { parsePlanInput } from '@/lib/finance/debt/plan-input';
import type { PlanInput } from '@/lib/finance/debt/plan-input';
import { baselineFor, PLAN_SELECT } from '@/lib/finance/debt/plans-server';
import { currentUserId, errorResponse, getServiceDb, unauthorized } from '@/lib/finance/debt/route-helpers';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const db = getServiceDb();
  const { data, error } = await db
    .from('debt_plans')
    .select(PLAN_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingTable(error, 'debt_plans')) return NextResponse.json(DEBT_NOT_READY, { status: 503 });
    return errorResponse(new Error(`Could not load plans: ${error.message}`), 'api/finance/debt/saved-plans');
  }
  return NextResponse.json({ plans: data ?? [] });
}

export async function POST(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const parsed = parsePlanInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const input = parsed.value as PlanInput;

  try {
    const db = getServiceDb();
    const today = requestToday(request.nextUrl.searchParams.get('today'));
    const data = await loadDebtData(db, userId);
    const baseline = baselineFor(data, input, today);
    const { data: created, error } = await db
      .from('debt_plans')
      .insert({ user_id: userId, ...input, baseline })
      .select(PLAN_SELECT)
      .single();
    if (error) {
      if (isMissingTable(error, 'debt_plans')) return NextResponse.json(DEBT_NOT_READY, { status: 503 });
      throw new Error(`Could not save the plan: ${error.message}`);
    }
    return NextResponse.json({ plan: created }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'api/finance/debt/saved-plans');
  }
}
