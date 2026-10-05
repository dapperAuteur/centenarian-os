// tests/unit/fx.test.ts
// Unit tests for multi-currency finance (lib/finance/fx/): conversion and rounding, cross rates
// through USD, manual-over-fetched precedence, nearest-date lookup, the providers' parsing, the
// rate service against the in-memory fake database with a fake fetch, the exchange plan, and the
// totals helper.
// Run: npm run test:unit
//
// Every rate here is made up. Nothing touches a database or the network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  convert,
  crossRate,
  daysBetween,
  exchangeMath,
  formatRate,
  normalizeCurrency,
  pickNearestEarlier,
  roundCents,
} from '../../lib/finance/fx/math.ts';
import { resolveRate } from '../../lib/finance/fx/resolve.ts';
import type { RateRow } from '../../lib/finance/fx/resolve.ts';
import { fetchFrankfurter, fetchOpenErApi } from '../../lib/finance/fx/providers.ts';
import type { FetchLike } from '../../lib/finance/fx/providers.ts';
import { getRate, refreshLatest, resetFetchThrottle, saveManualRate, storeFetched } from '../../lib/finance/fx/rates.ts';
import { backfillHomeAmounts, fxFieldsFor } from '../../lib/finance/fx/server.ts';
import { planExchange } from '../../lib/finance/fx/exchange.ts';
import { amountForTotals, toHomeAmounts, withOptionalFx } from '../../lib/finance/fx/totals.ts';
import { FakeDb } from './fake-supabase.ts';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function asDb(db: FakeDb): SupabaseClient {
  return db as unknown as SupabaseClient;
}

function fetched(quote: string, rate: number, rate_date: string, source: RateRow['source'] = 'frankfurter'): RateRow {
  return { base: 'USD', quote, rate, rate_date, source, user_id: null };
}

function manual(base: string, quote: string, rate: number, rate_date: string, user_id = USER): RateRow {
  return { base, quote, rate, rate_date, source: 'manual', user_id };
}

/** A fetch that answers from a table of URL prefixes and records what was asked. */
function fakeFetch(routes: Record<string, unknown>): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(url);
    const key = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    if (!key) return { ok: false, status: 404, json: async () => ({ message: 'not found' }) };
    return { ok: true, status: 200, json: async () => routes[key] };
  }) as FetchLike & { calls: string[] };
  fn.calls = calls;
  return fn;
}

// ── math ────────────────────────────────────────────────────────────────────

test('normalizeCurrency accepts three letters only', () => {
  assert.equal(normalizeCurrency(' eur '), 'EUR');
  assert.equal(normalizeCurrency('EURO'), null);
  assert.equal(normalizeCurrency('E1R'), null);
  assert.equal(normalizeCurrency(42), null);
});

test('roundCents rounds half away from zero without float drift', () => {
  assert.equal(roundCents(1.005), 1.01);
  assert.equal(roundCents(2.675), 2.68);
  assert.equal(roundCents(-1.005), -1.01);
  assert.equal(roundCents(10), 10);
});

test('convert keeps rate precision and rounds only the result', () => {
  // 1,000 JPY at 0.0063291 USD each = 6.3291 -> 6.33
  assert.equal(convert(1000, 0.0063291), 6.33);
  assert.equal(convert(123.45, 1), 123.45);
});

test('crossRate goes through USD', () => {
  // 1 USD = 0.86 EUR, 1 USD = 18.15 MXN -> 1 EUR = 21.1046... MXN
  const eurToMxn = crossRate(0.86, 18.15);
  assert.ok(Math.abs(eurToMxn - 18.15 / 0.86) < 1e-12);
  assert.throws(() => crossRate(0, 1));
});

test('pickNearestEarlier never looks forward and honours the age limit', () => {
  const rows = [
    { rate: 1, rate_date: '2026-09-01' },
    { rate: 2, rate_date: '2026-09-04' },
    { rate: 3, rate_date: '2026-09-10' },
  ];
  assert.equal(pickNearestEarlier(rows, '2026-09-06')?.rate, 2);
  assert.equal(pickNearestEarlier(rows, '2026-09-04')?.rate, 2);
  assert.equal(pickNearestEarlier(rows, '2026-08-31'), null);
  assert.equal(pickNearestEarlier(rows, '2026-09-15', 7)?.rate, 3);
  assert.equal(pickNearestEarlier(rows, '2026-09-30', 7), null);
  assert.equal(daysBetween('2026-09-01', '2026-09-08'), 7);
});

test('formatRate shows small and large rates readably', () => {
  assert.equal(formatRate(18.1498), '18.1498');
  assert.equal(formatRate(0.0000623), '0.00006230');
});

// ── resolve: precedence and dates ───────────────────────────────────────────

test('same currency is rate 1', () => {
  const { resolved } = resolveRate([], 'EUR', 'EUR', '2026-09-01');
  assert.equal(resolved?.rate, 1);
  assert.equal(resolved?.source, 'identity');
});

test('fetched USD->X is used directly and inverted for X->USD', () => {
  const rows = [fetched('EUR', 0.8, '2026-09-04')];
  assert.equal(resolveRate(rows, 'USD', 'EUR', '2026-09-05').resolved?.rate, 0.8);
  const back = resolveRate(rows, 'EUR', 'USD', '2026-09-05').resolved;
  assert.equal(back?.rate, 1.25);
  assert.equal(back?.source, 'frankfurter');
  assert.equal(back?.rate_date, '2026-09-04');
});

test('cross rate between two non-USD currencies uses both USD legs', () => {
  const rows = [fetched('EUR', 0.8, '2026-09-04'), fetched('MXN', 18, '2026-09-03')];
  const r = resolveRate(rows, 'EUR', 'MXN', '2026-09-05').resolved;
  assert.equal(r?.rate, 22.5);
  assert.equal(r?.rate_date, '2026-09-03', 'reports the older leg');
});

test('a manual rate beats a fetched rate, even a newer one', () => {
  const rows = [fetched('MXN', 18.2, '2026-09-10'), manual('USD', 'MXN', 17.5, '2026-09-01')];
  const r = resolveRate(rows, 'MXN', 'USD', '2026-09-10').resolved;
  assert.equal(r?.source, 'manual');
  assert.ok(Math.abs((r?.rate ?? 0) - 1 / 17.5) < 1e-12);
});

test('a manual direct pair beats the USD legs, either direction', () => {
  const rows = [fetched('EUR', 0.8, '2026-09-04'), fetched('MXN', 18, '2026-09-04'), manual('MXN', 'EUR', 0.05, '2026-09-02')];
  const r = resolveRate(rows, 'EUR', 'MXN', '2026-09-05').resolved;
  assert.equal(r?.source, 'manual');
  assert.equal(r?.rate, 20);
});

test('a manual rate dated after the transaction is not used', () => {
  const rows = [fetched('MXN', 18, '2026-09-01'), manual('USD', 'MXN', 17, '2026-09-20')];
  assert.equal(resolveRate(rows, 'USD', 'MXN', '2026-09-05').resolved?.source, 'frankfurter');
});

test('fetched rates older than 7 days are missing unless stale is allowed', () => {
  const rows = [fetched('JPY', 150, '2026-08-01')];
  const fresh = resolveRate(rows, 'USD', 'JPY', '2026-09-01');
  assert.equal(fresh.resolved, null);
  assert.deepEqual(fresh.missing, ['JPY']);
  const stale = resolveRate(rows, 'USD', 'JPY', '2026-09-01', { allowStale: true }).resolved;
  assert.equal(stale?.rate, 150);
  assert.equal(stale?.stale, true);
});

test('on the same date Frankfurter is preferred over ExchangeRate-API', () => {
  const rows = [fetched('EUR', 0.81, '2026-09-04', 'open_er_api'), fetched('EUR', 0.8, '2026-09-04')];
  assert.equal(resolveRate(rows, 'USD', 'EUR', '2026-09-04').resolved?.source, 'frankfurter');
});

test("another user's manual rate is never in the rows the service loads", async () => {
  const db = new FakeDb();
  db.seed('exchange_rates', [manual('USD', 'MXN', 5, '2026-09-01', OTHER), fetched('MXN', 18, '2026-09-01')]);
  const { rate } = await getRate(asDb(db), USER, 'USD', 'MXN', '2026-09-02', { allowFetch: false });
  assert.equal(rate?.rate, 18);
});

// ── providers ───────────────────────────────────────────────────────────────

test('fetchFrankfurter reads the business date and drops junk values', async () => {
  const f = fakeFetch({
    'https://api.frankfurter.dev/v1/2026-09-05': { amount: 1, base: 'USD', date: '2026-09-04', rates: { EUR: 0.86044, MXN: 'x' } },
  });
  const r = await fetchFrankfurter('2026-09-05', ['EUR', 'MXN'], f);
  assert.equal(r?.rate_date, '2026-09-04');
  assert.deepEqual(r?.rates, { EUR: 0.86044 });
  assert.match(f.calls[0], /base=USD&symbols=EUR,MXN$/);
});

test('fetchOpenErApi requires result=success and dates from the update time', async () => {
  const ok = fakeFetch({
    'https://open.er-api.com/': { result: 'success', time_last_update_unix: 1791158551, rates: { USD: 1, VND: 26000 } },
  });
  const r = await fetchOpenErApi(ok);
  assert.equal(r?.rate_date, '2026-10-05');
  assert.deepEqual(r?.rates, { VND: 26000 });
  const bad = fakeFetch({ 'https://open.er-api.com/': { result: 'error' } });
  assert.equal(await fetchOpenErApi(bad), null);
});

// ── rate service against the fake db ───────────────────────────────────────

test('getRate fetches a missing leg, falls back to open.er-api, and caches both', async () => {
  resetFetchThrottle();
  const db = new FakeDb();
  const f = fakeFetch({
    'https://api.frankfurter.dev/v1/latest': { amount: 1, base: 'USD', date: '2026-10-05', rates: { EUR: 0.89 } },
    'https://open.er-api.com/': { result: 'success', time_last_update_unix: 1791158551, rates: { VND: 26000, EUR: 0.9 } },
  });
  const deps = { fetchImpl: f, today: '2026-10-05' };

  const eur = await getRate(asDb(db), USER, 'EUR', 'USD', '2026-10-05', deps);
  assert.ok(Math.abs((eur.rate?.rate ?? 0) - 1 / 0.89) < 1e-12);
  assert.equal(eur.rate?.source, 'frankfurter');
  assert.equal(f.calls.filter((u) => u.includes('open.er-api')).length, 0, 'no fallback when Frankfurter has it');

  const vnd = await getRate(asDb(db), USER, 'VND', 'USD', '2026-10-05', deps);
  assert.equal(vnd.rate?.source, 'open_er_api');
  const stored = db.rows('exchange_rates');
  assert.deepEqual(stored.map((r) => `${r.quote}:${r.source}`).sort(), ['EUR:frankfurter', 'VND:open_er_api']);
  assert.ok(stored.every((r) => r.user_id === null && r.base === 'USD'));

  // Cached now: no new request.
  const before = f.calls.length;
  await getRate(asDb(db), USER, 'EUR', 'USD', '2026-10-05', deps);
  assert.equal(f.calls.length, before);
});

test('getRate asks Frankfurter for the historical date of a past transaction', async () => {
  resetFetchThrottle();
  const db = new FakeDb();
  const f = fakeFetch({
    'https://api.frankfurter.dev/v1/2026-09-06': { amount: 1, base: 'USD', date: '2026-09-04', rates: { EUR: 0.86 } },
  });
  const { rate } = await getRate(asDb(db), USER, 'EUR', 'USD', '2026-09-06', { fetchImpl: f, today: '2026-10-05' });
  assert.equal(rate?.rate_date, '2026-09-04');
  assert.match(f.calls[0], /\/v1\/2026-09-06\?/);
});

test('getRate returns null for a currency no source covers and no manual rate', async () => {
  resetFetchThrottle();
  const db = new FakeDb();
  const f = fakeFetch({});
  const { rate, error } = await getRate(asDb(db), USER, 'XAA', 'USD', '2026-10-05', { fetchImpl: f, today: '2026-10-05' });
  assert.equal(rate, null);
  assert.equal(error, null);
});

test('storeFetched skips rows already cached', async () => {
  const db = new FakeDb();
  db.seed('exchange_rates', [fetched('EUR', 0.8, '2026-09-04')]);
  const { stored } = await storeFetched(asDb(db), [{ source: 'frankfurter', rate_date: '2026-09-04', rates: { EUR: 0.8, JPY: 150 } }]);
  assert.equal(stored, 1);
  assert.equal(db.rows('exchange_rates').length, 2);
});

test('saveManualRate replaces the same day instead of adding a second row', async () => {
  const db = new FakeDb();
  await saveManualRate(asDb(db), USER, { base: 'USD', quote: 'MXN', rate: 17.5, rate_date: '2026-09-01' });
  await saveManualRate(asDb(db), USER, { base: 'USD', quote: 'MXN', rate: 17.8, rate_date: '2026-09-01' });
  const rows = db.rows('exchange_rates');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rate, 17.8);
  assert.equal(rows[0].source, 'manual');
  assert.equal(rows[0].user_id, USER);
});

test('fxFieldsFor: home rows get nulls, foreign rows get rate and cents', async () => {
  const db = new FakeDb();
  db.seed('exchange_rates', [manual('USD', 'MXN', 17.5, '2026-09-01')]);
  const home = await fxFieldsFor(asDb(db), USER, 'USD', 'USD', 10, '2026-09-02', { allowFetch: false });
  assert.deepEqual(home.fields, { currency: null, fx_rate: null, amount_home: null });
  const mxn = await fxFieldsFor(asDb(db), USER, 'MXN', 'USD', 350, '2026-09-02', { allowFetch: false });
  assert.equal(mxn.fields.currency, 'MXN');
  assert.equal(mxn.fields.amount_home, 20);
  assert.equal(mxn.fields.fx_rate, 0.05714286, 'stored at 8 decimals');
  const none = await fxFieldsFor(asDb(db), USER, 'JPY', 'USD', 1000, '2026-09-02', { allowFetch: false });
  assert.deepEqual(none.fields, { currency: 'JPY', fx_rate: null, amount_home: null });
});

test('backfillHomeAmounts fills foreign-account rows only', async () => {
  resetFetchThrottle();
  const db = new FakeDb();
  db.seed('profiles', [{ id: USER, home_currency: null }]);
  db.seed('financial_accounts', [
    { id: 'acct-usd', user_id: USER, currency: 'USD' },
    { id: 'acct-mxn', user_id: USER, currency: 'MXN' },
  ]);
  db.seed('exchange_rates', [manual('USD', 'MXN', 20, '2026-09-01')]);
  db.seed('financial_transactions', [
    { id: 't1', user_id: USER, account_id: 'acct-mxn', amount: 100, currency: null, amount_home: null, transaction_date: '2026-09-03' },
    { id: 't2', user_id: USER, account_id: 'acct-usd', amount: 100, currency: null, amount_home: null, transaction_date: '2026-09-03' },
  ]);
  const res = await backfillHomeAmounts(asDb(db), USER, { deps: { allowFetch: false } });
  assert.equal(res.updated, 1);
  const [t1, t2] = db.rows('financial_transactions');
  assert.equal(t1.amount_home, 5);
  assert.equal(t1.currency, 'MXN');
  assert.equal(t2.amount_home, null);
});

test('refreshLatest skips codes already fetched today or yesterday', async () => {
  const db = new FakeDb();
  db.seed('exchange_rates', [fetched('EUR', 0.89, '2026-10-04')]);
  const f = fakeFetch({
    'https://api.frankfurter.dev/v1/latest': { amount: 1, base: 'USD', date: '2026-10-05', rates: { JPY: 158 } },
    'https://open.er-api.com/': { result: 'error' },
  });
  const res = await refreshLatest(asDb(db), ['USD', 'EUR', 'JPY', 'XAA'], { fetchImpl: f, today: '2026-10-05' });
  assert.deepEqual(res.skipped, ['EUR']);
  assert.deepEqual(res.checked, ['JPY', 'XAA']);
  assert.deepEqual(res.uncovered, ['XAA']);
  assert.equal(res.stored, 1);
  assert.match(f.calls[0], /symbols=JPY,XAA$/);
});

// ── exchange ────────────────────────────────────────────────────────────────

test('exchangeMath derives the rate from what was sent and received', () => {
  const m = exchangeMath({ sent: 200, received: 3500, fee: 5 });
  assert.equal(m.rate, 17.5);
  assert.equal(m.total_cost, 205);
  assert.ok(Math.abs(m.effective_rate - 3500 / 205) < 1e-12);
  assert.throws(() => exchangeMath({ sent: 0, received: 10 }));
  assert.throws(() => exchangeMath({ sent: 10, received: 10, fee: -1 }));
});

test('planExchange from USD: pair carries the USD value, fee is a separate expense', () => {
  const plan = planExchange({
    from: { id: 'usd', name: 'Checking', currency: 'USD' },
    to: { id: 'mxn', name: 'Pesos', currency: 'MXN' },
    home: 'USD',
    sent: 200,
    received: 3500,
    fee: 5,
  });
  const [out, inn, fee] = plan.rows;
  assert.equal(out.type, 'expense');
  assert.equal(out.amount, 200);
  assert.equal(out.amount_home, null, 'already home currency');
  assert.equal(inn.type, 'income');
  assert.equal(inn.amount, 3500);
  assert.equal(inn.currency, 'MXN');
  assert.equal(inn.amount_home, 200);
  assert.ok(Math.abs((inn.fx_rate ?? 0) - 200 / 3500) < 1e-12);
  assert.equal(fee.is_transfer_side, false);
  assert.equal(fee.amount, 5);
  assert.deepEqual(plan.manualRate, { base: 'USD', quote: 'MXN', rate: 17.5 });
});

test('planExchange back to USD values both sides at what was received', () => {
  const plan = planExchange({
    from: { id: 'mxn', name: 'Pesos', currency: 'MXN' },
    to: { id: 'usd', name: 'Cash', currency: 'USD' },
    home: 'USD',
    sent: 1000,
    received: 52.5,
  });
  assert.equal(plan.rows.length, 2);
  assert.equal(plan.rows[0].amount_home, 52.5);
  assert.equal(plan.rows[1].amount_home, null);
});

test('planExchange between two foreign currencies uses the source rate to home', () => {
  const plan = planExchange({
    from: { id: 'eur', name: 'Euros', currency: 'EUR' },
    to: { id: 'mxn', name: 'Pesos', currency: 'MXN' },
    home: 'USD',
    sent: 100,
    received: 2100,
    fee: 2,
    sourceToHome: 1.1234,
  });
  assert.equal(plan.rows[0].amount_home, 112.34);
  assert.equal(plan.rows[1].amount_home, 112.34);
  assert.equal(plan.rows[2].amount_home, 2.25);
});

test('planExchange refuses same-currency accounts', () => {
  assert.throws(
    () => planExchange({
      from: { id: 'a', name: 'A', currency: 'USD' },
      to: { id: 'b', name: 'B', currency: 'USD' },
      home: 'USD',
      sent: 1,
      received: 1,
    }),
    /same currency/,
  );
});

// ── totals ──────────────────────────────────────────────────────────────────

test('amountForTotals: amount_home first, home rows as is, unconverted foreign rows null', () => {
  assert.equal(amountForTotals({ amount: '3500', amount_home: '200.00', currency: 'MXN' }, 'USD'), 200);
  assert.equal(amountForTotals({ amount: '12.5' }, 'USD'), 12.5, 'pre-210 row');
  assert.equal(amountForTotals({ amount: 1000, financial_accounts: { currency: 'JPY' } }, 'USD'), null);
  assert.equal(amountForTotals({ amount: 1000, financial_accounts: [{ currency: 'USD' }] }, 'USD'), 1000);
  assert.equal(amountForTotals({ amount: 10, currency: 'EUR', financial_accounts: { currency: 'EUR' } }, 'EUR'), 10);
});

test('toHomeAmounts swaps amounts and counts the unconverted', () => {
  const { rows, unconverted } = toHomeAmounts(
    [
      { id: 'a', amount: 10 },
      { id: 'b', amount: 3500, amount_home: 200, currency: 'MXN' },
      { id: 'c', amount: 1000, currency: 'JPY' },
    ],
    'USD',
  );
  assert.deepEqual(rows.map((r) => [r.id, r.amount]), [['a', 10], ['b', 200]]);
  assert.equal(unconverted, 1);
});

test('withOptionalFx retries without the FX columns before migration 210', async () => {
  const seen: boolean[] = [];
  const res = await withOptionalFx(async (fx) => {
    seen.push(fx);
    return fx
      ? { data: null, error: { code: '42703', message: 'column financial_transactions.amount_home does not exist' } }
      : { data: [], error: null };
  });
  assert.deepEqual(seen, [true, false]);
  assert.equal(res.error, null);
});
