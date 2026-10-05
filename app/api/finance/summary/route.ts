// app/api/finance/summary/route.ts
// GET: monthly summary for the finance dashboard (totals, by-category, monthly trend)
//
// Transfers between the person's own accounts (including card and loan
// payments) are left out of every total here: they are not spending or income.
//
// Totals are in the user's home currency (`home_currency`): each row counts its amount_home when
// set, else its amount when it is in the home currency (lib/finance/fx/totals.ts). Foreign rows
// with no rate yet are left out and counted in `unconverted`.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { excludingTransfers, withoutTransfers } from '@/lib/finance/transfers/schema';
import { getServiceDb } from '@/lib/finance/transfers/server';
import { FX_TOTALS_COLUMNS, toHomeAmounts, withOptionalFx } from '@/lib/finance/fx/totals';
import { loadHomeCurrency } from '@/lib/finance/fx/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const months = parseInt(params.get('months') || '6');

  // Calculate date range
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    .toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];

  // Current month boundaries
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split('T')[0];
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString().split('T')[0];

  // Fetch all transactions in range + categories
  const [txRes, catRes, homeCurrency] = await Promise.all([
    // Works before migrations 202 and 210 too: see excludingTransfers() and withOptionalFx().
    withOptionalFx((fxColumnsExist) =>
      excludingTransfers((groupColumnExists) =>
        withoutTransfers(
          supabase
            .from('financial_transactions')
            .select(`amount, type, transaction_date, category_id${fxColumnsExist ? `, ${FX_TOTALS_COLUMNS}` : ''}`)
            .eq('user_id', user.id)
            .gte('transaction_date', startDate)
            .lte('transaction_date', endDate),
          groupColumnExists,
        ),
      ),
    ),
    supabase
      .from('budget_categories')
      .select('id, name, color, monthly_budget')
      .eq('user_id', user.id)
      .order('sort_order'),
    loadHomeCurrency(getServiceDb(), user.id),
  ]);

  if (txRes.error) return NextResponse.json({ error: txRes.error.message }, { status: 500 });

  // Amounts in the home currency; foreign rows with no rate yet are counted, not added.
  const { rows: transactions, unconverted } = toHomeAmounts(
    (txRes.data || []) as unknown as { amount: number; type: string; transaction_date: string; category_id: string | null }[],
    homeCurrency,
  );
  const categories = catRes.data || [];

  // Current month totals
  let currentExpenses = 0;
  let currentIncome = 0;
  // By-category spending this month
  const categorySpending: Record<string, number> = {};

  // Monthly trend
  const monthlyMap: Record<string, { expenses: number; income: number }> = {};

  for (const tx of transactions) {
    const monthKey = tx.transaction_date.slice(0, 7); // YYYY-MM
    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { expenses: 0, income: 0 };

    const amt = tx.amount;
    if (tx.type === 'expense') {
      monthlyMap[monthKey].expenses += amt;
    } else {
      monthlyMap[monthKey].income += amt;
    }

    // Current month specifics
    if (tx.transaction_date >= currentMonthStart && tx.transaction_date <= currentMonthEnd) {
      if (tx.type === 'expense') {
        currentExpenses += amt;
        if (tx.category_id) {
          categorySpending[tx.category_id] = (categorySpending[tx.category_id] || 0) + amt;
        }
      } else {
        currentIncome += amt;
      }
    }
  }

  // Build monthly trend array (sorted)
  const monthlyTrend = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      label: new Date(month + '-15').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      ...data,
      net: data.income - data.expenses,
    }));

  // Category breakdown with budget comparison
  const categoryBreakdown = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    color: cat.color,
    monthly_budget: cat.monthly_budget ? parseFloat(cat.monthly_budget) : null,
    spent: categorySpending[cat.id] || 0,
    remaining: cat.monthly_budget
      ? parseFloat(cat.monthly_budget) - (categorySpending[cat.id] || 0)
      : null,
  }));

  // ── Projections from unpaid invoices ──────────────────────────────────────
  const { data: unpaidInvoices } = await supabase
    .from('invoices')
    .select('id, direction, status, total, amount_paid, due_date')
    .eq('user_id', user.id)
    .in('status', ['sent', 'overdue']);

  let projReceivable = 0;
  let projPayable = 0;
  let receivableCount = 0;
  let payableCount = 0;
  const projMonthlyMap: Record<string, { receivable: number; payable: number; count: number }> = {};

  for (const inv of unpaidInvoices || []) {
    const balance = parseFloat(inv.total) - parseFloat(inv.amount_paid || '0');
    if (balance <= 0) continue;

    if (inv.direction === 'receivable') {
      projReceivable += balance;
      receivableCount++;
    } else {
      projPayable += balance;
      payableCount++;
    }

    const monthKey = inv.due_date ? inv.due_date.slice(0, 7) : 'undated';
    if (!projMonthlyMap[monthKey]) projMonthlyMap[monthKey] = { receivable: 0, payable: 0, count: 0 };
    projMonthlyMap[monthKey].count++;
    if (inv.direction === 'receivable') projMonthlyMap[monthKey].receivable += balance;
    else projMonthlyMap[monthKey].payable += balance;
  }

  const monthlyTimeline = Object.entries(projMonthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      label: month === 'undated'
        ? 'Undated'
        : new Date(month + '-15').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      ...data,
    }));

  const projections = (receivableCount > 0 || payableCount > 0) ? {
    currentMonth: {
      receivable: Math.round(projReceivable * 100) / 100,
      payable: Math.round(projPayable * 100) / 100,
      net: Math.round((projReceivable - projPayable) * 100) / 100,
    },
    invoiceCount: { receivable: receivableCount, payable: payableCount },
    monthlyTimeline,
  } : null;

  return NextResponse.json({
    home_currency: homeCurrency,
    unconverted,
    currentMonth: {
      expenses: Math.round(currentExpenses * 100) / 100,
      income: Math.round(currentIncome * 100) / 100,
      net: Math.round((currentIncome - currentExpenses) * 100) / 100,
    },
    categoryBreakdown,
    monthlyTrend,
    projections,
  });
}
