// tests/unit/wallet.test.ts
// Unit tests for the Wallet (plans/66 Part 2, W1): the credit limit rule shared with the Debt page,
// the Wallet's formulas (lib/finance/wallet/logic.ts), its loader against the in-memory fake
// (lib/finance/wallet/server.ts), and business pages (lib/finance/brands/*).
// Run: npm run test:unit
//
// Every account, amount, name and id here is SYNTHETIC. Nothing touches a database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creditLimitFor, latestStatementLimit } from '../../lib/finance/debt/credit-limit.ts';
import { buildDebtSummary, latestLinkedPayment } from '../../lib/finance/debt/overview.ts';
import type { DebtAccountRow, StatementRow, TxnRow } from '../../lib/finance/debt/overview.ts';
import {
  CREDIT_WARN_PERCENT,
  buildWallet,
  comparePayoff,
  loanPayment,
  payoffDifferenceText,
  loanStart,
  retirementFromOverview,
  toHome,
} from '../../lib/finance/wallet/logic.ts';
import type { RetirementIn, WalletAccountIn, WalletInput } from '../../lib/finance/wallet/logic.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FakeDbPlus, FakeQueryPlus } from './fake-supabase-plus.ts';
import type { Row } from './fake-supabase.ts';
import { loadWalletInput } from '../../lib/finance/wallet/server.ts';
import {
  brandOfRow,
  cashFlowStart,
  cashFlowTable,
  moneyInOut,
  openInvoices,
  periodOf,
  periodsBack,
} from '../../lib/finance/brands/logic.ts';
import type { BrandTxnRow } from '../../lib/finance/brands/logic.ts';
import { loadBrandPage, loadBrandSummaries, loadBrandTransactions } from '../../lib/finance/brands/server.ts';

// ── Credit limit rule ────────────────────────────────────────────────────────

test('creditLimitFor: the account limit wins over the statement', () => {
  const r = creditLimitFor({ id: 'a1', credit_limit: '8000' }, [{ account_id: 'a1', period_end: '2026-09-28', credit_limit: 9000 }]);
  assert.deepEqual(r, { limit: 8000, source: 'account' });
});

test('creditLimitFor: the latest statement that prints a limit is the fallback', () => {
  const statements = [
    { account_id: 'a1', period_end: '2026-07-28', credit_limit: 5000 },
    { account_id: 'a1', period_end: '2026-08-28', credit_limit: 6000 },
    // The newest statement printed no limit: the one before it still counts.
    { account_id: 'a1', period_end: '2026-09-28', credit_limit: null },
    // Another account's statement never counts.
    { account_id: 'b2', period_end: '2026-10-01', credit_limit: 99000 },
  ];
  assert.deepEqual(creditLimitFor({ id: 'a1', credit_limit: null }, statements), { limit: 6000, source: 'statement' });
  assert.equal(latestStatementLimit('a1', statements), 6000);
});

test('creditLimitFor: zero, blank and missing limits mean no limit', () => {
  assert.deepEqual(creditLimitFor({ id: 'a1', credit_limit: 0 }), { limit: null, source: null });
  assert.deepEqual(creditLimitFor({ id: 'a1', credit_limit: '' }, [{ account_id: 'a1', period_end: '2026-09-28', credit_limit: 0 }]), {
    limit: null,
    source: null,
  });
  assert.deepEqual(creditLimitFor({ id: 'a1' }), { limit: null, source: null });
});

test('buildDebtSummary: the Debt page uses the statement limit when the account has none', () => {
  const card: DebtAccountRow = { id: 'c1', name: 'Test Card', account_type: 'credit_card', credit_limit: null, opening_balance: 500 };
  const statement: StatementRow = {
    id: 's1',
    account_id: 'c1',
    period_start: '2026-08-29',
    period_end: '2026-09-28',
    new_balance: 500,
    minimum_payment: 35,
    due_date: '2026-10-25',
    interest_charged: 0,
    aprs: [],
    promos: [],
    credit_limit: 2500,
  };
  const d = buildDebtSummary(card, [statement], [], '2026-10-05');
  assert.equal(d.creditLimit, 2500);
  assert.equal(d.creditLimitSource, 'statement');
  const own = buildDebtSummary({ ...card, credit_limit: 3000 }, [statement], [], '2026-10-05');
  assert.equal(own.creditLimit, 3000);
  assert.equal(own.creditLimitSource, 'account');
  const none = buildDebtSummary(card, [], [], '2026-10-05');
  assert.equal(none.creditLimit, null);
  assert.equal(none.creditLimitSource, null);
});

// ── Wallet formulas ──────────────────────────────────────────────────────────

const TODAY = '2026-10-08';

function acct(over: Partial<WalletAccountIn> & Pick<WalletAccountIn, 'id' | 'account_type'>): WalletAccountIn {
  return { name: over.id, currency: 'USD', balance: 0, ...over };
}

function input(over: Partial<WalletInput> = {}): WalletInput {
  return {
    today: TODAY,
    home: 'USD',
    rates: new Map(),
    accounts: [],
    lastCounts: new Map(),
    countsReady: true,
    goalsHeld: new Map(),
    equipment: [],
    vehicles: [],
    bookValues: { equipment: new Map(), vehicles: new Map() },
    retirement: null,
    policies: [],
    ...over,
  };
}

test('toHome: home currency as is, foreign at the rate, no rate = null', () => {
  const rates = new Map<string, number | null>([['MXN', 0.055], ['XYZ', null]]);
  assert.equal(toHome(100.004, 'USD', 'USD', rates), 100);
  assert.equal(toHome(2400, 'MXN', 'USD', rates), 132);
  assert.equal(toHome(10, 'XYZ', 'USD', rates), null);
  assert.equal(toHome(10, 'EUR', 'USD', rates), null);
});

test('cash means physical cash only; checking and savings are their own section', () => {
  const w = buildWallet(
    input({
      accounts: [
        acct({ id: 'wallet', account_type: 'cash', balance: 320 }),
        acct({ id: 'chk', account_type: 'checking', balance: 5920 }),
        acct({ id: 'sav', account_type: 'savings', balance: 2000 }),
      ],
      lastCounts: new Map([['wallet', '2026-10-01']]),
      goalsHeld: new Map([['sav', 1500]]),
    }),
  );
  assert.equal(w.cash.total, 320);
  assert.deepEqual(w.cash.pockets.map((p) => p.id), ['wallet']);
  assert.equal(w.bank.total, 7920);
  assert.equal(w.bank.checking, 5920);
  assert.equal(w.bank.savings, 2000);
  // Set aside is shown, never subtracted.
  assert.equal(w.bank.set_aside, 1500);
  assert.equal(w.net_worth.total, 320 + 7920);
});

test('cash: a count older than 30 days, or none, asks for a count; overdrawn is flagged', () => {
  const accounts = [
    acct({ id: 'old', account_type: 'cash', balance: 10 }),
    acct({ id: 'never', account_type: 'cash', balance: -5 }),
    acct({ id: 'fresh', account_type: 'cash', balance: 1 }),
  ];
  const lastCounts = new Map([['old', '2026-08-28'], ['fresh', '2026-10-07']]);
  const w = buildWallet(input({ accounts, lastCounts }));
  const byId = Object.fromEntries(w.cash.pockets.map((p) => [p.id, p]));
  assert.equal(byId.old.count_status, 'stale');
  assert.equal(byId.old.days_since_count, 41);
  assert.equal(byId.old.needs_count, true);
  assert.equal(byId.never.needs_count, true);
  assert.equal(byId.never.overdrawn, true);
  assert.equal(byId.fresh.needs_count, false);
  assert.equal(w.cash.needs_count, 2);
  // Before migration 213 nobody is asked to count (counting would be refused).
  const notReady = buildWallet(input({ accounts, lastCounts, countsReady: false }));
  assert.equal(notReady.cash.needs_count, 0);
});

test('credit: cards with no limit stay out of the %, and an overpaid card never offsets another', () => {
  const w = buildWallet(
    input({
      accounts: [
        acct({ id: 'visa', account_type: 'credit_card', balance: -1900, credit_limit: 8000, credit_limit_source: 'account' }),
        acct({ id: 'amex', account_type: 'credit_card', balance: 230, credit_limit: 7000 }), // overpaid by 230
        acct({ id: 'store', account_type: 'credit_card', balance: -400, credit_limit: null }),
      ],
    }),
  );
  assert.equal(w.credit.used, 1900);
  assert.equal(w.credit.limit_total, 15000);
  assert.equal(w.credit.available, 13100);
  assert.equal(w.credit.percent, 12.7);
  assert.equal(w.credit.warn, false);
  assert.equal(w.credit.no_limit_count, 1);
  assert.equal(w.credit.no_limit_owed, 400);
  const amex = w.credit.lines.find((l) => l.id === 'amex')!;
  assert.equal(amex.owed, -230);
  assert.equal(amex.percent, 0);
  // Debts in net worth: max(0, owed) per card.
  assert.equal(w.net_worth.debts, 2300);
});

test('credit: amber at 30% or more, overall or on one card, and over the limit', () => {
  const at = buildWallet(input({ accounts: [acct({ id: 'c', account_type: 'credit_card', balance: -300, credit_limit: 1000 })] }));
  assert.equal(CREDIT_WARN_PERCENT, 30);
  assert.equal(at.credit.percent, 30);
  assert.equal(at.credit.warn, true);
  assert.equal(at.credit.lines[0].warn, true);
  const over = buildWallet(input({ accounts: [acct({ id: 'c', account_type: 'credit_card', balance: -1100, credit_limit: 1000 })] }));
  assert.equal(over.credit.lines[0].over_limit, true);
  assert.equal(over.credit.available, -100);
  // 29.999% shows as 30.0% but is under the threshold: the check uses exact cents.
  const under = buildWallet(input({ accounts: [acct({ id: 'c', account_type: 'credit_card', balance: -299.99, credit_limit: 1000 })] }));
  assert.equal(under.credit.warn, false);
  assert.equal(under.credit.lines[0].warn, false);
});

test('a loan with a limit is a line of credit: it counts in credit, not in loans', () => {
  const w = buildWallet(
    input({
      accounts: [
        acct({ id: 'heloc', account_type: 'loan', balance: -2000, credit_limit: 10000, credit_limit_source: 'statement' }),
        acct({ id: 'car', account_type: 'loan', balance: -9800, minimum_payment: 300, apr: 6 }),
      ],
    }),
  );
  assert.deepEqual(w.credit.lines.map((l) => [l.id, l.kind, l.limit_source]), [['heloc', 'line_of_credit', 'statement']]);
  assert.deepEqual(w.loans.loans.map((l) => l.id), ['car']);
  assert.equal(w.credit.percent, 20);
  assert.equal(w.loans.owed, 9800);
  assert.equal(w.net_worth.debts, 11800);
});

test('a foreign card: owed and limit convert at the same rate, so the % is exact; no rate = listed, left out', () => {
  const w = buildWallet(
    input({
      rates: new Map<string, number | null>([['MXN', 0.05], ['XYZ', null]]),
      accounts: [
        acct({ id: 'mx', account_type: 'credit_card', currency: 'MXN', balance: -3333, credit_limit: 10000 }),
        acct({ id: 'xyz', account_type: 'credit_card', currency: 'XYZ', balance: -50, credit_limit: 100 }),
        acct({ id: 'cashx', account_type: 'cash', currency: 'XYZ', balance: 70 }),
      ],
    }),
  );
  const mx = w.credit.lines.find((l) => l.id === 'mx')!;
  assert.equal(mx.percent, 33.3);
  assert.equal(mx.owed_home, 166.65);
  assert.equal(mx.limit_home, 500);
  assert.equal(w.credit.used, 166.65);
  assert.equal(w.credit.limit_total, 500);
  assert.deepEqual(
    w.unconverted.map((u) => [u.section, u.id, u.currency, u.amount]),
    [['cash', 'cashx', 'XYZ', 70], ['credit', 'xyz', 'XYZ', 50]],
  );
  assert.equal(w.cash.total, 0);
  assert.equal(w.net_worth.debts, 166.65);
});

test('loans: starting amount and date vs owed now, and the payoff at the minimum', () => {
  const w = buildWallet(
    input({
      accounts: [
        acct({
          id: 'car',
          account_type: 'loan',
          balance: -9000,
          opening_balance: 12000,
          opening_balance_date: '2025-01-31',
          created_at: '2025-03-01T10:00:00Z',
          last_activity: '2026-10-01',
          apr: 6,
          apr_source: 'account',
          minimum_payment: 300,
          minimum_estimated: false,
        }),
      ],
    }),
  );
  const loan = w.loans.loans[0];
  assert.equal(loan.starting_amount, 12000);
  assert.equal(loan.starting_date, '2025-01-31');
  assert.equal(loan.starting_date_source, 'starting_balance_date');
  assert.equal(loan.owed, 9000);
  assert.equal(loan.as_of, '2026-10-01');
  assert.equal(loan.paid_down, 3000);
  assert.equal(loan.paid_percent, 25);
  assert.equal(loan.minimum_source, 'statement');
  assert.ok(loan.at_minimum);
  assert.equal(loan.at_minimum.never_pays_off, false);
  assert.equal(loan.at_minimum.months, 33);
  assert.equal(loan.at_minimum.payoff_date, '2029-07-08');
  assert.ok(loan.at_minimum.total_interest > 700 && loan.at_minimum.total_interest < 800);
  assert.equal(w.loans.minimums, 300);
  assert.equal(w.loans.no_payment_count, 0);
});

test("loans: no statement means the last linked payment, never the card formula; neither means no payoff date", () => {
  // The card formula's estimate for $9,000 at 6% is $135 (1% + a month's interest): far too low for a car loan.
  const w = buildWallet(
    input({
      accounts: [
        acct({ id: 'car', account_type: 'loan', balance: -9000, apr: 6, minimum_payment: 135, minimum_estimated: true, last_payment: 300, last_payment_date: '2026-09-30' }),
        acct({ id: 'student', account_type: 'loan', balance: -4000, apr: 5, minimum_payment: 56.67, minimum_estimated: true }),
      ],
    }),
  );
  const [car, student] = w.loans.loans;
  assert.equal(car.minimum, 300);
  assert.equal(car.minimum_source, 'last_payment');
  assert.equal(car.minimum_date, '2026-09-30');
  assert.equal(car.at_minimum?.months, 33); // at $135 it would be 82
  assert.equal(student.minimum, null);
  assert.equal(student.minimum_source, null);
  assert.equal(student.at_minimum, null);
  assert.equal(w.loans.minimums, 300);
  assert.equal(w.loans.no_payment_count, 1);
  // A statement's minimum wins over the last payment.
  assert.deepEqual(loanPayment({ minimum_payment: 320, minimum_estimated: false, last_payment: 300 }), { amount: 320, source: 'statement', date: null });
  assert.deepEqual(loanPayment({ minimum_payment: 0, last_payment: 0 }), { amount: null, source: null, date: null });
});

test('latestLinkedPayment: the latest day of linked payments, added up; unlinked, future and other accounts never count', () => {
  const t = (over: Partial<TxnRow> & Pick<TxnRow, 'id' | 'amount' | 'transaction_date'>): TxnRow => ({ account_id: 'loan', type: 'income', ...over });
  const txns = [
    t({ id: '1', amount: 300, transaction_date: '2026-08-30', transfer_kind: 'loan_payment' }),
    t({ id: '2', amount: 250, transaction_date: '2026-09-30', transfer_group_id: 'g2' }),
    t({ id: '3', amount: 50, transaction_date: '2026-09-30', transfer_kind: 'loan_payment' }),
    t({ id: '4', amount: 999, transaction_date: '2026-10-05' }), // not linked
    t({ id: '5', amount: 300, transaction_date: '2026-10-30', transfer_kind: 'loan_payment' }), // after today
    t({ id: '6', amount: 300, transaction_date: '2026-10-01', transfer_kind: 'loan_payment', account_id: 'other' }),
    t({ id: '7', amount: 40, transaction_date: '2026-10-02', type: 'expense', transfer_kind: 'loan_payment' }), // not money in
  ];
  assert.deepEqual(latestLinkedPayment('loan', txns, TODAY), { amount: 300, date: '2026-09-30' });
  assert.equal(latestLinkedPayment('none', txns, TODAY), null);
});

test('loanStart: the starting-balance date, else the day the account was added', () => {
  assert.deepEqual(loanStart({ opening_balance_date: '2025-01-31', created_at: '2025-03-01T00:00:00Z' }), { date: '2025-01-31', source: 'starting_balance_date' });
  assert.deepEqual(loanStart({ opening_balance_date: null, created_at: '2025-03-01T00:00:00Z' }), { date: '2025-03-01', source: 'added' });
  assert.deepEqual(loanStart({}), { date: null, source: null });
});

test('comparePayoff: a custom payment shows the new payoff date and the interest saved', () => {
  const c = comparePayoff(9000, 6, 300, 500, TODAY);
  assert.equal(c.minimum.months, 33);
  assert.equal(c.custom.months, 19);
  assert.equal(c.months_saved, 14);
  assert.ok(c.interest_saved !== null && c.interest_saved > 250);
  assert.equal(c.interest_saved, Math.round((c.minimum.total_interest - c.custom.total_interest) * 100) / 100);
  // Paying less than the minimum costs more: a negative saving.
  const less = comparePayoff(9000, 6, 300, 250, TODAY);
  assert.ok(less.interest_saved !== null && less.interest_saved < 0);
  assert.ok(less.months_saved !== null && less.months_saved < 0);
  // A payment that never covers the interest never pays off, and nothing is compared.
  const never = comparePayoff(9000, 6, 300, 40, TODAY);
  assert.equal(never.custom.never_pays_off, true);
  assert.equal(never.interest_saved, null);
  assert.equal(never.months_saved, null);
  // No monthly payment known: the custom amount alone.
  const alone = comparePayoff(9000, 6, null, 300, TODAY);
  assert.equal(alone.minimum, null);
  assert.equal(alone.custom.months, 33);
  assert.equal(alone.interest_saved, null);
});

test('payoffDifferenceText: the interest saved shows even when both finish in the same month', () => {
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  // $305 instead of $300 on $9,000 at 6%: 33 months either way, but $13.90 less interest.
  const small = comparePayoff(9000, 6, 300, 305, TODAY);
  assert.equal(small.months_saved, 0);
  assert.equal(small.interest_saved, 13.9);
  assert.equal(payoffDifferenceText(small, fmt), 'Compared with the monthly payment, that saves about $13.90 in interest.');
  const big = comparePayoff(9000, 6, 300, 500, TODAY);
  assert.match(payoffDifferenceText(big, fmt) ?? '', /^Compared with the monthly payment, that saves about \$\d+\.\d{2} in interest and finishes 14 months sooner\.$/);
  const less = comparePayoff(9000, 6, 300, 250, TODAY);
  assert.match(payoffDifferenceText(less, fmt) ?? '', /costs about \$\d+\.\d{2} more in interest and finishes \d+ months later\.$/);
  // No APR: no interest either way, but it finishes sooner.
  assert.equal(payoffDifferenceText({ interest_saved: 0, months_saved: 1 }, fmt), 'Compared with the monthly payment, that finishes 1 month sooner.');
  // Nothing to compare, or no difference.
  assert.equal(payoffDifferenceText({ interest_saved: null, months_saved: null }, fmt), null);
  assert.equal(payoffDifferenceText({ interest_saved: 0, months_saved: 0 }, fmt), null);
});

test("payoff: 'doesn't cover the interest' is told apart from 'takes more than 50 years'", () => {
  // $40 on $9,000 at 6% is under the $45 monthly interest: it never pays off.
  const never = comparePayoff(9000, 6, 300, 40, TODAY).custom;
  assert.equal(never.never_pays_off, true);
  assert.equal(never.over_max, false);
  // $2,200 on $400,000 at 6.5% covers the $2,166.67 interest but needs more than 600 payments.
  const mortgage = comparePayoff(400000, 6.5, 2200, 3000, TODAY);
  assert.equal(mortgage.minimum?.never_pays_off, false);
  assert.equal(mortgage.minimum?.over_max, true);
  assert.equal(mortgage.minimum?.payoff_date, null);
  assert.equal(mortgage.custom.over_max, false);
  assert.equal(mortgage.custom.months, 238);
  assert.equal(mortgage.interest_saved, null);
  // No APR: every payment covers the (zero) interest; $400 on $300,000 is 750 payments, so over 50 years.
  const noApr = comparePayoff(300000, null, 400, 400, TODAY);
  assert.equal(noApr.custom.never_pays_off, false);
  assert.equal(noApr.custom.over_max, true);
  // Paying the whole balance off is never either.
  const done = comparePayoff(0, 6, 300, 300, TODAY).custom;
  assert.deepEqual([done.months, done.never_pays_off, done.over_max], [0, false, false]);
});

test('assets: owned equipment and your own vehicles, your value then book value then price', () => {
  const w = buildWallet(
    input({
      equipment: [
        { id: 'cam', name: 'Camera body', purchase_price: 2000, current_value: 1800, ownership_type: 'own' },
        { id: 'bike', name: 'Road bike', purchase_price: 1500, current_value: null, ownership_type: 'own' },
        { id: 'mat', name: 'Mat', purchase_price: 40, current_value: null, ownership_type: 'own' },
        { id: 'gym', name: 'Gym rack', purchase_price: 900, current_value: 900, ownership_type: 'access' },
        { id: 'none', name: 'Gift', purchase_price: null, current_value: null },
      ],
      vehicles: [
        { id: 'car', nickname: 'Car', ownership_type: 'owned' },
        { id: 'rent', nickname: 'Rental', ownership_type: 'rental' },
        { id: 'bus', nickname: 'Bus', ownership_type: 'owned', is_system: true },
        { id: 'scooter', nickname: 'Scooter', ownership_type: 'owned' },
      ],
      bookValues: { equipment: new Map([['cam', 1400], ['bike', 1100]]), vehicles: new Map([['car', 8000]]) },
    }),
  );
  const byId = Object.fromEntries([...w.assets.top, ...w.assets.no_value].map((i) => [i.id, i]));
  assert.equal(w.assets.count, 6);
  assert.equal(w.assets.equipment_count, 4);
  assert.equal(w.assets.vehicle_count, 2);
  assert.equal(byId.cam.value, 1800);
  assert.equal(byId.cam.value_source, 'your_value');
  assert.equal(byId.cam.book_value, 1400);
  assert.equal(byId.bike.value_source, 'book_value');
  assert.equal(byId.mat.value_source, 'purchase_price');
  assert.equal(byId.car.value, 8000);
  assert.equal(w.assets.total, 1800 + 1100 + 40 + 8000);
  assert.equal(w.assets.your_value_total, 1800);
  assert.equal(w.assets.book_value_total, 1400 + 1100 + 8000);
  assert.deepEqual(w.assets.no_value.map((i) => i.id).sort(), ['none', 'scooter']);
  assert.equal(w.assets.top[0].id, 'car');
  assert.equal(w.net_worth.assets, 10940);
  const noBooks = buildWallet(input({ equipment: [{ id: 'cam', name: 'Camera', purchase_price: 10 }], bookValues: null }));
  assert.equal(noBooks.assets.depreciation_ready, false);
});

test('retirement: the planner figures, age 65 marked assumed, on track or short', () => {
  const overview = {
    ready: true,
    settings_row: { retirement_age: null },
    settings: { retirement_age: 65, current_age: 43 },
    accounts: [{}, {}],
    unconverted: 0,
    policy_cash_value: 5000,
    plan: { current_total: 86000, years_to_retirement: 22, gap: 210000, extra_monthly_needed: 410 },
  };
  const r = retirementFromOverview(overview);
  assert.equal(r.funds, 86000);
  assert.equal(r.years_left, 22);
  assert.equal(r.age_assumed, true);
  assert.equal(r.age_missing, false);
  const w = buildWallet(input({ retirement: r, accounts: [acct({ id: 'c', account_type: 'cash', balance: 100 })] }));
  assert.equal(w.retirement?.on_track, false);
  assert.equal(w.net_worth.total, 100 + 86000 + 5000);
  const set = retirementFromOverview({ ...overview, settings_row: { retirement_age: 60 }, plan: { ...overview.plan, gap: -1 } });
  assert.equal(set.age_assumed, false);
  assert.equal(buildWallet(input({ retirement: set })).retirement?.on_track, true);
  const noAge = retirementFromOverview({ ...overview, settings: { retirement_age: 65, current_age: null }, plan: { ...overview.plan, years_to_retirement: null, gap: null } });
  assert.equal(noAge.age_missing, true);
  assert.equal(buildWallet(input({ retirement: noAge })).retirement?.on_track, null);
});

test('net worth: cash + bank + retirement + policy cash value + assets - debts', () => {
  const retirement: RetirementIn = {
    ready: true, funds: 1000, accounts: 1, years_left: 10, retirement_age: 65, age_assumed: false, age_missing: false,
    gap: 0, extra_monthly: 0, unconverted: 0, policy_cash_value: 250,
  };
  const w = buildWallet(
    input({
      retirement,
      accounts: [
        acct({ id: 'cash', account_type: 'cash', balance: 100.1 }),
        acct({ id: 'chk', account_type: 'checking', balance: -50.2 }),
        acct({ id: 'card', account_type: 'credit_card', balance: -300.3, credit_limit: 1000 }),
        acct({ id: 'loan', account_type: 'loan', balance: -400, minimum_payment: 50 }),
      ],
      equipment: [{ id: 'e', name: 'E', current_value: 75.5 }],
    }),
  );
  assert.deepEqual(w.net_worth, {
    total: 675.1, // 100.1 - 50.2 + 1000 + 250 + 75.5 - 700.3
    cash: 100.1,
    bank: -50.2,
    retirement: 1000,
    policy_cash_value: 250,
    assets: 75.5,
    debts: 700.3,
  });
  assert.equal(w.bank.accounts[0].overdrawn, true);
  // Retirement not set up (migration 215): no funds, no cash value.
  const none = buildWallet(input({ retirement: { ...retirement, ready: false } }));
  assert.equal(none.net_worth.retirement, 0);
  assert.equal(none.net_worth.policy_cash_value, 0);
});

test('insurance line: coverage per group in the home currency; other currencies are counted apart', () => {
  const w = buildWallet(
    input({
      policies: [
        { kind: 'term_life', coverage_amount: 500000, currency: 'USD' },
        { kind: 'whole_life', coverage_amount: 100000, currency: null },
        { kind: 'term_life', coverage_amount: 999, currency: 'EUR' },
        { kind: 'other', coverage_amount: 5000, currency: 'USD', is_active: false },
      ],
    }),
  );
  assert.equal(w.insurance.ready, true);
  assert.equal(w.insurance.coverage.life, 600000);
  assert.equal(w.insurance.counts.life, 2);
  assert.equal(w.insurance.other_currency, 1);
  assert.equal(w.insurance.counts.other, 0);
  assert.equal(buildWallet(input({ policies: null })).insurance.ready, false);
});

// ── Loaders, against the in-memory fake ──────────────────────────────────────

/** FakeDbPlus that also answers select('*, rel(col)') with whole rows (the base fake drops '*' there). */
class StarQuery extends FakeQueryPlus {
  override project(row: Row): Row {
    if ((this.columns ?? '').split(',').some((c) => c.trim() === '*')) return { ...row };
    return super.project(row);
  }
}
class WalletFakeDb extends FakeDbPlus {
  override from(table: string): StarQuery {
    return new StarQuery(this, table);
  }
}
const USER = 'user-1';
const OTHER = 'user-2';
const asClient = (db: WalletFakeDb) => db as unknown as SupabaseClient;

function seedAccounts(db: WalletFakeDb) {
  db.seed('financial_accounts', [
    { id: 'cash1', user_id: USER, name: 'Wallet', account_type: 'cash', opening_balance: 300, is_active: true, currency: 'USD' },
    { id: 'chk1', user_id: USER, name: 'Checking', account_type: 'checking', opening_balance: 1000, is_active: true, currency: 'USD' },
    { id: 'card1', user_id: USER, name: 'Visa', account_type: 'credit_card', opening_balance: 0, credit_limit: null, is_active: true, currency: 'USD' },
    { id: 'loan1', user_id: USER, name: 'Car loan', account_type: 'loan', opening_balance: 5000, opening_balance_date: '2026-01-31', interest_rate: 6, is_active: true, currency: 'USD' },
    { id: 'mxn1', user_id: USER, name: 'Pesos', account_type: 'cash', opening_balance: 2000, is_active: true, currency: 'MXN' },
    { id: 'old', user_id: USER, name: 'Closed', account_type: 'checking', opening_balance: 999, is_active: false, currency: 'USD' },
    { id: 'theirs', user_id: OTHER, name: 'Not mine', account_type: 'checking', opening_balance: 5, is_active: true, currency: 'USD' },
  ]);
}

test('loadWalletInput: balances over every page, the statement limit, counts, goals and rates', async () => {
  const db = new WalletFakeDb();
  seedAccounts(db);
  // 1,200 rows on the card: more than one page.
  db.seed(
    'financial_transactions',
    Array.from({ length: 1200 }, (_, i) => ({
      id: `t${String(i).padStart(5, '0')}`,
      user_id: USER,
      account_id: 'card1',
      type: 'expense',
      amount: 1,
      transaction_date: '2026-09-15',
    })),
  );
  db.seed('financial_transactions', [
    { id: 'u1', user_id: USER, account_id: 'loan1', type: 'income', amount: 500, transaction_date: '2026-10-01' },
    { id: 'u0', user_id: USER, account_id: 'loan1', type: 'income', amount: 100, transaction_date: '2026-01-15' }, // before its starting date
    { id: 'c1', user_id: USER, account_id: 'cash1', type: 'expense', amount: 20, transaction_date: '2026-10-02' },
  ]);
  db.seed('account_statements', [
    { id: 's1', user_id: USER, account_id: 'card1', period_start: '2026-08-29', period_end: '2026-09-28', new_balance: 1200, minimum_payment: 40, due_date: '2026-10-25', interest_charged: 0, aprs: [], promos: [], credit_limit: 4000 },
  ]);
  db.seed('cash_counts', [
    { user_id: USER, account_id: 'cash1', counted_on: '2026-08-01', counted_at: '2026-08-01T12:00:00Z' },
    { user_id: USER, account_id: 'cash1', counted_on: '2026-10-05', counted_at: '2026-10-05T12:00:00Z' },
  ]);
  db.seed('savings_goals', [{ id: 'g1', user_id: USER, funding_account_id: 'chk1', starting_amount: 100 }]);
  db.seed('savings_allocations', [{ id: 'a1', user_id: USER, goal_id: 'g1', amount: 50 }]);
  db.seed('equipment', [
    { id: 'e1', user_id: USER, name: 'Camera', purchase_price: 900, current_value: 700, is_active: true, ownership_type: 'own' },
    { id: 'e2', user_id: OTHER, name: 'Theirs', purchase_price: 1, current_value: 1, is_active: true, ownership_type: 'own' },
  ]);
  db.seed('vehicles', [{ id: 'v1', user_id: USER, nickname: 'Car', active: true, ownership_type: 'owned', is_system: false }]);
  db.seed('insurance_policies', [{ user_id: USER, kind: 'term_life', coverage_amount: 250000, currency: 'USD', is_active: true }]);

  const asked: string[] = [];
  const { input: loaded, error } = await loadWalletInput(asClient(db), USER, TODAY, 'USD', {
    rateFor: async (c) => {
      asked.push(c);
      return c === 'MXN' ? 0.05 : null;
    },
  });
  assert.equal(error, null);
  assert.ok(loaded);
  assert.deepEqual(asked, ['MXN']); // once per currency, never for the home currency
  const byId = Object.fromEntries(loaded.accounts.map((a) => [a.id, a]));
  assert.deepEqual(Object.keys(byId).sort(), ['card1', 'cash1', 'chk1', 'loan1', 'mxn1']);
  assert.equal(byId.card1.balance, -1200);
  assert.equal(byId.card1.credit_limit, 4000);
  assert.equal(byId.card1.credit_limit_source, 'statement');
  assert.equal(byId.card1.minimum_payment, 40);
  assert.equal(byId.loan1.balance, -4500);
  assert.equal(byId.loan1.last_activity, '2026-10-01');
  assert.equal(byId.loan1.apr, 6);
  assert.equal(byId.loan1.minimum_estimated, true);
  assert.equal(loaded.lastCounts.get('cash1'), '2026-10-05');
  assert.equal(loaded.countsReady, true);
  assert.equal(loaded.goalsHeld.get('chk1'), 150);
  assert.deepEqual(loaded.equipment.map((e) => e.id), ['e1']);
  assert.equal(loaded.policies?.length, 1);

  const w = buildWallet({ ...loaded, retirement: null, bookValues: null });
  assert.equal(w.credit.percent, 30);
  assert.equal(w.credit.warn, true);
  assert.equal(w.cash.total, 280 + 100);
  assert.equal(w.loans.loans[0].starting_amount, 5000);
  assert.equal(w.loans.loans[0].owed, 4500);
  // Nothing written by a read.
  assert.equal(db.writes().length, 0);
});

test('loadWalletInput: a loan with no statement pays its last linked payment (33 months, not 82)', async () => {
  const db = new WalletFakeDb();
  db.seed('financial_accounts', [
    { id: 'car', user_id: USER, name: 'Car loan', account_type: 'loan', opening_balance: 9350, interest_rate: 6, is_active: true, currency: 'USD' },
  ]);
  db.seed('financial_transactions', [
    { id: 'p1', user_id: USER, account_id: 'car', type: 'income', amount: 300, transaction_date: '2026-09-30', transfer_group_id: 'g1', transfer_kind: 'loan_payment' },
    { id: 'p2', user_id: USER, account_id: 'car', type: 'income', amount: 50, transaction_date: '2026-10-01', transfer_group_id: null, transfer_kind: null },
  ]);
  const { input: loaded, error } = await loadWalletInput(asClient(db), USER, TODAY, 'USD', { rateFor: async () => null });
  assert.equal(error, null);
  assert.ok(loaded);
  const car = loaded.accounts[0];
  assert.equal(car.minimum_estimated, true);
  assert.equal(car.last_payment, 300);
  assert.equal(car.last_payment_date, '2026-09-30');
  const loan = buildWallet({ ...loaded, retirement: null, bookValues: null }).loans.loans[0];
  assert.equal(loan.owed, 9000);
  assert.equal(loan.minimum, 300);
  assert.equal(loan.at_minimum?.months, 33);

  // Before migration 203 (no transfer_kind) the transfer group still links the payment.
  db.missingColumns = { financial_transactions: ['transfer_kind'] };
  const older = await loadWalletInput(asClient(db), USER, TODAY, 'USD', { rateFor: async () => null });
  assert.equal(older.error, null);
  assert.equal(older.input?.accounts[0].balance, -9000);
  assert.equal(older.input?.accounts[0].last_payment, 300);
  // Before migration 202 (no transfer columns at all) balances still load, with no linked payment.
  db.missingColumns = { financial_transactions: ['transfer_kind', 'transfer_group_id'] };
  const oldest = await loadWalletInput(asClient(db), USER, TODAY, 'USD', { rateFor: async () => null });
  assert.equal(oldest.error, null);
  assert.equal(oldest.input?.accounts[0].balance, -9000);
  assert.equal(oldest.input?.accounts[0].last_payment, null);
});

test('loadWalletInput: works before the statement, count, goal and policy migrations', async () => {
  const db = new WalletFakeDb();
  seedAccounts(db);
  db.missingTables = ['account_statements', 'cash_counts', 'savings_goals', 'savings_allocations', 'insurance_policies'];
  const { input: loaded, error } = await loadWalletInput(asClient(db), USER, TODAY, 'USD', { rateFor: async () => null });
  assert.equal(error, null);
  assert.ok(loaded);
  assert.equal(loaded.countsReady, false);
  assert.equal(loaded.goalsHeld.size, 0);
  assert.equal(loaded.policies, null);
  const w = buildWallet({ ...loaded, retirement: null, bookValues: null });
  assert.equal(w.cash.needs_count, 0);
  assert.equal(w.credit.no_limit_count, 1);
  // The peso pocket has no rate: listed, left out of cash.
  assert.deepEqual(w.unconverted.map((u) => u.id), ['mxn1']);
  assert.equal(w.cash.total, 300);
});

// ── Businesses ───────────────────────────────────────────────────────────────

test('periods: months, quarters and years, newest first, across a year boundary', () => {
  assert.deepEqual(periodOf('2026-02-14', 'month'), { key: '2026-02', label: 'Feb 2026', from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(periodOf('2026-11-30', 'quarter'), { key: '2026-Q4', label: 'Q4 2026', from: '2026-10-01', to: '2026-12-31' });
  assert.equal(periodOf('2024-02-10', 'month').to, '2024-02-29');
  const months = periodsBack('2026-02-14', 'month');
  assert.equal(months.length, 12);
  assert.deepEqual([months[0].key, months[1].key, months[11].key], ['2026-02', '2026-01', '2025-03']);
  assert.deepEqual(periodsBack('2026-02-14', 'quarter').map((p) => p.key).slice(0, 3), ['2026-Q1', '2025-Q4', '2025-Q3']);
  assert.deepEqual(periodsBack('2026-02-14', 'year').map((p) => p.key), ['2026', '2025', '2024', '2023', '2022']);
  assert.equal(cashFlowStart('2026-10-08'), '2022-01-01');
});

const brandRow = (over: Partial<BrandTxnRow> & Pick<BrandTxnRow, 'type' | 'amount' | 'transaction_date'>): BrandTxnRow => ({
  brand_id: 'b1',
  ...over,
});

test('cash flow: money in, out and net per period; transfers and unrated foreign rows are left out', () => {
  const rows = [
    brandRow({ type: 'income', amount: 1000, transaction_date: '2026-10-02' }),
    brandRow({ type: 'expense', amount: 250.5, transaction_date: '2026-10-03' }),
    brandRow({ type: 'expense', amount: 100, transaction_date: '2026-09-30' }),
    // A transfer between your own accounts is neither.
    brandRow({ type: 'expense', amount: 999, transaction_date: '2026-10-04', transfer_group_id: 'tg1' }),
    // Converted at save: the home amount counts.
    brandRow({ type: 'income', amount: 2000, amount_home: 110, currency: 'MXN', transaction_date: '2026-08-10' }),
    // Foreign with no rate: left out, counted.
    brandRow({ type: 'income', amount: 500, currency: 'MXN', transaction_date: '2026-08-11' }),
    // After today: not in any period.
    brandRow({ type: 'income', amount: 7, transaction_date: '2026-10-20' }),
  ];
  const monthly = cashFlowTable(rows, 'USD', TODAY, 'month');
  assert.equal(monthly.rows.length, 12);
  assert.deepEqual(monthly.rows[0], { key: '2026-10', label: 'Oct 2026', from: '2026-10-01', to: '2026-10-31', money_in: 1000, money_out: 250.5, net: 749.5 });
  assert.equal(monthly.rows[1].money_out, 100);
  assert.equal(monthly.rows[2].money_in, 110);
  assert.equal(monthly.rows[5].net, 0); // a month with nothing still shows
  assert.deepEqual(monthly.totals, { money_in: 1110, money_out: 350.5, net: 759.5 });
  const quarterly = cashFlowTable(rows, 'USD', TODAY, 'quarter');
  assert.deepEqual([quarterly.rows[0].key, quarterly.rows[0].net], ['2026-Q4', 749.5]);
  assert.deepEqual([quarterly.rows[1].key, quarterly.rows[1].money_in, quarterly.rows[1].money_out], ['2026-Q3', 110, 100]);
  const yearly = cashFlowTable(rows, 'USD', TODAY, 'year');
  assert.equal(yearly.rows[0].net, 759.5);
  const ytd = moneyInOut(rows, 'USD', '2026-01-01', TODAY);
  assert.deepEqual(ytd, { money_in: 1110, money_out: 350.5, net: 759.5, unconverted: 1, transfers: 1 });
});

test("brandOfRow: a transaction's own tag wins, then its account's tag", () => {
  const accountBrands = new Map([['acct-biz', 'b2']]);
  assert.equal(brandOfRow({ brand_id: 'b1', account_id: 'acct-biz' }, accountBrands), 'b1');
  assert.equal(brandOfRow({ brand_id: null, account_id: 'acct-biz' }, accountBrands), 'b2');
  assert.equal(brandOfRow({ brand_id: null, account_id: 'acct-home' }, accountBrands), null);
  assert.equal(brandOfRow({ brand_id: null, account_id: 'acct-biz' }), null);
});

test('openInvoices: sent or overdue, total minus paid, receivables and payables apart', () => {
  assert.deepEqual(
    openInvoices([
      { direction: 'receivable', status: 'sent', total: 1000, amount_paid: 250 },
      { direction: 'receivable', status: 'overdue', total: 300, amount_paid: 0 },
      { direction: 'receivable', status: 'paid', total: 999, amount_paid: 999 },
      { direction: 'receivable', status: 'draft', total: 50, amount_paid: 0 },
      { direction: 'payable', status: 'sent', total: 80, amount_paid: null },
      { direction: 'receivable', status: 'sent', total: 10, amount_paid: 10 },
    ]),
    { owed_to_you: 1050, owed_to_you_count: 2, you_owe: 80, you_owe_count: 1 },
  );
});

function seedBrands(db: WalletFakeDb) {
  db.seed('user_brands', [
    { id: 'b1', user_id: USER, name: 'Studio', dba_name: null, ein: null, color: '#123456', is_active: true },
    { id: 'b2', user_id: USER, name: 'Apparel', dba_name: 'AP', ein: null, color: '#654321', is_active: true },
    { id: 'bx', user_id: OTHER, name: 'Not mine', color: '#000000', is_active: true },
  ]);
}

test('loadBrandTransactions: reads every page, so a P&L past 1000 rows is not cut short', async () => {
  const db = new WalletFakeDb();
  db.seed(
    'financial_transactions',
    Array.from({ length: 1500 }, (_, i) => ({
      id: `r${String(i).padStart(5, '0')}`,
      user_id: USER,
      brand_id: 'b1',
      type: i % 3 === 0 ? 'income' : 'expense',
      amount: 2,
      transaction_date: `2026-0${(i % 9) + 1}-15`,
    })),
  );
  db.seed('financial_transactions', [{ id: 'x', user_id: OTHER, brand_id: 'b1', type: 'income', amount: 1, transaction_date: '2026-05-01' }]);
  const { rows, error } = await loadBrandTransactions(asClient(db), USER, { brandId: 'b1' });
  assert.equal(error, null);
  assert.equal(rows.length, 1500);
  assert.ok(db.calls.filter((c) => c.table === 'financial_transactions').length >= 2);
  const pl = moneyInOut(rows, 'USD');
  assert.deepEqual([pl.money_in, pl.money_out], [1000, 2000]);
  // Window bounds are inclusive.
  const june = await loadBrandTransactions(asClient(db), USER, { brandId: 'b1', from: '2026-06-15', to: '2026-06-15' });
  assert.equal(june.rows.length, 167); // i % 9 === 5 for i < 1500
});

test('loadBrandSummaries: one row per business with this year, open invoices and expected income', async () => {
  const db = new WalletFakeDb();
  seedBrands(db);
  db.seed('financial_transactions', [
    { id: 'i1', user_id: USER, brand_id: 'b1', type: 'income', amount: 5000, transaction_date: '2026-03-01' },
    { id: 'o1', user_id: USER, brand_id: 'b1', type: 'expense', amount: 1200, transaction_date: '2026-04-01' },
    { id: 'old', user_id: USER, brand_id: 'b1', type: 'income', amount: 777, transaction_date: '2025-12-31' }, // last year
    { id: 'i2', user_id: USER, brand_id: 'b2', type: 'income', amount: 300, transaction_date: '2026-09-01' },
    { id: 'p', user_id: USER, brand_id: null, type: 'income', amount: 100000, transaction_date: '2026-09-01' }, // personal
  ]);
  db.seed('invoices', [
    { user_id: USER, brand_id: 'b1', direction: 'receivable', status: 'sent', total: 900, amount_paid: 400 },
    { user_id: USER, brand_id: 'b2', direction: 'payable', status: 'overdue', total: 60, amount_paid: 0 },
  ]);
  db.seed('income_events', [
    { user_id: USER, source_type: 'invoice', source_id: 'x', expected_date: '2026-11-01', expected_amount: 2500, brand_id: 'b1', is_active: true },
    { user_id: USER, source_type: 'invoice', source_id: 'y', expected_date: '2027-03-01', expected_amount: 9999, brand_id: 'b1', is_active: true }, // beyond 90 days
  ]);
  const { summaries, error } = await loadBrandSummaries(asClient(db), USER, TODAY, 'USD');
  assert.equal(error, null);
  assert.ok(summaries);
  assert.deepEqual(summaries.brands.map((b) => b.name), ['Apparel', 'Studio']);
  const studio = summaries.brands.find((b) => b.id === 'b1')!;
  assert.deepEqual([studio.this_year.money_in, studio.this_year.money_out, studio.this_year.net], [5000, 1200, 3800]);
  assert.equal(studio.invoices.owed_to_you, 500);
  assert.equal(studio.expected_income, 2500);
  assert.equal(studio.expected_income_count, 1);
  const apparel = summaries.brands.find((b) => b.id === 'b2')!;
  assert.equal(apparel.invoices.you_owe, 60);
  assert.deepEqual(summaries.totals, { money_in: 5300, money_out: 1200, net: 4100, unconverted: 0 });
});

test("loadBrandPage: cash flow tables, tag counts, and nothing for someone else's business", async () => {
  const db = new WalletFakeDb();
  seedBrands(db);
  db.seed('financial_transactions', [
    { id: 'i1', user_id: USER, brand_id: 'b1', type: 'income', amount: 5000, transaction_date: '2026-03-01' },
    { id: 'i0', user_id: USER, brand_id: 'b1', type: 'income', amount: 700, transaction_date: '2023-06-01' },
    { id: 'o1', user_id: USER, brand_id: 'b1', type: 'expense', amount: 1200, transaction_date: '2026-09-01' },
  ]);
  db.seed('trips', [{ id: 'tr', user_id: USER, brand_id: 'b1' }]);
  const { page, error } = await loadBrandPage(asClient(db), USER, 'b1', TODAY, 'USD');
  assert.equal(error, null);
  assert.ok(page);
  assert.deepEqual([page.this_year.money_in, page.this_year.money_out], [5000, 1200]);
  assert.equal(page.cash_flow.month.rows.length, 12);
  assert.equal(page.cash_flow.quarter.rows.length, 8);
  assert.deepEqual(page.cash_flow.year.rows.map((r) => [r.key, r.net]), [['2026', 3800], ['2025', 0], ['2024', 0], ['2023', 700], ['2022', 0]]);
  assert.deepEqual(page.tagged, { transactions: 3, invoices: 0, trips: 1 });
  const theirs = await loadBrandPage(asClient(db), USER, 'bx', TODAY, 'USD');
  assert.equal(theirs.page, null);
  assert.equal(theirs.error, null);
});
