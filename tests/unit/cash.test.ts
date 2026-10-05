// tests/unit/cash.test.ts
// Unit tests for cash on hand (lib/finance/cash/): counting cash against the
// recorded balance (the adjustment, denominations, history and undo, before and
// after migration 213), how fresh a count is, the default cash account, and the
// cash-withdrawal wording the statement import reads.
// Run: npm run test:unit
//
// Every account, amount, description and id here is SYNTHETIC. Nothing touches a database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CASH_COUNT_TAG,
  CASH_FOUND,
  CashRuleError,
  UNRECORDED_SPENDING,
  countFreshness,
  defaultCashAccount,
  parseCountInput,
  planAdjustment,
} from '../../lib/finance/cash/logic.ts';
import {
  cleanDenominationCounts,
  denominationLabel,
  denominationTotalCents,
  denominationsFor,
} from '../../lib/finance/cash/denominations.ts';
import { isCashWithdrawalText } from '../../lib/finance/cash/withdrawal.ts';
import {
  CASH_NOT_READY,
  listCounts,
  loadCashOverview,
  recordCashCount,
  undoLatestCount,
} from '../../lib/finance/cash/server.ts';
import { FakeDb } from './fake-supabase.ts';
import type { Row } from './fake-supabase.ts';

const asDb = (fake: FakeDb) => fake as unknown as SupabaseClient;
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '99999999-9999-4999-8999-999999999999';
const WALLET = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PESOS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CHECKING = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DINING = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TODAY = '2026-10-05';

// ── The adjustment ────────────────────────────────────────────────────────

test('planAdjustment: less cash than recorded is unrecorded spending, more is cash found, equal is nothing', () => {
  assert.deepEqual(planAdjustment(10000, 8450), {
    differenceCents: -1550,
    adjustment: { type: 'expense', amountCents: 1550, description: UNRECORDED_SPENDING },
  });
  assert.deepEqual(planAdjustment(10000, 10020), {
    differenceCents: 20,
    adjustment: { type: 'income', amountCents: 20, description: CASH_FOUND },
  });
  assert.deepEqual(planAdjustment(10000, 10000), { differenceCents: 0, adjustment: null });
  // A recorded balance below zero (spending entered with no cash recorded) still closes to the count.
  assert.deepEqual(planAdjustment(-500, 0).adjustment, { type: 'income', amountCents: 500, description: CASH_FOUND });
});

test('countFreshness: never counted, fresh up to 30 days, stale after', () => {
  assert.deepEqual(countFreshness(null, TODAY), { status: 'never', days: null });
  assert.deepEqual(countFreshness('2026-10-05', TODAY), { status: 'fresh', days: 0 });
  assert.deepEqual(countFreshness('2026-09-05', TODAY), { status: 'fresh', days: 30 });
  assert.deepEqual(countFreshness('2026-09-04', TODAY), { status: 'stale', days: 31 });
  assert.deepEqual(countFreshness('2026-09-04T23:00:00.000Z', TODAY), { status: 'stale', days: 31 });
});

test('defaultCashAccount: remembered, then last used, then the first; active and in the currency asked', () => {
  const accounts = [
    { id: 'a', currency: 'USD' },
    { id: 'b', currency: 'MXN' },
    { id: 'c', currency: 'USD', is_active: false },
    { id: 'd', currency: 'USD' },
  ];
  assert.equal(defaultCashAccount(accounts, { remembered: 'd', lastUsed: 'a' })?.id, 'd');
  assert.equal(defaultCashAccount(accounts, { remembered: 'gone', lastUsed: 'b' })?.id, 'b');
  assert.equal(defaultCashAccount(accounts, { remembered: 'c' })?.id, 'a', 'an inactive account is never the default');
  assert.equal(defaultCashAccount(accounts, { lastUsed: 'b', currency: 'USD' })?.id, 'a');
  assert.equal(defaultCashAccount(accounts, { currency: 'EUR' }), null);
  assert.equal(defaultCashAccount([]), null);
});

// ── Denominations ─────────────────────────────────────────────────────────

test('denominations: lists by currency, cleaned counts and totals in cents', () => {
  assert.deepEqual(denominationsFor('usd')?.slice(0, 3).map((d) => d.cents), [10000, 5000, 2000]);
  assert.ok(denominationsFor('MXN')?.some((d) => d.cents === 50 && d.kind === 'coin'));
  assert.equal(denominationsFor('XYZ'), null);
  const counts = cleanDenominationCounts({ '2000': 3, '25': '4', '1': 0, '300': 2, '500': -1, '100': 1.5 }, 'USD');
  assert.deepEqual(counts, { '2000': 3, '25': 4 });
  assert.equal(denominationTotalCents(counts), 6100);
  assert.equal(cleanDenominationCounts({ '2000': 1 }, 'XYZ'), null);
  assert.equal(cleanDenominationCounts({}, 'USD'), null);
  assert.equal(denominationLabel(2000), '20');
  assert.equal(denominationLabel(25), '0.25');
});

test('parseCountInput: amount or denominations, they must agree, and dates and categories are read', () => {
  const base = { account_id: WALLET };
  assert.equal(parseCountInput({ ...base, counted_amount: '84.50' }, 'USD', TODAY).countedCents, 8450);
  assert.equal(parseCountInput({ ...base, denominations: { '2000': 4, '100': 4, '50': 1 } }, 'USD', TODAY).countedCents, 8450);
  assert.throws(
    () => parseCountInput({ ...base, counted_amount: 80, denominations: { '2000': 4, '100': 1 } }, 'USD', TODAY),
    /add up to a different amount/,
  );
  assert.throws(() => parseCountInput({ ...base }, 'USD', TODAY), CashRuleError);
  assert.throws(() => parseCountInput({ ...base, counted_amount: -1 }, 'USD', TODAY), /below zero/);
  assert.throws(() => parseCountInput({ counted_amount: 1 }, 'USD', TODAY), /Choose the cash account/);
  const full = parseCountInput(
    { ...base, counted_amount: 0, category_id: DINING, counted_on: '2026-10-04', note: '  after the market  ' },
    'USD',
    TODAY,
  );
  assert.deepEqual(full, {
    accountId: WALLET,
    countedCents: 0,
    denominations: null,
    categoryId: DINING,
    countedOn: '2026-10-04',
    note: 'after the market',
  });
  assert.equal(parseCountInput({ ...base, counted_amount: 1, counted_on: '2026-02-30' }, 'USD', TODAY).countedOn, TODAY);
});

// ── Counting against the fake database ────────────────────────────────────

function seeded(): FakeDb {
  const db = new FakeDb();
  db.seed('financial_accounts', [
    { id: WALLET, user_id: USER, name: 'Wallet', account_type: 'cash', institution_name: null, last_four: null, opening_balance: 100, is_active: true, currency: 'USD' },
    { id: PESOS, user_id: USER, name: 'Pesos', account_type: 'cash', institution_name: null, last_four: null, opening_balance: 0, is_active: true, currency: 'MXN' },
    { id: CHECKING, user_id: USER, name: 'Checking', account_type: 'checking', institution_name: 'Desert CU', last_four: '2222', opening_balance: 500, is_active: true, currency: 'USD' },
  ]);
  db.seed('financial_transactions', [
    { user_id: USER, account_id: WALLET, type: 'expense', amount: 12.5, transaction_date: '2026-10-01', description: 'Tacos' },
    { user_id: USER, account_id: WALLET, type: 'income', amount: 40, transaction_date: '2026-10-02', description: 'Cash withdrawal from Checking' },
    { user_id: OTHER, account_id: WALLET, type: 'expense', amount: 999, transaction_date: '2026-10-02', description: 'Not mine' },
  ]);
  db.seed('budget_categories', [{ id: DINING, user_id: USER, name: 'Dining' }]);
  db.seed('cash_counts', []);
  return db;
}

const txns = (db: FakeDb) => db.rows('financial_transactions');

test('count: less cash than recorded adds one "Unrecorded cash spending" expense, tagged, and keeps the count', async () => {
  const db = seeded();
  // Recorded: 100 + 40 - 12.50 = 127.50. Counted 120.
  const result = await recordCashCount(asDb(db), USER, { account_id: WALLET, counted_amount: 120, category_id: DINING }, TODAY);
  assert.deepEqual(result.adjustment, { type: 'expense', amount: 7.5, description: UNRECORDED_SPENDING });
  const adj = txns(db).find((r) => r.id === result.adjustment_transaction_id) as Row;
  assert.equal(adj.account_id, WALLET);
  assert.equal(adj.type, 'expense');
  assert.equal(adj.amount, 7.5);
  assert.equal(adj.category_id, DINING);
  assert.deepEqual(adj.tags, [CASH_COUNT_TAG]);
  assert.equal(adj.transaction_date, TODAY);
  assert.equal(adj.source, 'manual');
  assert.equal(result.count.counted_amount, 120);
  assert.equal(result.count.recorded_balance, 127.5);
  assert.equal(result.count.difference, -7.5);
  assert.equal(result.count.adjustment_transaction_id, adj.id);

  const overview = (await loadCashOverview(asDb(db), USER, TODAY)).overview!;
  const wallet = overview.accounts.find((a) => a.id === WALLET)!;
  assert.equal(wallet.balance, 120, 'the balance now matches the count');
  assert.equal(wallet.count_status, 'fresh');
  assert.equal(wallet.last_count?.id, result.count.id);
});

test('count: more cash than recorded is "Cash found" income with no category by default; a match adds nothing', async () => {
  const db = seeded();
  const found = await recordCashCount(asDb(db), USER, { account_id: WALLET, denominations: { '10000': 1, '2000': 1, '1000': 1 } }, TODAY);
  assert.deepEqual(found.adjustment, { type: 'income', amount: 2.5, description: CASH_FOUND });
  assert.equal((txns(db).find((r) => r.id === found.adjustment_transaction_id) as Row).category_id, null);
  assert.deepEqual(found.count.denominations, { '10000': 1, '2000': 1, '1000': 1 });

  const before = txns(db).length;
  db.tick(60_000);
  const same = await recordCashCount(asDb(db), USER, { account_id: WALLET, counted_amount: 130 }, TODAY);
  assert.equal(same.adjustment, null);
  assert.equal(same.adjustment_transaction_id, null);
  assert.equal(txns(db).length, before);
  assert.equal((await listCounts(asDb(db), USER, WALLET)).counts.length, 2);
});

test('count: refused for another person\'s or a non-cash account, an unknown category, and before migration 213', async () => {
  const db = seeded();
  await assert.rejects(recordCashCount(asDb(db), OTHER, { account_id: WALLET, counted_amount: 1 }, TODAY), /not found/);
  await assert.rejects(recordCashCount(asDb(db), USER, { account_id: CHECKING, counted_amount: 1 }, TODAY), /not found/);
  await assert.rejects(
    recordCashCount(asDb(db), USER, { account_id: WALLET, counted_amount: 1, category_id: 'nope' }, TODAY),
    /category was not found/,
  );
  assert.equal(txns(db).length, 3, 'nothing was written');

  const old = seeded();
  old.missingTables = ['cash_counts'];
  await assert.rejects(
    recordCashCount(asDb(old), USER, { account_id: WALLET, counted_amount: 1 }, TODAY),
    (err: unknown) => err instanceof CashRuleError && err.status === 503 && err.code === CASH_NOT_READY.code,
  );
  assert.equal(txns(old).length, 3, 'no adjustment before the table exists');
  const overview = (await loadCashOverview(asDb(old), USER, TODAY)).overview!;
  assert.equal(overview.ready, false);
  assert.deepEqual(overview.accounts.map((a) => [a.name, a.count_status]), [['Wallet', 'never'], ['Pesos', 'never']]);
  assert.deepEqual(await listCounts(asDb(old), USER, WALLET), { counts: [], ready: false, error: null });
});

test('count: a failed count insert takes the adjustment back out', async () => {
  const db = seeded();
  db.rejectInsert = (table) => (table === 'cash_counts' ? { code: '23514', message: 'check violation' } : null);
  await assert.rejects(recordCashCount(asDb(db), USER, { account_id: WALLET, counted_amount: 1 }, TODAY), /Couldn't save the count/);
  assert.equal(txns(db).length, 3);
});

test('count: a foreign-currency account gets the FX fields for the adjustment', async () => {
  const db = seeded();
  const result = await recordCashCount(
    asDb(db),
    USER,
    { account_id: PESOS, counted_amount: 50 },
    TODAY,
    async (currency, amount) => ({ currency, fx_rate: 0.05, amount_home: amount * 0.05 }),
  );
  const adj = txns(db).find((r) => r.id === result.adjustment_transaction_id) as Row;
  assert.equal(adj.currency, 'MXN');
  assert.equal(adj.amount_home, 2.5);
  assert.equal(result.count.currency, 'MXN');
});

test('undo: only the latest count, and it deletes the adjustment so the balance goes back', async () => {
  const db = seeded();
  const first = await recordCashCount(asDb(db), USER, { account_id: WALLET, counted_amount: 120 }, TODAY);
  db.tick(60_000);
  const second = await recordCashCount(asDb(db), USER, { account_id: WALLET, counted_amount: 110 }, TODAY);
  await assert.rejects(undoLatestCount(asDb(db), USER, first.count.id), /Only the latest count/);
  await assert.rejects(undoLatestCount(asDb(db), OTHER, second.count.id), /not found/);

  const undone = await undoLatestCount(asDb(db), USER, second.count.id);
  assert.equal(undone.adjustmentDeleted, true);
  assert.equal(txns(db).some((r) => r.id === second.adjustment_transaction_id), false);
  let wallet = (await loadCashOverview(asDb(db), USER, TODAY)).overview!.accounts.find((a) => a.id === WALLET)!;
  assert.equal(wallet.balance, 120);
  assert.equal(wallet.last_count?.id, first.count.id);

  await undoLatestCount(asDb(db), USER, first.count.id);
  wallet = (await loadCashOverview(asDb(db), USER, TODAY)).overview!.accounts.find((a) => a.id === WALLET)!;
  assert.equal(wallet.balance, 127.5);
  assert.equal(wallet.count_status, 'never');
});

test('overview: cash accounts only, last used, and amber after 30 days', async () => {
  const db = seeded();
  db.seed('cash_counts', [
    { user_id: USER, account_id: PESOS, counted_amount: 0, recorded_balance: 0, difference: 0, currency: 'MXN', counted_on: '2026-08-01', counted_at: '2026-08-01T15:00:00.000Z' },
  ]);
  db.tick(1000);
  db.seed('financial_transactions', [
    { user_id: USER, account_id: PESOS, type: 'expense', amount: 35, transaction_date: '2026-10-03', description: 'Elote' },
  ]);
  const overview = (await loadCashOverview(asDb(db), USER, TODAY)).overview!;
  assert.equal(overview.ready, true);
  assert.deepEqual(overview.accounts.map((a) => a.id), [WALLET, PESOS]);
  assert.equal(overview.last_used_account_id, PESOS);
  const pesos = overview.accounts.find((a) => a.id === PESOS)!;
  assert.equal(pesos.balance, -35);
  assert.equal(pesos.count_status, 'stale');
  assert.equal(pesos.days_since_count, 65);
});

// ── Cash-withdrawal wording ───────────────────────────────────────────────

test('isCashWithdrawalText: ATM, branch, teller and Spanish withdrawals; cash back only as its own line', () => {
  const yes = [
    'ATM WITHDRAWAL 1234 MAIN ST TUCSON AZ',
    'NON-CHASE ATM WITHDRAW 09/14',
    'ATM W/D #0042',
    'CASH WITHDRAWAL',
    'Withdrawal at Branch',
    'WITHDRAWAL AT BRANCH 0042',
    'TELLER WITHDRAWAL',
    'Over the counter withdrawal',
    'RETIRO EN CAJERO AUTOMÁTICO',
    'RETIRO DE EFECTIVO',
    'CAJERO AUTOMATICO BBVA 0457',
    'DISPOSICION DE EFECTIVO',
    'CASH BACK',
    'CASHBACK 40.00',
  ];
  const no = [
    'ATM FEE',
    'NON-NETWORK ATM SURCHARGE',
    'ATM FEE REBATE',
    'ATM DEPOSIT',
    'COMISION RETIRO CAJERO',
    'IVA COMISION CAJERO',
    'RETIRO SPEI ENVIADO',
    'RETIRO POR TRANSFERENCIA',
    'POS PURCHASE WITH CASH BACK SAMPLE MART',
    'ATM CARD PURCHASE SAMPLE MART',
    'CASH BACK REWARDS REDEMPTION',
    'Withdrawal Debit Card SAMPLE MART',
    'USER INITIATED WITHDRAWAL',
    'ONLINE TRANSFER TO SAVINGS',
    '',
  ];
  for (const text of yes) assert.equal(isCashWithdrawalText(text), true, text);
  for (const text of no) assert.equal(isCashWithdrawalText(text), false, text);
});
