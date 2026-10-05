// tests/unit/savings.test.ts
// Unit tests for savings goals as virtual envelopes (lib/finance/savings/):
// saved so far, the unallocated balance and over-allocation, monthly needed,
// the monthly surplus and "does it fit?", pace and projected date, milestones,
// deposits to allocate, the allocation rules, and the database helpers
// against the in-memory fake (including milestone planner tasks).
// Run: npm run test:unit
//
// Every account, goal, amount and id here is made up. Nothing touches a database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  accountBalance,
  addMonthsToDate,
  contributionPace,
  depositsToAllocate,
  envelopeSummary,
  fitGoals,
  milestoneReached,
  milestonesCrossed,
  monthlyNeeded,
  monthlySurplus,
  monthsLeft,
  planAllocation,
  projectedDate,
  savedSoFar,
  SavingsRuleError,
  trackStatus,
  wholeMonthsBetween,
} from '../../lib/finance/savings/logic.ts';
import type { AllocationContext, EnvelopeGoal } from '../../lib/finance/savings/logic.ts';
import {
  applyAllocation,
  createGoal,
  loadSavingsOverview,
  noteMilestones,
  parseAllocationRequest,
  parseGoalInput,
  SAVINGS_NOT_READY,
  updateGoal,
} from '../../lib/finance/savings/server.ts';
import { FakeDb } from './fake-supabase.ts';

const USER = 'user-1';
const OTHER = 'user-2';
const SAVINGS = 'acct-savings';
const CHECKING = 'acct-checking';
const CARD = 'acct-card';
const TODAY = '2026-10-05';

// ── Saved so far and envelopes ──────────────────────────────────────────────

test('saved so far = starting amount + allocations (in and out)', () => {
  const goal = { id: 'g1', starting_amount: '100.00' };
  const allocations = [
    { goal_id: 'g1', amount: 250, allocated_on: '2026-09-01' },
    { goal_id: 'g1', amount: '-50.10', allocated_on: '2026-09-15' },
    { goal_id: 'g2', amount: 999, allocated_on: '2026-09-15' },
  ];
  assert.equal(savedSoFar(goal, allocations), 299.9);
});

test('account balance uses the accounts API formula', () => {
  const rows = [
    { type: 'income', amount: 1000 },
    { type: 'expense', amount: '200.25' },
  ];
  assert.equal(accountBalance({ account_type: 'savings', opening_balance: 500 }, rows), 1299.75);
  assert.equal(accountBalance({ account_type: 'credit_card', opening_balance: 100 }, rows), -(100 + 200.25 - 1000));
});

test('unallocated = balance - what the goals hold; over-allocation is flagged', () => {
  const goals = [
    { id: 'g1', starting_amount: 100 },
    { id: 'g2', starting_amount: 0 },
  ];
  const allocations = [
    { goal_id: 'g1', amount: 400, allocated_on: '2026-09-01' },
    { goal_id: 'g2', amount: 300, allocated_on: '2026-09-01' },
  ];
  assert.deepEqual(envelopeSummary(1000, goals, allocations), {
    balance: 1000,
    allocated: 800,
    unallocated: 200,
    over_allocated: 0,
  });
  // Money was spent from the account: the goals now hold more than it has.
  assert.deepEqual(envelopeSummary(650, goals, allocations), {
    balance: 650,
    allocated: 800,
    unallocated: -150,
    over_allocated: 150,
  });
});

// ── Dates and monthly needed ────────────────────────────────────────────────

test('whole months between dates and months left', () => {
  assert.equal(wholeMonthsBetween('2026-10-05', '2027-01-05'), 3);
  assert.equal(wholeMonthsBetween('2026-10-05', '2027-01-04'), 2);
  assert.equal(monthsLeft(TODAY, '2026-10-20'), 1, 'at least 1 while the date is ahead');
  assert.equal(monthsLeft(TODAY, TODAY), 0);
  assert.equal(monthsLeft(TODAY, '2026-01-01'), 0);
  assert.equal(addMonthsToDate('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonthsToDate('2026-10-05', -3), '2026-07-05');
});

test('monthly needed = (target - saved) / months left', () => {
  assert.deepEqual(monthlyNeeded(1200, 300, '2027-04-05', TODAY), { monthly: 150, months_left: 6, past_due: false });
  // Rounds up to the cent so the goal is reached on time.
  assert.deepEqual(monthlyNeeded(100, 0, '2027-01-05', TODAY), { monthly: 33.34, months_left: 3, past_due: false });
  assert.deepEqual(monthlyNeeded(1000, 0, null, TODAY), { monthly: null, months_left: null, past_due: false });
  assert.deepEqual(monthlyNeeded(1000, 400, '2026-09-01', TODAY), { monthly: 600, months_left: 0, past_due: true });
  assert.deepEqual(monthlyNeeded(1000, 1200, '2027-01-01', TODAY), { monthly: 0, months_left: 2, past_due: false });
});

// ── Surplus and fit ─────────────────────────────────────────────────────────

test('monthly surplus: income - spending, transfers excluded, complete months only', () => {
  const rows = [
    { type: 'income', amount: 3000, transaction_date: '2026-08-01' },
    { type: 'expense', amount: 2000, transaction_date: '2026-08-10' },
    { type: 'income', amount: 3000, transaction_date: '2026-09-01' },
    { type: 'expense', amount: 2600, transaction_date: '2026-09-10' },
    // Transfer to savings: never spending.
    { type: 'expense', amount: 500, transaction_date: '2026-09-11', transfer_group_id: 'grp' },
    { type: 'expense', amount: 500, transaction_date: '2026-09-12', source: 'transfer' },
    // This month hasn't finished.
    { type: 'expense', amount: 9999, transaction_date: '2026-10-02' },
  ];
  const s = monthlySurplus(rows, { window: 3, method: 'average', currentMonth: '2026-10', firstMonth: '2026-08' });
  assert.deepEqual(s.per_month.map((p) => p.month), ['2026-08', '2026-09'], 'months before the first transaction are left out');
  assert.equal(s.amount, 700);
  const m = monthlySurplus(rows, { window: 6, method: 'median', currentMonth: '2026-10', firstMonth: null });
  assert.equal(m.per_month.length, 6);
  assert.equal(m.amount, 0, 'four $0 months and two positive ones: median 0');
});

test('goals claim the surplus in priority order; "fits from" when they do not fit', () => {
  const goals = [
    { id: 'emergency', name: 'Emergency', priority: 1, status: 'active', target_date: '2027-04-05', remaining: 1800, monthly: 300 },
    { id: 'trip', name: 'Trip', priority: 2, status: 'active', target_date: '2027-01-05', remaining: 900, monthly: 300 },
    { id: 'paused', name: 'Paused', priority: 1, status: 'paused', target_date: '2027-01-05', remaining: 900, monthly: 300 },
    { id: 'nodate', name: 'Someday', priority: 1, status: 'active', target_date: null, remaining: 500, monthly: null },
  ];
  const fits = fitGoals(goals, 500, TODAY);
  assert.deepEqual(fits.get('emergency'), { fits: true, available: 500, fits_from: null });
  // 200 left after the emergency fund; 900 / 200 = 4.5 -> 5 months.
  assert.deepEqual(fits.get('trip'), { fits: false, available: 200, fits_from: '2027-03-05' });
  assert.equal(fits.get('paused')!.fits, null, 'a paused goal claims nothing');
  assert.equal(fits.get('nodate')!.fits, null, 'no target date, no monthly claim');

  const none = fitGoals(goals, -100, TODAY);
  assert.deepEqual(none.get('emergency'), { fits: false, available: 0, fits_from: null });
  assert.equal(fitGoals(goals, null, TODAY).get('emergency')!.fits, null);
});

// ── Pace, projection, status ────────────────────────────────────────────────

test('pace over the last 3 months, or the goal age when younger', () => {
  const allocations = [
    { amount: 300, allocated_on: '2026-08-10' },
    { amount: 300, allocated_on: '2026-09-10' },
    { amount: -150, allocated_on: '2026-09-20' },
    { amount: 999, allocated_on: '2026-05-01' }, // older than 3 months
  ];
  assert.equal(contributionPace(allocations, TODAY), 150);
  // A goal created 1 month ago with $200 in it: $200/month, not $66.67.
  assert.equal(contributionPace([{ amount: 200, allocated_on: '2026-09-20' }], TODAY, '2026-09-05'), 200);
  // About two months old (61 days): $300 over 2.004 months.
  assert.equal(contributionPace([{ amount: 300, allocated_on: '2026-09-20' }], TODAY, '2026-08-05'), 149.69);
  assert.equal(contributionPace([], TODAY, '2026-10-01'), 0);
});

test('projected date and on track / behind', () => {
  assert.equal(projectedDate(900, 300, TODAY), '2027-01-05');
  assert.equal(projectedDate(1000, 300, TODAY), '2027-02-05');
  assert.equal(projectedDate(0, 0, TODAY), TODAY);
  assert.equal(projectedDate(500, 0, TODAY), null);
  assert.equal(trackStatus({ status: 'active', remaining: 0, target_date: null, projected: TODAY }), 'reached');
  assert.equal(trackStatus({ status: 'active', remaining: 9, target_date: '2027-02-05', projected: '2027-02-05' }), 'on_track');
  assert.equal(trackStatus({ status: 'active', remaining: 9, target_date: '2027-01-05', projected: '2027-02-05' }), 'behind');
  assert.equal(trackStatus({ status: 'active', remaining: 9, target_date: '2027-01-05', projected: null }), 'behind');
  assert.equal(trackStatus({ status: 'active', remaining: 9, target_date: null, projected: null }), 'no_date');
  assert.equal(trackStatus({ status: 'paused', remaining: 9, target_date: '2027-01-05', projected: null }), 'paused');
});

test('milestones crossed at 25/50/75/100%', () => {
  assert.deepEqual(milestonesCrossed(200, 260, 1000), [25]);
  assert.deepEqual(milestonesCrossed(240, 1000, 1000), [25, 50, 75, 100]);
  assert.deepEqual(milestonesCrossed(250, 300, 1000), [], 'already at 25%');
  assert.deepEqual(milestonesCrossed(800, 700, 1000), [], 'taking money out crosses nothing');
  assert.equal(milestoneReached(749.99, 1000), 50);
  assert.equal(milestoneReached(1200, 1000), 100);
});

// ── Deposits ────────────────────────────────────────────────────────────────

test('deposits to allocate: income into the account, minus what was allocated from it', () => {
  const rows = [
    { id: 't1', account_id: SAVINGS, type: 'income', amount: 500, transaction_date: '2026-09-01', transfer_group_id: 'grp1' },
    { id: 't2', account_id: SAVINGS, type: 'income', amount: 300, transaction_date: '2026-10-01', description: 'Interest' },
    { id: 't3', account_id: SAVINGS, type: 'expense', amount: 50, transaction_date: '2026-10-02' },
    { id: 't4', account_id: CHECKING, type: 'income', amount: 4000, transaction_date: '2026-10-02' },
    { id: 't5', account_id: SAVINGS, type: 'income', amount: 100, transaction_date: '2026-10-03' },
  ];
  const allocations = [
    { goal_id: 'g1', amount: 200, allocated_on: '2026-09-02', transaction_id: 't1' },
    { goal_id: 'g2', amount: 100, allocated_on: '2026-10-03', transaction_id: 't5' },
  ];
  const deposits = depositsToAllocate(SAVINGS, rows, allocations);
  assert.deepEqual(deposits.map((d) => [d.id, d.remaining, d.is_transfer]), [
    ['t2', 300, false],
    ['t1', 300, true],
  ]);
});

// ── Allocation rules ────────────────────────────────────────────────────────

function ctx(overrides: Partial<AllocationContext> = {}): AllocationContext {
  const goals = new Map<string, EnvelopeGoal>([
    ['g1', { id: 'g1', name: 'Trip', funding_account_id: SAVINGS, saved: 400 }],
    ['g2', { id: 'g2', name: 'House', funding_account_id: SAVINGS, saved: 100 }],
    ['g3', { id: 'g3', name: 'Laptop', funding_account_id: CHECKING, saved: 50 }],
    ['g4', { id: 'g4', name: 'Orphan', funding_account_id: null, saved: 0 }],
  ]);
  return { goals, unallocated: new Map([[SAVINGS, 250], [CHECKING, 0]]), deposit: null, ...overrides };
}

const rejects = (fn: () => unknown, pattern: RegExp) =>
  assert.throws(fn, (err: unknown) => err instanceof SavingsRuleError && pattern.test(err.message));

test('allocate: never more than is unallocated', () => {
  assert.deepEqual(planAllocation({ action: 'allocate', goal_id: 'g1', amount: 250 }, ctx()), [
    { goal_id: 'g1', amount: 250, transaction_id: null },
  ]);
  rejects(() => planAllocation({ action: 'allocate', goal_id: 'g1', amount: 250.01 }, ctx()), /Only \$250\.00 is unallocated/);
  rejects(() => planAllocation({ action: 'allocate', goal_id: 'g3', amount: 1 }, ctx()), /Nothing is unallocated/);
  rejects(() => planAllocation({ action: 'allocate', goal_id: 'g4', amount: 1 }, ctx()), /Pick the account/);
  rejects(() => planAllocation({ action: 'allocate', goal_id: 'nope', amount: 1 }, ctx()), /not found/);
  rejects(() => planAllocation({ action: 'allocate', goal_id: 'g1', amount: 0 }, ctx()), /above \$0/);
  // Over-allocated account: negative unallocated.
  rejects(
    () => planAllocation({ action: 'allocate', goal_id: 'g1', amount: 1 }, ctx({ unallocated: new Map([[SAVINGS, -20]]) })),
    /Nothing is unallocated/,
  );
});

test('release and move: never more than the goal holds; move stays in one account', () => {
  assert.deepEqual(planAllocation({ action: 'release', goal_id: 'g2', amount: 100 }, ctx()), [
    { goal_id: 'g2', amount: -100, transaction_id: null },
  ]);
  rejects(() => planAllocation({ action: 'release', goal_id: 'g2', amount: 100.01 }, ctx()), /holds \$100\.00/);
  assert.deepEqual(planAllocation({ action: 'move', from_goal_id: 'g1', to_goal_id: 'g2', amount: 150 }, ctx()), [
    { goal_id: 'g1', amount: -150, transaction_id: null },
    { goal_id: 'g2', amount: 150, transaction_id: null },
  ]);
  rejects(() => planAllocation({ action: 'move', from_goal_id: 'g1', to_goal_id: 'g3', amount: 1 }, ctx()), /different accounts/);
  rejects(() => planAllocation({ action: 'move', from_goal_id: 'g1', to_goal_id: 'g1', amount: 1 }, ctx()), /two different/);
  rejects(() => planAllocation({ action: 'move', from_goal_id: 'g2', to_goal_id: 'g1', amount: 101 }, ctx()), /holds/);
});

test('split a deposit across goals', () => {
  const deposit = { id: 't1', account_id: SAVINGS, type: 'income', amount: 300, allocated: 100 };
  const c = ctx({ deposit });
  assert.deepEqual(
    planAllocation({ action: 'split', transaction_id: 't1', parts: [{ goal_id: 'g1', amount: 120 }, { goal_id: 'g2', amount: 80 }] }, c),
    [
      { goal_id: 'g1', amount: 120, transaction_id: 't1' },
      { goal_id: 'g2', amount: 80, transaction_id: 't1' },
    ],
  );
  rejects(
    () => planAllocation({ action: 'split', transaction_id: 't1', parts: [{ goal_id: 'g1', amount: 201 }] }, c),
    /Only \$200\.00 of that deposit/,
  );
  rejects(
    () => planAllocation({ action: 'split', transaction_id: 't1', parts: [{ goal_id: 'g1', amount: 10 }, { goal_id: 'g3', amount: 10 }] }, c),
    /same account/,
  );
  rejects(
    () => planAllocation({ action: 'split', transaction_id: 't1', parts: [{ goal_id: 'g1', amount: 10 }, { goal_id: 'g1', amount: 10 }] }, c),
    /only once/,
  );
  rejects(
    () => planAllocation({ action: 'split', transaction_id: 't1', parts: [{ goal_id: 'g1', amount: 10 }] }, ctx({ deposit: { ...deposit, account_id: CHECKING } })),
    /not a deposit into the account/,
  );
  rejects(
    () => planAllocation({ action: 'split', transaction_id: 't1', parts: [{ goal_id: 'g1', amount: 10 }] }, ctx({ deposit: { ...deposit, type: 'expense' } })),
    /not a deposit/,
  );
  // The deposit has room but the account doesn't (money already spent from it).
  rejects(
    () => planAllocation({ action: 'split', transaction_id: 't1', parts: [{ goal_id: 'g1', amount: 150 }] }, ctx({ deposit, unallocated: new Map([[SAVINGS, 100]]) })),
    /split is too large/,
  );
});

// ── Request parsing ─────────────────────────────────────────────────────────

test('goal input: create needs name, target and account; update is partial', () => {
  const ok = parseGoalInput({ name: ' Japan trip ', kind: 'trip', target_amount: '3000', funding_account_id: SAVINGS, target_date: '2027-06-30' }, false);
  assert.equal(ok.name, 'Japan trip');
  assert.equal(ok.target_amount, 3000);
  assert.throws(() => parseGoalInput({ name: 'x', target_amount: 10 }, false), /account/);
  assert.throws(() => parseGoalInput({ name: 'x', target_amount: 0, funding_account_id: SAVINGS }, false), /above zero/);
  assert.throws(() => parseGoalInput({ name: 'x', kind: 'yacht', target_amount: 1, funding_account_id: SAVINGS }, false), /what the goal is for/);
  assert.throws(() => parseGoalInput({ target_date: '2027-02-30' }, true), /target date/);
  assert.throws(() => parseGoalInput({ linked_trip_id: 'a', linked_equipment_id: 'b' }, true), /not both/);
  assert.throws(() => parseGoalInput({}, true), /Nothing to change/);
  assert.deepEqual(parseGoalInput({ status: 'paused' }, true), { status: 'paused' });
});

test('allocation request parsing drops empty split parts', () => {
  const req = parseAllocationRequest({ action: 'split', transaction_id: 't1', parts: [{ goal_id: 'g1', amount: '25' }, { goal_id: 'g2', amount: '' }] });
  assert.deepEqual(req, { action: 'split', transaction_id: 't1', parts: [{ goal_id: 'g1', amount: 25 }] });
  assert.throws(() => parseAllocationRequest({ action: 'steal' }), /Action must be/);
  assert.throws(() => parseAllocationRequest({ action: 'allocate', goal_id: 'g1', amount: -5 }), /above \$0/);
});

// ── Database helpers (in-memory fake) ───────────────────────────────────────

const asDb = (db: FakeDb) => db as unknown as SupabaseClient;

function seededDb(): FakeDb {
  const db = new FakeDb();
  db.seed('financial_accounts', [
    { id: SAVINGS, user_id: USER, name: 'High Yield', account_type: 'savings', institution_name: 'Ally', last_four: '4321', opening_balance: 1000, is_active: true },
    { id: CHECKING, user_id: USER, name: 'Checking', account_type: 'checking', institution_name: null, last_four: null, opening_balance: 0, is_active: true },
    { id: CARD, user_id: USER, name: 'Visa', account_type: 'credit_card', institution_name: null, last_four: '1111', opening_balance: 0, is_active: true },
    { id: 'acct-other', user_id: OTHER, name: 'Theirs', account_type: 'savings', institution_name: null, last_four: null, opening_balance: 50000, is_active: true },
  ]);
  db.seed('financial_transactions', [
    { id: 'tx-in', user_id: USER, account_id: SAVINGS, type: 'income', amount: 500, transaction_date: '2026-09-15', source: 'transfer', transfer_group_id: 'grp', description: 'From checking' },
    { id: 'tx-out', user_id: USER, account_id: CHECKING, type: 'expense', amount: 500, transaction_date: '2026-09-15', source: 'transfer', transfer_group_id: 'grp' },
    { id: 'tx-pay', user_id: USER, account_id: CHECKING, type: 'income', amount: 4000, transaction_date: '2026-09-01', source: 'manual', transfer_group_id: null },
    { id: 'tx-rent', user_id: USER, account_id: CHECKING, type: 'expense', amount: 3000, transaction_date: '2026-09-03', source: 'manual', transfer_group_id: null },
  ]);
  db.seed('savings_goals', [
    { id: 'g-trip', user_id: USER, name: 'Trip', kind: 'trip', target_amount: 1000, target_date: '2027-04-05', funding_account_id: SAVINGS, starting_amount: 200, priority: 1, status: 'active', milestone_tasks: true, created_at: '2026-06-01T00:00:00Z' },
    { id: 'g-house', user_id: USER, name: 'House', kind: 'house', target_amount: 20000, target_date: null, funding_account_id: SAVINGS, starting_amount: 0, priority: 2, status: 'active', milestone_tasks: false, created_at: '2026-06-01T00:00:00Z' },
  ]);
  db.seed('savings_allocations', [
    { id: 'a1', goal_id: 'g-trip', user_id: USER, amount: 100, allocated_on: '2026-09-15', transaction_id: 'tx-in' },
    { id: 'a2', goal_id: 'g-house', user_id: USER, amount: 300, allocated_on: '2026-09-15', transaction_id: null },
  ]);
  return db;
}

test('overview before migration 212 says not ready', async () => {
  const db = seededDb();
  db.missingTables = ['savings_goals', 'savings_allocations'];
  const { overview, error } = await loadSavingsOverview(asDb(db), USER, { today: TODAY, window: 6, method: 'average' });
  assert.equal(error, null);
  assert.equal(overview!.ready, false);
  assert.deepEqual(overview!.funding_options.map((o) => o.id), [SAVINGS, CHECKING], 'savings first, no cards');
  await assert.rejects(
    applyAllocation(asDb(db), USER, { action: 'allocate', goal_id: 'g-trip', amount: 1 }, TODAY),
    (err: unknown) => err instanceof SavingsRuleError && err.status === 503 && err.code === SAVINGS_NOT_READY.code,
  );
});

test('overview: balance, allocated, unallocated, goals and deposits per account', async () => {
  const db = seededDb();
  const { overview, error } = await loadSavingsOverview(asDb(db), USER, { today: TODAY, window: 6, method: 'average' });
  assert.equal(error, null);
  assert.equal(overview!.ready, true);
  assert.equal(overview!.accounts.length, 1);
  const acct = overview!.accounts[0];
  assert.equal(acct.label, 'Ally High Yield ••4321');
  assert.equal(acct.balance, 1500);
  assert.equal(acct.allocated, 600);
  assert.equal(acct.unallocated, 900);
  assert.equal(acct.over_allocated, 0);
  const trip = acct.goals.find((g) => g.id === 'g-trip')!;
  assert.equal(trip.saved, 300);
  assert.equal(trip.monthly_needed, 116.67);
  assert.equal(trip.milestone, 25);
  assert.deepEqual(acct.deposits.map((d) => [d.id, d.remaining]), [['tx-in', 400]]);
  // Surplus: September only has income/spending (4000 - 3000); the transfer is excluded; 6-month average from the first month.
  assert.equal(overview!.surplus!.amount, 1000);
  assert.equal(trip.fit.fits, true);
});

test('allocate writes a row, refuses more than unallocated, and reports milestones', async () => {
  const db = seededDb();
  await assert.rejects(
    applyAllocation(asDb(db), USER, { action: 'allocate', goal_id: 'g-trip', amount: 900.01 }, TODAY),
    /Only \$900\.00 is unallocated/,
  );
  const result = await applyAllocation(asDb(db), USER, { action: 'allocate', goal_id: 'g-trip', amount: 250, transaction_id: 'tx-in' }, TODAY);
  assert.equal(result.inserted, 1);
  assert.deepEqual(result.crossed.map((c) => [c.goal.id, c.levels, c.saved]), [['g-trip', [50], 550]]);
  const rows = db.rows('savings_allocations').filter((r) => r.goal_id === 'g-trip');
  assert.equal(rows.length, 2);
  assert.equal(rows[1].transaction_id, 'tx-in');
  assert.equal(rows[1].user_id, USER);
  // tx-in had 400 left; 250 used -> 150 left.
  await assert.rejects(
    applyAllocation(asDb(db), USER, { action: 'split', transaction_id: 'tx-in', parts: [{ goal_id: 'g-house', amount: 151 }] }, TODAY),
    /Only \$150\.00 of that deposit/,
  );
});

test('another user\'s goal is not found', async () => {
  const db = seededDb();
  await assert.rejects(
    applyAllocation(asDb(db), OTHER, { action: 'release', goal_id: 'g-trip', amount: 1 }, TODAY),
    /not found/,
  );
});

test('createGoal checks the account and the starting amount', async () => {
  const db = seededDb();
  await assert.rejects(
    createGoal(asDb(db), USER, { name: 'X', kind: 'other', target_amount: 10, funding_account_id: CARD }),
    /not a card or loan/,
  );
  await assert.rejects(
    createGoal(asDb(db), USER, { name: 'X', kind: 'other', target_amount: 10, funding_account_id: 'acct-other' }),
    /not found/,
  );
  await assert.rejects(
    createGoal(asDb(db), USER, { name: 'X', kind: 'other', target_amount: 5000, funding_account_id: SAVINGS, starting_amount: 901 }),
    /more than the \$900\.00 unallocated/,
  );
  const goal = await createGoal(asDb(db), USER, { name: 'Emergency', kind: 'emergency', target_amount: 5000, funding_account_id: SAVINGS, starting_amount: 900 });
  assert.equal(goal.name, 'Emergency');
  assert.equal(db.rows('savings_goals').length, 3);
});

test('archiving a goal releases what it holds', async () => {
  const db = seededDb();
  const { released } = await updateGoal(asDb(db), USER, 'g-trip', { status: 'archived' }, TODAY);
  assert.equal(released, 300);
  const last = db.rows('savings_allocations').at(-1)!;
  assert.equal(last.amount, -300);
  assert.equal(last.goal_id, 'g-trip');
});

test('milestone tasks: completed note under Inbox, once per level, only when turned on', async () => {
  const db = seededDb();
  const goal = db.rows('savings_goals').find((g) => g.id === 'g-trip')! as never;
  let resolved = 0;
  const resolve = async () => {
    resolved += 1;
    return 'inbox-milestone';
  };
  const crossed = { goal, levels: [25, 50] as (25 | 50)[], saved: 500 };
  assert.equal(await noteMilestones(asDb(db), crossed, resolve, TODAY, '2026-10-05T12:00:00Z'), 2);
  assert.equal(await noteMilestones(asDb(db), crossed, resolve, TODAY, '2026-10-05T12:00:00Z'), 0, 'idempotent');
  const tasks = db.rows('tasks');
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].completed, true);
  assert.equal(tasks[0].milestone_id, 'inbox-milestone');
  assert.equal(tasks[0].source_type, 'savings_milestone_25');
  assert.equal(tasks[0].source_id, 'g-trip');
  assert.equal(resolved, 1);

  const house = db.rows('savings_goals').find((g) => g.id === 'g-house')! as never;
  assert.equal(await noteMilestones(asDb(db), { goal: house, levels: [25], saved: 5000 }, resolve, TODAY, ''), 0, 'toggle off');
});
