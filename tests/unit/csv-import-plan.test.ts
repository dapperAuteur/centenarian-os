// tests/unit/csv-import-plan.test.ts
// Unit tests for the statement import's plan, commit and undo steps in
// lib/finance/csv-import/, plus the request checks and the older `{ rows }`
// contract.
// Run: npm run test:unit
//   (node --test --experimental-strip-types tests/unit/*.test.ts)
//
// No test touches a real database. The pure functions get plain objects; the
// functions that read and write get the in-memory fake in ./fake-supabase.ts.
// Every merchant, person and amount is made up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  INSERT_CHUNK,
  MAX_IMPORT_ROWS,
  commitImport,
  resolveActions,
  resolveCategory,
} from '../../lib/finance/csv-import/commit.ts';
import { PAGE_SIZE, readAllPages } from '../../lib/finance/csv-import/db.ts';
import {
  ImportError,
  dbFailure,
  isMissingSchemaError,
  isUniqueViolation,
} from '../../lib/finance/csv-import/errors.ts';
import { legacyType, readLegacyRows } from '../../lib/finance/csv-import/legacy.ts';
import {
  MAX_AMOUNT_CENTS,
  PENDING_REASON,
  buildPlanIndex,
  classifyRow,
  countStatuses,
  createClaims,
  identifyRows,
  planImport,
  planRows,
  recordClaims,
  suggestCategory,
  transactionKey,
} from '../../lib/finance/csv-import/plan.ts';
import type { ExistingTransaction } from '../../lib/finance/csv-import/plan.ts';
import {
  parseImportRequest,
  previewImport,
  readStatement,
  runImport,
  sanitizeSavedMapping,
} from '../../lib/finance/csv-import/service.ts';
import type { DecidedRow, NormalizedRow, PlannedRow } from '../../lib/finance/csv-import/types.ts';
import { UNTOUCHED_TOLERANCE_MS, undoBatch, undoDisposition } from '../../lib/finance/csv-import/undo.ts';
import { buildLearnedCategoryIndex } from '../../lib/finance/transaction-matching.ts';
import { FakeDb } from './fake-supabase.ts';
import type { Row } from './fake-supabase.ts';

// ── Fixtures ──────────────────────────────────────────────────────────────

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '99999999-9999-4999-8999-999999999999';
const ACCOUNT = '22222222-2222-4222-8222-222222222222';
const OTHER_ACCOUNT = '33333333-3333-4333-8333-333333333333';
const CAT_DINING = '44444444-4444-4444-8444-444444444444';
const CAT_GROCERIES = '55555555-5555-4555-8555-555555555555';
const CAT_INCOME = '66666666-6666-4666-8666-666666666666';

const asDb = (fake: FakeDb) => fake as unknown as SupabaseClient;

/** A statement row as applyMapping returns it. Defaults to a $4.75 coffee on 2026-01-13. */
function statementRow(rowNumber: number, overrides: Partial<NormalizedRow> = {}): NormalizedRow {
  return {
    rowNumber,
    date: '2026-01-13',
    amountCents: 475,
    type: 'expense',
    description: 'BLUE HERON CAFE',
    vendor: 'Blue Heron Cafe',
    hints: [],
    issues: [],
    ...overrides,
  };
}

/** A stored transaction. Defaults to the same coffee as an old bank-sync row in ACCOUNT. */
function stored(id: string, overrides: Partial<ExistingTransaction> = {}): ExistingTransaction {
  return {
    id,
    transaction_date: '2026-01-13',
    amount: 4.75,
    type: 'expense',
    description: 'BLUE HERON CAFE',
    vendor: 'Blue Heron Cafe',
    external_id: null,
    source: 'bank_sync',
    account_id: ACCOUNT,
    ...overrides,
  };
}

/** Identifies rows and plans them against the given stored rows, like planImport without the reads. */
function plan(
  rows: NormalizedRow[],
  database: Partial<Parameters<typeof buildPlanIndex>[0]> = {},
  includePending = false,
): PlannedRow[] {
  const identified = identifyRows(rows, includePending);
  const fileExternalIds = new Set(
    identified.map((row) => row.externalId).filter((id): id is string => id !== null),
  );
  const index = buildPlanIndex({ accountId: ACCOUNT, accountRows: [], fileExternalIds, ...database });
  return planRows(identified, index);
}

const statuses = (rows: readonly PlannedRow[]) => rows.map((row) => row.status);

const COFFEE_HASH = 'hash:2026-01-13|475|expense|blueheroncafe';

// ── classifyRow: every status ─────────────────────────────────────────────

test('classifyRow: a row the account has never seen is new and will be inserted', () => {
  const [row] = plan([statementRow(2)]);
  assert.equal(row.status, 'new');
  assert.equal(row.defaultAction, 'insert');
  assert.equal(row.externalId, `${COFFEE_HASH}|1`);
  assert.equal(row.suggestedCategoryId, null);
});

test('classifyRow: a row carrying an issue is invalid, with the reason', () => {
  const [row] = plan([statementRow(2, { issues: ['Amount is zero', 'No description'] })]);
  assert.equal(row.status, 'invalid');
  assert.equal(row.defaultAction, 'skip');
  assert.equal(row.reason, 'Amount is zero; No description');
});

test('classifyRow: an amount too large for the column is invalid', () => {
  const [ok, tooBig] = plan([
    statementRow(2, { amountCents: MAX_AMOUNT_CENTS }),
    statementRow(3, { amountCents: MAX_AMOUNT_CENTS + 1 }),
  ]);
  assert.equal(ok.status, 'new');
  assert.equal(tooBig.status, 'invalid');
  assert.match(tooBig.reason ?? '', /larger than the app can store/);
});

test('classifyRow: a pending row is left out unless pending rows are included', () => {
  const rows = [statementRow(2, { pending: true }), statementRow(3, { pending: false })];

  const [pending, posted] = plan(rows);
  assert.equal(pending.status, 'invalid');
  assert.equal(pending.reason, PENDING_REASON);
  assert.equal(pending.externalId, null);
  // The posted row is counted as the first coffee: the pending one took no number.
  assert.equal(posted.externalId, `${COFFEE_HASH}|1`);

  const included = plan(rows, {}, true);
  assert.deepEqual(statuses(included), ['new', 'new']);
  assert.deepEqual(included.map((r) => r.externalId), [`${COFFEE_HASH}|1`, `${COFFEE_HASH}|2`]);
});

test('classifyRow: a row whose external id is already in the account is a duplicate', () => {
  const [row] = plan([statementRow(2)], {
    accountRows: [stored('t1', { external_id: `${COFFEE_HASH}|1`, source: 'csv_import' })],
  });
  assert.equal(row.status, 'duplicate');
  assert.equal(row.duplicateRule, 'external_id');
  assert.equal(row.duplicateOf, 't1');
  assert.equal(row.defaultAction, 'skip');
});

test('classifyRow: a bank ID already in the account is a duplicate even when the details differ', () => {
  const [row] = plan([statementRow(2, { bankId: 'REF-881', description: 'BLUE HERON CAFE AUSTIN' })], {
    accountRows: [
      stored('t1', { external_id: 'bank:REF-881', transaction_date: '2026-01-12', source: 'csv_import' }),
    ],
  });
  assert.equal(row.status, 'duplicate');
  assert.equal(row.duplicateRule, 'external_id');
});

test('classifyRow: an old bank-sync row with the same date, cents, type and vendor key is a duplicate', () => {
  const [row] = plan([statementRow(2, { description: 'Blue Heron Cafe #1234' })], {
    accountRows: [stored('old1', { description: 'BLUE HERON CAFE' })],
  });
  assert.equal(row.status, 'duplicate');
  assert.equal(row.duplicateRule, 'same_transaction');
  assert.equal(row.duplicateOf, 'old1');
});

test('classifyRow: an earlier import with no external id is a duplicate by the same rule', () => {
  const [row] = plan([statementRow(2)], {
    accountRows: [stored('legacy1', { source: 'csv_import', description: null, vendor: 'Blue Heron Cafe' })],
  });
  // The stored row has no description, so its vendor stands in for the key.
  assert.equal(row.status, 'duplicate');
  assert.equal(row.duplicateOf, 'legacy1');
});

test('classifyRow: the same-transaction rule needs the date, the cents, the type and the vendor to agree', () => {
  const accountRows = [stored('old1')];
  assert.deepEqual(
    statuses(
      plan(
        [
          statementRow(2, { date: '2026-01-14' }),
          statementRow(3, { amountCents: 476 }),
          statementRow(4, { type: 'income' }),
          statementRow(5, { description: 'RED FOX DINER', vendor: 'Red Fox Diner' }),
        ],
        { accountRows },
      ),
    ),
    ['new', 'new', 'new', 'new'],
  );
});

test('classifyRow: one old row answers for one statement row, so a second identical coffee is new', () => {
  const rows = plan([statementRow(2), statementRow(3)], { accountRows: [stored('old1')] });
  assert.deepEqual(statuses(rows), ['duplicate', 'new']);
  assert.equal(rows[0].duplicateOf, 'old1');

  const two = plan([statementRow(2), statementRow(3)], { accountRows: [stored('old1'), stored('old2')] });
  assert.deepEqual(two.map((r) => [r.status, r.duplicateOf]), [['duplicate', 'old1'], ['duplicate', 'old2']]);
});

test('classifyRow: a stored row found by its external id does not also absorb the next identical row', () => {
  // Only the first of two coffees was imported before. The second is new.
  const rows = plan([statementRow(2), statementRow(3)], {
    accountRows: [stored('t1', { external_id: `${COFFEE_HASH}|1`, source: 'csv_import' })],
  });
  assert.deepEqual(rows.map((r) => [r.status, r.duplicateRule]), [
    ['duplicate', 'external_id'],
    ['new', undefined],
  ]);
});

test('classifyRow: a row imported under a different id (a hash, then a bank ID) is still a duplicate', () => {
  const [row] = plan([statementRow(2, { bankId: 'REF-7' })], {
    accountRows: [stored('t1', { external_id: `${COFFEE_HASH}|1`, source: 'csv_import' })],
  });
  assert.equal(row.status, 'duplicate');
  assert.equal(row.duplicateRule, 'same_transaction');
});

test('classifyRow: a bank ID repeated inside the file is a duplicate of the earlier row', () => {
  const rows = plan([
    statementRow(2, { bankId: 'REF-1' }),
    statementRow(3, { bankId: 'REF-2' }),
    statementRow(4, { bankId: 'REF-1', description: 'SOMETHING ELSE' }),
  ]);
  assert.deepEqual(statuses(rows), ['new', 'new', 'duplicate_in_file']);
  assert.equal(rows[2].duplicateOfRow, 2);
  assert.equal(rows[2].defaultAction, 'skip');
  assert.match(rows[2].reason ?? '', /Row 2/);
});

test('classifyRow: identical rows without a bank ID are both real, never in-file duplicates', () => {
  assert.deepEqual(statuses(plan([statementRow(2), statementRow(3)])), ['new', 'new']);
});

test('classifyRow: a manual entry of the same purchase is a match, to be linked', () => {
  const manual = stored('m1', {
    source: 'manual',
    transaction_date: '2026-01-12',
    description: null,
    vendor: 'Blue Heron',
  });
  const [row] = plan([statementRow(2)], { accountRows: [manual] });
  assert.equal(row.status, 'matches');
  assert.equal(row.defaultAction, 'link');
  assert.deepEqual(row.match, {
    id: 'm1',
    transaction_date: '2026-01-12',
    amount: 4.75,
    vendor: 'Blue Heron',
    description: null,
    account_id: ACCOUNT,
  });
});

test('classifyRow: a scanned entry with no account matches too', () => {
  const scan = stored('s1', { source: 'scan', account_id: null });
  const [row] = plan([statementRow(2)], { unassigned: [scan] });
  assert.equal(row.status, 'matches');
  assert.equal(row.match?.account_id, null);
});

test('classifyRow: an identical manual entry is linked, not reported as a duplicate', () => {
  const [row] = plan([statementRow(2)], { accountRows: [stored('m1', { source: 'manual' })] });
  assert.equal(row.status, 'matches');
  assert.equal(row.match?.id, 'm1');
});

test('classifyRow: what is not a match candidate', () => {
  const cases: [string, ExistingTransaction, 'accountRows' | 'unassigned'][] = [
    ['money in never matches money out', stored('m1', { source: 'manual', type: 'income' }), 'accountRows'],
    ['outside the date window', stored('m2', { source: 'manual', transaction_date: '2026-01-02' }), 'accountRows'],
    ['a different amount', stored('m3', { source: 'manual', amount: 4.95 }), 'accountRows'],
    ['a different vendor', stored('m4', { source: 'manual', description: 'RED FOX', vendor: 'Red Fox' }), 'accountRows'],
    ['an entry on another account', stored('m5', { source: 'manual', account_id: OTHER_ACCOUNT }), 'unassigned'],
    ['a no-account row that is not manual or scanned', stored('m6', { source: 'trip', account_id: null }), 'unassigned'],
  ];
  for (const [label, entry, where] of cases) {
    const [row] = plan([statementRow(2)], { [where]: [entry] });
    assert.equal(row.status, 'new', label);
  }
});

test('classifyRow: an entry already linked to a statement row is not matched again', () => {
  const linked = stored('m1', { source: 'manual', external_id: 'hash:something-else|1', description: 'coffee' });
  const [row] = plan([statementRow(2)], { accountRows: [linked] });
  assert.equal(row.status, 'new');
});

test('classifyRow: one entry is matched once, so the second identical statement row is new', () => {
  const rows = plan([statementRow(2), statementRow(3)], { accountRows: [stored('m1', { source: 'manual' })] });
  assert.deepEqual(statuses(rows), ['matches', 'new']);
  assert.equal(rows[0].match?.id, 'm1');
});

test('classifyRow: two entries and two statement rows pair off one to one, closest date first', () => {
  const rows = plan(
    [statementRow(2, { date: '2026-01-13' }), statementRow(3, { date: '2026-01-15' })],
    {
      accountRows: [
        stored('near15', { source: 'manual', transaction_date: '2026-01-15' }),
        stored('near13', { source: 'manual', transaction_date: '2026-01-12' }),
      ],
    },
  );
  assert.deepEqual(rows.map((r) => r.match?.id), ['near13', 'near15']);
});

test('classifyRow: reads the claims it is given and leaves them unchanged', () => {
  const index = buildPlanIndex({ accountId: ACCOUNT, accountRows: [stored('m1', { source: 'manual' })] });
  const [row] = identifyRows([statementRow(2)], false);

  const claims = createClaims();
  assert.equal(classifyRow(row, index, claims).status, 'matches');
  assert.equal(claims.claimedMatches.size, 0);
  assert.equal(claims.seenExternalIds.size, 0);

  claims.claimedMatches.add('m1');
  assert.equal(classifyRow(row, index, claims).status, 'new');

  const fresh = createClaims();
  recordClaims(classifyRow(row, index, fresh), fresh);
  assert.deepEqual([...fresh.claimedMatches], ['m1']);
  assert.equal(fresh.seenExternalIds.get(`${COFFEE_HASH}|1`), 2);
});

test('classifyRow: a duplicate wins over a match when both exist', () => {
  const [row] = plan([statementRow(2)], {
    accountRows: [stored('m1', { source: 'manual' }), stored('old1')],
  });
  assert.equal(row.status, 'duplicate');
  assert.equal(row.duplicateOf, 'old1');
});

// ── Suggested category ────────────────────────────────────────────────────

const LEARNED = buildLearnedCategoryIndex([
  { name: 'Blue Heron Cafe', contact_type: 'vendor', default_category_id: CAT_DINING, use_count: 3 },
  { name: 'Acme Co', contact_type: 'customer', default_category_id: CAT_INCOME, use_count: 1 },
]);
const CATEGORIES = [
  { id: CAT_DINING, name: 'Dining' },
  { id: CAT_GROCERIES, name: 'Groceries' },
  { id: CAT_INCOME, name: 'Paycheck' },
];

test('suggestCategory: the learned category beats the file\'s category name', () => {
  const [row] = plan([statementRow(2, { categoryName: 'Groceries' })], { learned: LEARNED, categories: CATEGORIES });
  assert.equal(row.suggestedCategoryId, CAT_DINING);
  assert.equal(row.suggestedCategorySource, 'learned');
});

test('suggestCategory: with no learned category, the file\'s category is matched by name, ignoring case', () => {
  const [row] = plan(
    [statementRow(2, { description: 'CORNER MARKET', vendor: 'Corner Market', categoryName: ' GROCERIES ' })],
    { learned: LEARNED, categories: CATEGORIES },
  );
  assert.equal(row.suggestedCategoryId, CAT_GROCERIES);
  assert.equal(row.suggestedCategorySource, 'category_name');
});

test('suggestCategory: nothing learned and no name match leaves the row uncategorized', () => {
  const [row] = plan(
    [statementRow(2, { description: 'CORNER MARKET', vendor: 'Corner Market', categoryName: 'Food & Drink' })],
    { learned: LEARNED, categories: CATEGORIES },
  );
  assert.equal(row.suggestedCategoryId, null);
  assert.equal(row.suggestedCategorySource, null);
});

test('suggestCategory: vendors are looked up for expenses and customers for income', () => {
  const index = buildPlanIndex({ accountId: ACCOUNT, accountRows: [], learned: LEARNED, categories: CATEGORIES });
  const payroll = statementRow(2, { description: 'ACME CO', vendor: 'Acme Co', type: 'income' });
  assert.equal(suggestCategory(payroll, 'income', index).id, CAT_INCOME);
  assert.equal(suggestCategory(payroll, 'expense', index).id, null);
});

test('countStatuses: one total per status', () => {
  const rows = plan(
    [
      statementRow(2),
      statementRow(3, { issues: ['No description'] }),
      statementRow(4, { bankId: 'A' }),
      statementRow(5, { bankId: 'A' }),
      statementRow(6, { description: 'RED FOX DINER', vendor: 'Red Fox Diner', amountCents: 1200 }),
    ],
    {
      accountRows: [
        stored('old1'),
        stored('m1', { source: 'manual', description: 'Red Fox Diner', vendor: null, amount: 12 }),
      ],
    },
  );
  assert.deepEqual(statuses(rows), ['duplicate', 'invalid', 'new', 'duplicate_in_file', 'matches']);
  assert.deepEqual(countStatuses(rows), {
    rows: 5, new: 1, duplicate: 1, duplicate_in_file: 1, matches: 1, invalid: 1,
  });
});

test('transactionKey: the vendor part ignores case, punctuation and store numbers', () => {
  assert.equal(transactionKey('2026-01-13', 475, 'expense', 'SQ *Blue Heron Cafe #12'), '2026-01-13|475|expense|blueheroncafe');
  assert.equal(transactionKey('2026-01-13T00:00:00Z', 475, 'expense', null), '2026-01-13|475|expense|');
});

// ── planImport against the fake database ──────────────────────────────────

function seededDb(): FakeDb {
  const db = new FakeDb();
  db.seed('financial_accounts', [
    { id: ACCOUNT, user_id: USER, name: 'Everyday Checking', account_type: 'checking', institution_name: 'Test Bank', last_four: '1234' },
    { id: OTHER_ACCOUNT, user_id: OTHER_USER, name: 'Someone else', account_type: 'checking', institution_name: null, last_four: null },
  ]);
  db.seed('budget_categories', CATEGORIES.map((category) => ({ ...category, user_id: USER })));
  db.seed('user_contacts', [
    { user_id: USER, name: 'Blue Heron Cafe', contact_type: 'vendor', default_category_id: CAT_DINING, use_count: 3 },
  ]);
  return db;
}

function transaction(overrides: Row): Row {
  return {
    user_id: USER,
    account_id: ACCOUNT,
    transaction_date: '2026-01-13',
    amount: 4.75,
    type: 'expense',
    description: 'BLUE HERON CAFE',
    vendor: 'Blue Heron Cafe',
    category_id: null,
    external_id: null,
    import_batch_id: null,
    source: 'manual',
    ...overrides,
  };
}

test('planImport: reads the account, classifies every row, and writes nothing', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [
    transaction({ id: 'old-sync', source: 'bank_sync', transaction_date: '2026-01-14', amount: 23.1, description: 'CORNER MARKET #12', vendor: 'Corner Market' }),
    transaction({ id: 'manual-no-account', account_id: null, vendor: 'Blue Heron', description: null }),
    transaction({ id: 'someone-elses', user_id: OTHER_USER, source: 'bank_sync' }),
    transaction({ id: 'other-account', account_id: OTHER_ACCOUNT, source: 'bank_sync' }),
  ]);

  const result = await planImport(asDb(db), USER, ACCOUNT, [
    statementRow(2),
    statementRow(3, { date: '2026-01-14', amountCents: 2310, description: 'CORNER MARKET #12', vendor: 'Corner Market' }),
    statementRow(4, { date: '2026-01-15', amountCents: 150000, type: 'income', description: 'PAYROLL ACME CO', vendor: 'Payroll Acme Co' }),
  ]);

  assert.deepEqual(statuses(result.rows), ['matches', 'duplicate', 'new']);
  assert.equal(result.rows[0].match?.id, 'manual-no-account');
  assert.equal(result.rows[0].suggestedCategoryId, CAT_DINING);
  assert.equal(result.rows[1].duplicateOf, 'old-sync');
  assert.deepEqual(result.totals, { rows: 3, new: 1, duplicate: 1, duplicate_in_file: 0, matches: 1, invalid: 0 });
  assert.deepEqual(db.writes(), []);
});

test('planImport: a file with nothing importable makes no database reads', async () => {
  const db = seededDb();
  const result = await planImport(asDb(db), USER, ACCOUNT, [statementRow(2, { pending: true })]);
  assert.deepEqual(statuses(result.rows), ['invalid']);
  assert.deepEqual(db.calls, []);
});

test('planImport: finds every existing row even when the server returns short pages', async () => {
  const db = seededDb();
  db.maxRows = 2;
  db.seed(
    'financial_transactions',
    [1, 2, 3, 4, 5].map((n) =>
      transaction({ source: 'bank_sync', amount: n, description: `SHOP ${'ABCDE'[n - 1]}`, vendor: null }),
    ),
  );
  const rows = [1, 2, 3, 4, 5].map((n) =>
    statementRow(n + 1, { amountCents: n * 100, description: `SHOP ${'ABCDE'[n - 1]}`, vendor: 'Shop' }),
  );
  const result = await planImport(asDb(db), USER, ACCOUNT, rows);
  assert.deepEqual(statuses(result.rows), ['duplicate', 'duplicate', 'duplicate', 'duplicate', 'duplicate']);
});

test('planImport: before migration 203 it fails with a clear message, not a Postgres error', async () => {
  const db = seededDb();
  db.missingColumns.financial_transactions = ['external_id', 'import_batch_id', 'transfer_kind'];
  await assert.rejects(
    () => planImport(asDb(db), USER, ACCOUNT, [statementRow(2)]),
    (error: unknown) => {
      assert.ok(error instanceof ImportError);
      assert.equal(error.status, 503);
      assert.equal(error.code, 'migration_required');
      assert.match(error.message, /Run migration 203 first/);
      return true;
    },
  );
});

test('readAllPages: stops on an empty page and never returns a partial read', async () => {
  const pages = [[1, 2], [3], []];
  const asked: number[] = [];
  const all = await readAllPages<number>('read', (from) => {
    asked.push(from);
    return Promise.resolve({ data: pages.shift() ?? [], error: null });
  });
  assert.deepEqual(all, [1, 2, 3]);
  assert.deepEqual(asked, [0, 2, 3]);
  assert.equal(PAGE_SIZE, 1000);

  await assert.rejects(
    () => readAllPages('read the rows', () => Promise.resolve({ data: null, error: { code: '08006', message: 'connection lost' } })),
    /Could not read the rows: connection lost/,
  );
});

// ── resolveActions ────────────────────────────────────────────────────────

test('resolveActions: rows with no action get their default', () => {
  const planned = plan(
    [statementRow(2), statementRow(3, { description: 'RED FOX DINER', vendor: 'Red Fox Diner' }), statementRow(4, { issues: ['No date'] })],
    { accountRows: [stored('m1', { source: 'manual' })] },
  );
  assert.deepEqual(resolveActions(planned, []).map((r) => r.action), ['link', 'insert', 'skip']);
});

test('resolveActions: actions apply by spreadsheet row number', () => {
  const planned = plan(
    [statementRow(2), statementRow(3, { description: 'RED FOX DINER', vendor: 'Red Fox Diner' }), statementRow(4, { issues: ['No date'] })],
    { accountRows: [stored('m1', { source: 'manual' })] },
  );
  const decided = resolveActions(planned, [
    { row: 2, action: 'insert' },
    { row: 3, action: 'skip', type: 'income', categoryId: CAT_DINING },
    { row: 4, action: 'insert' },
    { row: 99, action: 'insert' },
  ]);
  assert.deepEqual(decided.map((r) => r.action), ['insert', 'skip', 'skip']);
  assert.equal(decided[1].typeOverride, 'income');
  assert.equal(decided[1].categoryOverride, CAT_DINING);
  assert.equal(decided[0].categoryOverride, undefined);
});

test('resolveActions: link only holds on a row the server matched', () => {
  const planned = plan([statementRow(2), statementRow(3)], { accountRows: [stored('old1')] });
  assert.deepEqual(statuses(planned), ['duplicate', 'new']);
  const decided = resolveActions(planned, [{ row: 2, action: 'link' }, { row: 3, action: 'link' }]);
  assert.deepEqual(decided.map((r) => r.action), ['skip', 'insert']);
});

test('resolveActions: a null category override is kept as "no category"', () => {
  const planned = plan([statementRow(2)]);
  assert.equal(resolveActions(planned, [{ row: 2, categoryId: null }])[0].categoryOverride, null);
});

// ── commitImport ──────────────────────────────────────────────────────────

/** Plans rows against the fake as it is now and applies the default actions. */
async function decide(db: FakeDb, rows: NormalizedRow[], actions: Parameters<typeof resolveActions>[1] = []) {
  const result = await planImport(asDb(db), USER, ACCOUNT, rows);
  return resolveActions(result.rows, actions);
}

const batchOf = (db: FakeDb, id: string) => db.rows('import_batches').find((row) => row.id === id);
const inAccount = (db: FakeDb) => db.rows('financial_transactions').filter((row) => row.account_id === ACCOUNT);

test('commitImport: records the batch, inserts new rows, and links the matched entry', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [transaction({ id: 'manual-1', account_id: null, vendor: 'Blue Heron', description: null })]);
  const rows = await decide(db, [
    statementRow(2),
    statementRow(3, { date: '2026-01-14', amountCents: 2310, description: 'CORNER MARKET #12', vendor: 'Corner Market', categoryName: 'groceries' }),
    statementRow(4, { issues: ['No description'] }),
  ]);

  const result = await commitImport(asDb(db), USER, {
    accountId: ACCOUNT,
    fileName: 'january.csv',
    preset: 'generic',
    mapping: { sign: 'negative_is_expense' },
    rows,
    rejected: [{ row: 5, reason: 'Amount is zero' }],
  });

  assert.equal(result.inserted, 1);
  assert.equal(result.linked, 1);
  assert.equal(result.duplicates, 0);
  assert.equal(result.skipped, 0);
  assert.equal(result.invalid, 2);
  assert.deepEqual(result.rejected, [
    { row: 4, reason: 'No description' },
    { row: 5, reason: 'Amount is zero' },
  ]);

  const batch = batchOf(db, result.batchId);
  assert.ok(batch);
  assert.equal(batch.user_id, USER);
  assert.equal(batch.account_id, ACCOUNT);
  assert.equal(batch.source, 'csv_import');
  assert.equal(batch.file_name, 'january.csv');
  assert.equal(batch.row_count, 4);
  assert.equal(batch.inserted_count, 1);
  assert.equal(batch.linked_count, 1);
  assert.equal(batch.duplicate_count, 0);
  assert.equal(batch.invalid_count, 2);

  const inserted = db.rows('financial_transactions').find((row) => row.source === 'csv_import');
  assert.ok(inserted);
  assert.equal(inserted.user_id, USER);
  assert.equal(inserted.account_id, ACCOUNT);
  assert.equal(inserted.transaction_date, '2026-01-14');
  assert.equal(inserted.amount, 23.1);
  assert.equal(inserted.type, 'expense');
  assert.equal(inserted.description, 'CORNER MARKET #12');
  assert.equal(inserted.vendor, 'Corner Market');
  assert.equal(inserted.category_id, CAT_GROCERIES);
  assert.equal(inserted.external_id, 'hash:2026-01-14|2310|expense|cornermarket|1');
  assert.equal(inserted.import_batch_id, result.batchId);

  // The manual entry is still the person's row: only the link and the account were set.
  const linked = db.rows('financial_transactions').find((row) => row.id === 'manual-1');
  assert.ok(linked);
  assert.equal(linked.source, 'manual');
  assert.equal(linked.vendor, 'Blue Heron');
  assert.equal(linked.external_id, `${COFFEE_HASH}|1`);
  assert.equal(linked.import_batch_id, result.batchId);
  assert.equal(linked.account_id, ACCOUNT);
});

test('commitImport: the batch row is written before any transaction', async () => {
  const db = seededDb();
  const rows = await decide(db, [statementRow(2)]);
  db.calls = [];
  await commitImport(asDb(db), USER, { accountId: ACCOUNT, rows });
  const writes = db.writes().map((call) => `${call.op} ${call.table}`);
  assert.deepEqual(writes, ['insert import_batches', 'insert financial_transactions', 'update import_batches']);
});

test('commitImport: skipped duplicates and skipped-by-choice rows are counted apart', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [transaction({ id: 'old1', source: 'bank_sync' })]);
  const rows = await decide(
    db,
    [statementRow(2), statementRow(3, { description: 'RED FOX DINER', vendor: 'Red Fox Diner' })],
    [{ row: 3, action: 'skip' }],
  );
  const result = await commitImport(asDb(db), USER, { accountId: ACCOUNT, rows });
  assert.deepEqual(
    [result.inserted, result.linked, result.duplicates, result.skipped, result.invalid],
    [0, 0, 1, 1, 0],
  );
  assert.equal(inAccount(db).length, 1);
});

test('commitImport: a replayed request inserts nothing and counts every row as a duplicate', async () => {
  const db = seededDb();
  const file = [
    statementRow(2),
    statementRow(3),
    statementRow(4, { description: 'RED FOX DINER', vendor: 'Red Fox Diner' }),
  ];
  // Both requests were planned before either one wrote, so the plan is stale for the second.
  const first = await decide(db, file);
  const replay = await decide(db, file);

  const one = await commitImport(asDb(db), USER, { accountId: ACCOUNT, rows: first });
  assert.equal(one.inserted, 3);

  const two = await commitImport(asDb(db), USER, { accountId: ACCOUNT, rows: replay });
  assert.equal(two.inserted, 0);
  assert.equal(two.duplicates, 3);
  assert.equal(two.invalid, 0);
  assert.equal(inAccount(db).length, 3);
  assert.equal(batchOf(db, two.batchId)?.duplicate_count, 3);
});

test('commitImport: a collision makes only its own chunk go row by row', async () => {
  const db = seededDb();
  const file = Array.from({ length: INSERT_CHUNK + 1 }, (_, i) =>
    statementRow(i + 2, { amountCents: 100 + i, description: `SHOP ${i}`, vendor: 'Shop' }),
  );
  const rows = await decide(db, file);
  // After planning, another request lands row 6 of the file.
  db.seed('financial_transactions', [
    transaction({ source: 'csv_import', external_id: rows[4].externalId, amount: 1.04, description: 'SHOP 4' }),
  ]);
  db.calls = [];

  const result = await commitImport(asDb(db), USER, { accountId: ACCOUNT, rows });
  assert.equal(result.inserted, INSERT_CHUNK);
  assert.equal(result.duplicates, 1);
  assert.deepEqual(result.rejected, []);

  const inserts = db.calls.filter((call) => call.table === 'financial_transactions' && call.op === 'insert');
  // One failed chunk of 200, 200 single rows (one refused), then the last chunk of 1.
  assert.equal(inserts.length, 1 + INSERT_CHUNK + 1);
  assert.deepEqual([inserts[0].rows, inserts[0].failed], [INSERT_CHUNK, true]);
  assert.equal(inserts.filter((call) => call.failed).length, 2);
  assert.equal(inAccount(db).length, INSERT_CHUNK + 1);
});

test('commitImport: a row the database refuses is reported and the rest still import', async () => {
  const db = seededDb();
  const rows = await decide(db, [
    statementRow(2),
    statementRow(3, { description: 'BAD ROW', vendor: 'Bad Row' }),
    statementRow(4, { description: 'RED FOX DINER', vendor: 'Red Fox Diner' }),
  ]);
  db.rejectInsert = (table, row) =>
    table === 'financial_transactions' && row.description === 'BAD ROW'
      ? { code: '22003', message: 'numeric field overflow' }
      : null;

  const result = await commitImport(asDb(db), USER, { accountId: ACCOUNT, rows });
  assert.equal(result.inserted, 2);
  assert.equal(result.invalid, 1);
  assert.deepEqual(result.rejected, [{ row: 3, reason: 'Could not be saved: numeric field overflow' }]);
  assert.equal(batchOf(db, result.batchId)?.invalid_count, 1);
});

test('commitImport: two imports cannot link the same entry; the loser inserts its row instead', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [transaction({ id: 'manual-1' })]);
  const rows = await decide(db, [statementRow(2, { bankId: 'REF-A' })]);
  assert.equal(rows[0].action, 'link');

  // Another import links the entry between this request's plan and its commit.
  const entry = db.rows('financial_transactions').find((row) => row.id === 'manual-1') as Row;
  entry.external_id = 'bank:REF-OTHER';
  entry.import_batch_id = 'another-batch';

  const result = await commitImport(asDb(db), USER, { accountId: ACCOUNT, rows });
  assert.equal(result.linked, 0);
  assert.equal(result.inserted, 1);
  assert.equal(entry.external_id, 'bank:REF-OTHER');
  assert.equal(entry.import_batch_id, 'another-batch');
  assert.equal(inAccount(db).filter((row) => row.external_id === 'bank:REF-A').length, 1);
});

test('commitImport: linking keeps the entry\'s own account and never touches another source', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [transaction({ id: 'manual-1' })]);
  const rows = await decide(db, [statementRow(2)]);

  // The entry stops being a manual entry before the commit: the link must not apply.
  (db.rows('financial_transactions')[0] as Row).source = 'transfer';
  const result = await commitImport(asDb(db), USER, { accountId: ACCOUNT, rows });
  assert.equal(result.linked, 0);
  assert.equal(result.inserted, 1);
  assert.equal(db.rows('financial_transactions')[0].external_id, null);
});

test('commitImport: the category is the person\'s choice, then the learned one, then the file\'s', async () => {
  const db = seededDb();
  const file = [
    statementRow(2, { categoryName: 'Groceries' }),
    statementRow(3, { categoryName: 'Groceries' }),
    statementRow(4, { categoryName: 'Groceries' }),
    statementRow(5, { description: 'CORNER MARKET', vendor: 'Corner Market', categoryName: 'Groceries' }),
    statementRow(6, { description: 'RED FOX DINER', vendor: 'Red Fox Diner' }),
    statementRow(7, { categoryName: 'Groceries' }),
  ];
  const rows = await decide(db, file, [
    { row: 2, categoryId: CAT_INCOME },
    { row: 3, categoryId: null },
    // Not one of this person's categories: ignored, so the learned one applies.
    { row: 7, categoryId: '77777777-7777-4777-8777-777777777777' },
  ]);
  await commitImport(asDb(db), USER, { accountId: ACCOUNT, rows });

  const saved = inAccount(db).map((row) => row.category_id);
  assert.deepEqual(saved, [CAT_INCOME, null, CAT_DINING, CAT_GROCERIES, null, CAT_DINING]);
});

test('commitImport: a type override is saved, and decides whose learned category applies', async () => {
  const db = seededDb();
  db.seed('user_contacts', [
    { user_id: USER, name: 'Blue Heron Cafe', contact_type: 'customer', default_category_id: CAT_INCOME, use_count: 1 },
  ]);
  const rows = await decide(db, [statementRow(2)], [{ row: 2, type: 'income' }]);
  await commitImport(asDb(db), USER, { accountId: ACCOUNT, rows });

  const [saved] = inAccount(db);
  assert.equal(saved.type, 'income');
  assert.equal(saved.category_id, CAT_INCOME);
  // The external id stays the file's own, so importing the file again still finds it.
  assert.equal(saved.external_id, `${COFFEE_HASH}|1`);
});

test('resolveCategory: the order, without a database', () => {
  const context = {
    learned: LEARNED,
    categoryIdByName: new Map([['groceries', CAT_GROCERIES]]),
    categoryIds: new Set([CAT_DINING, CAT_GROCERIES, CAT_INCOME]),
  };
  const [planned] = plan([statementRow(2, { categoryName: 'Groceries' })]);
  const decided = (extra: Partial<DecidedRow>): DecidedRow => ({ ...planned, action: 'insert', ...extra });

  assert.equal(resolveCategory(decided({ categoryOverride: CAT_INCOME }), 'expense', context), CAT_INCOME);
  assert.equal(resolveCategory(decided({ categoryOverride: null }), 'expense', context), null);
  assert.equal(resolveCategory(decided({}), 'expense', context), CAT_DINING);
  assert.equal(resolveCategory(decided({ vendor: 'Nobody', description: 'NOBODY' }), 'expense', context), CAT_GROCERIES);
});

test('commitImport: more than 5,000 rows is refused before anything is written', async () => {
  const db = seededDb();
  const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => ({
    ...plan([statementRow(i + 2, { amountCents: i + 1 })])[0],
    action: 'insert' as const,
  }));
  await assert.rejects(
    () => commitImport(asDb(db), USER, { accountId: ACCOUNT, rows }),
    (error: unknown) => error instanceof ImportError && error.status === 400 && error.code === 'too_many_rows',
  );
  assert.deepEqual(db.writes(), []);
});

test('commitImport: before migration 203 it says to run the migration and writes no transaction', async () => {
  const db = seededDb();
  const rows = resolveActions(plan([statementRow(2)]), []);
  db.missingTables = ['import_batches'];
  db.missingColumns.financial_transactions = ['external_id', 'import_batch_id'];
  await assert.rejects(
    () => commitImport(asDb(db), USER, { accountId: ACCOUNT, rows }),
    (error: unknown) => error instanceof ImportError && error.status === 503 && /Run migration 203 first/.test(error.message),
  );
  assert.equal(db.rows('financial_transactions').length, 0);
});

// ── Undo ──────────────────────────────────────────────────────────────────

test('undoDisposition: an imported row nobody has edited is deleted', () => {
  const at = '2026-10-03T12:00:00.123456+00:00';
  assert.equal(undoDisposition({ source: 'csv_import', created_at: at, updated_at: at }), 'delete');
});

test('undoDisposition: untouched means updated within 2 seconds of created', () => {
  const created = '2026-10-03T12:00:00.000Z';
  const after = (ms: number) => new Date(Date.parse(created) + ms).toISOString();
  assert.equal(UNTOUCHED_TOLERANCE_MS, 2000);
  assert.equal(undoDisposition({ source: 'csv_import', created_at: created, updated_at: after(2000) }), 'delete');
  assert.equal(undoDisposition({ source: 'csv_import', created_at: created, updated_at: after(2001) }), 'keep');
  assert.equal(undoDisposition({ source: 'csv_import', created_at: created, updated_at: after(86_400_000) }), 'keep');
});

test('undoDisposition: a manual or scanned entry the import linked is unlinked, never deleted', () => {
  const at = '2026-10-03T12:00:00.000Z';
  assert.equal(undoDisposition({ source: 'manual', created_at: at, updated_at: at }), 'unlink');
  assert.equal(undoDisposition({ source: 'scan', created_at: at, updated_at: '2026-10-09T08:00:00.000Z' }), 'unlink');
  assert.equal(undoDisposition({ source: null, created_at: at, updated_at: at }), 'unlink');
});

test('undoDisposition: a row whose timestamps cannot be read is kept', () => {
  assert.equal(undoDisposition({ source: 'csv_import', created_at: 'not a time', updated_at: '' }), 'keep');
});

/** Imports three rows (one linked to a manual entry) and returns the batch id. */
async function importJanuary(db: FakeDb): Promise<string> {
  db.seed('financial_transactions', [transaction({ id: 'manual-1', account_id: null, vendor: 'Blue Heron', description: null })]);
  const rows = await decide(db, [
    statementRow(2),
    statementRow(3, { date: '2026-01-14', amountCents: 2310, description: 'CORNER MARKET #12', vendor: 'Corner Market' }),
    statementRow(4, { date: '2026-01-15', amountCents: 1200, description: 'RED FOX DINER', vendor: 'Red Fox Diner' }),
  ]);
  const result = await commitImport(asDb(db), USER, { accountId: ACCOUNT, rows });
  assert.deepEqual([result.inserted, result.linked], [2, 1]);
  return result.batchId;
}

test('undoBatch: deletes the untouched imported rows, unlinks the matched entry, marks the batch undone', async () => {
  const db = seededDb();
  const batchId = await importJanuary(db);
  db.tick(3_600_000);

  const result = await undoBatch(asDb(db), USER, batchId);
  assert.deepEqual(result, { batchId, alreadyUndone: false, deleted: 2, unlinked: 1, kept: [] });

  const left = db.rows('financial_transactions');
  assert.equal(left.length, 1);
  const [entry] = left;
  assert.equal(entry.id, 'manual-1');
  assert.equal(entry.external_id, null);
  assert.equal(entry.import_batch_id, null);
  // The account the import filled in stays.
  assert.equal(entry.account_id, ACCOUNT);

  const batch = batchOf(db, batchId);
  assert.equal(batch?.status, 'undone');
  assert.equal(typeof batch?.undone_at, 'string');
});

test('undoBatch: a row edited since the import is kept and reported', async () => {
  const db = seededDb();
  const batchId = await importJanuary(db);

  db.tick(60_000);
  await db.from('financial_transactions').update({ category_id: CAT_DINING }).eq('description', 'RED FOX DINER');
  db.tick(60_000);

  const result = await undoBatch(asDb(db), USER, batchId);
  assert.equal(result.deleted, 1);
  assert.equal(result.unlinked, 1);
  assert.deepEqual(result.kept.map((row) => [row.description, row.amount, row.transaction_date]), [
    ['RED FOX DINER', 12, '2026-01-15'],
  ]);

  const kept = db.rows('financial_transactions').find((row) => row.description === 'RED FOX DINER');
  assert.ok(kept);
  assert.equal(kept.category_id, CAT_DINING);
  // It still carries its statement identity, so importing the file again won't double it.
  assert.equal(kept.import_batch_id, batchId);
  assert.equal(typeof kept.external_id, 'string');
});

test('undoBatch: a row edited between the read and the delete is kept', async () => {
  const db = seededDb();
  const batchId = await importJanuary(db);
  db.tick(60_000);

  let edited = false;
  db.beforeRun = (table, op) => {
    if (table !== 'financial_transactions' || op !== 'delete' || edited) return;
    edited = true;
    const row = db.rows('financial_transactions').find((r) => r.description === 'RED FOX DINER') as Row;
    row.notes = 'split with Sam';
    row.updated_at = db.timestamp();
  };

  const result = await undoBatch(asDb(db), USER, batchId);
  assert.equal(result.deleted, 1);
  assert.deepEqual(result.kept.map((row) => row.description), ['RED FOX DINER']);
  assert.ok(db.rows('financial_transactions').some((row) => row.description === 'RED FOX DINER'));
});

test('undoBatch: a second undo is a no-op', async () => {
  const db = seededDb();
  const batchId = await importJanuary(db);
  await undoBatch(asDb(db), USER, batchId);
  const undoneAt = batchOf(db, batchId)?.undone_at;

  db.tick(5000);
  db.calls = [];
  const again = await undoBatch(asDb(db), USER, batchId);
  assert.deepEqual(again, { batchId, alreadyUndone: true, deleted: 0, unlinked: 0, kept: [] });
  assert.deepEqual(db.writes(), []);
  assert.equal(batchOf(db, batchId)?.undone_at, undoneAt);
});

test('undoBatch: leaves every other transaction alone', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [
    transaction({ id: 'other-import', source: 'csv_import', import_batch_id: 'another-batch', external_id: 'bank:Z', description: 'ELSEWHERE' }),
    transaction({ id: 'plain-manual', description: 'SOMETHING ELSE', vendor: 'Something Else', amount: 99 }),
  ]);
  const batchId = await importJanuary(db);
  await undoBatch(asDb(db), USER, batchId);
  assert.deepEqual(
    db.rows('financial_transactions').map((row) => row.id).sort(),
    ['manual-1', 'other-import', 'plain-manual'],
  );
});

test('undoBatch: someone else\'s batch, or one that does not exist, is not found', async () => {
  const db = seededDb();
  const batchId = await importJanuary(db);
  for (const [user, id] of [[OTHER_USER, batchId], [USER, '00000000-0000-4000-8000-999999999999']]) {
    await assert.rejects(
      () => undoBatch(asDb(db), user, id),
      (error: unknown) => error instanceof ImportError && error.status === 404,
    );
  }
  assert.equal(batchOf(db, batchId)?.status, 'committed');
  assert.equal(db.rows('financial_transactions').length, 3);
});

test('undoBatch: after an undo the same file imports again as new', async () => {
  const db = seededDb();
  const batchId = await importJanuary(db);
  await undoBatch(asDb(db), USER, batchId);

  const again = await planImport(asDb(db), USER, ACCOUNT, [
    statementRow(2),
    statementRow(3, { date: '2026-01-14', amountCents: 2310, description: 'CORNER MARKET #12', vendor: 'Corner Market' }),
  ]);
  // The manual entry is unlinked again, so the coffee matches it once more.
  assert.deepEqual(statuses(again.rows), ['matches', 'new']);
});

// ── The request, end to end against the fake ──────────────────────────────

const STATEMENT = [
  'Date,Description,Amount',
  '01/13/2026,BLUE HERON CAFE,-4.75',
  '01/14/2026,CORNER MARKET #12,-23.10',
  '01/15/2026,PAYROLL ACME CO,1500.00',
  '01/16/2026,,-5.00',
].join('\n');

const MAPPING = { date: 'date', description: 'description', amount: 'amount' };

const requestBody = (extra: Record<string, unknown> = {}) => ({
  account_id: ACCOUNT,
  csv_text: STATEMENT,
  mapping: MAPPING,
  sign: 'negative_is_expense',
  dateOrder: 'MDY',
  ...extra,
});

test('parseImportRequest: reads a full commit body', () => {
  const request = parseImportRequest(
    requestBody({
      file_name: ' january.csv ',
      include_pending: true,
      actions: [{ row: 3, action: 'skip' }, { row: 4, type: 'income', category_id: CAT_INCOME }, { row: 5, category_id: null }],
    }),
    { requireMapping: true },
  );
  assert.equal(request.accountId, ACCOUNT);
  assert.deepEqual(request.mapping, MAPPING);
  assert.equal(request.sign, 'negative_is_expense');
  assert.equal(request.dateOrder, 'MDY');
  assert.equal(request.includePending, true);
  assert.equal(request.fileName, 'january.csv');
  assert.deepEqual(request.actions, [
    { row: 3, action: 'skip' },
    { row: 4, type: 'income', categoryId: CAT_INCOME },
    { row: 5, categoryId: null },
  ]);
});

test('parseImportRequest: a preview may leave the mapping out; a commit may not', () => {
  const body = { account_id: ACCOUNT, csv_text: STATEMENT };
  const preview = parseImportRequest(body, { requireMapping: false });
  assert.deepEqual([preview.mapping, preview.sign, preview.dateOrder], [null, null, null]);
  assert.throws(() => parseImportRequest(body, { requireMapping: true }), /Preview the file first/);
});

test('parseImportRequest: every bad body gets a readable 400', () => {
  const cases: [unknown, RegExp][] = [
    [null, /not valid JSON/],
    [{ csv_text: STATEMENT }, /Choose the account/],
    [requestBody({ account_id: 'checking' }), /account is not valid/],
    [requestBody({ csv_text: '   ' }), /No statement was sent/],
    [requestBody({ mapping: 'date' }), /mapping must be an object/],
    [requestBody({ mapping: { date: 7 } }), /column chosen for "date"/],
    [requestBody({ sign: 'backwards' }), /sign convention must be one of/],
    [requestBody({ dateOrder: 'YDM' }), /date order must be one of/],
    [requestBody({ actions: 'all' }), /actions must be a list/],
    [requestBody({ actions: [{ action: 'skip' }] }), /spreadsheet row number/],
    [requestBody({ actions: [{ row: 2, action: 'delete' }] }), /Row 2: the action must be/],
    [requestBody({ actions: [{ row: 2, type: 'refund' }] }), /Row 2: the type must be/],
    [requestBody({ actions: [{ row: 2, category_id: 'dining' }] }), /Row 2: the category is not valid/],
  ];
  for (const [body, message] of cases) {
    assert.throws(
      () => parseImportRequest(body, { requireMapping: true }),
      (error: unknown) => error instanceof ImportError && error.status === 400 && message.test(error.message),
      String(message),
    );
  }
});

test('readStatement: parses on the server and reports rows it could not read', () => {
  const statement = readStatement({ csvText: STATEMENT, mapping: MAPPING, sign: 'negative_is_expense', dateOrder: 'MDY' });
  assert.deepEqual(statement.rows.map((r) => [r.rowNumber, r.date, r.type, r.amountCents]), [
    [2, '2026-01-13', 'expense', 475],
    [3, '2026-01-14', 'expense', 2310],
    [4, '2026-01-15', 'income', 150000],
  ]);
  assert.deepEqual(statement.rejected, [{ row: 5, reason: 'No description' }]);
});

test('readStatement: with no mapping in the request it uses its own guess', () => {
  const statement = readStatement({ csvText: STATEMENT, mapping: null, sign: null, dateOrder: null });
  assert.deepEqual(statement.mapping, MAPPING);
  assert.equal(statement.sign, 'negative_is_expense');
  assert.equal(statement.rows.length, 3);
});

test('readStatement: a mapping that does not fit the file says which columns are missing', () => {
  assert.throws(
    () => readStatement({ csvText: STATEMENT, mapping: { date: 'date', description: 'payee' }, sign: 'negative_is_expense', dateOrder: 'MDY' }),
    (error: unknown) => {
      assert.ok(error instanceof ImportError);
      assert.equal(error.code, 'mapping_incomplete');
      assert.deepEqual(error.details.missingColumns, ['description', 'amount']);
      assert.ok(error.details.detected);
      return true;
    },
  );
});

test('readStatement: an empty file and an over-long file are refused', () => {
  assert.throws(() => readStatement({ csvText: 'Date,Description,Amount\n', mapping: MAPPING, sign: 'negative_is_expense', dateOrder: 'MDY' }), /No transactions were found/);
  const long = ['Date,Description,Amount', ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `01/13/2026,SHOP ${i},-1.00`)].join('\n');
  assert.throws(
    () => readStatement({ csvText: long, mapping: MAPPING, sign: 'negative_is_expense', dateOrder: 'MDY' }),
    (error: unknown) => error instanceof ImportError && error.code === 'too_many_rows' && /5,001 rows/.test(error.message),
  );
});

test('previewImport: returns rows, totals and rejected rows, and writes nothing', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [transaction({ id: 'old-sync', source: 'bank_sync', transaction_date: '2026-01-14', amount: 23.1, description: 'CORNER MARKET #12', vendor: 'Corner Market' })]);

  const preview = await previewImport(asDb(db), USER, requestBody());
  assert.equal(preview.account.name, 'Everyday Checking');
  assert.deepEqual(preview.rows.map((r) => [r.rowNumber, r.status]), [[2, 'new'], [3, 'duplicate'], [4, 'new']]);
  assert.deepEqual(preview.rejected, [{ row: 5, reason: 'No description' }]);
  assert.deepEqual(preview.totals, { rows: 3, new: 2, duplicate: 1, duplicate_in_file: 0, matches: 0, invalid: 0, rejected: 1 });
  assert.equal(preview.detected.preset, 'generic');
  assert.equal(preview.file.rowCount, 4);
  assert.deepEqual(db.writes(), []);
});

test('previewImport: an account that is not the user\'s is not found', async () => {
  const db = seededDb();
  await assert.rejects(
    () => previewImport(asDb(db), USER, requestBody({ account_id: OTHER_ACCOUNT })),
    (error: unknown) => error instanceof ImportError && error.status === 404 && /account was not found/.test(error.message),
  );
  assert.deepEqual(db.writes(), []);
});

test('runImport: commits by row number, and importing the same file again is all duplicates', async () => {
  const db = seededDb();
  const first = await runImport(asDb(db), USER, requestBody({ file_name: 'january.csv', actions: [{ row: 3, action: 'skip' }] }));
  assert.deepEqual(
    [first.inserted, first.linked, first.duplicates, first.skipped, first.invalid],
    [2, 0, 0, 1, 1],
  );
  assert.deepEqual(first.rejected, [{ row: 5, reason: 'No description' }]);
  assert.deepEqual(inAccount(db).map((row) => row.description), ['BLUE HERON CAFE', 'PAYROLL ACME CO']);
  assert.deepEqual(batchOf(db, first.batchId)?.mapping, {
    mapping: MAPPING, sign: 'negative_is_expense', dateOrder: 'MDY', includePending: false,
  });
  assert.equal(batchOf(db, first.batchId)?.preset, 'generic');

  const second = await runImport(asDb(db), USER, requestBody({ actions: [{ row: 3, action: 'skip' }] }));
  assert.deepEqual([second.inserted, second.duplicates, second.skipped], [0, 2, 1]);
  assert.equal(inAccount(db).length, 2);
});

test('runImport: rows normalized by the browser are never used', async () => {
  const db = seededDb();
  // A tampered client sends its own idea of the rows next to the file. Only the file counts.
  const result = await runImport(asDb(db), USER, requestBody({
    rows: [{ transaction_date: '2026-01-13', amount: 999999, type: 'income', description: 'FAKE' }],
  }));
  assert.equal(result.inserted, 3);
  assert.ok(!db.rows('financial_transactions').some((row) => row.description === 'FAKE'));
});

test('sanitizeSavedMapping: keeps the known settings and refuses anything else', () => {
  assert.equal(sanitizeSavedMapping(null), null);
  assert.deepEqual(
    sanitizeSavedMapping({
      mapping: { ...MAPPING, nonsense: 'x', status: '' },
      sign: 'positive_is_expense',
      dateOrder: 'DMY',
      includePending: true,
      preset: 'amex',
      extra: 'dropped',
    }),
    { mapping: MAPPING, sign: 'positive_is_expense', dateOrder: 'DMY', includePending: true, preset: 'amex' },
  );
  assert.throws(() => sanitizeSavedMapping('chase'), /must be an object or null/);
  assert.throws(() => sanitizeSavedMapping({ mapping: MAPPING, sign: 'nope', dateOrder: 'MDY' }), /sign convention/);
  assert.throws(() => sanitizeSavedMapping({ mapping: MAPPING, sign: 'split_columns' }), /date order/);
});

// ── The older { rows } contract ───────────────────────────────────────────

const NO_LOOKUP = { categoryIdByName: new Map<string, string>(), learned: buildLearnedCategoryIndex([]) };

test('legacyType: the type column is read without regard to case', () => {
  for (const word of ['income', 'Income', 'INCOME', ' Credit ', 'Deposit']) {
    assert.equal(legacyType(word, 1250), 'income', word);
  }
  for (const word of ['expense', 'Expense', 'DEBIT', 'Purchase']) {
    assert.equal(legacyType(word, 1250), 'expense', word);
  }
});

test('legacyType: an unknown type is an expense; no type falls back to the sign', () => {
  assert.equal(legacyType('Adjustment', 1250), 'expense');
  assert.equal(legacyType('', -1250), 'expense');
  assert.equal(legacyType(undefined, 1250), 'income');
});

test('readLegacyRows: dates must be real calendar dates', () => {
  const { payloads, errors } = readLegacyRows(
    [
      { transaction_date: '2026-01-13', amount: '4.75', type: 'Expense' },
      { transaction_date: '2026-02-30', amount: '4.75' },
      { transaction_date: '2026-13-01', amount: '4.75' },
      { transaction_date: '1/5/2026', amount: '10' },
      { transaction_date: '', amount: '10' },
      { transaction_date: 'yesterday', amount: '10' },
    ],
    NO_LOOKUP,
  );
  assert.deepEqual(payloads.map((p) => p.transaction_date), ['2026-01-13', '2026-01-05']);
  assert.deepEqual(errors, [
    'Row 2: "2026-02-30" is not a real date',
    'Row 3: "2026-13-01" is not a real date',
    'Row 5: no date',
    'Row 6: "yesterday" is not a real date',
  ]);
});

test('readLegacyRows: amounts, direction and text fields', () => {
  const { payloads, errors } = readLegacyRows(
    [
      { transaction_date: '2026-01-13', amount: '$1,234.56', type: 'INCOME', description: ' Paycheck ', vendor: ' Acme Co ' },
      { transaction_date: '2026-01-13', amount: '(12.34)' },
      { transaction_date: '2026-01-13', amount: -8 },
      { transaction_date: '2026-01-13', amount: 'NaN' },
      { transaction_date: '2026-01-13', amount: '0.00' },
    ],
    NO_LOOKUP,
  );
  assert.deepEqual(payloads, [
    { transaction_date: '2026-01-13', amount: 1234.56, type: 'income', description: 'Paycheck', vendor: 'Acme Co', category_id: null },
    { transaction_date: '2026-01-13', amount: 12.34, type: 'expense', description: null, vendor: null, category_id: null },
    { transaction_date: '2026-01-13', amount: 8, type: 'expense', description: null, vendor: null, category_id: null },
  ]);
  assert.deepEqual(errors, ['Row 4: the amount is not a number', 'Row 5: the amount is zero']);
});

test('readLegacyRows: the row\'s category name wins, then the vendor\'s learned category', () => {
  const lookup = { categoryIdByName: new Map([['groceries', CAT_GROCERIES]]), learned: LEARNED };
  const { payloads } = readLegacyRows(
    [
      { transaction_date: '2026-01-13', amount: '5', type: 'expense', vendor: 'Blue Heron Cafe', category_name: 'Groceries' },
      { transaction_date: '2026-01-13', amount: '5', type: 'expense', vendor: 'BLUE HERON CAFE #2' },
      { transaction_date: '2026-01-13', amount: '5', type: 'expense', vendor: 'Nobody', category_name: 'Unknown' },
    ],
    lookup,
  );
  assert.deepEqual(payloads.map((p) => p.category_id), [CAT_GROCERIES, CAT_DINING, null]);
});

// ── Errors ────────────────────────────────────────────────────────────────

test('isMissingSchemaError: recognizes the objects migration 203 creates, and only those', () => {
  const missing = [
    { code: '42703', message: 'column financial_transactions.external_id does not exist' },
    { code: 'PGRST204', message: "Could not find the 'import_batch_id' column of 'financial_transactions' in the schema cache" },
    { code: 'PGRST205', message: "Could not find the table 'public.import_batches' in the schema cache" },
    { code: '42P01', message: 'relation "public.import_batches" does not exist' },
    { code: 'PGRST204', message: "Could not find the 'csv_import_mapping' column of 'financial_accounts' in the schema cache" },
  ];
  for (const error of missing) assert.equal(isMissingSchemaError(error), true, error.message);

  assert.equal(isMissingSchemaError({ code: '42703', message: 'column financial_transactions.nope does not exist' }), false);
  assert.equal(isMissingSchemaError({ code: '23505', message: 'duplicate key ... external_id' }), false);
  assert.equal(isMissingSchemaError(null), false);
});

test('dbFailure: a missing-schema error becomes "run the migration"; anything else keeps its message', () => {
  const migration = dbFailure({ code: 'PGRST205', message: "Could not find the table 'public.import_batches' in the schema cache" }, 'start the import');
  assert.equal(migration.status, 503);
  assert.match(migration.message, /Run migration 203 first/);

  const other = dbFailure({ code: '57014', message: 'canceling statement due to statement timeout' }, 'start the import');
  assert.equal(other.status, 500);
  assert.equal(other.message, 'Could not start the import: canceling statement due to statement timeout');

  assert.equal(isUniqueViolation({ code: '23505', message: 'duplicate key' }), true);
  assert.equal(isUniqueViolation({ code: '23503', message: 'foreign key' }), false);
});
