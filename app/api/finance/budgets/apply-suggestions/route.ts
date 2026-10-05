// app/api/finance/budgets/apply-suggestions/route.ts
// POST: accept suggested budgets for a month in bulk.
//   { month: 'YYYY-MM', window?: 3|6|12, method?: 'average'|'median',
//     category_ids?: string[], from_this_month_on?: boolean }
//
// The suggestions are worked out again here from the person's own history
// (the numbers on screen are never trusted). Categories without a suggestion
// (no usable months) or whose budget already equals it are skipped.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isMonthKey, monthOf } from '@/lib/finance/budgets/months';
import { parseMethod, parseWindow } from '@/lib/finance/budgets/logic';
import { BudgetWriteError, loadBudgetReport, writeBudgets } from '@/lib/finance/budgets/server';
import { suggestionsToApply } from '@/lib/finance/budgets/apply';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'The request body must be JSON.' }, { status: 400 });
  }

  try {
    if (!isMonthKey(body.month)) throw new BudgetWriteError('Month must look like 2026-10.');
    const categoryIds = Array.isArray(body.category_ids)
      ? body.category_ids.filter((id): id is string => typeof id === 'string')
      : null;

    const { report, error } = await loadBudgetReport(supabase, user.id, {
      month: body.month,
      window: parseWindow(body.window),
      method: parseMethod(body.method),
      currentMonth: monthOf(new Date()),
    });
    if (error || !report) throw new BudgetWriteError(error?.message || 'Could not load budgets.', 500);

    const items = suggestionsToApply(report.categories, categoryIds);
    if (items.length === 0) {
      return NextResponse.json({ ok: true, updated: 0, skipped: report.categories.length });
    }
    const result = await writeBudgets(supabase, user.id, {
      month: body.month,
      items,
      fromThisMonthOn: body.from_this_month_on === true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof BudgetWriteError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
}
