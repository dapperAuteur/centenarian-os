// tests/unit/finance-review.test.ts
// Unit tests for the finance Review page, saved statement imports (drafts) and
// editing a past import (plans/63, section A):
//   lib/finance/review/{sections,server,actions}.ts
//   lib/finance/import-drafts/{drafts,preview}.ts
//   lib/finance/import-history/batch-rows.ts
// Run: npm run test:unit
//
// No test touches a real database: the reads and writes go to the in-memory
// fake in ./fake-supabase.ts. Every merchant, person and amount is made up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ImportError } from '../../lib/finance/csv-import/errors.ts';
import {
  DRAFT_TTL_DAYS,
  assertDraftFits,
  commitDraft,
  countChangedStatuses,
  deleteDraft,
  listDrafts,
  loadDraft,
  readDecisions,
  readDraftRows,
  resumeDraft,
  updateDraftChoices,
} from '../../lib/finance/import-drafts/drafts.ts';
import { plainRows, previewAndSaveDraft } from '../../lib/finance/import-drafts/preview.ts';
import {
  deleteBatchRows,
  editBatchRows,
  listBatchRows,
  readBatchEdit,
  rematchBatchTransfers,
} from '../../lib/finance/import-history/batch-rows.ts';
import {
  categorizeRows,
  dismissSuggestions,
  linkPayments,
  linkTransferPairs,
  mergeMatches,
  readDismissItems,
  restoreDismissals,
} from '../../lib/finance/review/actions.ts';
import { REVIEW_MIGRATION_CODE, isReviewSchemaMissing } from '../../lib/finance/review/schema.ts';
import {
  buildMatchSection,
  buildPaymentSection,
  buildTransferSection,
  detectTransfers,
  dismissalKey,
  dismissalToPanelKey,
  looksLikePayment,
  pageOf,
  panelKeyToDismissal,
  type ReviewAccount,
  type ReviewTxn,
} from '../../lib/finance/review/sections.ts';
import { buildReview, readRange } from '../../lib/finance/review/server.ts';
import { FakeDb } from './fake-supabase.ts';
import type { Row } from './fake-supabase.ts';

// ── Fixtures ──────────────────────────────────────────────────────────────

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '99999999-9999-4999-8999-999999999999';
const CHECKING = '22222222-2222-4222-8222-222222222222';
const SAVINGS = '23232323-2323-4232-8232-232323232323';
const CARD = '24242424-2424-4242-8242-242424242424';
const OTHER_ACCOUNT = '33333333-3333-4333-8333-333333333333';
const CAT_DINING = '44444444-4444-4444-8444-444444444444';
const OTHER_CAT = '45454545-4545-4545-8545-454545454545';
const BATCH = '55555555-5555-4555-8555-555555555555';
const OTHER_BATCH = '56565656-5656-4565-8565-565656565656';

const asDb = (fake: FakeDb) => fake as unknown as SupabaseClient;

/** A made-up uuid for test transaction n. */
const tx = (n: number): string => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;

const ACCOUNTS: ReviewAccount[] = [
  { id: CHECKING, name: 'Everyday Checking', account_type: 'checking', institution_name: 'Test Bank', last_four: '1234' },
  { id: SAVINGS, name: 'Rainy Day Savings', account_type: 'savings', institution_name: 'Test Bank', last_four: '5345' },
  { id: CARD, name: 'Rewards Card', account_type: 'credit_card', institution_name: 'Card Co', last_four: '9876' },
];

function row(id: string, overrides: Partial<ReviewTxn> = {}): ReviewTxn {
  return {
    id,
    account_id: CHECKING,
    transaction_date: '2026-03-10',
    amount: 25,
    type: 'expense',
    description: 'BLUE HERON CAFE',
    vendor: 'Blue Heron Cafe',
    source: 'csv_import',
    external_id: `hash:${id}`,
    import_batch_id: BATCH,
    category_id: null,
    ...overrides,
  };
}

function seededDb(): FakeDb {
  const db = new FakeDb();
  db.seed('financial_accounts', [
    ...ACCOUNTS.map((account) => ({ ...account, user_id: USER, is_active: true })),
    { id: OTHER_ACCOUNT, user_id: OTHER_USER, name: 'Someone else', account_type: 'checking', institution_name: null, last_four: null, is_active: true },
  ]);
  db.seed('budget_categories', [
    { id: CAT_DINING, user_id: USER, name: 'Dining' },
    { id: OTHER_CAT, user_id: OTHER_USER, name: 'Not yours' },
  ]);
  return db;
}

/** A stored transaction of USER. */
function stored(id: string, overrides: Row = {}): Row {
  return {
    id,
    user_id: USER,
    account_id: CHECKING,
    transaction_date: '2026-03-10',
    amount: 25,
    type: 'expense',
    description: 'BLUE HERON CAFE',
    vendor: 'Blue Heron Cafe',
    category_id: null,
    external_id: null,
    import_batch_id: null,
    transfer_group_id: null,
    source: 'manual',
    ...overrides,
  };
}

const STATEMENT = [
  'Date,Description,Amount',
  '03/10/2026,BLUE HERON CAFE,-4.75',
  '03/11/2026,CORNER MARKET #12,-23.10',
  '03/12/2026,PAYROLL ACME CO,1500.00',
  '03/13/2026,,-5.00',
].join('\n');

const csvBody = (extra: Record<string, unknown> = {}) => ({
  account_id: CHECKING,
  csv_text: STATEMENT,
  mapping: { date: 'date', description: 'description', amount: 'amount' },
  sign: 'negative_is_expense',
  dateOrder: 'MDY',
  file_name: 'march.csv',
  ...extra,
});

const isImportError = (status: number, code?: string) => (error: unknown) => {
  assert.ok(error instanceof ImportError, `expected an ImportError, got ${String(error)}`);
  assert.equal(error.status, status);
  if (code) assert.equal(error.code, code);
  return true;
};

// ── Dismissal keys ────────────────────────────────────────────────────────

test('dismissal keys: the panel\'s old browser keys map to stored answers and back', () => {
  assert.deepEqual(panelKeyToDismissal(`pair:${tx(1)}:${tx(2)}`), {
    section: 'transfer_pair',
    transaction_id: tx(1),
    other_transaction_id: tx(2),
  });
  assert.deepEqual(panelKeyToDismissal(`one:${tx(3)}`), {
    section: 'one_sided_payment',
    transaction_id: tx(3),
    other_transaction_id: null,
  });
  assert.equal(panelKeyToDismissal('pair:not-an-id:x'), null);
  assert.equal(dismissalToPanelKey({ section: 'transfer_pair', transaction_id: tx(1), other_transaction_id: tx(2) }), `pair:${tx(1)}:${tx(2)}`);
  assert.equal(dismissalToPanelKey({ section: 'possible_match', transaction_id: tx(1), other_transaction_id: tx(2) }), null);
  assert.equal(dismissalKey('one_sided_payment', tx(3).toUpperCase()), `one_sided_payment|${tx(3)}|`);
});

test('readDismissItems: a pair answer needs both rows, and repeats are collapsed', () => {
  assert.throws(() => readDismissItems([{ section: 'transfer_pair', transaction_id: tx(1) }]), isImportError(400));
  assert.throws(() => readDismissItems([{ section: 'mystery', transaction_id: tx(1) }]), isImportError(400));
  assert.throws(() => readDismissItems([]), isImportError(400));
  const items = readDismissItems([
    { section: 'one_sided_payment', transaction_id: tx(1) },
    { section: 'one_sided_payment', transaction_id: tx(1).toUpperCase() },
    { section: 'possible_match', transaction_id: tx(2), other_transaction_id: tx(3) },
  ]);
  assert.equal(items.length, 2);
});

// ── Sections (pure) ───────────────────────────────────────────────────────

test('transfers section: a checking-to-savings pair is suggested, and a dismissed pair is not', () => {
  const rows = [
    row(tx(1), { description: 'ONLINE TRANSFER TO SAV 5345', vendor: null, amount: 200 }),
    row(tx(2), { account_id: SAVINGS, type: 'income', description: 'TRANSFER FROM CHK 1234', vendor: null, amount: 200 }),
  ];
  const suggestions = detectTransfers(rows, ACCOUNTS);
  const shown = buildTransferSection(rows, ACCOUNTS, suggestions, new Set());
  assert.equal(shown.length, 1);
  assert.equal(shown[0].from.id, tx(1));
  assert.equal(shown[0].to.id, tx(2));
  assert.equal(shown[0].confidence, 'high');
  assert.equal(shown[0].from.account_label, 'Test Bank Everyday Checking ••1234');

  const dismissed = new Set([dismissalKey('transfer_pair', tx(1), tx(2))]);
  assert.deepEqual(buildTransferSection(rows, ACCOUNTS, suggestions, dismissed), []);
});

test('looksLikePayment: payment wording counts, refunds and rewards never do', () => {
  assert.equal(looksLikePayment('ONLINE PAYMENT THANK YOU'), true);
  assert.equal(looksLikePayment('AUTOPAY 0310'), true);
  assert.equal(looksLikePayment('PAYMENT'), true);
  assert.equal(looksLikePayment('RETURN BLUE HERON CAFE'), false);
  assert.equal(looksLikePayment('CASH BACK REWARD'), false);
  assert.equal(looksLikePayment('PAYMENT REVERSAL'), false);
  assert.equal(looksLikePayment('CORNER MARKET'), false);
});

test('payments section: a card payment with no "Paid from" is listed with the usual account, a refund is not', () => {
  const rows = [
    row(tx(1), { account_id: CARD, type: 'income', description: 'ONLINE PAYMENT THANK YOU', vendor: null, amount: 150 }),
    row(tx(2), { account_id: CARD, type: 'income', description: 'RETURN CORNER MARKET', vendor: null, amount: 12 }),
    row(tx(3), { account_id: CARD, type: 'income', description: 'PAYMENT', source: 'transfer', amount: 75 }),
  ];
  const suggestions = detectTransfers(rows, ACCOUNTS);
  const items = buildPaymentSection(rows, ACCOUNTS, suggestions, new Set(), {
    paidFromDefaults: new Map([[CARD, CHECKING]]),
  });
  assert.deepEqual(items.map((item) => [item.transaction.id, item.side, item.kind, item.suggested_account_id]), [
    [tx(1), 'paid_from', 'card_payment', CHECKING],
  ]);
  const dismissed = new Set([dismissalKey('one_sided_payment', tx(1))]);
  assert.deepEqual(buildPaymentSection(rows, ACCOUNTS, suggestions, dismissed), []);
});

test('payments section: money out of checking that names the card is a "Paid to" item', () => {
  const rows = [row(tx(1), { description: 'CARD CO ONLINE PAYMENT 9876', vendor: null, amount: 300 })];
  const suggestions = detectTransfers(rows, ACCOUNTS);
  const items = buildPaymentSection(rows, ACCOUNTS, suggestions, new Set());
  assert.equal(items.length, 1);
  assert.equal(items[0].side, 'paid_to');
  assert.equal(items[0].suggested_account_id, CARD);
});

test('payments section: a card payment that is half of a suggested pair stays in the transfers section', () => {
  const rows = [
    row(tx(1), { description: 'CARD CO ONLINE PAYMENT 9876', vendor: null, amount: 300 }),
    row(tx(2), { account_id: CARD, type: 'income', description: 'ONLINE PAYMENT THANK YOU', vendor: null, amount: 300 }),
  ];
  const suggestions = detectTransfers(rows, ACCOUNTS);
  assert.equal(buildTransferSection(rows, ACCOUNTS, suggestions, new Set()).length, 1);
  assert.deepEqual(buildPaymentSection(rows, ACCOUNTS, suggestions, new Set()), []);
});

test('matches section: an imported row and an unlinked entry of the same purchase are paired once', () => {
  const rows = [
    row(tx(1), { amount: 25, description: 'BLUE HERON CAFE #44' }),
    row(tx(2), { amount: 25, description: 'BLUE HERON CAFE #44', transaction_date: '2026-03-11', external_id: 'hash:other' }),
    row(tx(3), { source: 'manual', external_id: null, import_batch_id: null, account_id: null, transaction_date: '2026-03-09', vendor: 'Blue Heron Cafe' }),
    // Money in never matches money out.
    row(tx(4), { source: 'manual', external_id: null, import_batch_id: null, type: 'income' }),
    // An entry already linked to a statement row is not offered.
    row(tx(5), { source: 'manual', external_id: 'hash:x', import_batch_id: null }),
  ];
  const items = buildMatchSection(rows, ACCOUNTS, new Set());
  assert.equal(items.length, 1);
  assert.equal(items[0].entry.id, tx(3));
  // The closest date wins: tx(1) is one day from the entry, tx(2) two days.
  assert.equal(items[0].imported.id, tx(1));
  assert.equal(items[0].days_apart, 1);
  assert.ok(items[0].reasons.includes('Your entry has no account yet'));

  // "Not the same": that pair never comes back, and the next closest imported row is offered instead.
  const dismissed = new Set([dismissalKey('possible_match', tx(1), tx(3))]);
  const after = buildMatchSection(rows, ACCOUNTS, dismissed);
  assert.deepEqual(after.map((item) => [item.imported.id, item.entry.id]), [[tx(2), tx(3)]]);
});

test('pageOf: clamps to the list', () => {
  assert.deepEqual(pageOf([1, 2, 3, 4, 5], 2, 2), [3, 4]);
  assert.deepEqual(pageOf([1, 2, 3], -5, 2), [1, 2]);
  assert.deepEqual(pageOf([1, 2, 3], 10, 2), []);
});

test('readRange: checks the dates', () => {
  assert.deepEqual(readRange('2026-01-01', ''), { from: '2026-01-01', to: null });
  assert.throws(() => readRange('01/01/2026', null), isImportError(400));
  assert.throws(() => readRange('2026-02-01', '2026-01-01'), isImportError(400));
});

// ── The Review page (reads) ───────────────────────────────────────────────

test('buildReview: counts every section, pages them, and leaves other people\'s rows out', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [
    stored(tx(1), { description: 'ONLINE TRANSFER TO SAV 5345', vendor: null, amount: 200, category_id: CAT_DINING }),
    stored(tx(2), { account_id: SAVINGS, type: 'income', description: 'TRANSFER FROM CHK 1234', vendor: null, amount: 200, category_id: CAT_DINING }),
    stored(tx(3), { account_id: CARD, type: 'income', description: 'ONLINE PAYMENT THANK YOU', vendor: null, amount: 150, category_id: CAT_DINING }),
    stored(tx(4), { source: 'csv_import', external_id: 'hash:4', import_batch_id: BATCH }),
    stored(tx(5), { account_id: null }),
    stored(tx(6), { description: 'CORNER MARKET', vendor: 'Corner Market', amount: 40 }),
    // Grouped rows and a recorded transfer entry are never uncategorized items.
    stored(tx(7), { transfer_group_id: 'g1', amount: 99 }),
    stored(tx(8), { source: 'transfer', amount: 98, account_id: SAVINGS, description: 'Payment from x' }),
    stored(tx(9), { user_id: OTHER_USER, account_id: OTHER_ACCOUNT }),
  ]);
  const review = await buildReview(asDb(db), USER, { limit: 1 });
  assert.equal(review.counts.transfers, 1);
  assert.equal(review.counts.payments, 1);
  assert.equal(review.counts.matches, 1);
  // tx(4), tx(5), tx(6): uncategorized real spending. Not tx(7) (a transfer), tx(8) (recorded) or tx(9).
  assert.equal(review.counts.uncategorized, 3);
  assert.equal(review.sections.uncategorized.items.length, 1);
  assert.equal(review.counts.drafts, 0);
  assert.equal(review.counts.total, 6);
  assert.equal(review.saved_answers_available, true);
  // The only write is the clean-up of the person's expired drafts.
  assert.deepEqual(db.writes().filter((call) => call.table !== 'import_drafts' || call.op !== 'delete'), []);
});

test('buildReview: before migration 219 it still answers, and says answers can\'t be saved', async () => {
  const db = seededDb();
  db.missingTables = ['finance_review_dismissals', 'import_drafts'];
  db.seed('financial_transactions', [stored(tx(1))]);
  const review = await buildReview(asDb(db), USER);
  assert.equal(review.saved_answers_available, false);
  assert.equal(review.drafts, null);
  assert.equal(review.counts.uncategorized, 1);
});

// ── Review actions (writes) ───────────────────────────────────────────────

test('dismissSuggestions: saves answers about the user\'s own rows only, and saving twice adds nothing', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [
    stored(tx(1)),
    stored(tx(2), { account_id: SAVINGS, type: 'income' }),
    stored(tx(3), { user_id: OTHER_USER, account_id: OTHER_ACCOUNT }),
  ]);
  const items = [
    { section: 'transfer_pair', transaction_id: tx(1), other_transaction_id: tx(2) },
    { section: 'one_sided_payment', transaction_id: tx(3) },
  ];
  assert.deepEqual(await dismissSuggestions(asDb(db), USER, items), { dismissed: 1 });
  assert.deepEqual(await dismissSuggestions(asDb(db), USER, items), { dismissed: 1 });
  const saved = db.rows('finance_review_dismissals');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].user_id, USER);
  assert.equal(saved[0].transaction_id, tx(1));

  assert.deepEqual(await restoreDismissals(asDb(db), USER, ['transfer_pair']), { restored: 1 });
  assert.equal(db.rows('finance_review_dismissals').length, 0);
});

test('dismissSuggestions: before migration 219 the answer is "Run migration 219 first"', async () => {
  const db = seededDb();
  db.missingTables = ['finance_review_dismissals'];
  db.seed('financial_transactions', [stored(tx(1))]);
  await assert.rejects(
    () => dismissSuggestions(asDb(db), USER, [{ section: 'one_sided_payment', transaction_id: tx(1) }]),
    isImportError(503, REVIEW_MIGRATION_CODE),
  );
  assert.equal(isReviewSchemaMissing({ code: 'PGRST205', message: "Could not find the table 'public.import_drafts'" }), true);
  assert.equal(isReviewSchemaMissing({ code: 'PGRST205', message: "Could not find the table 'public.cash_counts'" }), false);
});

test('linkTransferPairs: links a valid pair once, refuses someone else\'s row and a mismatched amount', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [
    stored(tx(1), { amount: 200 }),
    stored(tx(2), { account_id: SAVINGS, type: 'income', amount: 200 }),
    stored(tx(3), { account_id: SAVINGS, type: 'income', amount: 201 }),
    stored(tx(4), { user_id: OTHER_USER, account_id: OTHER_ACCOUNT, type: 'income', amount: 200 }),
  ]);
  const result = await linkTransferPairs(asDb(db), USER, [
    { from_id: tx(1), to_id: tx(2) },
    { from_id: tx(1), to_id: tx(3) },
    { from_id: tx(1), to_id: tx(4) },
  ]);
  assert.equal(result.linked, 1);
  assert.equal(result.failed.length, 2);
  const rows = new Map(db.rows('financial_transactions').map((r) => [r.id, r]));
  assert.ok(rows.get(tx(1))?.transfer_group_id);
  assert.equal(rows.get(tx(1))?.transfer_group_id, rows.get(tx(2))?.transfer_group_id);
  assert.equal(rows.get(tx(2))?.transfer_kind, 'transfer');
  assert.equal(rows.get(tx(4))?.transfer_group_id ?? null, null);

  // Running it again changes nothing: both rows are already linked.
  const again = await linkTransferPairs(asDb(db), USER, [{ from_id: tx(1), to_id: tx(2) }]);
  assert.equal(again.linked, 0);
});

test('linkPayments: links to the matching withdrawal, else records it on the account chosen', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [
    stored(tx(1), { account_id: CARD, type: 'income', amount: 150, description: 'ONLINE PAYMENT THANK YOU', transaction_date: '2026-03-10' }),
    stored(tx(2), { account_id: CHECKING, type: 'expense', amount: 150, description: 'CARD CO PAYMENT', transaction_date: '2026-03-08' }),
    stored(tx(3), { account_id: CARD, type: 'income', amount: 80, description: 'PAYMENT', transaction_date: '2026-03-20' }),
  ]);
  const result = await linkPayments(asDb(db), USER, [
    { transaction_id: tx(1), account_id: CHECKING },
    { transaction_id: tx(3), account_id: CHECKING },
    { transaction_id: tx(1), account_id: OTHER_ACCOUNT },
  ]);
  assert.equal(result.linked, 1);
  assert.equal(result.recorded, 1);
  assert.equal(result.failed.length, 1);
  const rows = db.rows('financial_transactions');
  const recorded = rows.find((r) => r.source === 'transfer');
  assert.ok(recorded);
  assert.equal(recorded.account_id, CHECKING);
  assert.equal(recorded.type, 'expense');
  assert.equal(recorded.amount, 80);
  assert.match(String(recorded.description), /^Payment to Card Co Rewards Card ••9876$/);
  assert.equal(recorded.transfer_kind, 'card_payment');
  assert.equal(rows.find((r) => r.id === tx(3))?.transfer_group_id, recorded.transfer_group_id);
});

test('mergeMatches: keeps the entry with the statement identity and removes the imported copy', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [
    stored(tx(1), { source: 'csv_import', external_id: 'hash:1', import_batch_id: BATCH, category_id: CAT_DINING }),
    stored(tx(2), { account_id: null, transaction_date: '2026-03-09', vendor: null, description: 'Blue Heron Cafe lunch', category_id: null }),
    stored(tx(3), { source: 'csv_import', external_id: 'hash:3', import_batch_id: BATCH, amount: 70, description: 'CORNER MARKET' }),
    stored(tx(4), { account_id: null, amount: 70, description: 'Something else entirely', vendor: 'Hardware Barn' }),
  ]);
  const result = await mergeMatches(asDb(db), USER, [
    { imported_id: tx(1), entry_id: tx(2) },
    { imported_id: tx(3), entry_id: tx(4) },
  ]);
  assert.equal(result.merged, 1);
  assert.equal(result.failed.length, 1);
  const rows = new Map(db.rows('financial_transactions').map((r) => [r.id, r]));
  assert.equal(rows.has(tx(1)), false);
  const entry = rows.get(tx(2));
  assert.equal(entry?.external_id, 'hash:1');
  assert.equal(entry?.import_batch_id, BATCH);
  assert.equal(entry?.account_id, CHECKING);
  assert.equal(entry?.category_id, CAT_DINING);
  assert.equal(entry?.source, 'manual');
  // The pair that didn't look alike was left exactly as it was.
  assert.equal(rows.get(tx(3))?.external_id, 'hash:3');
});

test('categorizeRows: only the user\'s own category, only the user\'s own rows', async () => {
  const db = seededDb();
  db.seed('financial_transactions', [stored(tx(1)), stored(tx(2), { user_id: OTHER_USER, account_id: OTHER_ACCOUNT })]);
  await assert.rejects(() => categorizeRows(asDb(db), USER, [tx(1)], OTHER_CAT), isImportError(400));
  assert.deepEqual(await categorizeRows(asDb(db), USER, [tx(1), tx(2)], CAT_DINING), { updated: 1 });
  const rows = new Map(db.rows('financial_transactions').map((r) => [r.id, r]));
  assert.equal(rows.get(tx(1))?.category_id, CAT_DINING);
  assert.equal(rows.get(tx(2))?.category_id, null);
});

// ── Saved imports (drafts) ────────────────────────────────────────────────

test('readDecisions: keeps the known fields and drops the rest', () => {
  const decisions = readDecisions({
    '2': { action: 'skip', type: 'income', categoryId: CAT_DINING, cardKind: 'payment', transferAccountId: CHECKING, evil: true },
    '3': { action: 'delete-everything', categoryId: 'not-a-uuid' },
    abc: { action: 'skip' },
    '4': { categoryId: null },
  });
  assert.deepEqual(decisions, {
    2: { action: 'skip', type: 'income', categoryId: CAT_DINING, cardKind: 'payment', transferAccountId: CHECKING },
    4: { categoryId: null },
  });
  assert.throws(() => readDecisions([1, 2]), isImportError(400));
});

test('readDraftRows: a tampered row is kept as "can\'t import", never saved malformed', () => {
  const rows = readDraftRows([
    { rowNumber: 2, date: '2026-03-10', amountCents: 475, type: 'expense', description: 'CAFE', vendor: 'Cafe', hints: ['transfer', 'bogus'], issues: [] },
    { rowNumber: 3, date: 'yesterday', amountCents: 'lots', type: 'gift', description: 5 },
  ]);
  assert.deepEqual(rows[0].hints, ['transfer']);
  assert.equal(rows[0].issues.length, 0);
  assert.equal(rows[1].issues.length, 1);
});

test('assertDraftFits: past the importer\'s limits a draft is refused', () => {
  assert.throws(() => assertDraftFits(new Array(5001).fill({})), isImportError(413, 'draft_too_large'));
  assert.throws(() => assertDraftFits([{ description: 'x'.repeat(4_000_001) }]), isImportError(413, 'draft_too_large'));
  assertDraftFits(new Array(5000).fill({ a: 1 }));
});

test('drafts: preview saves the server\'s rows (never the file), resume re-checks duplicates against current data', async () => {
  const db = seededDb();
  const response = await previewAndSaveDraft(asDb(db), USER, csvBody({ remember: true }));
  assert.ok(response.draft);
  assert.deepEqual(response.rows.map((r) => r.status), ['new', 'new', 'new']);
  const saved = db.rows('import_drafts');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].user_id, USER);
  assert.equal(saved[0].source, 'csv');
  assert.equal(saved[0].file_name, 'march.csv');
  // The raw file is not in the draft anywhere.
  assert.equal(JSON.stringify(saved[0]).includes('03/10/2026,BLUE HERON CAFE'), false);
  assert.equal(saved[0].row_count, 4);
  assert.deepEqual(saved[0].rejected, [{ row: 5, reason: 'No description' }]);
  assert.equal((saved[0].mapping as { remember: boolean }).remember, true);
  const expires = Date.parse(String(saved[0].expires_at)) - Date.parse(String(saved[0].updated_at));
  assert.equal(Math.round(expires / 86_400_000), DRAFT_TTL_DAYS);

  // The person picks choices; the autosave keeps them.
  await updateDraftChoices(asDb(db), USER, response.draft.id, {
    decisions: { 2: { categoryId: CAT_DINING }, 3: { action: 'skip' } },
    options: { recordMissing: false },
  });

  // Meanwhile the corner market row arrives some other way.
  db.seed('financial_transactions', [
    stored(tx(1), { transaction_date: '2026-03-11', amount: 23.1, description: 'CORNER MARKET #12', vendor: 'Corner Market', source: 'bank_sync' }),
  ]);
  const resumed = await resumeDraft(asDb(db), USER, response.draft.id);
  assert.deepEqual(resumed.preview.rows.map((r) => r.status), ['new', 'duplicate', 'new']);
  assert.equal(resumed.changedSinceSave, 1);
  assert.deepEqual(resumed.draft.decisions, { 2: { categoryId: CAT_DINING }, 3: { action: 'skip' } });
  assert.deepEqual(resumed.draft.options, { recordMissing: false, confirmUnreconciled: false });
  assert.deepEqual(resumed.preview.rejected, [{ row: 5, reason: 'No description' }]);
  assert.equal(resumed.preview.account.id, CHECKING);
});

test('drafts: a second preview of the same file replaces the older draft instead of adding one', async () => {
  const db = seededDb();
  const first = await previewAndSaveDraft(asDb(db), USER, csvBody());
  const second = await previewAndSaveDraft(asDb(db), USER, csvBody());
  assert.notEqual(first.draft?.id, second.draft?.id);
  assert.equal(db.rows('import_drafts').length, 1);
  const third = await previewAndSaveDraft(asDb(db), USER, csvBody({ draft_id: second.draft?.id }));
  assert.equal(third.draft?.id, second.draft?.id);
  assert.equal(db.rows('import_drafts').length, 1);
});

test('drafts: another person can\'t read, change, finish or discard a draft', async () => {
  const db = seededDb();
  const { draft } = await previewAndSaveDraft(asDb(db), USER, csvBody());
  assert.ok(draft);
  await assert.rejects(() => loadDraft(asDb(db), OTHER_USER, draft.id), isImportError(404, 'draft_not_found'));
  await assert.rejects(() => resumeDraft(asDb(db), OTHER_USER, draft.id), isImportError(404));
  await assert.rejects(() => updateDraftChoices(asDb(db), OTHER_USER, draft.id, { decisions: {} }), isImportError(404));
  await assert.rejects(() => commitDraft(asDb(db), OTHER_USER, draft.id, {}), isImportError(404));
  assert.equal(await deleteDraft(asDb(db), OTHER_USER, draft.id), false);
  assert.equal(db.rows('import_drafts').length, 1);
  assert.deepEqual(await listDrafts(asDb(db), OTHER_USER), []);
  assert.equal((await listDrafts(asDb(db), USER)).length, 1);
});

test('drafts: a draft for an account that isn\'t the user\'s is never saved', async () => {
  const db = seededDb();
  await assert.rejects(() => previewAndSaveDraft(asDb(db), USER, csvBody({ account_id: OTHER_ACCOUNT })), isImportError(404));
  assert.equal(db.rows('import_drafts').length, 0);
});

test('drafts: an expired draft is gone, and is deleted when the drafts are listed', async () => {
  const db = seededDb();
  db.seed('import_drafts', [
    { id: tx(50), user_id: USER, account_id: CHECKING, source: 'csv', file_name: 'old.csv', rows: [], rejected: [], skipped: [], decisions: {}, options: {}, row_count: 0, expires_at: '2020-01-01T00:00:00.000Z' },
    { id: tx(51), user_id: USER, account_id: CHECKING, source: 'csv', file_name: 'new.csv', rows: [], rejected: [], skipped: [], decisions: {}, options: {}, row_count: 0, expires_at: '2999-01-01T00:00:00.000Z' },
  ]);
  await assert.rejects(() => loadDraft(asDb(db), USER, tx(50)), isImportError(404));
  db.seed('import_drafts', [
    { id: tx(52), user_id: USER, account_id: CHECKING, source: 'csv', file_name: 'older.csv', rows: [], rejected: [], skipped: [], decisions: {}, options: {}, row_count: 0, expires_at: '2020-01-01T00:00:00.000Z' },
  ]);
  const listed = await listDrafts(asDb(db), USER);
  assert.deepEqual(listed.map((draft) => draft.id), [tx(51)]);
  assert.deepEqual(db.rows('import_drafts').map((draft) => draft.id), [tx(51)]);
  await assert.rejects(() => updateDraftChoices(asDb(db), USER, tx(50), { decisions: {} }), isImportError(404));
});

test('drafts: finishing imports with the saved choices, against current data, then deletes the draft', async () => {
  const db = seededDb();
  const { draft } = await previewAndSaveDraft(asDb(db), USER, csvBody());
  assert.ok(draft);
  db.seed('financial_transactions', [
    stored(tx(1), { transaction_date: '2026-03-11', amount: 23.1, description: 'CORNER MARKET #12', vendor: 'Corner Market', source: 'bank_sync' }),
  ]);
  const result = await commitDraft(asDb(db), USER, draft.id, {
    actions: [{ row: 2, category_id: CAT_DINING }, { row: 4, action: 'skip' }],
  });
  assert.equal(result.inserted, 1);
  assert.equal(result.duplicates, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.invalid, 1);
  assert.equal(result.draftDeleted, true);
  assert.equal(db.rows('import_drafts').length, 0);
  const inserted = db.rows('financial_transactions').find((r) => r.source === 'csv_import');
  assert.equal(inserted?.category_id, CAT_DINING);
  assert.equal(inserted?.import_batch_id, result.batchId);
  const batch = db.rows('import_batches')[0];
  assert.equal(batch.file_name, 'march.csv');
  assert.equal(batch.source, 'csv_import');

  await assert.rejects(() => commitDraft(asDb(db), USER, draft.id, {}), isImportError(404));
});

test('drafts: before migration 219 the preview still answers and says why it wasn\'t kept', async () => {
  const db = seededDb();
  db.missingTables = ['import_drafts'];
  const response = await previewAndSaveDraft(asDb(db), USER, csvBody());
  assert.equal(response.draft, null);
  assert.equal(response.draftError?.code, REVIEW_MIGRATION_CODE);
  assert.match(response.draftError?.message ?? '', /Run migration 219 first/);
  assert.equal(response.rows.length, 3);
  await assert.rejects(() => listDrafts(asDb(db), USER), isImportError(503, REVIEW_MIGRATION_CODE));
});

test('countChangedStatuses and plainRows', () => {
  assert.equal(countChangedStatuses({ 2: 'new', 3: 'new' }, [{ rowNumber: 2, status: 'new' }, { rowNumber: 3, status: 'duplicate' }, { rowNumber: 4, status: 'new' }]), 1);
  assert.equal(countChangedStatuses(null, [{ rowNumber: 2, status: 'new' }]), 0);
  const planned = { rowNumber: 2, date: '2026-03-10', amountCents: 1, type: 'expense' as const, description: 'x', vendor: '', hints: [], issues: [], status: 'new', externalId: 'hash:x' };
  assert.deepEqual(Object.keys(plainRows([planned])[0]).sort(), ['amountCents', 'date', 'description', 'hints', 'issues', 'rowNumber', 'type', 'vendor']);
});

// ── Editing a past import ─────────────────────────────────────────────────

function seedBatches(db: FakeDb): void {
  db.seed('import_batches', [
    { id: BATCH, user_id: USER, account_id: CHECKING, file_name: 'march.csv', row_count: 3 },
    { id: OTHER_BATCH, user_id: OTHER_USER, account_id: OTHER_ACCOUNT, file_name: 'theirs.csv', row_count: 1 },
  ]);
}

test('readBatchEdit: checks ids and changes', () => {
  assert.throws(() => readBatchEdit({ ids: [], changes: { type: 'income' } }), isImportError(400));
  assert.throws(() => readBatchEdit({ ids: [tx(1)], changes: {} }), isImportError(400));
  assert.throws(() => readBatchEdit({ ids: [tx(1)], changes: { type: 'refund' } }), isImportError(400));
  assert.deepEqual(readBatchEdit({ ids: [tx(1), tx(1)], changes: { vendor: '  Cafe  ', category_id: null } }), {
    ids: [tx(1)],
    changes: { vendor: 'Cafe', category_id: null },
  });
});

test('batch edits: only the user\'s import, only its rows, only the user\'s category', async () => {
  const db = seededDb();
  seedBatches(db);
  db.seed('financial_transactions', [
    stored(tx(1), { source: 'csv_import', import_batch_id: BATCH, external_id: 'hash:1' }),
    stored(tx(2), { source: 'csv_import', import_batch_id: BATCH, external_id: 'hash:2', transfer_group_id: 'g1' }),
    stored(tx(3), { source: 'csv_import', import_batch_id: null, external_id: 'hash:3' }),
    stored(tx(4), { user_id: OTHER_USER, account_id: OTHER_ACCOUNT, import_batch_id: OTHER_BATCH, source: 'csv_import' }),
  ]);

  await assert.rejects(() => editBatchRows(asDb(db), USER, OTHER_BATCH, { ids: [tx(4)], changes: { vendor: 'x' } }), isImportError(404));
  await assert.rejects(() => editBatchRows(asDb(db), OTHER_USER, BATCH, { ids: [tx(1)], changes: { vendor: 'x' } }), isImportError(404));
  await assert.rejects(
    () => editBatchRows(asDb(db), USER, BATCH, { ids: [tx(1)], changes: { category_id: OTHER_CAT } }),
    isImportError(400, 'bad_reference'),
  );

  db.tick(60_000);
  const result = await editBatchRows(asDb(db), USER, BATCH, {
    ids: [tx(1), tx(2), tx(3), tx(4)],
    changes: { type: 'income', category_id: CAT_DINING },
  });
  assert.equal(result.updated, 1);
  assert.deepEqual(result.skipped.map((s) => s.id).sort(), [tx(2), tx(3), tx(4)].sort());
  const rows = new Map(db.rows('financial_transactions').map((r) => [r.id, r]));
  assert.equal(rows.get(tx(1))?.type, 'income');
  assert.equal(rows.get(tx(1))?.category_id, CAT_DINING);
  assert.equal(rows.get(tx(2))?.type, 'expense');
  assert.equal(rows.get(tx(3))?.category_id, null);
  assert.equal(rows.get(tx(4))?.category_id, null);

  // A category change is fine on one side of a transfer.
  const categoryOnly = await editBatchRows(asDb(db), USER, BATCH, { ids: [tx(2)], changes: { category_id: CAT_DINING } });
  assert.equal(categoryOnly.updated, 1);

  const listed = await listBatchRows(asDb(db), USER, BATCH);
  assert.equal(listed.total, 2);
  assert.equal(listed.rows.find((r) => r.id === tx(1))?.edited, true);
  await assert.rejects(() => listBatchRows(asDb(db), OTHER_USER, BATCH), isImportError(404));
});

test('batch delete: removes rows the import added, never the person\'s own entry, and takes apart their transfers', async () => {
  const db = seededDb();
  seedBatches(db);
  db.seed('financial_transactions', [
    stored(tx(1), { source: 'csv_import', import_batch_id: BATCH, external_id: 'hash:1', account_id: CARD, type: 'income', transfer_group_id: 'g1' }),
    stored(tx(2), { source: 'transfer', account_id: CHECKING, transfer_group_id: 'g1' }),
    stored(tx(3), { source: 'manual', import_batch_id: BATCH, external_id: 'hash:3' }),
  ]);
  const result = await deleteBatchRows(asDb(db), USER, BATCH, { ids: [tx(1), tx(3)] });
  assert.equal(result.deleted, 1);
  assert.equal(result.counterEntriesRemoved, 1);
  assert.deepEqual(result.skipped.map((s) => s.id), [tx(3)]);
  assert.deepEqual(db.rows('financial_transactions').map((r) => r.id), [tx(3)]);
  await assert.rejects(() => deleteBatchRows(asDb(db), OTHER_USER, BATCH, { ids: [tx(3)] }), isImportError(404));
});

test('re-run transfer matching: links the import\'s clear transfers once; running it again changes nothing', async () => {
  const db = seededDb();
  seedBatches(db);
  db.seed('financial_transactions', [
    stored(tx(1), { source: 'csv_import', import_batch_id: BATCH, external_id: 'hash:1', description: 'ONLINE TRANSFER TO SAV 5345', vendor: null, amount: 200, transaction_date: '2026-03-10' }),
    stored(tx(2), { source: 'csv_import', import_batch_id: null, external_id: 'hash:2', account_id: SAVINGS, type: 'income', description: 'TRANSFER FROM CHK 1234', vendor: null, amount: 200, transaction_date: '2026-03-11' }),
    // A round amount with two possible partners is only counted for review.
    stored(tx(3), { source: 'csv_import', import_batch_id: BATCH, external_id: 'hash:3', description: 'ATM', vendor: null, amount: 60, transaction_date: '2026-03-12' }),
    stored(tx(4), { account_id: SAVINGS, type: 'income', description: 'DEPOSIT', vendor: null, amount: 60, transaction_date: '2026-03-12' }),
    stored(tx(5), { account_id: CARD, type: 'income', description: 'CREDIT', vendor: null, amount: 60, transaction_date: '2026-03-13' }),
  ]);
  const first = await rematchBatchTransfers(asDb(db), USER, BATCH);
  assert.equal(first.linked, 1);
  assert.equal(first.toReview, 1);
  assert.equal(first.checked, 2);
  const groupsAfterFirst = db.rows('financial_transactions').map((r) => r.transfer_group_id ?? null);

  const second = await rematchBatchTransfers(asDb(db), USER, BATCH);
  assert.equal(second.linked, 0);
  assert.equal(second.checked, 1);
  assert.deepEqual(db.rows('financial_transactions').map((r) => r.transfer_group_id ?? null), groupsAfterFirst);

  await assert.rejects(() => rematchBatchTransfers(asDb(db), OTHER_USER, BATCH), isImportError(404));
});

test('re-run transfer matching: a pair the person turned down is left alone', async () => {
  const db = seededDb();
  seedBatches(db);
  db.seed('financial_transactions', [
    stored(tx(1), { source: 'csv_import', import_batch_id: BATCH, external_id: 'hash:1', description: 'ONLINE TRANSFER TO SAV 5345', vendor: null, amount: 200 }),
    stored(tx(2), { account_id: SAVINGS, type: 'income', description: 'TRANSFER FROM CHK 1234', vendor: null, amount: 200 }),
  ]);
  db.seed('finance_review_dismissals', [
    { user_id: USER, section: 'transfer_pair', transaction_id: tx(1), other_transaction_id: tx(2) },
  ]);
  const result = await rematchBatchTransfers(asDb(db), USER, BATCH);
  assert.equal(result.linked, 0);
  assert.equal(result.toReview, 0);
});
