// app/api/institutions/aggregate/route.ts
// POST: Admin-only — aggregate anonymized institution data from user accounts.
// Queries financial_accounts grouped by institution_name, computes averages.
// Never stores user_id, account_id, or any PII.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();

  // Fetch all active accounts with an institution_name
  const { data: accounts, error } = await db
    .from('financial_accounts')
    .select('institution_name, account_type, interest_rate, credit_limit, monthly_fee, dispute_window_days, default_return_days, rewards_type, rewards_rate, user_id')
    .eq('is_active', true)
    .not('institution_name', 'is', null)
    .neq('institution_name', '');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!accounts?.length) return NextResponse.json({ message: 'No accounts with institution names', aggregated: 0 });

  // Group by institution_name (case-insensitive)
  const grouped = new Map<string, typeof accounts>();
  for (const acct of accounts) {
    const key = acct.institution_name!.trim().toLowerCase();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(acct);
  }

  let aggregated = 0;

  for (const [, group] of grouped) {
    const name = group[0].institution_name!.trim();
    const slug = slugify(name);

    // Compute averages by account type (no user_id in output)
    const byType = (type: string) => group.filter((a) => a.account_type === type);
    const avg = (arr: typeof group, field: 'interest_rate' | 'credit_limit' | 'monthly_fee') => {
      const vals = arr.map((a) => a[field]).filter((v): v is number => v != null);
      return vals.length ? vals.reduce((s, v) => s + Number(v), 0) / vals.length : null;
    };

    const checkingAccts = byType('checking');
    const savingsAccts = byType('savings');
    const creditCardAccts = byType('credit_card');
    const loanAccts = byType('loan');

    // Most common dispute window (mode)
    const disputeDays = group.map((a) => a.dispute_window_days).filter((v): v is number => v != null);
    const disputeMode = disputeDays.length
      ? disputeDays.sort((a, b) =>
          disputeDays.filter((v) => v === b).length - disputeDays.filter((v) => v === a).length
        )[0]
      : null;

    const returnDays = group.map((a) => a.default_return_days).filter((v): v is number => v != null);
    const returnMode = returnDays.length
      ? returnDays.sort((a, b) =>
          returnDays.filter((v) => v === b).length - returnDays.filter((v) => v === a).length
        )[0]
      : null;

    // Rewards summary (most common)
    const rewardTypes = group.map((a) => a.rewards_type).filter(Boolean);
    const rewardsSummary = rewardTypes.length
      ? [...new Set(rewardTypes)].join(', ')
      : null;

    // Monthly fees
    const feesByType = ['checking', 'savings', 'credit_card', 'loan']
      .map((type) => {
        const avgFee = avg(byType(type), 'monthly_fee');
        return avgFee != null ? { account_type: type, fee_amount: Math.round(avgFee * 100) / 100 } : null;
      })
      .filter(Boolean);

    // Count distinct users (anonymized count)
    const uniqueUsers = new Set(group.map((a) => a.user_id)).size;

    const row = {
      name,
      slug,
      avg_checking_apr: avg(checkingAccts, 'interest_rate') != null ? Math.round(avg(checkingAccts, 'interest_rate')! * 100) / 100 : null,
      avg_savings_apr: avg(savingsAccts, 'interest_rate') != null ? Math.round(avg(savingsAccts, 'interest_rate')! * 100) / 100 : null,
      avg_credit_card_apr: avg(creditCardAccts, 'interest_rate') != null ? Math.round(avg(creditCardAccts, 'interest_rate')! * 100) / 100 : null,
      avg_loan_apr: avg(loanAccts, 'interest_rate') != null ? Math.round(avg(loanAccts, 'interest_rate')! * 100) / 100 : null,
      common_monthly_fees: feesByType.length ? feesByType : null,
      avg_credit_limit: avg(creditCardAccts, 'credit_limit') != null ? Math.round(avg(creditCardAccts, 'credit_limit')!) : null,
      known_dispute_window_days: disputeMode,
      known_return_days: returnMode,
      rewards_summary: rewardsSummary,
      account_count: uniqueUsers,
      last_aggregated_at: new Date().toISOString(),
    };

    // Upsert by slug
    const { error: upsertErr } = await db
      .from('institutions')
      .upsert(row, { onConflict: 'slug' });

    if (!upsertErr) aggregated++;
  }

  return NextResponse.json({ aggregated, total_institutions: grouped.size });
}
