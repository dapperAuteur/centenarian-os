// app/api/finance/debt/saved-plans/[id]/route.ts
// GET ?today=YYYY-MM-DD: one saved plan, its schedule computed from today's balances, and its
//     progress against linked payments since it was saved.
//     -> 200 { plan, comparison: { plan: PlanResult, minimumsOnly: PlanResult, interestSaved,
//              monthsSooner }, progress: { startDate, plannedToDate, paidToDate, difference,
//              onTrack, debts } | null }
// PATCH { name?, strategy?, extra_monthly?, custom_order?, protect_promos?, reset_baseline? }
//     Changing strategy, extra, order or promo protection (or reset_baseline: true) restarts the
//     baseline from today. -> 200 { plan }
// DELETE -> 200 { deleted: true }
// All -> 404 when the plan isn't the user's · 503 { code: 'migration_required' } before 211.
// PlanResult and progress rules: lib/finance/debt/plan.ts, progress.ts.

import { NextRequest, NextResponse } from 'next/server';
import { DEBT_NOT_READY, isMissingTable, loadDebtData, requestToday } from '@/lib/finance/debt/server';
import { parsePlanInput } from '@/lib/finance/debt/plan-input';
import { baselineFor, loadPlanWithSchedule, PLAN_SELECT, settingsOf } from '@/lib/finance/debt/saved-plans-server';
import type { DebtPlanRow } from '@/lib/finance/debt/saved-plans-server';
import { currentUserId, errorResponse, getServiceDb, unauthorized } from '@/lib/finance/debt/route-helpers';

type Ctx = { params: Promise<{ id: string }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadOwn(id: string, userId: string) {
  const db = getServiceDb();
  const { data, error } = await db.from('debt_plans').select(PLAN_SELECT).eq('id', id).eq('user_id', userId).maybeSingle();
  return { db, row: data as DebtPlanRow | null, error };
}

function notFound() {
  return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!UUID_RE.test(id)) return notFound();
  try {
    const { db, row, error } = await loadOwn(id, userId);
    if (error) {
      if (isMissingTable(error, 'debt_plans')) return NextResponse.json(DEBT_NOT_READY, { status: 503 });
      throw new Error(`Could not load the plan: ${error.message}`);
    }
    if (!row) return notFound();
    const today = requestToday(request.nextUrl.searchParams.get('today'));
    return NextResponse.json(await loadPlanWithSchedule(db, userId, row, today));
  } catch (err) {
    return errorResponse(err, 'api/finance/debt/saved-plans/[id]');
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!UUID_RE.test(id)) return notFound();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parsePlanInput(body, true);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { db, row, error } = await loadOwn(id, userId);
    if (error) {
      if (isMissingTable(error, 'debt_plans')) return NextResponse.json(DEBT_NOT_READY, { status: 503 });
      throw new Error(`Could not load the plan: ${error.message}`);
    }
    if (!row) return notFound();

    const changes: Record<string, unknown> = { ...parsed.value, updated_at: new Date().toISOString() };
    const settingsChanged = ['strategy', 'extra_monthly', 'custom_order', 'protect_promos'].some((k) => k in parsed.value);
    if (settingsChanged || body?.reset_baseline === true) {
      const today = requestToday(request.nextUrl.searchParams.get('today'));
      const data = await loadDebtData(db, userId);
      changes.baseline = baselineFor(data, { ...settingsOf(row), ...parsed.value }, today);
    }
    const { data: updated, error: upErr } = await db
      .from('debt_plans')
      .update(changes)
      .eq('id', id)
      .eq('user_id', userId)
      .select(PLAN_SELECT)
      .single();
    if (upErr) throw new Error(`Could not save the plan: ${upErr.message}`);
    return NextResponse.json({ plan: updated });
  } catch (err) {
    return errorResponse(err, 'api/finance/debt/saved-plans/[id]');
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!UUID_RE.test(id)) return notFound();
  const db = getServiceDb();
  const { data, error } = await db.from('debt_plans').delete().eq('id', id).eq('user_id', userId).select('id');
  if (error) {
    if (isMissingTable(error, 'debt_plans')) return NextResponse.json(DEBT_NOT_READY, { status: 503 });
    return errorResponse(new Error(`Could not delete the plan: ${error.message}`), 'api/finance/debt/saved-plans/[id]');
  }
  if (!data?.length) return notFound();
  return NextResponse.json({ deleted: true });
}
