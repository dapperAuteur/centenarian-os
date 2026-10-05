// tests/unit/debt.test.ts
// Unit tests for lib/finance/debt/: payoff math, the debt-free plan and its strategies (with BAM's
// promo-deadline rule), interest paid, the debts overview, and due dates / reminders.
// Run: npm run test:unit
//
// Every account, statement and amount here is made up. Nothing touches a database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonthsToDate,
  daysBetween,
  monthlyPaymentsUntil,
} from '../../lib/finance/debt/dates.ts';
import {
  backInterestAtRisk,
  earlyPaymentSavings,
  estimatedMinimumPayment,
  monthlyInterestCents,
  paymentByDate,
  paymentForMonths,
  payoffSchedule,
  promoRequiredMonthly,
} from '../../lib/finance/debt/amortize.ts';
import { buildPlan, comparePlan } from '../../lib/finance/debt/plan.ts';
import type { PlanDebt } from '../../lib/finance/debt/plan.ts';
import { interestPaid } from '../../lib/finance/debt/interest.ts';
import {
  buildDebtSummary,
  isLinkedPayment,
  owedFromTransactions,
  pickApr,
  promoKey,
  toPlanDebts,
} from '../../lib/finance/debt/overview.ts';
import type { DebtAccountRow, StatementRow, TxnRow } from '../../lib/finance/debt/overview.ts';
import {
  dayOfMonthDates,
  dueSoon,
  dueTaskDescription,
  dueTaskTitle,
  isItemPaid,
  reminderToSend,
  upcomingDueItems,
} from '../../lib/finance/debt/due.ts';
import { makeBaseline, planProgress } from '../../lib/finance/debt/progress.ts';
import { parsePlanInput } from '../../lib/finance/debt/plan-input.ts';

// ── dates ───────────────────────────────────────────────────────────────────────────────────────

test('addMonthsToDate clamps to the end of a shorter month', () => {
  assert.equal(addMonthsToDate('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonthsToDate('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonthsToDate('2026-11-15', 3), '2027-02-15');
  assert.equal(addMonthsToDate('2026-03-15', -3), '2025-12-15');
});

test('monthlyPaymentsUntil counts payments a month apart, first one a month out', () => {
  assert.equal(monthlyPaymentsUntil('2026-10-05', '2027-03-31'), 5);
  assert.equal(monthlyPaymentsUntil('2026-10-05', '2026-11-05'), 1);
  assert.equal(monthlyPaymentsUntil('2026-10-05', '2026-11-04'), 0);
  assert.equal(daysBetween('2026-10-05', '2026-10-15'), 10);
});

// ── single debt ─────────────────────────────────────────────────────────────────────────────────

test('monthly interest is balance x APR / 12, to the cent', () => {
  // $1,000 at 24% -> $20.00 a month
  assert.equal(monthlyInterestCents(100_000, 24), 2000);
  assert.equal(monthlyInterestCents(100_000, 0), 0);
  assert.equal(monthlyInterestCents(100_000, null), 0);
});

test('payoffSchedule: $1,000 at 24% paying $100/month', () => {
  const r = payoffSchedule(1000, 24, 100, '2026-10-05');
  assert.equal(r.neverPaysOff, false);
  assert.equal(r.months, 12);
  assert.equal(r.schedule[0].interest, 20);
  assert.equal(r.schedule[0].principal, 80);
  assert.equal(r.schedule[0].balance, 920);
  assert.equal(r.schedule[0].date, '2026-11-05');
  assert.equal(r.payoffDate, '2027-10-05');
  // Interest + principal = total paid
  assert.equal(Math.round((r.totalPaid - r.totalInterest) * 100), 100_000);
  assert.ok(r.totalInterest > 120 && r.totalInterest < 135, `interest ${r.totalInterest}`);
});

test('payoffSchedule: zero APR divides evenly, and a payment below the interest never pays off', () => {
  const zero = payoffSchedule(600, 0, 100, '2026-01-01');
  assert.equal(zero.months, 6);
  assert.equal(zero.totalInterest, 0);
  const stuck = payoffSchedule(1000, 24, 20, '2026-01-01');
  assert.equal(stuck.neverPaysOff, true);
  assert.equal(stuck.months, null);
  assert.equal(payoffSchedule(0, 24, 50, '2026-01-01').months, 0);
});

test('paymentForMonths solves the payment, and the schedule then finishes on time', () => {
  const p = paymentForMonths(5000, 18, 24);
  // Standard formula: 5000 * 0.015 / (1 - 1.015^-24) = 249.62
  assert.ok(Math.abs(p - 249.62) <= 0.02, `payment ${p}`);
  const r = payoffSchedule(5000, 18, p, '2026-01-01');
  assert.ok(r.months !== null && r.months <= 24);
  assert.equal(paymentForMonths(1200, 0, 12), 100);
});

test('paymentByDate: pay off by a date', () => {
  const r = paymentByDate(1200, 0, '2026-10-05', '2027-10-05');
  assert.equal(r.months, 12);
  assert.equal(r.payment, 100);
  const now = paymentByDate(300, 20, '2026-10-05', '2026-10-20');
  assert.equal(now.payInFull, true);
  assert.equal(now.payment, 300);
});

test('earlyPaymentSavings: amount x APR / 365 x days, as an estimate', () => {
  assert.equal(earlyPaymentSavings(500, 23.99, 10), 3.29);
  assert.equal(earlyPaymentSavings(500, null, 10), 0);
  assert.equal(earlyPaymentSavings(500, 23.99, 0), 0);
});

test('estimatedMinimumPayment: max($25, 1% + interest), capped at the balance', () => {
  assert.equal(estimatedMinimumPayment(5000, 24), 150); // 50 + 100
  assert.equal(estimatedMinimumPayment(500, 24), 25);
  assert.equal(estimatedMinimumPayment(10, 24), 10.2); // balance + a month's interest
  assert.equal(estimatedMinimumPayment(0, 24), 0);
});

test('promoRequiredMonthly: balance / payments left, rounded up', () => {
  const pace = promoRequiredMonthly(1000, '2026-10-05', '2027-03-31');
  assert.equal(pace.paymentsLeft, 5);
  assert.equal(pace.monthly, 200);
  const odd = promoRequiredMonthly(1000, '2026-10-05', '2027-01-31');
  assert.equal(odd.paymentsLeft, 3);
  assert.equal(odd.monthly, 333.34);
  const soon = promoRequiredMonthly(400, '2026-10-05', '2026-10-20');
  assert.deepEqual(soon, { paymentsLeft: 1, monthly: 400, expired: false });
  assert.equal(promoRequiredMonthly(400, '2026-10-05', '2026-09-30').expired, true);
});

test('backInterestAtRisk: statement figure is exact, otherwise an estimate', () => {
  assert.deepEqual(
    backInterestAtRisk({ deferredInterest: 80, balance: 500, today: '2026-10-05' }),
    { amount: 80, estimated: false },
  );
  // 600 * 0.24/12 * 6 months = 72
  assert.deepEqual(
    backInterestAtRisk({ balance: 600, aprPercent: 24, startedOn: '2026-04-05', today: '2026-10-05' }),
    { amount: 72, estimated: true },
  );
  assert.equal(backInterestAtRisk({ balance: 600, today: '2026-10-05' }), null);
});

// ── plan ────────────────────────────────────────────────────────────────────────────────────────

const highApr: PlanDebt = { id: 'a', name: 'High APR card', balance: 3000, apr: 29.99, minPayment: 90 };
const lowBalance: PlanDebt = { id: 'b', name: 'Small loan', balance: 800, apr: 9, minPayment: 40 };
const midCard: PlanDebt = { id: 'c', name: 'Mid card', balance: 2000, apr: 19.99, minPayment: 60 };

test('avalanche targets the highest APR first; snowball the smallest balance', () => {
  const debts = [lowBalance, midCard, highApr];
  const av = buildPlan(debts, { strategy: 'avalanche', extraMonthly: 200, startDate: '2026-10-05' });
  assert.deepEqual(av.firstMonthOrder, ['a', 'c', 'b']);
  const sb = buildPlan(debts, { strategy: 'snowball', extraMonthly: 200, startDate: '2026-10-05' });
  assert.deepEqual(sb.firstMonthOrder, ['b', 'c', 'a']);
  assert.equal(av.neverPaysOff, false);
  assert.equal(sb.neverPaysOff, false);
  // Avalanche never pays more interest than snowball on the same budget.
  assert.ok(av.totalInterest <= sb.totalInterest, `${av.totalInterest} vs ${sb.totalInterest}`);
  // Snowball clears the small loan first.
  assert.ok(sb.payoffDates.b! < sb.payoffDates.a!);
});

test('the monthly budget stays fixed: freed minimums roll over', () => {
  const plan = buildPlan([lowBalance, highApr], { extraMonthly: 100, startDate: '2026-10-05' });
  assert.equal(plan.monthlyBudget, 230);
  // Every month but the last pays the full budget.
  for (const row of plan.schedule.slice(0, -1)) assert.equal(row.payment, 230);
  assert.equal(plan.schedule[plan.schedule.length - 1].balance, 0);
  assert.equal(plan.debtFreeDate, plan.schedule[plan.schedule.length - 1].date);
});

test('custom order is followed, and debts left out follow in avalanche order', () => {
  const plan = buildPlan([lowBalance, midCard, highApr], {
    strategy: 'custom',
    customOrder: ['c'],
    extraMonthly: 100,
    startDate: '2026-10-05',
  });
  assert.deepEqual(plan.firstMonthOrder, ['c', 'a', 'b']);
});

test('interest saved versus minimums only', () => {
  const cmp = comparePlan([lowBalance, highApr], { extraMonthly: 150, startDate: '2026-10-05' });
  assert.equal(cmp.minimumsOnly.neverPaysOff, false);
  assert.ok(cmp.interestSaved !== null && cmp.interestSaved > 0);
  assert.ok(cmp.monthsSooner !== null && cmp.monthsSooner > 0);
  // Zero extra still saves by rolling freed minimums over.
  const rollOnly = comparePlan([lowBalance, highApr], { extraMonthly: 0, startDate: '2026-10-05' });
  assert.ok(rollOnly.interestSaved !== null && rollOnly.interestSaved >= 0);
});

test('minimums that never cover the interest are reported, not looped for ever', () => {
  const stuck: PlanDebt = { id: 's', name: 'Stuck', balance: 10_000, apr: 30, minPayment: 100 };
  const cmp = comparePlan([stuck], { extraMonthly: 0, startDate: '2026-10-05' });
  assert.equal(cmp.plan.neverPaysOff, true);
  assert.equal(cmp.interestSaved, null);
  assert.ok(cmp.plan.schedule.length < 600);
});

test('a missing minimum is estimated and listed', () => {
  const plan = buildPlan([{ id: 'x', name: 'No min', balance: 1000, apr: 24, minPayment: null }], {
    startDate: '2026-10-05',
  });
  assert.deepEqual(plan.estimatedMinimums, ['x']);
  assert.equal(plan.monthlyBudget, 30); // 1% + 2% interest = $30
});

// BAM's rule: avalanche, but a deferred-interest promo is cleared before its deadline first.
const promoCard: PlanDebt = {
  id: 'bb',
  name: 'Best Buy card',
  balance: 1200,
  apr: 30.99,
  minPayment: 35,
  promos: [{ id: 'p1', balance: 1200, expiresOn: '2027-04-30', deferredInterest: 250 }],
};
const otherCard: PlanDebt = { id: 'oc', name: 'Other card', balance: 4000, apr: 27.99, minPayment: 120 };

test('avalanche protects a promo deadline: the promo is cleared before it expires', () => {
  // $250 extra leaves room to clear $1,200 in the 5 payments before the last one (Nov - Mar).
  const plan = buildPlan([promoCard, otherCard], { extraMonthly: 250, startDate: '2026-10-05' });
  assert.equal(plan.strategy, 'avalanche');
  // Avalanche ranks the promo-only card last (it charges nothing yet); the guard still pays it.
  assert.deepEqual(plan.firstMonthOrder, ['oc', 'bb']);
  assert.equal(plan.schedule[0].debts.bb.payment, 240);
  assert.deepEqual(plan.missedPromos, []);
  const cleared = plan.schedule.find((m) => m.debts.bb.balance === 0);
  assert.ok(cleared, 'promo card is paid off');
  assert.ok(cleared!.date < '2027-04-30', `cleared on ${cleared!.date}`);
  // One payment of margin: cleared by the second-to-last payment date before expiry.
  assert.ok(cleared!.date <= '2027-03-05');
});

test('without the promo guard, plain avalanche misses the promo and pays the back interest', () => {
  const plan = buildPlan([promoCard, otherCard], {
    extraMonthly: 200,
    startDate: '2026-10-05',
    protectPromos: false,
  });
  assert.equal(plan.missedPromos.length, 1);
  assert.equal(plan.missedPromos[0].backInterest, 250);
  assert.equal(plan.missedPromos[0].backInterestEstimated, false);
  const guarded = buildPlan([promoCard, otherCard], { extraMonthly: 200, startDate: '2026-10-05' });
  assert.ok(guarded.totalInterest < plan.totalInterest);
});

test('promo_first puts all spare money on promos, earliest expiry first', () => {
  const plan = buildPlan([promoCard, otherCard], {
    strategy: 'promo_first',
    extraMonthly: 200,
    startDate: '2026-10-05',
  });
  // Month 1: minimums 35 + 120, then all 200 extra to the promo.
  assert.equal(plan.schedule[0].debts.bb.payment, 235);
  assert.deepEqual(plan.missedPromos, []);
});

// ── interest paid ───────────────────────────────────────────────────────────────────────────────

test('interestPaid: statements are exact and win over transactions in their period', () => {
  const report = interestPaid(
    [
      { accountId: 'a', periodStart: '2026-01-06', periodEnd: '2026-02-05', interestCharged: 41.5 },
      { accountId: 'a', periodStart: null, periodEnd: '2026-03-05', interestCharged: 39 },
      { accountId: 'a', periodStart: '2025-12-06', periodEnd: '2026-01-05', interestCharged: null },
    ],
    [
      // inside the Feb statement period: skipped
      { accountId: 'a', date: '2026-02-05', amount: 41.5, type: 'expense' },
      // covered by the Mar statement (no period_start: assumed Feb 6 - Mar 5): skipped
      { accountId: 'a', date: '2026-03-05', amount: 39, type: 'expense' },
      // statement without an interest figure doesn't cover: counted
      { accountId: 'a', date: '2026-01-05', amount: 44, type: 'expense' },
      // a refund of interest subtracts
      { accountId: 'a', date: '2026-04-10', amount: 50, type: 'expense' },
      { accountId: 'a', date: '2026-04-12', amount: 10, type: 'income' },
      // other year: ignored
      { accountId: 'a', date: '2025-12-20', amount: 99, type: 'expense' },
      { accountId: 'l', date: '2026-04-01', amount: 12.34, type: 'expense' },
    ],
    2026,
  );
  const a = report.accounts.find((x) => x.accountId === 'a')!;
  assert.deepEqual(
    a.months.map((m) => [m.month, m.amount, m.source]),
    [
      ['2026-01', 44, 'transactions'],
      ['2026-02', 41.5, 'statement'],
      ['2026-03', 39, 'statement'],
      ['2026-04', 40, 'transactions'],
    ],
  );
  assert.equal(a.total, 164.5);
  assert.equal(report.total, 176.84);
  assert.equal(report.byMonth.length, 12);
  assert.equal(report.byMonth[3].amount, 52.34);
});

// ── overview ────────────────────────────────────────────────────────────────────────────────────

const card: DebtAccountRow = {
  id: 'card1',
  name: 'Best Buy',
  account_type: 'credit_card',
  interest_rate: 25,
  due_date: 21,
  opening_balance: 1000,
};

const statement: StatementRow = {
  id: 'st1',
  account_id: 'card1',
  period_start: '2026-09-02',
  period_end: '2026-09-28',
  new_balance: 1150,
  minimum_payment: 40,
  due_date: '2026-10-21',
  interest_charged: 20.5,
  aprs: [
    { balance_type: 'Promotional Purchases', apr: 0 },
    { balance_type: 'Purchases - Regular', apr: 30.99 },
    { balance_type: 'Cash Advances', apr: 30.99 },
  ],
  promos: [
    { description: 'Deferred interest 12 months', balance: 600, expires_on: '2027-01-31', deferred_interest: 95.5 },
    { description: 'Expired', balance: 100, expires_on: '2026-09-01' },
    { description: 'No balance', balance: 0, expires_on: '2027-06-01' },
  ],
};

const txns: TxnRow[] = [
  { id: 't1', account_id: 'card1', amount: 200, type: 'expense', transaction_date: '2026-09-10' },
  { id: 't2', account_id: 'card1', amount: 50, type: 'income', transaction_date: '2026-09-15', transfer_kind: 'card_payment', transfer_group_id: 'g1' },
  { id: 't3', account_id: 'other', amount: 999, type: 'expense', transaction_date: '2026-09-15' },
];

test('owedFromTransactions matches the accounts route formula', () => {
  assert.equal(owedFromTransactions(card, txns), 1150);
});

test('isLinkedPayment: income linked by transfer tracking only', () => {
  assert.equal(isLinkedPayment(txns[1]), true);
  assert.equal(isLinkedPayment({ ...txns[1], transfer_kind: null, transfer_group_id: null }), false);
  assert.equal(isLinkedPayment({ ...txns[1], transfer_kind: null }), true);
  assert.equal(isLinkedPayment(txns[0]), false);
});

test('pickApr prefers the statement purchase APR, then the highest, then the account rate', () => {
  assert.deepEqual(pickApr(statement.aprs, 25), { apr: 30.99, source: 'statement' });
  assert.deepEqual(pickApr([{ balance_type: 'Cash', apr: 28 }, { balance_type: 'Other', apr: 20 }], 25), { apr: 28, source: 'statement' });
  assert.deepEqual(pickApr([], '25.00'), { apr: 25, source: 'account' });
  assert.deepEqual(pickApr(null, null), { apr: null, source: null });
});

test('buildDebtSummary: latest statement figures and open promos', () => {
  const older: StatementRow = { ...statement, id: 'st0', period_end: '2026-08-28', minimum_payment: 99, due_date: '2026-09-21' };
  const d = buildDebtSummary(card, [older, statement], txns, '2026-10-05');
  assert.equal(d.balance, 1150);
  assert.equal(d.apr, 30.99);
  assert.equal(d.minimumPayment, 40);
  assert.equal(d.minimumEstimated, false);
  assert.equal(d.dueDay, 21);
  assert.equal(d.latestStatement?.id, 'st1');
  // Expired promo is kept (flagged), zero-balance promo dropped.
  assert.equal(d.promos.length, 2);
  const live = d.promos.find((p) => !p.expired)!;
  assert.equal(live.requiredMonthly, 200);
  assert.equal(live.backInterest, 95.5);
  assert.equal(live.needsAttention, false);
  assert.equal(live.id, promoKey({ expires_on: '2027-01-31', description: 'Deferred interest 12 months' }));
  const plan = toPlanDebts([d]);
  assert.equal(plan[0].promos!.length, 1);
  assert.equal(plan[0].minPayment, 40);
});

// ── due dates ───────────────────────────────────────────────────────────────────────────────────

test('dayOfMonthDates lists the due day in a range, clamped for short months', () => {
  assert.deepEqual(dayOfMonthDates(21, '2026-09-25', '2026-11-19'), ['2026-10-21']);
  assert.deepEqual(dayOfMonthDates(31, '2026-02-01', '2026-04-30'), ['2026-02-28', '2026-03-31', '2026-04-30']);
});

test('upcomingDueItems: the statement due date, the next cycle, and a promo deadline', () => {
  const d = buildDebtSummary(card, [statement], txns, '2026-10-10');
  // Window: Sep 30 to Nov 24.
  const items = upcomingDueItems(d, '2026-10-10');
  const payments = items.filter((i) => i.kind === 'payment_due');
  assert.deepEqual(payments.map((i) => i.deadline), ['2026-10-21', '2026-11-21']);
  assert.equal(payments[0].minimum, 40);
  assert.equal(payments[0].statementBalance, 1150);
  assert.equal(payments[0].cycleStart, '2026-09-29');
  assert.equal(payments[1].minimum, null);
  // The promo expires Jan 31 2027; its task is 30 days before (Jan 1), past the 45-day window.
  assert.equal(items.filter((i) => i.kind === 'promo_deadline').length, 0);
  const later = upcomingDueItems(d, '2026-12-01');
  const promo = later.find((i) => i.kind === 'promo_deadline')!;
  assert.equal(promo.date, '2027-01-01');
  assert.equal(promo.deadline, '2027-01-31');
});

test('dueTaskTitle and description carry the amounts and the early-payment estimate', () => {
  const d = buildDebtSummary(card, [statement], txns, '2026-10-05');
  const [first] = upcomingDueItems(d, '2026-10-05');
  assert.equal(
    dueTaskTitle(first, '2026-10-05'),
    'Pay Best Buy — $40.00 minimum ($1,150.00 statement balance to avoid interest) — due Oct 21',
  );
  const desc = dueTaskDescription(first, '2026-10-05');
  // 1150 * 0.3099 / 365 * 10 = 9.76
  assert.match(desc, /Paying \$1,150\.00 10 days early saves about \$9\.76 at 30\.99% APR \(estimate/);
  const promo = upcomingDueItems(d, '2026-12-01').find((i) => i.kind === 'promo_deadline')!;
  assert.equal(dueTaskTitle(promo, '2026-12-01'), 'Clear Best Buy promo — $600.00 by Jan 31, 2027 to avoid deferred interest');
  assert.match(dueTaskDescription(promo, '2026-12-01'), /\$95\.50 of deferred interest/);
});

test('isItemPaid: linked payments in the cycle that reach the minimum', () => {
  const d = buildDebtSummary(card, [statement], txns, '2026-10-05');
  const [first] = upcomingDueItems(d, '2026-10-05');
  assert.equal(isItemPaid(first, txns), false); // the $50 on Sep 15 is before the cycle
  const pay = (amount: number, date: string): TxnRow => ({
    id: `p${date}`, account_id: 'card1', amount, type: 'income', transaction_date: date, transfer_kind: 'card_payment',
  });
  assert.equal(isItemPaid(first, [pay(30, '2026-10-02')]), false);
  assert.equal(isItemPaid(first, [pay(30, '2026-10-02'), pay(10, '2026-10-20')]), true);
  assert.equal(isItemPaid(first, [pay(40, '2026-10-31')]), true); // late but within grace
  assert.equal(isItemPaid(first, [pay(40, '2026-11-01')]), false);
  // An unlinked refund doesn't count.
  assert.equal(isItemPaid(first, [{ ...pay(40, '2026-10-10'), transfer_kind: null }]), false);
});

test('reminderToSend: 3 days, 1 day, both, each once', () => {
  const d = buildDebtSummary(card, [statement], txns, '2026-10-05');
  const [item] = upcomingDueItems(d, '2026-10-05'); // due Oct 21
  const none = { threeDay: false, oneDay: false };
  assert.equal(reminderToSend(item, '2026-10-18', 'off', none), null);
  assert.equal(reminderToSend(item, '2026-10-18', '3_days', none), '3_days');
  assert.equal(reminderToSend(item, '2026-10-18', '1_day', none), null);
  assert.equal(reminderToSend(item, '2026-10-20', '1_day', none), '1_day');
  assert.equal(reminderToSend(item, '2026-10-21', 'both', none), '1_day');
  assert.equal(reminderToSend(item, '2026-10-20', 'both', { threeDay: true, oneDay: true }), null);
  assert.equal(reminderToSend(item, '2026-10-22', 'both', none), null);
  assert.equal(reminderToSend(item, '2026-10-19', 'both', none), '3_days');
});

test('dueSoon: unpaid due dates from today to 3 days ahead', () => {
  const d = buildDebtSummary(card, [statement], txns, '2026-10-18');
  const items = upcomingDueItems(d, '2026-10-18');
  assert.deepEqual(dueSoon(items, txns, '2026-10-18').map((e) => e.daysUntil), [3]);
  assert.deepEqual(dueSoon(items, txns, '2026-10-21').map((e) => e.daysUntil), [0]);
  assert.deepEqual(dueSoon(items, txns, '2026-10-17'), []);
  const paid: TxnRow = { id: 'p', account_id: 'card1', amount: 40, type: 'income', transaction_date: '2026-10-16', transfer_kind: 'card_payment' };
  assert.deepEqual(dueSoon(items, [paid], '2026-10-18'), []);
});

// ── saved plans ─────────────────────────────────────────────────────────────────────────────────

test('parsePlanInput: defaults, validation, and partial updates', () => {
  const full = parsePlanInput({});
  assert.deepEqual(full, {
    ok: true,
    value: { name: 'My debt-free plan', strategy: 'avalanche', extra_monthly: 0, custom_order: [], protect_promos: true },
  });
  assert.equal(parsePlanInput({ strategy: 'random' }).ok, false);
  assert.equal(parsePlanInput({ extra_monthly: -5 }).ok, false);
  assert.equal(parsePlanInput({ custom_order: ['not-a-uuid'] }).ok, false);
  assert.equal(parsePlanInput(null).ok, false);
  assert.deepEqual(parsePlanInput({ extra_monthly: '125.456' }, true), { ok: true, value: { extra_monthly: 125.46 } });
});

test('planProgress compares linked payments since the baseline with the plan', () => {
  const debts = [lowBalance, highApr];
  const plan = buildPlan(debts, { extraMonthly: 100, startDate: '2026-10-05' });
  const baseline = makeBaseline(plan, debts, '2026-10-05');
  assert.equal(baseline.months[0].date, '2026-11-05');
  assert.equal(baseline.months[0].payments.a + baseline.months[0].payments.b, 230);
  const pay = (account: string, amount: number, date: string): TxnRow => ({
    id: `${account}${date}`, account_id: account, amount, type: 'income', transaction_date: date, transfer_kind: 'card_payment',
  });
  const progress = planProgress(
    baseline,
    [pay('a', 200, '2026-11-03'), pay('b', 40, '2026-11-04'), pay('a', 999, '2026-10-01'), pay('z', 50, '2026-11-04')],
    '2026-11-10',
  );
  assert.equal(progress.plannedToDate, 230);
  assert.equal(progress.paidToDate, 240);
  assert.equal(progress.onTrack, true);
  assert.equal(planProgress(baseline, [pay('a', 100, '2026-11-03')], '2026-11-10').onTrack, false);
});

test('a card with both a regular and a promo balance: the guard still clears the promo in time', () => {
  const mixed: PlanDebt = {
    id: 'mx',
    name: 'Mixed card',
    balance: 2000,
    apr: 29.99,
    minPayment: 60,
    promos: [{ id: 'p', balance: 900, expiresOn: '2027-06-30', deferredInterest: null, startedOn: '2026-06-30' }],
  };
  const plan = buildPlan([mixed], { extraMonthly: 150, startDate: '2026-10-05' });
  assert.deepEqual(plan.missedPromos, []);
  assert.equal(plan.neverPaysOff, false);
  const noGuard = buildPlan([mixed], { extraMonthly: 0, startDate: '2026-10-05', protectPromos: false });
  // Minimum goes to the regular part first, so the promo is missed and back interest estimated.
  assert.equal(noGuard.missedPromos.length, 1);
  assert.equal(noGuard.missedPromos[0].backInterestEstimated, true);
});
