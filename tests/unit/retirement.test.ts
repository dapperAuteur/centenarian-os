// tests/unit/retirement.test.ts
// Unit tests for the retirement planner math (lib/finance/retirement/logic.ts) and the life
// insurance rules (lib/finance/insurance/logic.ts): contributions and employer match, growth,
// real vs nominal, the target with Social Security, the gap and "needed per month", premium
// matching, next due, term-end warnings and totals.
// Run: npm run test:unit
//
// Every account, policy, amount and id here is made up. Nothing touches a database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  annualContribution,
  annualMatch,
  buildPlan,
  futureValue,
  latestSnapshots,
  matchSummary,
  monthlyToReach,
  realRatePct,
  resolveSettings,
  retirementTarget,
  toReal,
} from '../../lib/finance/retirement/logic.ts';
import type { ContributionInput, PlanAccount } from '../../lib/finance/retirement/logic.ts';
import {
  addMonthsClamped,
  dueAround,
  isPremiumPayment,
  policyGroup,
  policyTotals,
  premiumStatus,
  termStatus,
} from '../../lib/finance/insurance/logic.ts';
import type { PolicyRow, PremiumTxn } from '../../lib/finance/insurance/logic.ts';

const close = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

const base: ContributionInput = {
  contribution_type: 'none',
  contribution_amount: null,
  contribution_percent: null,
  contribution_frequency: 'monthly',
  annual_pay: null,
  match_rate_percent: null,
  match_limit_percent: null,
  match_annual_cap: null,
};

// ── Contributions and match ─────────────────────────────────────────────────

test('contribution: amount per period x periods per year', () => {
  assert.equal(annualContribution({ ...base, contribution_type: 'amount', contribution_amount: 200, contribution_frequency: 'biweekly' }), 5200);
  assert.equal(annualContribution({ ...base, contribution_type: 'amount', contribution_amount: '500', contribution_frequency: 'monthly' }), 6000);
});

test('contribution: percent of pay, 0 without pay', () => {
  assert.equal(annualContribution({ ...base, contribution_type: 'percent', contribution_percent: 6, annual_pay: 80000 }), 4800);
  assert.equal(annualContribution({ ...base, contribution_type: 'percent', contribution_percent: 6 }), 0);
  assert.equal(annualContribution(base), 0);
});

test('match: 100% up to 4% of pay', () => {
  const a = { ...base, contribution_type: 'percent', contribution_percent: 6, annual_pay: 80000, match_rate_percent: 100, match_limit_percent: 4 };
  assert.deepEqual(annualMatch(a), { amount: 3200, needs_pay: false });
  assert.equal(matchSummary(a), '100% match up to 4% of pay');
});

test('match: 50% up to 6%, contributing less than the limit, and the yearly cap', () => {
  const a = { ...base, contribution_type: 'percent', contribution_percent: 3, annual_pay: 100000, match_rate_percent: 50, match_limit_percent: 6 };
  assert.equal(annualMatch(a).amount, 1500);
  assert.equal(annualMatch({ ...a, contribution_percent: 10, match_annual_cap: 2000 }).amount, 2000);
});

test('match: a limit with no pay figure is flagged and counts 0; no limit matches everything', () => {
  const a = { ...base, contribution_type: 'amount', contribution_amount: 100, match_rate_percent: 100, match_limit_percent: 4 };
  assert.deepEqual(annualMatch(a), { amount: 0, needs_pay: true });
  assert.equal(annualMatch({ ...a, match_limit_percent: null }).amount, 1200);
  assert.equal(matchSummary(base), null);
});

// ── Growth ───────────────────────────────────────────────────────────────────

test('future value: monthly compounding equals the yearly rate over 12 months', () => {
  close(futureValue(1000, 0, 6, 12), 1060);
  close(futureValue(1000, 0, 6, 120), 1000 * Math.pow(1.06, 10));
  assert.equal(futureValue(1000, 100, 0, 12), 2200);
  assert.equal(futureValue(1000, 100, 6, 0), 1000);
});

test('real rate and today\'s dollars', () => {
  close(realRatePct(6, 3), 2.9126, 0.0001);
  close(toReal(1060, 6, 1), 1000);
});

test('monthly to reach: inverse of future value', () => {
  const pmt = monthlyToReach(100000, 5, 240)!;
  close(futureValue(0, pmt, 5, 240), 100000, 0.05);
  assert.equal(monthlyToReach(-5, 5, 10), 0);
  assert.equal(monthlyToReach(100, 5, 0), null);
  assert.equal(monthlyToReach(1200, 0, 12), 100);
});

// ── Settings and target ─────────────────────────────────────────────────────

test('settings: defaults are filled and listed; age from birth year', () => {
  const s = resolveSettings({ birth_year: 1980 }, '2026-10-05');
  assert.equal(s.current_age, 46);
  assert.equal(s.retirement_age, 65);
  assert.equal(s.returns.middle, 6);
  assert.equal(s.selected_preset, 'middle');
  assert.ok(s.defaulted.includes('inflation_rate'));
  assert.equal(resolveSettings({ current_age: 30, birth_year: null }, '2026-10-05').current_age, 30);
});

test('target by years: spending x years, Social Security from its start age', () => {
  const s = resolveSettings(
    { current_age: 40, retirement_age: 65, life_expectancy: 90, desired_yearly_spending: 50000, social_security_monthly: 2000, social_security_start_age: 67 },
    '2026-10-05',
  );
  const t = retirementTarget(s, null);
  // 2 bridge years x 50,000 + 23 years x 26,000.
  assert.equal(t.target, 100000 + 23 * 26000);
  assert.equal(t.social_security_offset, 25 * 50000 - t.target!);
  assert.equal(t.years_in_retirement, 25);
});

test('target by withdrawal rate (rule of thumb): need / rate plus bridge years', () => {
  const s = resolveSettings(
    { current_age: 40, retirement_age: 65, desired_yearly_spending: 40000, social_security_monthly: 1000, target_method: 'withdrawal_rate' },
    '2026-10-05',
  );
  assert.equal(retirementTarget(s, null).target, 28000 / 0.04);
  const later = resolveSettings({ current_age: 40, retirement_age: 62, desired_yearly_spending: 40000, social_security_monthly: 1000, social_security_start_age: 67, target_method: 'withdrawal_rate' }, '2026-10-05');
  assert.equal(retirementTarget(later, null).target, 28000 / 0.04 + 5 * 12000);
});

test('target as a multiple of current spending; none without history', () => {
  const s = resolveSettings({ current_age: 50, spending_mode: 'multiple', spending_multiple: 0.8 }, '2026-10-05');
  assert.equal(retirementTarget(s, 60000).yearly_spending, 48000);
  assert.equal(retirementTarget(s, null).target, null);
});

// ── The plan ─────────────────────────────────────────────────────────────────

const acct = (over: Partial<PlanAccount> = {}): PlanAccount => ({
  id: 'a1',
  name: 'Made-up 401(k)',
  balance: 100000,
  annual_contribution: 6000,
  annual_match: 3000,
  expected_return: null,
  is_active: true,
  ...over,
});

test('plan: projection, presets ordered, gap and needed per month', () => {
  const settings = resolveSettings({ current_age: 45, retirement_age: 65, desired_yearly_spending: 60000 }, '2026-10-05');
  const plan = buildPlan({ accounts: [acct()], settings, currentYearlySpending: null, today: '2026-10-05' });
  assert.equal(plan.years_to_retirement, 20);
  assert.equal(plan.monthly_contributions, 750);
  const nominal = futureValue(100000, 750, 6, 240);
  close(plan.projected_nominal!, nominal);
  close(plan.projected_real!, toReal(nominal, 3, 20));
  assert.ok(plan.preset_real!.conservative < plan.preset_real!.middle);
  assert.ok(plan.preset_real!.middle < plan.preset_real!.optimistic);
  close(plan.preset_real!.middle, plan.projected_real!);
  assert.equal(plan.series.length, 21);
  assert.equal(plan.series[0].yours, 100000);
  close(plan.series[20].yours, plan.projected_real!, 0.02);
  assert.equal(plan.target.target, 25 * 60000);
  close(plan.gap!, 1500000 - plan.projected_real!);
  const extra = monthlyToReach(plan.gap!, plan.selected_real_return, 240)!;
  close(plan.extra_monthly_needed!, extra);
  close(plan.total_monthly_needed!, 750 + extra);
});

test('plan: an account\'s own return is used in "your plan" only; inactive accounts get no contributions', () => {
  const settings = resolveSettings({ current_age: 55, retirement_age: 65, desired_yearly_spending: 1 }, '2026-10-05');
  const plan = buildPlan({
    accounts: [acct({ expected_return: 10 }), acct({ id: 'a2', is_active: false, balance: 1000 })],
    settings,
    currentYearlySpending: null,
    today: '2026-10-05',
  });
  assert.equal(plan.accounts[0].rate_source, 'account');
  close(plan.accounts[0].nominal, futureValue(100000, 750, 10, 120));
  close(plan.accounts[1].nominal, futureValue(1000, 0, 6, 120));
  assert.ok(plan.projected_real! > plan.preset_real!.middle);
  assert.ok(plan.gap! < 0);
  assert.equal(plan.extra_monthly_needed, 0);
});

test('plan: no age -> no projection; at retirement age -> no per-month figure', () => {
  const none = buildPlan({ accounts: [acct()], settings: resolveSettings({}, '2026-10-05'), currentYearlySpending: null, today: '2026-10-05' });
  assert.equal(none.projected_real, null);
  assert.equal(none.current_total, 100000);
  const retired = buildPlan({
    accounts: [acct()],
    settings: resolveSettings({ current_age: 70, desired_yearly_spending: 30000 }, '2026-10-05'),
    currentYearlySpending: null,
    today: '2026-10-05',
  });
  assert.equal(retired.retired, true);
  assert.equal(retired.projected_real, 100000);
  assert.equal(retired.extra_monthly_needed, null);
});

test('latest snapshot per account', () => {
  const latest = latestSnapshots([
    { account_id: 'a', as_of: '2026-01-31', balance: 1 },
    { account_id: 'a', as_of: '2026-06-30', balance: 2 },
    { account_id: 'b', as_of: '2025-12-31', balance: 3 },
  ]);
  assert.equal(latest.get('a')!.balance, 2);
  assert.equal(latest.get('b')!.balance, 3);
});

// ── Insurance ────────────────────────────────────────────────────────────────

const policy = (over: Partial<PolicyRow> = {}): PolicyRow => ({
  id: 'p1',
  kind: 'term_life',
  insurer: 'Example Mutual',
  coverage_amount: 500000,
  premium_amount: 42.5,
  premium_frequency: 'monthly',
  start_date: '2025-01-31',
  term_end_date: '2045-01-31',
  cash_value: null,
  premium_category_id: 'cat-ins',
  premium_vendor: 'example mutual',
  is_active: true,
  ...over,
});

const tx = (id: string, date: string, amount: number, over: Partial<PremiumTxn> = {}): PremiumTxn => ({
  id,
  type: 'expense',
  amount,
  transaction_date: date,
  category_id: null,
  vendor: 'EXAMPLE MUTUAL INS',
  description: null,
  ...over,
});

test('schedule: month-end start dates clamp; dueAround finds previous and next', () => {
  assert.equal(addMonthsClamped('2025-01-31', 1), '2025-02-28');
  assert.equal(addMonthsClamped('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonthsClamped('2025-11-15', 3), '2026-02-15');
  assert.deepEqual(dueAround('2025-01-31', 'monthly', '2026-10-05'), { previous: '2026-09-30', next: '2026-10-31' });
  assert.deepEqual(dueAround('2025-03-10', 'annual', '2026-10-05'), { previous: '2026-03-10', next: '2027-03-10' });
  assert.deepEqual(dueAround('2027-01-01', 'monthly', '2026-10-05'), { previous: null, next: '2027-01-01' });
});

test('matching: by category or vendor, amount within 2% (min $1), expenses only', () => {
  const p = policy();
  assert.ok(isPremiumPayment(p, tx('t1', '2026-09-30', 42.5)));
  assert.ok(isPremiumPayment(p, tx('t2', '2026-09-30', 43.4, { vendor: 'Other', category_id: 'cat-ins' })));
  assert.ok(!isPremiumPayment(p, tx('t3', '2026-09-30', 45)));
  assert.ok(!isPremiumPayment(p, tx('t4', '2026-09-30', 42.5, { type: 'income' })));
  assert.ok(!isPremiumPayment(p, tx('t5', '2026-09-30', 42.5, { vendor: 'Grocer' })));
  assert.ok(!isPremiumPayment(policy({ premium_category_id: null, premium_vendor: null }), tx('t6', '2026-09-30', 42.5)));
  assert.ok(!isPremiumPayment(p, tx('t7', '2024-06-01', 42.5)));
});

test('premium status: paid to date, this year, next due and whether it is covered', () => {
  const p = policy();
  const txns = [tx('a', '2025-12-31', 42.5), tx('b', '2026-08-31', 42.5), tx('c', '2026-09-30', 42.5)];
  const s = premiumStatus(p, txns, '2026-10-05');
  assert.equal(s.paid_to_date, 127.5);
  assert.equal(s.paid_this_year, 85);
  assert.equal(s.last_paid, '2026-09-30');
  assert.equal(s.next_due, '2026-10-31');
  assert.equal(s.next_due_paid, false);
  assert.equal(s.yearly_premium, 510);
  const early = premiumStatus(p, [...txns, tx('d', '2026-10-03', 42.5)], '2026-10-05');
  assert.equal(early.next_due_paid, true);
  assert.equal(premiumStatus(policy({ term_end_date: '2026-01-01' }), txns, '2026-10-05').next_due, null);
});

test('term status and totals', () => {
  assert.equal(termStatus(policy({ term_end_date: '2027-03-01' }), '2026-10-05').status, 'ending_soon');
  assert.equal(termStatus(policy({ term_end_date: '2026-01-01' }), '2026-10-05').status, 'ended');
  assert.equal(termStatus(policy(), '2026-10-05').status, 'active');
  assert.equal(termStatus(policy({ term_end_date: null }), '2026-10-05').status, 'none');
  const totals = policyTotals([
    policy(),
    policy({ id: 'p2', kind: 'whole_life', coverage_amount: 100000, premium_amount: 1200, premium_frequency: 'annual', cash_value: 8000 }),
    policy({ id: 'p3', is_active: false, coverage_amount: 999999 }),
  ]);
  assert.deepEqual(totals, {
    coverage: { life: 600000, property: 0, liability: 0, other: 0 },
    counts: { life: 2, property: 0, liability: 0, other: 0 },
    cash_value: 8000,
    yearly_premiums: 1710,
    active: 2,
  });
});

test('policy totals: coverage is summed per group, never across groups', () => {
  const totals = policyTotals([
    policy({ id: 'l1', coverage_amount: 500000 }),
    policy({ id: 'o1', kind: 'other', coverage_amount: 20000 }),
    // Kinds from plans/66 W2 already land in their own groups.
    policy({ id: 'h1', kind: 'homeowners', coverage_amount: 300000 }),
    policy({ id: 'u1', kind: 'umbrella', coverage_amount: 1000000 }),
    policy({ id: 'x1', kind: 'something_new', coverage_amount: 5 }),
  ]);
  assert.deepEqual(totals.coverage, { life: 500000, property: 300000, liability: 1000000, other: 20005 });
  assert.deepEqual(totals.counts, { life: 1, property: 1, liability: 1, other: 2 });
  assert.equal(policyGroup('whole_life'), 'life');
  assert.equal(policyGroup('general_liability'), 'liability');
  assert.equal(policyGroup('other'), 'other');
});
