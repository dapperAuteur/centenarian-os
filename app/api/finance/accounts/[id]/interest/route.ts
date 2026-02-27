// app/api/finance/accounts/[id]/interest/route.ts
// POST: calculate and apply interest using Average Daily Balance (ADB)
// Works for credit_card and loan accounts with interest_rate and statement_date set.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id: accountId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Fetch account
  const { data: account } = await db
    .from('financial_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single();

  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  if (account.account_type !== 'credit_card' && account.account_type !== 'loan') {
    return NextResponse.json({ error: 'Interest only applies to credit cards and loans' }, { status: 400 });
  }
  if (account.interest_rate == null || account.statement_date == null) {
    return NextResponse.json({ error: 'Account must have interest_rate and statement_date set' }, { status: 400 });
  }

  const apr = Number(account.interest_rate);
  const statementDay = Number(account.statement_date);

  // Determine the most recent statement period
  const now = new Date();
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), statementDay);
  // If we haven't reached the statement day this month, use last month's
  if (periodEnd > now) {
    periodEnd.setMonth(periodEnd.getMonth() - 1);
  }
  const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, statementDay);

  const startStr = periodStart.toISOString().split('T')[0];
  const endStr = periodEnd.toISOString().split('T')[0];

  // Check for duplicate interest charge in this period
  const { data: existing } = await db
    .from('financial_transactions')
    .select('id')
    .eq('user_id', user.id)
    .eq('account_id', accountId)
    .eq('source', 'interest')
    .gte('transaction_date', startStr)
    .lte('transaction_date', endStr)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Interest already applied for this statement period' }, { status: 409 });
  }

  // Fetch all transactions for this account up to the period end to build running balance
  const { data: transactions } = await db
    .from('financial_transactions')
    .select('amount, type, transaction_date')
    .eq('user_id', user.id)
    .eq('account_id', accountId)
    .lte('transaction_date', endStr)
    .order('transaction_date', { ascending: true });

  // Build running balance at period start (all transactions before periodStart)
  let balanceAtStart = Number(account.opening_balance);
  const periodTxns: { amount: number; type: string; transaction_date: string }[] = [];

  for (const tx of transactions ?? []) {
    const amt = Number(tx.amount);
    if (tx.transaction_date < startStr) {
      // Before period — accumulate into starting balance
      if (tx.type === 'expense') balanceAtStart += amt;
      else balanceAtStart -= amt; // income (payment) reduces debt balance
    } else {
      periodTxns.push(tx);
    }
  }

  // Calculate ADB over the statement period
  const daysInPeriod = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  if (daysInPeriod <= 0) {
    return NextResponse.json({ error: 'Invalid statement period' }, { status: 400 });
  }

  // Sort period transactions by date
  periodTxns.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

  let dailyBalanceSum = 0;
  let currentBalance = balanceAtStart;
  let txIdx = 0;

  for (let d = 0; d < daysInPeriod; d++) {
    const dayDate = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate() + d);
    const dayStr = dayDate.toISOString().split('T')[0];

    // Apply transactions that fall on this day
    while (txIdx < periodTxns.length && periodTxns[txIdx].transaction_date <= dayStr) {
      const amt = Number(periodTxns[txIdx].amount);
      if (periodTxns[txIdx].type === 'expense') currentBalance += amt;
      else currentBalance -= amt;
      txIdx++;
    }

    dailyBalanceSum += Math.max(0, currentBalance); // only positive balances accrue interest
  }

  const averageDailyBalance = dailyBalanceSum / daysInPeriod;
  const dailyRate = apr / 100 / 365;
  const interestAmount = Math.round(averageDailyBalance * dailyRate * daysInPeriod * 100) / 100;

  if (interestAmount <= 0) {
    return NextResponse.json({
      message: 'No interest due — average daily balance is zero or negative',
      breakdown: { averageDailyBalance: 0, dailyRate, daysInPeriod, interestAmount: 0, periodStart: startStr, periodEnd: endStr },
    });
  }

  // Create the interest charge transaction
  const periodLabel = periodEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const { data: tx, error } = await db
    .from('financial_transactions')
    .insert({
      user_id: user.id,
      amount: interestAmount,
      type: 'expense',
      description: `Interest charge — ${periodLabel}`,
      transaction_date: endStr,
      account_id: accountId,
      source: 'interest',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    transaction: tx,
    breakdown: {
      averageDailyBalance: Math.round(averageDailyBalance * 100) / 100,
      dailyRate: Math.round(dailyRate * 1000000) / 1000000,
      daysInPeriod,
      interestAmount,
      periodStart: startStr,
      periodEnd: endStr,
    },
  }, { status: 201 });
}
