// tests/unit/find-similar.test.ts
// "Find similar" (lib/finance/similar/): which transactions share the chosen
// details, how typed words are escaped for PostgREST, and the server scan
// that reads a person's transactions page by page.
// Run: npm run test:unit
//   (node --test --experimental-strip-types tests/unit/*.test.ts)
//
// Every transaction here is made up. No database: FakeDbPlus applies the same
// filters PostgREST would.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NONE,
  applySimilarFilters,
  criteriaFromForm,
  escapeLike,
  formFromSearch,
  formFromTransaction,
  ilikeAnyColumn,
  parseCriteria,
  quoteFilterValue,
  rowMatches,
  searchWords,
  significantWords,
  type SimilarCriteria,
  type SimilarRow,
} from '../../lib/finance/similar/criteria.ts';
import { MAX_SCAN, findSimilarIds } from '../../lib/finance/similar/server.ts';
import { FakeDbPlus, likeToRegExp } from './fake-supabase-plus.ts';

const ME = '11111111-1111-4111-8111-111111111111';
const THEM = '22222222-2222-4222-8222-222222222222';
const CHECKING = 'aaaaaaaa-0000-4000-8000-000000000001';
const CARD = 'aaaaaaaa-0000-4000-8000-000000000002';
const DINING = 'cccccccc-0000-4000-8000-000000000001';

function row(overrides: Partial<SimilarRow> = {}): SimilarRow {
  return {
    vendor: 'CHIPOTLE #1234',
    description: 'POS PURCHASE CHIPOTLE 1234 AUSTIN TX',
    amount: 12.4,
    type: 'expense',
    account_id: CHECKING,
    category_id: null,
    transaction_date: '2026-03-14',
    ...overrides,
  };
}

// ─── Words ────────────────────────────────────────────────────────────────────

test('searchWords splits at punctuation, lower-cases, drops one-letter pieces and repeats', () => {
  assert.deepEqual(searchWords("McDonald's #12"), ['mcdonald', '12']);
  assert.deepEqual(searchWords('50%, off (sale) OFF'), ['50', 'off', 'sale']);
  assert.deepEqual(searchWords(['Café', 'Olé']), ['café', 'olé']);
  assert.deepEqual(searchWords('a b c'), []);
  assert.equal(searchWords('one two three four five six seven eight nine ten').length, 8);
});

test('significantWords leaves out bank boilerplate, numbers and short words', () => {
  assert.deepEqual(significantWords('POS PURCHASE CHIPOTLE 0876 AUSTIN TX'), ['chipotle', 'austin']);
  assert.deepEqual(significantWords('ACH DEBIT ONLINE PAYMENT REF#A12B34'), ['ref']);
  assert.deepEqual(significantWords(null), []);
});

// ─── Escaping ─────────────────────────────────────────────────────────────────

test('escapeLike makes %, _ and backslash literal, and * matchable', () => {
  assert.equal(escapeLike('50%_off\\now'), '50\\%\\_off\\\\now');
  assert.equal(escapeLike('a*b'), 'a_b');
  // The escaped pattern matches the text itself and nothing wider.
  const re = likeToRegExp(`%${escapeLike('50%')}%`);
  assert.ok(re.test('Save 50% today'));
  assert.ok(!re.test('Save 500 today'));
  const star = likeToRegExp(`%${escapeLike('a*b')}%`);
  assert.ok(star.test('xa*by'));
  assert.ok(!star.test('xaZZZby'));
});

test('quoteFilterValue wraps in double quotes and escapes backslash and quote', () => {
  assert.equal(quoteFilterValue('a,b'), '"a,b"');
  assert.equal(quoteFilterValue('say "hi"'), '"say \\"hi\\""');
  assert.equal(quoteFilterValue('back\\slash'), '"back\\\\slash"');
});

test('ilikeAnyColumn survives every PostgREST reserved character', async () => {
  const db = new FakeDbPlus();
  const nasty = 'a,b.(c):"d"\\e%f_g*h';
  db.seed('financial_transactions', [
    { user_id: ME, description: `x ${nasty} y`, vendor: null },
    { user_id: ME, description: 'a b c d e f g h', vendor: null },
    { user_id: ME, description: null, vendor: `shop ${nasty}` },
  ]);
  const filter = ilikeAnyColumn(['description', 'vendor'], nasty);
  const { data } = await db.from('financial_transactions').select('description, vendor').or(filter);
  assert.equal((data as unknown[]).length, 2);
});

// ─── Criteria ─────────────────────────────────────────────────────────────────

test('parseCriteria reads each detail and refuses bad ones', () => {
  const ok = parseCriteria({
    vendor: ' Chipotle ',
    words: 'chipotle, austin',
    amount: '-12.40',
    amount_tolerance: '0.5',
    account_id: CHECKING.toUpperCase(),
    category_id: null,
    type: 'expense',
    from: '2026-01-01',
    to: '2026-12-31',
  });
  assert.ok(ok.ok);
  assert.deepEqual(ok.criteria, {
    vendor: 'Chipotle',
    words: ['chipotle', 'austin'],
    amount: 12.4,
    amount_tolerance: 0.5,
    account_id: CHECKING,
    category_id: null,
    type: 'expense',
    from: '2026-01-01',
    to: '2026-12-31',
  });

  const refused: [unknown, RegExp][] = [
    [{}, /at least one/],
    [null, /at least one/],
    [{ vendor: '#123 ***' }, /no letters or digits/],
    [{ words: 'a !' }, /at least one word/],
    [{ words: [1, 2] }, /not valid/],
    [{ amount: 'twelve' }, /not a number/],
    [{ amount: true }, /not a number/],
    [{ amount: 12, amount_tolerance: -1 }, /zero or more/],
    [{ account_id: 'not-an-id' }, /account/],
    [{ category_id: "x' or 1=1" }, /category/],
    [{ type: 'transfer' }, /expense or income/],
    [{ from: '03/14/2026' }, /YYYY-MM-DD/],
    [{ from: '2026-05-01', to: '2026-04-01' }, /after the end/],
  ];
  for (const [input, message] of refused) {
    const result = parseCriteria(input);
    assert.ok(!result.ok, JSON.stringify(input));
    assert.match(result.error, message);
  }
});

test('rowMatches: same vendor by vendorKey, not by spelling', () => {
  const c: SimilarCriteria = { vendor: 'Chipotle' };
  assert.ok(rowMatches(row({ vendor: 'CHIPOTLE #1234' }), c));
  assert.ok(rowMatches(row({ vendor: 'TST* Chipotle 0876' }), c));
  assert.ok(!rowMatches(row({ vendor: 'Chipotle Grill' }), c));
  assert.ok(!rowMatches(row({ vendor: null }), c));
  assert.ok(rowMatches(row({ vendor: 'WAL-MART #12' }), { vendor: 'Walmart' }));
});

test('rowMatches: every word in the description or the vendor', () => {
  const c: SimilarCriteria = { words: ['chipotle', 'austin'] };
  assert.ok(rowMatches(row(), c));
  assert.ok(rowMatches(row({ description: 'Lunch in Austin', vendor: 'Chipotle' }), c));
  assert.ok(!rowMatches(row({ description: 'Lunch in Dallas', vendor: 'Chipotle' }), c));
});

test('rowMatches: amount within the tolerance, compared in cents', () => {
  assert.ok(rowMatches(row({ amount: '12.40' }), { amount: 12.4, amount_tolerance: 0 }));
  assert.ok(!rowMatches(row({ amount: 12.41 }), { amount: 12.4, amount_tolerance: 0 }));
  assert.ok(rowMatches(row({ amount: 12.9 }), { amount: 12.4, amount_tolerance: 0.5 }));
  assert.ok(!rowMatches(row({ amount: 12.91 }), { amount: 12.4, amount_tolerance: 0.5 }));
  // 0.1 + 0.2 must not miss 0.3 by float error.
  assert.ok(rowMatches(row({ amount: 0.1 + 0.2 }), { amount: 0.3, amount_tolerance: 0 }));
});

test('rowMatches: account, category (null = none), type and dates', () => {
  assert.ok(rowMatches(row(), { account_id: CHECKING }));
  assert.ok(!rowMatches(row(), { account_id: CARD }));
  assert.ok(rowMatches(row({ account_id: null }), { account_id: null }));
  assert.ok(rowMatches(row({ category_id: null }), { category_id: null }));
  assert.ok(!rowMatches(row({ category_id: DINING }), { category_id: null }));
  assert.ok(!rowMatches(row(), { type: 'income' }));
  assert.ok(rowMatches(row(), { from: '2026-03-14', to: '2026-03-14' }));
  assert.ok(!rowMatches(row(), { from: '2026-03-15' }));
});

test('the form: a transaction ticks its vendor (or its words) and type; a search ticks its words', () => {
  const form = formFromTransaction({ ...row(), amount: '12.4' });
  assert.equal(form.vendor.on, true);
  assert.equal(form.words.on, false);
  assert.equal(form.type.on, true);
  assert.equal(form.amount.value, '12.40');
  assert.deepEqual(form.dates, { on: false, from: '2026-01-01', to: '2026-12-31' });
  assert.deepEqual(criteriaFromForm(form), { vendor: 'CHIPOTLE #1234', type: 'expense' });

  const noVendor = formFromTransaction({ ...row(), vendor: null, account_id: null });
  assert.equal(noVendor.vendor.on, false);
  assert.equal(noVendor.words.on, true);
  noVendor.account.on = true;
  assert.equal(noVendor.account.value, NONE);
  assert.deepEqual(criteriaFromForm(noVendor), { words: 'chipotle austin', account_id: null, type: 'expense' });

  assert.deepEqual(criteriaFromForm(formFromSearch('Whole Foods')), { words: 'whole foods' });
});

// ─── The server scan ──────────────────────────────────────────────────────────

function seedMany(db: FakeDbPlus, count: number, make: (i: number) => Record<string, unknown>) {
  db.seed(
    'financial_transactions',
    Array.from({ length: count }, (_, i) => ({
      user_id: ME,
      type: 'expense',
      account_id: CHECKING,
      category_id: null,
      transfer_group_id: null,
      transaction_date: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      ...make(i),
    })),
  );
}

test('findSimilarIds matches by vendor key across many pages, newest first, only the caller', async () => {
  const db = new FakeDbPlus();
  db.maxRows = 1000;
  seedMany(db, 2600, (i) => ({
    vendor: i % 3 === 0 ? `CHIPOTLE #${i}` : i % 3 === 1 ? 'Chipotle' : 'Starbucks',
    description: 'card purchase',
    amount: 10,
    transfer_group_id: i === 3 ? 'group-1' : null,
  }));
  db.seed('financial_transactions', [
    { user_id: THEM, vendor: 'Chipotle', description: 'x', amount: 10, type: 'expense', transaction_date: '2026-12-31' },
  ]);

  const result = await findSimilarIds(db, ME, { vendor: 'chipotle' });
  assert.equal(result.error, null);
  // i % 3 is 0 or 1: 867 + 867 rows.
  assert.equal(result.total, 1734);
  assert.equal(result.ids.length, 1734);
  assert.equal(result.transferCount, 1);
  assert.equal(result.truncated, false);
  const mine = new Set(db.rows('financial_transactions').filter((r) => r.user_id === ME).map((r) => r.id));
  assert.ok(result.ids.every((id) => mine.has(id)));
  const dates = result.ids.map((id) => String(db.rows('financial_transactions').find((r) => r.id === id)!.transaction_date));
  assert.deepEqual(dates, [...dates].sort().reverse());
});

test('findSimilarIds reads in the server page size when max-rows is smaller', async () => {
  const db = new FakeDbPlus();
  db.maxRows = 300;
  seedMany(db, 1000, () => ({ vendor: 'Target', description: 'x', amount: 5 }));
  const result = await findSimilarIds(db, ME, { vendor: 'TARGET #22' });
  assert.equal(result.total, 1000);
  assert.equal(new Set(result.ids).size, 1000);
});

test('findSimilarIds lets the database filter type, account, category, amount, dates and words', async () => {
  const db = new FakeDbPlus();
  seedMany(db, 40, (i) => ({
    vendor: i % 2 ? 'Corner Market' : 'Fuel Stop',
    description: i % 4 === 0 ? 'Weekly groceries, (bulk)' : 'gas',
    amount: i % 5 === 0 ? 50 : 50.75,
    account_id: i % 8 === 0 ? CARD : CHECKING,
  }));
  const criteria: SimilarCriteria = {
    words: ['groceries', 'bulk'],
    amount: 50.5,
    amount_tolerance: 0.5,
    account_id: CHECKING,
    type: 'expense',
    from: '2026-01-01',
    to: '2026-12-31',
  };
  const result = await findSimilarIds(db, ME, criteria);
  const expected = db
    .rows('financial_transactions')
    .filter((r) => rowMatches(r as unknown as SimilarRow, criteria))
    .length;
  assert.ok(expected > 0);
  assert.equal(result.total, expected);
});

test('applySimilarFilters sends one quoted or() per word and the vendor as not-null', () => {
  const calls: string[] = [];
  const builder = {
    eq: (c: string, v: unknown) => (calls.push(`eq ${c} ${v}`), builder),
    is: (c: string) => (calls.push(`is ${c} null`), builder),
    gte: (c: string, v: unknown) => (calls.push(`gte ${c} ${v}`), builder),
    lte: (c: string, v: unknown) => (calls.push(`lte ${c} ${v}`), builder),
    or: (f: string) => (calls.push(`or ${f}`), builder),
    not: (c: string, op: string) => (calls.push(`not ${c} ${op} null`), builder),
  };
  applySimilarFilters(builder, { vendor: 'x', words: ['a,b'], amount: 10, amount_tolerance: 0.25, category_id: null });
  assert.deepEqual(calls, [
    'is category_id null',
    'gte amount 9.75',
    'lte amount 10.25',
    'or description.ilike."%a,b%",vendor.ilike."%a,b%"',
    'not vendor is null',
  ]);
});

test('findSimilarIds says when there were more rows than it reads', async () => {
  const db = new FakeDbPlus();
  seedMany(db, MAX_SCAN + 5, () => ({ vendor: 'Coffee', description: 'c', amount: 3 }));
  const result = await findSimilarIds(db, ME, { type: 'expense' });
  assert.equal(result.truncated, true);
  assert.equal(result.total, MAX_SCAN);
  assert.equal(result.ids.length, 10_000);
});

test('findSimilarIds works on a database without transfer_group_id (before migration 202)', async () => {
  const db = new FakeDbPlus();
  db.missingColumns = { financial_transactions: ['transfer_group_id'] };
  seedMany(db, 5, () => ({ vendor: 'Chipotle', description: 'c', amount: 3 }));
  const result = await findSimilarIds(db, ME, { vendor: 'Chipotle' });
  assert.equal(result.error, null);
  assert.equal(result.total, 5);
  assert.equal(result.transferCount, 0);
});
