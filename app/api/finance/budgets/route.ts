// app/api/finance/budgets/route.ts
// GET: budgets for one month: per category the budget (and where it comes
//      from), spent, remaining, the monthly spending for the chosen window,
//      a suggested budget and a "varies a lot" flag; plus an Uncategorized
//      line and totals.
//        ?month=YYYY-MM (default: this month) &window=3|6|12 (default 6)
//        &method=average|median (default average)
// PUT: set one or many categories' budget for a month.
//        { month: 'YYYY-MM', items: [{ category_id, amount?: number|null, rollover?: boolean }],
//          from_this_month_on?: boolean }
//
// Transfers between the person's own accounts never count as spending.
// Rules: lib/finance/budgets/logic.ts. Works before migration 208: budgets
// then come from budget_categories.monthly_budget and PUT answers 503.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isMonthKey, monthOf } from '@/lib/finance/budgets/months';
import { parseMethod, parseWindow } from '@/lib/finance/budgets/logic';
import {
  BudgetWriteError,
  loadBudgetReport,
  validateItem,
  writeBudgets,
} from '@/lib/finance/budgets/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const currentMonth = monthOf(new Date());
  const monthParam = params.get('month');
  if (monthParam && !isMonthKey(monthParam)) {
    return NextResponse.json({ error: 'Month must look like 2026-10.' }, { status: 400 });
  }

  const { report, error } = await loadBudgetReport(supabase, user.id, {
    month: monthParam || currentMonth,
    window: parseWindow(params.get('window')),
    method: parseMethod(params.get('method')),
    currentMonth,
  });
  if (error || !report) {
    return NextResponse.json({ error: error?.message || 'Could not load budgets.' }, { status: 500 });
  }
  return NextResponse.json(report);
}

export async function PUT(request: NextRequest) {
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
    const rawItems = Array.isArray(body.items) ? body.items : body.category_id ? [body] : [];
    if (rawItems.length === 0) throw new BudgetWriteError('Send at least one category budget.');
    if (rawItems.length > 500) throw new BudgetWriteError('Too many budgets in one request.');
    const items = rawItems.map(validateItem);
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
