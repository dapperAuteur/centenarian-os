// tests/unit/reconciliation.test.ts
// Unit tests for the one balance rule (lib/finance/balance) with a dated
// starting balance, and for reconciling accounts to statements
// (lib/finance/reconciliation): the period, the comparison, card and loan sign
// conventions, the adjustment, changing the starting balance, the
// reconciled-period guard, the monthly audit, unreconcile, before migration
// 221, and ownership.
// Run: npm run test:unit
//
// Every account, amount, description and id here is SYNTHETIC. Nothing touches a database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  accountBalance as balanceRule,
  amountOwed,
  countsInBalance,
  signedFromStatementCents,
  startingBalanceDate,
  statementBalance,
} from '../../lib/finance/balance/logic.ts';
import { loadBalanceRows, signedBalancesCents } from '../../lib/finance/balance/server.ts';
import { accountBalance as savingsAccountBalance } from '../../lib/finance/savings/logic.ts';
import { owedFromTransactions } from '../../lib/finance/debt/overview.ts';
import { loadCashOverview } from '../../lib/finance/cash/server.ts';
import {
  RECONCILE_ADJUSTMENT_DESCRIPTION,
  RECONCILE_ADJUSTMENT_TAG,
  ReconcileRuleError,
  auditState,
  auditsAccount,
  compareWithStatement,
  coveringReconciliation,
  dayBefore,
  decideOutcome,
  effectCents,
  openingAfterChange,
  parseReconcileInput,
  pickStatement,
  planReconcileAdjustment,
  reconcilePeriod,
  reconciledThrough,
  startingFromStatement,
} from '../../lib/finance/reconciliation/logic.ts';
import {
  annotateReconciled,
  finishReconciliation,
  loadReconcileAudit,
  loadReconcileStatus,
  loadReconcileView,
  reconciledPeriods,
  unreconcile,
} from '../../lib/finance/reconciliation/server.ts';
import { FakeDb } from './fake-supabase.ts';
import type { Row } from './fake-supabase.ts';

const asDb = (fake: FakeDb) => fake as unknown as SupabaseClient;
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '99999999-9999-4999-8999-999999999999';
const CHECKING = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CARD = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const LOAN = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const WALLET = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PESOS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const THEIRS = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const TODAY = '2026-10-07';
const NOW = '2026-10-07T15:00:00.000Z';
const now = () => NOW;

// ── The balance rule ──────────────────────────────────────────────────────

const rows = [
  { type: 'income', amount: 1000, transaction_date: '2026-08-20' },
  { type: 'expense', amount: '200.25', transaction_date: '2026-08-31' },
  { type: 'income', amount: 50, transaction_date: '2026-09-01' },
  { type: 'expense', amount: 10.1, transaction_date: '2026-09-15' },
];

test('balance without a starting-balance date counts every transaction (the old rule)', () => {
  const savings = { account_type: 'savings', opening_balance: 500 };
  assert.equal(balanceRule(savings, rows), 500 + 1000 - 200.25 + 50 - 10.1);
  assert.equal(balanceRule({ ...savings, opening_balance_date: null }, rows), 1339.65);
  // The savings module re-exports the same rule.
  assert.equal(savingsAccountBalance(savings, rows), 1339.65);
});

test('balance with a starting-balance date counts only transactions dated after it', () => {
  const savings = { account_type: 'savings', opening_balance: 2000, opening_balance_date: '2026-08-31' };
  // 08-20 and 08-31 are inside the opening balance; 09-01 and 09-15 count.
  assert.equal(balanceRule(savings, rows), 2000 + 50 - 10.1);
  assert.equal(countsInBalance(savings, '2026-08-31'), false, 'a transaction ON the date is inside the opening balance');
  assert.equal(countsInBalance(savings, '2026-09-01'), true);
  assert.equal(countsInBalance(savings, null), true, 'a row without a date always counts');
  // A timestamp-looking date is read by its day.
  assert.equal(startingBalanceDate({ opening_balance_date: '2026-08-31T00:00:00Z' }), '2026-08-31');
  assert.equal(startingBalanceDate({ opening_balance_date: 'not a date' }), null);
});

test('balance through a date stops at that day (inclusive)', () => {
  const checking = { account_type: 'checking', opening_balance: 100 };
  assert.equal(statementBalance(checking, rows, { through: '2026-08-31' }), 100 + 1000 - 200.25);
  assert.equal(statementBalance(checking, rows, { through: '2026-08-30' }), 1100);
  const dated = { ...checking, opening_balance_date: '2026-08-25' };
  assert.equal(statementBalance(dated, rows, { through: '2026-09-01' }), 100 - 200.25 + 50);
});

test('cards and loans: statement terms are money owed, the signed balance is negative', () => {
  const card = { account_type: 'credit_card', opening_balance: 300, opening_balance_date: '2026-08-31' };
  const charges = [
    { type: 'expense', amount: 120, transaction_date: '2026-09-05' }, // a charge raises what is owed
    { type: 'income', amount: 200, transaction_date: '2026-09-20' }, // a payment lowers it
    { type: 'expense', amount: 999, transaction_date: '2026-08-30' }, // before the starting date
  ];
  assert.equal(amountOwed(card, charges), 220);
  assert.equal(statementBalance(card, charges), 220);
  assert.equal(balanceRule(card, charges), -220);
  const loan = { account_type: 'loan', opening_balance: 5000 };
  assert.equal(balanceRule(loan, [{ type: 'income', amount: 250, transaction_date: '2026-09-01' }]), -4750);
  assert.equal(signedFromStatementCents('loan', 475000), -475000);
  assert.equal(signedFromStatementCents('checking', 475000), 475000);
  // A credit balance (overpaid card) is negative owed and a positive signed balance.
  assert.equal(amountOwed({ account_type: 'credit_card', opening_balance: 0 }, [{ type: 'income', amount: 25 }]), -25);
  assert.equal(balanceRule({ account_type: 'credit_card', opening_balance: 0 }, [{ type: 'income', amount: 25 }]), 25);
});

test('the debts overview uses the same rule, starting-balance date included', () => {
  const card = { id: 'card1', name: 'Card', account_type: 'credit_card', opening_balance: 1000, opening_balance_date: '2026-09-01' };
  const txns = [
    { id: 't1', account_id: 'card1', amount: 200, type: 'expense', transaction_date: '2026-09-10' },
    { id: 't2', account_id: 'card1', amount: 50, type: 'income', transaction_date: '2026-09-15' },
    { id: 't3', account_id: 'card1', amount: 75, type: 'expense', transaction_date: '2026-09-01' }, // on the date: excluded
    { id: 't4', account_id: 'other', amount: 999, type: 'expense', transaction_date: '2026-09-15' },
  ];
  assert.equal(owedFromTransactions(card, txns), 1150);
  assert.equal(owedFromTransactions({ ...card, opening_balance_date: null }, txns), 1225);
});

test('own currency: a foreign account balance uses the amount in its currency, never the home amount', () => {
  const pesos = { account_type: 'cash', opening_balance: 1000, opening_balance_date: null };
  const mxn = [
    { type: 'expense', amount: 250, amount_home: 13.9, currency: 'MXN', transaction_date: '2026-09-02' },
    { type: 'income', amount: 500, amount_home: 27.8, currency: 'MXN', transaction_date: '2026-09-03' },
  ];
  assert.equal(balanceRule(pesos, mxn), 1250);
});

test('loadBalanceRows reads every page and only the caller\'s rows; signedBalancesCents per account', async () => {
  const db = new FakeDb();
  db.maxRows = 1000;
  const many = Array.from({ length: 2300 }, () => ({
    user_id: USER,
    account_id: CHECKING,
    type: 'expense',
    amount: 1,
    transaction_date: '2026-09-01',
  }));
  db.seed('financial_transactions', [
    ...many,
    { user_id: OTHER, account_id: CHECKING, type: 'income', amount: 5000, transaction_date: '2026-09-01' },
  ]);
  const { rows: loaded, error } = await loadBalanceRows(asDb(db), USER, [CHECKING]);
  assert.equal(error, null);
  assert.equal(loaded.length, 2300, 'past the 1000-row cap');
  const balances = signedBalancesCents([{ id: CHECKING, account_type: 'checking', opening_balance: 3000 }], loaded);
  assert.equal(balances.get(CHECKING), 70000);
});

test('cash on hand balances honor the starting-balance date', async () => {
  const db = new FakeDb();
  db.seed('financial_accounts', [
    { id: WALLET, user_id: USER, name: 'Wallet', account_type: 'cash', opening_balance: 60, opening_balance_date: '2026-09-30', is_active: true, currency: 'USD' },
  ]);
  db.seed('financial_transactions', [
    { user_id: USER, account_id: WALLET, type: 'expense', amount: 500, transaction_date: '2026-09-15' },
    { user_id: USER, account_id: WALLET, type: 'expense', amount: 12.5, transaction_date: '2026-10-01' },
  ]);
  db.seed('cash_counts', []);
  const overview = (await loadCashOverview(asDb(db), USER, TODAY)).overview!;
  assert.equal(overview.accounts[0].balance, 47.5);
});

// ── Reconciliation rules ──────────────────────────────────────────────────

const rec = (statement_date: string, status: 'reconciled' | 'open' = 'reconciled', id = `rec-${statement_date}`) => ({
  id,
  statement_date,
  status,
});

test('the period starts after the previous reconciled statement or the starting date, whichever is later', () => {
  const plain = { opening_balance_date: null };
  assert.deepEqual(reconcilePeriod(plain, [], '2026-09-30'), { after: null, through: '2026-09-30' });
  assert.deepEqual(reconcilePeriod(plain, [rec('2026-08-31'), rec('2026-07-31')], '2026-09-30'), { after: '2026-08-31', through: '2026-09-30' });
  // An open one doesn't end a period; a later one doesn't either.
  assert.deepEqual(reconcilePeriod(plain, [rec('2026-08-31', 'open'), rec('2026-10-31')], '2026-09-30'), { after: null, through: '2026-09-30' });
  assert.deepEqual(reconcilePeriod({ opening_balance_date: '2026-09-10' }, [rec('2026-08-31')], '2026-09-30'), { after: '2026-09-10', through: '2026-09-30' });
  assert.equal(reconciledThrough([rec('2026-08-31'), rec('2026-09-30', 'open'), rec('2026-07-31')]), '2026-08-31');
  assert.equal(reconciledThrough([rec('2026-09-30', 'open')]), null);
});

test('effect in statement terms: income raises a bank balance, a charge raises what is owed', () => {
  assert.equal(effectCents('checking', { type: 'income', amount: 10 }), 1000);
  assert.equal(effectCents('savings', { type: 'expense', amount: 10 }), -1000);
  assert.equal(effectCents('credit_card', { type: 'expense', amount: 10 }), 1000);
  assert.equal(effectCents('loan', { type: 'income', amount: 10 }), -1000);
});

test('compareWithStatement: checking account, computed on the date, difference, period rows and Cleared', () => {
  const account = { account_type: 'checking', opening_balance: 500, opening_balance_date: '2026-08-31' };
  const tx = [
    { id: 'a', type: 'income', amount: 1000, transaction_date: '2026-09-03', cleared_at: NOW },
    { id: 'b', type: 'expense', amount: 200.25, transaction_date: '2026-09-10', cleared_at: null },
    { id: 'c', type: 'expense', amount: 40, transaction_date: '2026-10-02', cleared_at: null }, // after the statement
    { id: 'd', type: 'expense', amount: 99, transaction_date: '2026-08-31', cleared_at: null }, // inside the opening balance
  ];
  const c = compareWithStatement(account, tx, [], '2026-09-30', 1290.75);
  assert.equal(c.computed_balance, 1299.75);
  assert.equal(c.statement_balance, 1290.75);
  assert.equal(c.difference, -9);
  assert.deepEqual(c.period, { after: '2026-08-31', through: '2026-09-30' });
  assert.deepEqual(c.transactions.map((t) => [t.id, t.effect, t.cleared]), [['a', 1000, true], ['b', -200.25, false]]);
  assert.equal(c.cleared_count, 1);
  assert.equal(c.uncleared_effect, -200.25);
  // The page's ticks override the saved ones.
  const ticked = compareWithStatement(account, tx, [], '2026-09-30', 1290.75, new Set(['b']));
  assert.deepEqual(ticked.transactions.map((t) => t.cleared), [false, true]);
  // No statement balance yet: no difference.
  assert.equal(compareWithStatement(account, tx, [], '2026-09-30', null).difference, null);
});

test('compareWithStatement: a credit card compares amounts owed, as the statement prints them', () => {
  const card = { account_type: 'credit_card', opening_balance: 1000, opening_balance_date: '2026-08-31' };
  const tx = [
    { id: 'x', type: 'expense', amount: 200, transaction_date: '2026-09-05' },
    { id: 'y', type: 'income', amount: 300, transaction_date: '2026-09-20' },
  ];
  const c = compareWithStatement(card, tx, [], '2026-09-30', 925);
  assert.equal(c.computed_balance, 900, 'owed: 1000 + 200 - 300');
  assert.equal(c.difference, 25, 'the statement says 25 more is owed');
});

test('the adjustment closes the gap with the right type for each kind of account', () => {
  assert.deepEqual(planReconcileAdjustment('checking', 1025), { type: 'income', amountCents: 1025, description: RECONCILE_ADJUSTMENT_DESCRIPTION });
  assert.deepEqual(planReconcileAdjustment('savings', -900), { type: 'expense', amountCents: 900, description: RECONCILE_ADJUSTMENT_DESCRIPTION });
  assert.equal(planReconcileAdjustment('cash', 0), null);
  // Card / loan: more owed on the statement is a charge (expense); less owed is a credit (income).
  assert.equal(planReconcileAdjustment('credit_card', 2500)?.type, 'expense');
  assert.equal(planReconcileAdjustment('credit_card', -2000)?.type, 'income');
  assert.equal(planReconcileAdjustment('loan', 100)?.type, 'expense');
  assert.equal(planReconcileAdjustment('loan', -100)?.type, 'income');

  // Applying the adjustment makes the computed balance equal the statement, for every kind.
  for (const [type, opening, statement] of [
    ['checking', 500, 512.34],
    ['checking', 500, 487.66],
    ['credit_card', 900, 925],
    ['credit_card', 900, 880],
    ['loan', 5000, 4990],
  ] as const) {
    const account = { account_type: type, opening_balance: opening };
    const before = statementBalance(account, []);
    const diff = Math.round((statement - before) * 100);
    const adj = planReconcileAdjustment(type, diff)!;
    const after = statementBalance(account, [{ type: adj.type, amount: adj.amountCents / 100, transaction_date: '2026-09-30' }]);
    assert.equal(after, statement, `${type} ${opening} -> ${statement}`);
  }
});

test('changing the starting balance moves it by the difference, in statement terms for every kind', () => {
  assert.equal(openingAfterChange(500, -900), 49100);
  assert.equal(openingAfterChange('1000.00', 2500), 102500);
  const card = { account_type: 'credit_card', opening_balance: 1000 };
  const tx = [{ type: 'expense', amount: 200, transaction_date: '2026-09-05' }];
  const before = statementBalance(card, tx);
  const moved = { ...card, opening_balance: openingAfterChange(card.opening_balance, Math.round((1180 - before) * 100)) / 100 };
  assert.equal(statementBalance(moved, tx), 1180);
});

test('decideOutcome: matched, adjustment, starting balance (refused after an earlier reconciliation), left open', () => {
  assert.deepEqual(decideOutcome(0, null, { earlierReconciled: true }), { status: 'reconciled', resolution: 'matched' });
  assert.deepEqual(decideOutcome(0, 'left_open', { earlierReconciled: false }), { status: 'reconciled', resolution: 'matched' });
  assert.deepEqual(decideOutcome(-900, 'adjustment', { earlierReconciled: true }), { status: 'reconciled', resolution: 'adjustment' });
  assert.deepEqual(decideOutcome(-900, 'starting_balance', { earlierReconciled: false }), { status: 'reconciled', resolution: 'starting_balance' });
  assert.deepEqual(decideOutcome(-900, 'left_open', { earlierReconciled: false }), { status: 'open', resolution: 'left_open' });
  assert.throws(() => decideOutcome(-900, null, { earlierReconciled: false }), (err: unknown) => err instanceof ReconcileRuleError && err.code === 'choice_required' && /9\.00/.test(err.message));
  assert.throws(() => decideOutcome(-900, 'starting_balance', { earlierReconciled: true }), (err: unknown) => err instanceof ReconcileRuleError && err.status === 409);
});

test('guard: the reconciled statement whose period holds a transaction', () => {
  const recs = [rec('2026-08-31'), rec('2026-09-30'), rec('2026-10-31', 'open')];
  const plain = { opening_balance_date: null };
  assert.equal(coveringReconciliation(plain, '2026-09-12', recs)?.statement_date, '2026-09-30');
  assert.equal(coveringReconciliation(plain, '2026-08-31', recs)?.statement_date, '2026-08-31', 'the closing day is inside');
  assert.equal(coveringReconciliation(plain, '2026-07-01', recs)?.statement_date, '2026-08-31');
  assert.equal(coveringReconciliation(plain, '2026-10-05', recs), null, 'only an open statement covers it');
  assert.equal(coveringReconciliation({ opening_balance_date: '2026-08-15' }, '2026-08-10', recs), null, 'inside the opening balance: no balance depends on it');
  assert.equal(coveringReconciliation(plain, null, recs), null);
});

test('monthly audit state: never, fresh within 30 days, stale after; cash and inactive accounts are left out', () => {
  assert.deepEqual(auditState(null, TODAY), { state: 'never', days: null });
  assert.deepEqual(auditState('2026-09-30', TODAY), { state: 'fresh', days: 7 });
  assert.deepEqual(auditState('2026-09-07', TODAY), { state: 'fresh', days: 30 });
  assert.deepEqual(auditState('2026-09-06', TODAY), { state: 'stale', days: 31 });
  assert.equal(auditsAccount({ account_type: 'checking', is_active: true }), true);
  assert.equal(auditsAccount({ account_type: 'cash', is_active: true }), false);
  assert.equal(auditsAccount({ account_type: 'credit_card', is_active: false }), false);
});

test('statements: the one to reconcile to, and a starting balance from the earliest', () => {
  const statements = [
    { id: 's1', period_start: '2026-07-01', period_end: '2026-07-31', previous_balance: 410.5, new_balance: 380 },
    { id: 's3', period_start: '2026-09-01', period_end: '2026-09-30', previous_balance: 455, new_balance: 925 },
    { id: 's2', period_start: '2026-08-01', period_end: '2026-08-31', previous_balance: 380, new_balance: 455 },
    { id: 's4', period_start: null, period_end: '2026-10-31', previous_balance: null, new_balance: null },
  ];
  assert.equal(pickStatement(statements)?.id, 's3', 'the latest with a new balance');
  assert.equal(pickStatement(statements, '2026-08-31')?.id, 's2');
  assert.equal(pickStatement(statements, '2026-12-31')?.id, 's3');
  assert.equal(pickStatement([]), null);
  assert.deepEqual(startingFromStatement(statements), {
    opening_balance: 410.5,
    opening_balance_date: '2026-06-30',
    statement_id: 's1',
    period_start: '2026-07-01',
  });
  assert.equal(dayBefore('2026-03-01'), '2026-02-28');
  assert.equal(dayBefore('2028-03-01'), '2028-02-29');
});

test('parseReconcileInput reads the request and refuses what it can\'t use', () => {
  const ok = parseReconcileInput(
    { account_id: CHECKING, statement_date: '2026-09-30', statement_balance: '$1,290.75', cleared_ids: ['a', 'a', 5, 'b'], difference_choice: 'adjustment', note: '  sept  ' },
    TODAY,
  );
  assert.deepEqual(ok, { accountId: CHECKING, statementDate: '2026-09-30', statementCents: 129075, clearedIds: ['a', 'b'], choice: 'adjustment', note: 'sept', statementId: null });
  assert.equal(parseReconcileInput({ account_id: CARD, statement_date: '2026-09-30', statement_balance: -25 }, TODAY).statementCents, -2500, 'a credit balance');
  const bad = (body: unknown) => assert.throws(() => parseReconcileInput(body, TODAY), ReconcileRuleError);
  bad(null);
  bad({ statement_date: '2026-09-30', statement_balance: 1 });
  bad({ account_id: CHECKING, statement_date: '2026-02-30', statement_balance: 1 });
  bad({ account_id: CHECKING, statement_date: '2026-10-08', statement_balance: 1 });
  bad({ account_id: CHECKING, statement_date: '2026-09-30', statement_balance: 'abc' });
  bad({ account_id: CHECKING, statement_date: '2026-09-30', statement_balance: 1, difference_choice: 'ignore' });
  bad({ account_id: CHECKING, statement_date: '2026-09-30', statement_balance: 1, cleared_ids: 'a' });
});

// ── Against the fake database ─────────────────────────────────────────────

function seeded(): FakeDb {
  const db = new FakeDb();
  db.now = Date.parse(NOW);
  db.seed('financial_accounts', [
    { id: CHECKING, user_id: USER, name: 'Checking', account_type: 'checking', institution_name: 'Desert CU', last_four: '2222', opening_balance: 500, opening_balance_date: '2026-08-31', is_active: true, currency: 'USD', created_at: '2026-01-01T00:00:00Z' },
    { id: CARD, user_id: USER, name: 'Visa', account_type: 'credit_card', institution_name: 'Bank', last_four: '1111', opening_balance: 1000, opening_balance_date: '2026-08-31', is_active: true, currency: 'USD', created_at: '2026-01-02T00:00:00Z' },
    { id: LOAN, user_id: USER, name: 'Car loan', account_type: 'loan', institution_name: null, last_four: null, opening_balance: 5000, opening_balance_date: null, is_active: true, currency: 'USD', created_at: '2026-01-03T00:00:00Z' },
    { id: WALLET, user_id: USER, name: 'Wallet', account_type: 'cash', institution_name: null, last_four: null, opening_balance: 20, opening_balance_date: null, is_active: true, currency: 'USD', created_at: '2026-01-04T00:00:00Z' },
    { id: PESOS, user_id: USER, name: 'Pesos', account_type: 'savings', institution_name: null, last_four: null, opening_balance: 1000, opening_balance_date: null, is_active: true, currency: 'MXN', created_at: '2026-01-05T00:00:00Z' },
    { id: THEIRS, user_id: OTHER, name: 'Theirs', account_type: 'checking', institution_name: null, last_four: null, opening_balance: 9999, opening_balance_date: null, is_active: true, currency: 'USD', created_at: '2026-01-06T00:00:00Z' },
  ]);
  db.seed('financial_transactions', [
    { id: '00000000-0000-4000-8000-0000000000a1', user_id: USER, account_id: CHECKING, type: 'income', amount: 1000, transaction_date: '2026-09-03', description: 'Paycheck', tags: [], cleared_at: null },
    { id: '00000000-0000-4000-8000-0000000000a2', user_id: USER, account_id: CHECKING, type: 'expense', amount: 200.25, transaction_date: '2026-09-10', description: 'Groceries', tags: [], cleared_at: null },
    { id: '00000000-0000-4000-8000-0000000000a3', user_id: USER, account_id: CHECKING, type: 'expense', amount: 40, transaction_date: '2026-10-02', description: 'Fuel', tags: [], cleared_at: null },
    { id: '00000000-0000-4000-8000-0000000000a4', user_id: USER, account_id: CHECKING, type: 'expense', amount: 99, transaction_date: '2026-08-30', description: 'Before the start', tags: [], cleared_at: null },
    { id: '00000000-0000-4000-8000-0000000000b1', user_id: USER, account_id: CARD, type: 'expense', amount: 200, transaction_date: '2026-09-05', description: 'Charge', tags: [], cleared_at: null },
    { id: '00000000-0000-4000-8000-0000000000b2', user_id: USER, account_id: CARD, type: 'income', amount: 300, transaction_date: '2026-09-20', description: 'Payment', tags: [], cleared_at: null },
    { id: '00000000-0000-4000-8000-0000000000c1', user_id: USER, account_id: PESOS, type: 'expense', amount: 250, amount_home: 13.9, currency: 'MXN', transaction_date: '2026-09-02', description: 'Mercado', tags: [], cleared_at: null },
    { id: '00000000-0000-4000-8000-0000000000f1', user_id: OTHER, account_id: THEIRS, type: 'expense', amount: 5, transaction_date: '2026-09-05', description: 'Not mine', tags: [], cleared_at: null },
  ]);
  db.seed('account_statements', [
    { id: '00000000-0000-4000-8000-0000000000d1', user_id: USER, account_id: CARD, period_start: '2026-09-01', period_end: '2026-09-30', previous_balance: 1000, new_balance: 925 },
    { id: '00000000-0000-4000-8000-0000000000d2', user_id: USER, account_id: CARD, period_start: '2026-08-01', period_end: '2026-08-31', previous_balance: 1100, new_balance: 1000 },
    { id: '00000000-0000-4000-8000-0000000000d9', user_id: OTHER, account_id: THEIRS, period_start: '2026-09-01', period_end: '2026-09-30', previous_balance: 1, new_balance: 2 },
  ]);
  db.seed('account_reconciliations', []);
  return db;
}

const tx = (db: FakeDb, id: string) => db.rows('financial_transactions').find((r) => r.id === id) as Row;
const A1 = '00000000-0000-4000-8000-0000000000a1';
const A2 = '00000000-0000-4000-8000-0000000000a2';
const A3 = '00000000-0000-4000-8000-0000000000a3';
const B1 = '00000000-0000-4000-8000-0000000000b1';
const B2 = '00000000-0000-4000-8000-0000000000b2';
const F1 = '00000000-0000-4000-8000-0000000000f1';

test('finish: a match is reconciled, ticks are saved, and nothing else is written', async () => {
  const db = seeded();
  const result = await finishReconciliation(asDb(db), USER, {
    account_id: CHECKING, statement_date: '2026-09-30', statement_balance: 1299.75, cleared_ids: [A1, A2],
  }, TODAY, undefined, now);
  assert.equal(result.reconciliation.status, 'reconciled');
  assert.equal(result.reconciliation.resolution, 'matched');
  assert.equal(result.reconciliation.computed_balance, 1299.75);
  assert.equal(result.reconciliation.difference, 0);
  assert.equal(result.reconciliation.cleared_count, 2);
  assert.equal(result.reconciliation.reconciled_at, NOW);
  assert.equal(result.adjustment, null);
  assert.deepEqual(result.cleared, { marked: 2, unmarked: 0 });
  assert.equal(tx(db, A1).cleared_at, NOW);
  assert.equal(tx(db, A3).cleared_at, null, 'after the statement date: untouched');
  assert.equal(db.rows('financial_transactions').length, 8);
});

test('finish: a card with more owed on the statement gets a labelled expense adjustment, so the books match', async () => {
  const db = seeded();
  const result = await finishReconciliation(asDb(db), USER, {
    account_id: CARD, statement_date: '2026-09-30', statement_balance: 925, difference_choice: 'adjustment',
    statement_id: '00000000-0000-4000-8000-0000000000d1', cleared_ids: [B1, B2],
  }, TODAY, undefined, now);
  assert.equal(result.reconciliation.computed_balance, 900);
  assert.equal(result.reconciliation.difference, 25);
  assert.equal(result.reconciliation.status, 'reconciled');
  assert.equal(result.reconciliation.resolution, 'adjustment');
  assert.equal(result.reconciliation.statement_id, '00000000-0000-4000-8000-0000000000d1');
  assert.deepEqual(result.adjustment && { type: result.adjustment.type, amount: result.adjustment.amount }, { type: 'expense', amount: 25 });
  const adj = tx(db, result.adjustment!.id);
  assert.equal(adj.account_id, CARD);
  assert.equal(adj.transaction_date, '2026-09-30');
  assert.equal(adj.description, RECONCILE_ADJUSTMENT_DESCRIPTION);
  assert.deepEqual(adj.tags, [RECONCILE_ADJUSTMENT_TAG]);
  assert.equal(adj.source, 'manual');
  assert.equal(adj.cleared_at, NOW);
  assert.equal(result.reconciliation.adjustment_transaction_id, adj.id);

  // Reconciling the same date again finds no difference and updates the same row.
  const again = await finishReconciliation(asDb(db), USER, {
    account_id: CARD, statement_date: '2026-09-30', statement_balance: 925, cleared_ids: [B1, B2, adj.id],
  }, TODAY, undefined, now);
  assert.equal(again.reconciliation.id, result.reconciliation.id);
  assert.equal(again.reconciliation.resolution, 'matched');
  assert.equal(again.reconciliation.adjustment_transaction_id, adj.id, 'keeps pointing at the earlier adjustment');
  assert.equal(db.rows('account_reconciliations').length, 1);
});

test('finish: a card with less owed gets an income (credit) adjustment; a foreign account gets FX fields', async () => {
  const db = seeded();
  const credit = await finishReconciliation(asDb(db), USER, {
    account_id: CARD, statement_date: '2026-09-30', statement_balance: 880, difference_choice: 'adjustment',
  }, TODAY, undefined, now);
  assert.equal(credit.adjustment?.type, 'income');
  assert.equal(credit.adjustment?.amount, 20);

  const calls: unknown[][] = [];
  const fx = async (currency: string, amount: number, date: string) => {
    calls.push([currency, amount, date]);
    return { currency: 'MXN', fx_rate: 0.0556, amount_home: 0.56 };
  };
  // Pesos savings: 1000 - 250 = 750 MXN (the home amount is never used). Statement says 760.
  const mxn = await finishReconciliation(asDb(db), USER, {
    account_id: PESOS, statement_date: '2026-09-30', statement_balance: 760, difference_choice: 'adjustment',
  }, TODAY, fx, now);
  assert.equal(mxn.reconciliation.computed_balance, 750);
  assert.equal(mxn.reconciliation.currency, 'MXN');
  assert.deepEqual(calls, [['MXN', 10, '2026-09-30']]);
  const adj = tx(db, mxn.adjustment!.id);
  assert.equal(adj.type, 'income');
  assert.equal(adj.amount_home, 0.56);
});

test('finish: changing the starting balance moves the opening balance by the difference', async () => {
  const db = seeded();
  // Checking computes 1299.75 on 09-30; the statement says 1290.75.
  const result = await finishReconciliation(asDb(db), USER, {
    account_id: CHECKING, statement_date: '2026-09-30', statement_balance: 1290.75, difference_choice: 'starting_balance',
  }, TODAY, undefined, now);
  assert.deepEqual(result.starting_balance, { before: 500, after: 491 });
  assert.equal((db.rows('financial_accounts').find((a) => a.id === CHECKING) as Row).opening_balance, 491);
  assert.equal(result.reconciliation.resolution, 'starting_balance');
  assert.equal(result.adjustment, null);

  // A later statement can't move the starting balance any more: the September one would break.
  db.seed('financial_transactions', [{ user_id: USER, account_id: CHECKING, type: 'expense', amount: 5, transaction_date: '2026-10-03', tags: [], cleared_at: null }]);
  await assert.rejects(
    finishReconciliation(asDb(db), USER, { account_id: CHECKING, statement_date: '2026-10-05', statement_balance: 1, difference_choice: 'starting_balance' }, TODAY, undefined, now),
    (err: unknown) => err instanceof ReconcileRuleError && err.code === 'earlier_reconciled',
  );
});

test('finish: left open keeps the difference and changes no balance; a missing choice is refused before any write', async () => {
  const db = seeded();
  await assert.rejects(
    finishReconciliation(asDb(db), USER, { account_id: CHECKING, statement_date: '2026-09-30', statement_balance: 1300 }, TODAY, undefined, now),
    (err: unknown) => err instanceof ReconcileRuleError && err.code === 'choice_required',
  );
  assert.equal(db.writes().length, 0);
  const open = await finishReconciliation(asDb(db), USER, {
    account_id: CHECKING, statement_date: '2026-09-30', statement_balance: 1300, difference_choice: 'left_open', note: 'bank fee?',
  }, TODAY, undefined, now);
  assert.equal(open.reconciliation.status, 'open');
  assert.equal(open.reconciliation.difference, 0.25);
  assert.equal(open.reconciliation.reconciled_at, null);
  assert.equal(open.reconciliation.note, 'bank fee?');
  assert.equal(db.rows('financial_transactions').length, 8);
});

test('finish: a date before the starting balance is refused', async () => {
  const db = seeded();
  await assert.rejects(
    finishReconciliation(asDb(db), USER, { account_id: CHECKING, statement_date: '2026-08-15', statement_balance: 500 }, TODAY, undefined, now),
    (err: unknown) => err instanceof ReconcileRuleError && /starting balance date \(2026-08-31\)/.test(err.message),
  );
});

test('finish: when saving the reconciliation fails, the adjustment is deleted again', async () => {
  const db = seeded();
  db.rejectInsert = (table) => (table === 'account_reconciliations' ? { code: '23514', message: 'check violation' } : null);
  await assert.rejects(
    finishReconciliation(asDb(db), USER, { account_id: CARD, statement_date: '2026-09-30', statement_balance: 925, difference_choice: 'adjustment' }, TODAY, undefined, now),
    (err: unknown) => err instanceof ReconcileRuleError && err.status === 500,
  );
  assert.equal(db.rows('financial_transactions').filter((r) => Array.isArray(r.tags) && (r.tags as string[]).includes(RECONCILE_ADJUSTMENT_TAG)).length, 0);
  assert.equal(db.rows('account_reconciliations').length, 0);
});

test('before migration 221: views say not ready, finishing answers 503 before any write, balances keep the old rule', async () => {
  const db = seeded();
  db.missingTables = ['account_reconciliations'];
  db.missingColumns = { financial_transactions: ['cleared_at'], financial_accounts: ['opening_balance_date'] };
  for (const a of db.rows('financial_accounts')) delete a.opening_balance_date;

  const view = await loadReconcileView(asDb(db), USER, CHECKING, { statementDate: '2026-09-30', statementBalance: 1200.75 });
  assert.equal(view.ready, false);
  assert.equal(view.check?.computed_balance, 500 + 1000 - 200.25 - 99, 'no starting date: every transaction up to the date counts');

  await assert.rejects(
    finishReconciliation(asDb(db), USER, { account_id: CHECKING, statement_date: '2026-09-30', statement_balance: 1200.75 }, TODAY, undefined, now),
    (err: unknown) => err instanceof ReconcileRuleError && err.status === 503 && err.code === 'reconcile_not_migrated',
  );
  assert.equal(db.writes().length, 0);
  assert.deepEqual(await reconciledPeriods(asDb(db), USER, [{ account_id: CHECKING, transaction_date: '2026-09-10' }]), [null]);
  const status = await loadReconcileStatus(asDb(db), USER, [CHECKING]);
  assert.equal(status.ready, false);
  assert.equal(status.byAccount.size, 0);
  await assert.rejects(unreconcile(asDb(db), USER, 'x'), (err: unknown) => err instanceof ReconcileRuleError && err.status === 503);
});

test('ownership: someone else\'s account is not found, and someone else\'s ids are never touched', async () => {
  const db = seeded();
  await assert.rejects(
    finishReconciliation(asDb(db), USER, { account_id: THEIRS, statement_date: '2026-09-30', statement_balance: 1 }, TODAY, undefined, now),
    (err: unknown) => err instanceof ReconcileRuleError && err.status === 404,
  );
  await assert.rejects(loadReconcileView(asDb(db), USER, THEIRS), (err: unknown) => err instanceof ReconcileRuleError && err.status === 404);
  await assert.rejects(loadReconcileView(asDb(db), USER, 'not-a-uuid'), (err: unknown) => err instanceof ReconcileRuleError && err.status === 404);
  assert.equal(db.writes().length, 0);

  // Their transaction id in the ticks and their statement id are ignored.
  const result = await finishReconciliation(asDb(db), USER, {
    account_id: CHECKING, statement_date: '2026-09-30', statement_balance: 1299.75, cleared_ids: [A1, F1],
    statement_id: '00000000-0000-4000-8000-0000000000d9',
  }, TODAY, undefined, now);
  assert.equal(tx(db, F1).cleared_at, null);
  assert.equal(result.reconciliation.statement_id, null);
  // A statement of another of MY accounts is ignored too.
  const other = await finishReconciliation(asDb(db), USER, {
    account_id: CHECKING, statement_date: '2026-09-29', statement_balance: 1299.75, statement_id: '00000000-0000-4000-8000-0000000000d1',
  }, TODAY, undefined, now);
  assert.equal(other.reconciliation.statement_id, null);

  // Their reconciliation can't be unreconciled by me.
  const [theirRec] = db.seed('account_reconciliations', [{ user_id: OTHER, account_id: THEIRS, statement_date: '2026-09-30', statement_balance: 1, computed_balance: 1, difference: 0, status: 'reconciled', cleared_count: 0 }]);
  await assert.rejects(unreconcile(asDb(db), USER, String(theirRec.id)), (err: unknown) => err instanceof ReconcileRuleError && err.status === 404);
  assert.equal(theirRec.status, 'reconciled');
});

test('unticking: a transaction ticked before and unticked now is cleared again', async () => {
  const db = seeded();
  await finishReconciliation(asDb(db), USER, { account_id: CHECKING, statement_date: '2026-09-30', statement_balance: 1299.75, cleared_ids: [A1, A2] }, TODAY, undefined, now);
  const second = await finishReconciliation(asDb(db), USER, { account_id: CHECKING, statement_date: '2026-09-30', statement_balance: 1299.75, cleared_ids: [A1] }, TODAY, undefined, now);
  assert.deepEqual(second.cleared, { marked: 0, unmarked: 1 });
  assert.equal(tx(db, A2).cleared_at, null);
  assert.equal(second.reconciliation.cleared_count, 1);
});

test('guard: transactions inside a reconciled period are flagged; unreconcile lifts it and can remove the adjustment', async () => {
  const db = seeded();
  const done = await finishReconciliation(asDb(db), USER, {
    account_id: CARD, statement_date: '2026-09-30', statement_balance: 925, difference_choice: 'adjustment',
  }, TODAY, undefined, now);

  const list: Record<string, unknown>[] = [
    { id: B1, account_id: CARD, transaction_date: '2026-09-05' },
    { id: 'later', account_id: CARD, transaction_date: '2026-10-03' },
    { id: 'before-start', account_id: CARD, transaction_date: '2026-08-20' },
    { id: 'other-account', account_id: CHECKING, transaction_date: '2026-09-05' },
    { id: 'no-account', account_id: null, transaction_date: '2026-09-05' },
  ];
  await annotateReconciled(asDb(db), USER, list);
  assert.deepEqual(list.map((r) => (r.reconciled_period as { statement_date: string } | null)?.statement_date ?? null), ['2026-09-30', null, null, null, null]);
  assert.equal((list[0].reconciled_period as { reconciliation_id: string }).reconciliation_id, done.reconciliation.id);
  // Someone else asking about my account learns nothing.
  assert.deepEqual(await reconciledPeriods(asDb(db), OTHER, [{ account_id: CARD, transaction_date: '2026-09-05' }]), [null]);

  const undone = await unreconcile(asDb(db), USER, done.reconciliation.id, { removeAdjustment: true }, now);
  assert.equal(undone.adjustment_deleted, true);
  assert.equal(undone.reconciliation.status, 'open');
  assert.equal(undone.reconciliation.adjustment_transaction_id, null);
  assert.equal(undone.reconciliation.reconciled_at, null);
  assert.equal(db.rows('financial_transactions').some((r) => r.id === done.adjustment!.id), false);
  assert.deepEqual(await reconciledPeriods(asDb(db), USER, [{ account_id: CARD, transaction_date: '2026-09-05' }]), [null]);
});

test('unreconcile keeps an adjustment unless asked, and never deletes an untagged transaction', async () => {
  const db = seeded();
  const done = await finishReconciliation(asDb(db), USER, {
    account_id: CHECKING, statement_date: '2026-09-30', statement_balance: 1300, difference_choice: 'adjustment',
  }, TODAY, undefined, now);
  const kept = await unreconcile(asDb(db), USER, done.reconciliation.id, {}, now);
  assert.equal(kept.adjustment_deleted, false);
  assert.equal(kept.reconciliation.adjustment_transaction_id, done.adjustment!.id);
  // The adjustment lost its tag (edited by hand): removing it is refused silently.
  tx(db, done.adjustment!.id).tags = [];
  const again = await unreconcile(asDb(db), USER, done.reconciliation.id, { removeAdjustment: true }, now);
  assert.equal(again.adjustment_deleted, false);
  assert.ok(db.rows('financial_transactions').some((r) => r.id === done.adjustment!.id));
});

test('the Reconcile view: suggested statement, starting balance from the earliest statement, and the comparison', async () => {
  const db = seeded();
  const view = await loadReconcileView(asDb(db), USER, CARD, { statementDate: '2026-09-30', statementBalance: 925 });
  assert.equal(view.ready, true);
  assert.equal(view.account.is_debt, true);
  assert.deepEqual(view.suggested, { statement_id: '00000000-0000-4000-8000-0000000000d1', statement_date: '2026-09-30', statement_balance: 925 });
  assert.deepEqual(view.starting_suggestion, { opening_balance: 1100, opening_balance_date: '2026-07-31', statement_id: '00000000-0000-4000-8000-0000000000d2', period_start: '2026-08-01' });
  assert.equal(view.statements.length, 2, 'only this account\'s statements');
  assert.equal(view.check?.computed_balance, 900);
  assert.equal(view.check?.difference, 25);
  assert.equal(view.check?.before_start, false);
  assert.equal(view.check?.transactions.length, 2);
  const chosen = await loadReconcileView(asDb(db), USER, CARD, { statementPeriodEnd: '2026-08-31' });
  assert.equal(chosen.suggested?.statement_date, '2026-08-31');
  assert.equal(chosen.check, null);
  const early = await loadReconcileView(asDb(db), USER, CHECKING, { statementDate: '2026-08-15' });
  assert.equal(early.check?.before_start, true);
});

test('monthly audit: never, stale and open accounts are due; cash, inactive and someone else\'s are left out', async () => {
  const db = seeded();
  db.seed('account_reconciliations', [
    { user_id: USER, account_id: CHECKING, statement_date: '2026-09-30', statement_balance: 1, computed_balance: 1, difference: 0, status: 'reconciled', cleared_count: 0 },
    { user_id: USER, account_id: CARD, statement_date: '2026-08-31', statement_balance: 1, computed_balance: 1, difference: 0, status: 'reconciled', cleared_count: 0 },
    { user_id: USER, account_id: CARD, statement_date: '2026-09-30', statement_balance: 2, computed_balance: 1, difference: 1, status: 'open', cleared_count: 0 },
  ]);
  (db.rows('financial_accounts').find((a) => a.id === PESOS) as Row).is_active = false;
  const audit = await loadReconcileAudit(asDb(db), USER, TODAY);
  assert.equal(audit.ready, true);
  assert.deepEqual(audit.accounts.map((a) => a.id), [CHECKING, CARD, LOAN]);
  const byId = new Map(audit.accounts.map((a) => [a.id, a]));
  assert.equal(byId.get(CHECKING)?.state, 'fresh');
  assert.equal(byId.get(CARD)?.state, 'stale');
  assert.equal(byId.get(CARD)?.days, 37);
  assert.deepEqual(byId.get(CARD)?.open, { statement_date: '2026-09-30', difference: 1 });
  assert.equal(byId.get(LOAN)?.state, 'never');
  assert.deepEqual(audit.due.map((a) => a.id), [LOAN, CARD], 'never first, then the oldest');

  db.missingTables = ['account_reconciliations'];
  const before = await loadReconcileAudit(asDb(db), USER, TODAY);
  assert.equal(before.ready, false);
});
