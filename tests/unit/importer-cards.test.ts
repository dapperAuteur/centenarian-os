// tests/unit/importer-cards.test.ts
// Unit tests for the statement importer's card handling and status colors:
// card terms (charge / payment / refund / interest / fee), payments linked as
// transfers at commit and taken apart by undo, refunds as negative spending,
// the one status color scale, and the website-activity PDF parsers.
// Run: npm run test:unit
//
// Every fixture is SYNTHETIC: made-up merchants, accounts and amounts, laid
// out the way the real exports and printouts are. No real statement content.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildSpendingSeries, UNCATEGORIZED } from '../../lib/finance/budgets/logic.ts';
import {
  accountNamedIn,
  cardKindFor,
  cardKindLabel,
  cardKindSummary,
  countCardKinds,
  importExplanation,
  signOptionText,
  transferPickerAccounts,
  transferRoleFor,
  typeForCardKind,
} from '../../lib/finance/csv-import/card-terms.ts';
import { commitImport, resolveActions, transferIntents } from '../../lib/finance/csv-import/commit.ts';
import { buildPlanIndex, findTransferEntry, identifyRows, planImport, planRows } from '../../lib/finance/csv-import/plan.ts';
import { readActions, suggestPaidFrom } from '../../lib/finance/csv-import/service.ts';
import {
  TONE_CLASSES,
  planStatusChipLabel,
  toneForCsvDetection,
  toneForPdfDetection,
  toneForPlanStatus,
  toneForReconciliation,
  type StatusTone,
} from '../../lib/finance/csv-import/status-tones.ts';
import { PAYMENT_WINDOW_DAYS, counterEntryDescription, pickCounterpart } from '../../lib/finance/csv-import/transfer-links.ts';
import type { NormalizedRow, PlannedRow } from '../../lib/finance/csv-import/types.ts';
import {
  STATUS_LABELS,
  applyDecision,
  buildRowActions,
  effectiveTransferAccount,
  rowTransferRole,
  transferCounts,
  type ImportAccount,
  type TransferContext,
} from '../../lib/finance/csv-import/ui-helpers.ts';
import { undoBatch } from '../../lib/finance/csv-import/undo.ts';
import { sniffSpreadsheet } from '../../lib/finance/pdf-import/client.ts';
import { detectIssuer } from '../../lib/finance/pdf-import/issuers/index.ts';
import { parseWebActivity, webActivityKind } from '../../lib/finance/pdf-import/issuers/web-activity.ts';
import { needsReconciliationConfirmation, reconcileStatement } from '../../lib/finance/pdf-import/reconcile.ts';
import type { PdfLine } from '../../lib/finance/pdf-import/types.ts';
import { signedSpending, totalsRole } from '../../lib/finance/refunds.ts';
import { FakeDb } from './fake-supabase.ts';
import type { Row } from './fake-supabase.ts';

const asDb = (fake: FakeDb) => fake as unknown as SupabaseClient;
const USER = '11111111-1111-4111-8111-111111111111';
const CARD = '22222222-2222-4222-8222-222222222222';
const CHECKING = '33333333-3333-4333-8333-333333333333';
const SAVINGS = '44444444-4444-4444-8444-444444444444';
const LOAN = '55555555-5555-4555-8555-555555555555';
const OTHER_CARD = '66666666-6666-4666-8666-666666666666';

const ACCOUNTS: ImportAccount[] = [
  { id: CARD, name: 'Rewards Visa', account_type: 'credit_card', institution_name: 'Sample Card Co', last_four: '1111' },
  { id: CHECKING, name: 'Business Checking', account_type: 'checking', institution_name: 'Desert Credit Union', last_four: '2222' },
  { id: SAVINGS, name: 'Savings', account_type: 'savings', institution_name: 'Desert Credit Union', last_four: '3333', is_active: false },
  { id: LOAN, name: 'Auto Loan', account_type: 'loan', institution_name: 'Desert Credit Union', last_four: '4444' },
  { id: OTHER_CARD, name: 'Store Card', account_type: 'credit_card', institution_name: 'Pinecone Bank', last_four: '5555' },
];

function row(rowNumber: number, overrides: Partial<NormalizedRow> = {}): NormalizedRow {
  return {
    rowNumber,
    date: '2026-03-10',
    amountCents: 12000,
    type: 'income',
    description: 'ONLINE PAYMENT, THANK YOU',
    vendor: 'Online Payment Thank You',
    hints: ['card_payment'],
    issues: [],
    ...overrides,
  };
}

function planned(rows: NormalizedRow[]): PlannedRow[] {
  const identified = identifyRows(rows, false);
  return planRows(identified, buildPlanIndex({ accountId: CARD, accountRows: [] }));
}

// ── Card terms ────────────────────────────────────────────────────────────

test('cardKindFor: payments, refunds, interest, fees and charges from the wording', () => {
  assert.equal(cardKindFor(row(1)), 'payment');
  assert.equal(cardKindFor(row(1, { description: 'Payment Home Banking Transfer', hints: ['transfer'] })), 'payment');
  assert.equal(cardKindFor(row(1, { description: 'AUTOPAY 260310', hints: ['card_payment'] })), 'payment');
  assert.equal(cardKindFor(row(1, { description: 'QUILL BOOKS', hints: [] })), 'refund');
  assert.equal(cardKindFor(row(1, { description: 'PAYMENT REVERSAL', hints: [] })), 'refund');
  assert.equal(cardKindFor(row(1, { type: 'expense', description: 'INTEREST CHARGED TO STANDARD PURCH', hints: [] })), 'interest');
  assert.equal(cardKindFor(row(1, { type: 'expense', description: 'Interest Charge on Purchases', hints: [] })), 'interest');
  assert.equal(cardKindFor(row(1, { type: 'expense', description: 'LATE FEE', hints: [] })), 'fee');
  assert.equal(cardKindFor(row(1, { type: 'expense', description: 'Fee Credit Card - ANNUAL', hints: [] })), 'fee');
  assert.equal(cardKindFor(row(1, { type: 'expense', description: 'BLUE HERON CAFE', hints: [] })), 'charge');
  // "No interest if paid in full" is a promotion, not interest.
  assert.equal(cardKindFor(row(1, { type: 'expense', description: 'No Interest if paid in full', hints: [] })), 'charge');
});

test('cardKindFor: a PDF section wins, unless the person flipped the direction', () => {
  assert.equal(cardKindFor({ type: 'expense', description: 'ANYTHING', kind: 'interest' }), 'interest');
  assert.equal(cardKindFor({ type: 'expense', description: 'ANYTHING', kind: 'fee' }), 'fee');
  assert.equal(cardKindFor({ type: 'income', description: 'ANYTHING', kind: 'credit' }), 'refund');
  assert.equal(cardKindFor({ type: 'expense', description: 'ANYTHING', kind: 'cash_advance' }), 'charge');
  // Flipped to income: the purchase section no longer applies.
  assert.equal(cardKindFor({ type: 'expense', description: 'ANYTHING', kind: 'purchase' }, 'income'), 'refund');
});

test('card terms: stored types, labels, counts and the explanation line', () => {
  assert.deepEqual(
    (['charge', 'payment', 'refund', 'interest', 'fee'] as const).map(typeForCardKind),
    ['expense', 'income', 'income', 'expense', 'expense'],
  );
  assert.equal(cardKindLabel('refund', 'credit_card'), 'Refund or credit');
  assert.equal(cardKindLabel('refund', 'loan'), 'Credit');
  const counts = countCardKinds([
    row(1),
    row(2),
    row(3, { type: 'expense', description: 'BLUE HERON CAFE', hints: [] }),
    row(4, { type: 'income', description: 'QUILL BOOKS', hints: [] }),
  ]);
  assert.equal(cardKindSummary(counts, 'credit_card'), '1 charge, 2 payments, 1 refund or credit');
  assert.match(importExplanation('credit_card'), /never counted as income/);
  assert.match(importExplanation('credit_card'), /refund counts as less spending/);
  assert.match(importExplanation('loan'), /loan/);
  assert.match(importExplanation('checking'), /transfer/);
});

test('signOptionText: a card statement is worded in charges', () => {
  assert.equal(signOptionText('positive_is_expense', 'credit_card').label, 'Charges appear as positive numbers');
  assert.equal(signOptionText('negative_is_expense', 'loan').label, 'Charges appear as negative numbers');
  assert.equal(signOptionText('positive_is_expense', 'checking').label, 'Purchases are positive numbers');
  assert.equal(signOptionText('split_columns', 'credit_card').label, 'Separate charge and payment columns');
});

test('transferRoleFor: card payments are paid from somewhere; bank rows that name a card paid it', () => {
  assert.equal(transferRoleFor(row(1), 'credit_card'), 'paid_from');
  assert.equal(transferRoleFor(row(1, { description: 'QUILL BOOKS', hints: [] }), 'credit_card'), null);
  assert.equal(transferRoleFor(row(1, { type: 'expense', hints: [] }), 'credit_card'), null);
  assert.equal(transferRoleFor(row(1), 'loan'), 'paid_from');
  const bankPayment = row(1, { type: 'expense', description: 'Withdrawal SAMPLE CARD CO ONLINE', hints: ['card_payment'] });
  assert.equal(transferRoleFor(bankPayment, 'checking'), 'paid_to');
  assert.equal(transferRoleFor({ ...bankPayment, hints: ['loan_payment'] }, 'checking'), 'paid_to');
  assert.equal(transferRoleFor({ ...bankPayment, hints: [] }, 'checking'), null);
  assert.equal(transferRoleFor({ ...bankPayment, type: 'income' }, 'checking'), null);
});

test('pickers: paid-from lists other active accounts, bank first; this-paid lists cards and loans', () => {
  assert.deepEqual(
    transferPickerAccounts('paid_from', ACCOUNTS, CARD).map((a) => a.id),
    [CHECKING, LOAN, OTHER_CARD],
  );
  assert.deepEqual(transferPickerAccounts('paid_to', ACCOUNTS, CHECKING).map((a) => a.id), [CARD, LOAN, OTHER_CARD]);
});

test('accountNamedIn: a description naming exactly one card or loan picks it', () => {
  const debts = transferPickerAccounts('paid_to', ACCOUNTS, CHECKING);
  assert.equal(accountNamedIn('Withdrawal PINECONE BANK EPAY', debts)?.id, OTHER_CARD);
  assert.equal(accountNamedIn('Transfer To Loan 4444', debts)?.id, LOAN);
  // "Desert" names the loan's institution only once among cards and loans.
  assert.equal(accountNamedIn('DESERT CU LOAN PMT', debts)?.id, LOAN);
  assert.equal(accountNamedIn('Withdrawal CARD PAYMENT', debts), null);
});

// ── Review decisions: payments as transfers ───────────────────────────────

function context(overrides: Partial<TransferContext> = {}): TransferContext {
  return { accountId: CARD, accountType: 'credit_card', accounts: ACCOUNTS, paidFromDefault: CHECKING, recordMissing: true, ...overrides };
}

test('effectiveTransferAccount: the remembered paid-from account is the default, and can be changed or cleared', () => {
  const [payment, charge] = planned([row(2), row(3, { type: 'expense', description: 'BLUE HERON CAFE', hints: [] })]);
  assert.equal(effectiveTransferAccount(payment, undefined, context()), CHECKING);
  assert.equal(effectiveTransferAccount(payment, { transferAccountId: LOAN }, context()), LOAN);
  assert.equal(effectiveTransferAccount(payment, { transferAccountId: null }, context()), null);
  assert.equal(effectiveTransferAccount(payment, undefined, context({ paidFromDefault: null })), null);
  // An inactive or unknown account is never used.
  assert.equal(effectiveTransferAccount(payment, { transferAccountId: SAVINGS }, context()), null);
  assert.equal(effectiveTransferAccount(charge, undefined, context()), null);
  // Skipped rows, and a payment re-labelled as a refund, are not linked.
  assert.equal(rowTransferRole(payment, { action: 'skip' }, 'credit_card'), null);
  assert.equal(rowTransferRole(payment, { cardKind: 'refund' }, 'credit_card'), null);
});

test('applyDecision: choosing a card kind sets the stored direction with it', () => {
  const [charge] = planned([row(2, { type: 'expense', description: 'BLUE HERON CAFE', hints: [] })]);
  const decisions = applyDecision({}, [charge], { cardKind: 'refund' });
  assert.deepEqual(decisions[2], { cardKind: 'refund', type: 'income' });
  const flipped = applyDecision(decisions, [charge], { type: 'expense' });
  assert.deepEqual(flipped[2], { type: 'expense' });
});

test('buildRowActions: every linked payment carries its account, even untouched', () => {
  const rows = planned([row(2), row(3, { type: 'expense', description: 'BLUE HERON CAFE', hints: [] }), row(4)]);
  const actions = buildRowActions(rows, { 4: { transferAccountId: null } }, context());
  assert.deepEqual(actions, [{ row: 2, transfer_account_id: CHECKING }]);
  const noRecording = buildRowActions(rows, {}, context({ recordMissing: false }));
  assert.deepEqual(noRecording[0], { row: 2, transfer_account_id: CHECKING, record_missing: false });
  assert.deepEqual(transferCounts(rows, { 4: { transferAccountId: null } }, context()), { linked: 1, unassigned: 1 });
  // Without a context (an older page), nothing about transfers is sent.
  assert.deepEqual(buildRowActions(rows, {}), []);
});

test('readActions: the transfer account must be an id; record_missing is optional', () => {
  assert.deepEqual(readActions([{ row: 2, transfer_account_id: CHECKING }]), [{ row: 2, transferAccountId: CHECKING }]);
  assert.deepEqual(readActions([{ row: 2, transfer_account_id: CHECKING, record_missing: false }]), [
    { row: 2, transferAccountId: CHECKING, recordMissing: false },
  ]);
  assert.throws(() => readActions([{ row: 2, transfer_account_id: 'checking' }]), /not valid/);
});

// ── Commit and undo: linking against a fake database ──────────────────────

function seeded(): FakeDb {
  const db = new FakeDb();
  db.seed(
    'financial_accounts',
    ACCOUNTS.map((account) => ({ ...account, user_id: USER })),
  );
  db.seed('budget_categories', []);
  return db;
}

function stored(overrides: Row): Row {
  return {
    user_id: USER,
    account_id: CHECKING,
    transaction_date: '2026-03-09',
    amount: 120,
    type: 'expense',
    description: 'Withdrawal SAMPLE CARD CO ONLINE',
    vendor: null,
    category_id: null,
    external_id: 'bank:CHK-1',
    import_batch_id: null,
    source: 'csv_import',
    transfer_group_id: null,
    ...overrides,
  };
}

async function importCard(db: FakeDb, rows: NormalizedRow[], actions: Parameters<typeof resolveActions>[1]) {
  const plan = await planImport(asDb(db), USER, CARD, rows);
  return commitImport(asDb(db), USER, {
    accountId: CARD,
    account: { id: CARD, name: 'Rewards Visa', account_type: 'credit_card', institution_name: 'Sample Card Co', last_four: '1111' },
    rows: resolveActions(plan.rows, actions),
  });
}

const txns = (db: FakeDb) => db.rows('financial_transactions');

test('commit: a payment whose withdrawal is already on the paying account is linked to it', async () => {
  const db = seeded();
  db.seed('financial_transactions', [
    stored({ id: 'chk-far', transaction_date: '2026-02-20' }),
    stored({ id: 'chk-near', transaction_date: '2026-03-09', external_id: 'bank:CHK-2' }),
  ]);
  const result = await importCard(db, [row(2)], [{ row: 2, transferAccountId: CHECKING }]);
  assert.deepEqual(result.transfers, { linked: 1, recorded: 0, unmatched: 0, failed: [] });
  const payment = txns(db).find((r) => r.account_id === CARD) as Row;
  const near = txns(db).find((r) => r.id === 'chk-near') as Row;
  assert.ok(payment.transfer_group_id);
  assert.equal(near.transfer_group_id, payment.transfer_group_id);
  assert.equal(payment.transfer_kind, 'card_payment');
  // The one more than five days away is left alone.
  assert.equal((txns(db).find((r) => r.id === 'chk-far') as Row).transfer_group_id, null);
});

test('commit: with no matching withdrawal, the payment is recorded on the paying account', async () => {
  const db = seeded();
  const result = await importCard(db, [row(2)], [{ row: 2, transferAccountId: CHECKING }]);
  assert.deepEqual(result.transfers, { linked: 0, recorded: 1, unmatched: 0, failed: [] });
  const counter = txns(db).find((r) => r.account_id === CHECKING) as Row;
  assert.equal(counter.source, 'transfer');
  assert.equal(counter.type, 'expense');
  assert.equal(counter.amount, 120);
  assert.equal(counter.transaction_date, '2026-03-10');
  assert.equal(counter.description, 'Payment to Sample Card Co Rewards Visa ••1111');
  assert.equal(counter.import_batch_id ?? null, null);
  const payment = txns(db).find((r) => r.account_id === CARD) as Row;
  assert.equal(payment.transfer_group_id, counter.transfer_group_id);
});

test('commit: recording turned off leaves an unmatched payment unlinked', async () => {
  const db = seeded();
  const result = await importCard(db, [row(2)], [{ row: 2, transferAccountId: CHECKING, recordMissing: false }]);
  assert.deepEqual(result.transfers, { linked: 0, recorded: 0, unmatched: 1, failed: [] });
  assert.equal(txns(db).length, 1);
  assert.equal(txns(db)[0].transfer_group_id ?? null, null);
});

test('commit: an account that is not the person\'s is refused for that row only', async () => {
  const db = seeded();
  const stranger = '77777777-7777-4777-8777-777777777777';
  const result = await importCard(db, [row(2), row(3, { date: '2026-03-11' })], [
    { row: 2, transferAccountId: stranger },
    { row: 3, transferAccountId: CHECKING },
  ]);
  assert.equal(result.inserted, 2);
  assert.equal(result.transfers?.recorded, 1);
  assert.deepEqual(result.transfers?.failed.map((f) => f.row), [2]);
});

test('plan: the bank statement imported later links to the recorded payment instead of adding it twice', async () => {
  const db = seeded();
  await importCard(db, [row(2)], [{ row: 2, transferAccountId: CHECKING }]);
  const counter = txns(db).find((r) => r.account_id === CHECKING) as Row;

  const bankRow = row(5, {
    date: '2026-03-11',
    type: 'expense',
    description: 'Withdrawal SAMPLE CARD CO ONLINE',
    hints: ['card_payment'],
    bankId: 'CHK-9',
  });
  const plan = await planImport(asDb(db), USER, CHECKING, [bankRow]);
  assert.equal(plan.rows[0].status, 'matches');
  assert.equal(plan.rows[0].match?.id, counter.id);
  assert.equal(plan.rows[0].match?.source, 'transfer');

  const result = await commitImport(asDb(db), USER, { accountId: CHECKING, rows: resolveActions(plan.rows, []) });
  assert.equal(result.linked, 1);
  assert.equal(result.inserted, 0);
  assert.equal(counter.external_id, 'bank:CHK-9');
  assert.ok(counter.transfer_group_id, 'stays one side of the transfer');
});

test('findTransferEntry: only payment-like rows, same direction and cents, within the window', () => {
  const entry = { id: 't1', transaction_date: '2026-03-10', amount: 120, type: 'expense', vendor: null, description: 'Payment to X', account_id: CHECKING };
  const index = { transferEntries: [entry] };
  const claims = { claimedMatches: new Set<string>() };
  const base = { type: 'expense' as const, amountCents: 12000, date: '2026-03-12', hints: ['card_payment' as const] };
  assert.equal(findTransferEntry(base, index, claims)?.id, 't1');
  assert.equal(findTransferEntry({ ...base, hints: [] }, index, claims), null);
  assert.equal(findTransferEntry({ ...base, amountCents: 12001 }, index, claims), null);
  assert.equal(findTransferEntry({ ...base, date: '2026-03-20' }, index, claims), null);
  assert.equal(findTransferEntry({ ...base, type: 'income' }, index, claims), null);
  assert.equal(findTransferEntry({ ...base, hints: [], kind: 'payment' }, index, claims)?.id, 't1');
});

test('undo: the recorded payment is deleted and the linked withdrawal is unlinked', async () => {
  const db = seeded();
  db.seed('financial_transactions', [stored({ id: 'chk-near' })]);
  const first = await importCard(db, [row(2)], [{ row: 2, transferAccountId: CHECKING }]);
  const second = await importCard(db, [row(3, { date: '2026-04-10', amountCents: 5000 })], [{ row: 3, transferAccountId: CHECKING }]);
  assert.equal(first.transfers?.linked, 1);
  assert.equal(second.transfers?.recorded, 1);
  db.tick(3_600_000);

  const undoneSecond = await undoBatch(asDb(db), USER, second.batchId);
  assert.equal(undoneSecond.transfersUndone, 1);
  assert.equal(txns(db).filter((r) => r.source === 'transfer').length, 0);

  const undoneFirst = await undoBatch(asDb(db), USER, first.batchId);
  assert.equal(undoneFirst.deleted, 1);
  const withdrawal = txns(db).find((r) => r.id === 'chk-near') as Row;
  assert.equal(withdrawal.transfer_group_id, null);
  assert.equal(withdrawal.transfer_kind ?? null, null);
});

test('transfer helpers: closest counterpart wins, claimed ones are skipped, descriptions name the account', () => {
  const candidates = [
    { id: 'b', transaction_date: '2026-03-12' },
    { id: 'a', transaction_date: '2026-03-09' },
    { id: 'c', transaction_date: '2026-03-30' },
  ];
  assert.equal(pickCounterpart('2026-03-10', candidates, new Set())?.id, 'a');
  assert.equal(pickCounterpart('2026-03-10', candidates, new Set(['a']))?.id, 'b');
  assert.equal(pickCounterpart('2026-03-10', candidates, new Set(['a', 'b'])), null);
  assert.equal(PAYMENT_WINDOW_DAYS, 5);
  const card = { id: CARD, name: 'Rewards Visa', account_type: 'credit_card', institution_name: 'Sample Card Co', last_four: '1111' };
  assert.equal(counterEntryDescription('expense', card), 'Payment to Sample Card Co Rewards Visa ••1111');
  assert.equal(counterEntryDescription('income', card), 'Payment from Sample Card Co Rewards Visa ••1111');
  const intents = transferIntents(
    resolveActions(planned([row(2), row(3)]), [{ row: 2, transferAccountId: CHECKING, recordMissing: false }]),
  );
  assert.deepEqual(intents.map((i) => [i.rowNumber, i.otherAccountId, i.recordMissing]), [[2, CHECKING, false]]);
});

test('suggestPaidFrom: the account behind this card\'s last linked payment, else any card\'s', async () => {
  const db = seeded();
  assert.equal(await suggestPaidFrom(asDb(db), USER, { id: CHECKING, account_type: 'checking' }), null);
  assert.equal(await suggestPaidFrom(asDb(db), USER, { id: CARD, account_type: 'credit_card' }), null);
  await importCard(db, [row(2)], [{ row: 2, transferAccountId: CHECKING }]);
  assert.equal(await suggestPaidFrom(asDb(db), USER, { id: CARD, account_type: 'credit_card' }), CHECKING);
  // Another card with no history of its own starts from the same paying account.
  assert.equal(await suggestPaidFrom(asDb(db), USER, { id: OTHER_CARD, account_type: 'credit_card' }), CHECKING);
});

// ── Refunds count as less spending, never income ──────────────────────────

test('refunds: money back on a card lowers spending; an unlinked payment counts nowhere; pay is income', () => {
  const debt = new Set([CARD]);
  assert.equal(totalsRole({ amount: 8, type: 'income', account_id: CARD, description: 'QUILL BOOKS' }, debt), 'refund');
  assert.equal(signedSpending({ amount: 8, type: 'income', account_id: CARD, description: 'QUILL BOOKS' }, debt), -8);
  assert.equal(signedSpending({ amount: 120, type: 'income', account_id: CARD, description: 'PAYMENT THANK YOU' }, debt), 0);
  assert.equal(signedSpending({ amount: 1500, type: 'income', account_id: CHECKING, description: 'ACME PAYROLL' }, debt), null);
  assert.equal(signedSpending({ amount: 4.75, type: 'expense', account_id: CARD }, debt), 4.75);
});

test('budgets: a refund flagged by the loader lowers its category, or Uncategorized', () => {
  const series = buildSpendingSeries([
    { amount: 50, type: 'expense', transaction_date: '2026-03-01', category_id: null },
    { amount: 20, type: 'income', transaction_date: '2026-03-05', category_id: null, refund: true },
    { amount: 900, type: 'income', transaction_date: '2026-03-05', category_id: null },
  ]);
  assert.equal(series.get(UNCATEGORIZED)?.get('2026-03'), 30);
});

// ── The status color scale ────────────────────────────────────────────────

test('status tones: green means done; attention, errors and information are never green', () => {
  for (const tone of ['attention', 'error', 'info', 'neutral'] as StatusTone[]) {
    const classes = TONE_CLASSES[tone];
    assert.ok(!/green|emerald/.test(`${classes.box} ${classes.icon} ${classes.chip}`), `${tone} must not be green`);
  }
  assert.match(TONE_CLASSES.success.box, /green/);
  assert.match(TONE_CLASSES.attention.box, /amber/);
  assert.match(TONE_CLASSES.error.box, /red/);
  assert.match(TONE_CLASSES.info.box, /sky/);
  // Text on tints is the 900 shade (AA on the 50/100 backgrounds); every state also has words.
  for (const tone of ['success', 'attention', 'error', 'info'] as StatusTone[]) {
    assert.match(TONE_CLASSES[tone].box, /text-\w+-900/);
    assert.ok(TONE_CLASSES[tone].srLabel.length > 0);
  }
});

test('status tones: review chips, file boxes and reconciliation', () => {
  assert.equal(toneForPlanStatus({ status: 'new' }), 'info');
  assert.equal(toneForPlanStatus({ status: 'matches' }), 'info');
  assert.equal(toneForPlanStatus({ status: 'duplicate', duplicateRule: 'external_id' }), 'neutral');
  assert.equal(toneForPlanStatus({ status: 'duplicate', duplicateRule: 'same_transaction' }), 'attention');
  assert.equal(toneForPlanStatus({ status: 'duplicate_in_file' }), 'attention');
  assert.equal(toneForPlanStatus({ status: 'invalid' }), 'error');
  assert.equal(planStatusChipLabel({ status: 'duplicate', duplicateRule: 'same_transaction' }, STATUS_LABELS), 'Possible duplicate');
  assert.equal(planStatusChipLabel({ status: 'duplicate', duplicateRule: 'external_id' }, STATUS_LABELS), 'Already imported');

  // The owner's case: a file whose columns couldn't be worked out is not green.
  assert.equal(toneForCsvDetection({ confidence: 'low', warnings: 0 }), 'attention');
  assert.equal(toneForCsvDetection({ confidence: 'high', warnings: 1 }), 'attention');
  assert.equal(toneForCsvDetection({ confidence: 'medium', warnings: 0 }), 'info');
  assert.equal(toneForCsvDetection({ confidence: 'high', warnings: 0 }), 'success');

  const pdf = { confidence: 'high' as const, reconciliationOk: true, reconciliationApplicable: true, warnings: 0, accountMatches: 1, hasLastFour: true };
  assert.equal(toneForPdfDetection(pdf), 'success');
  assert.equal(toneForPdfDetection({ ...pdf, reconciliationOk: false }), 'attention');
  assert.equal(toneForPdfDetection({ ...pdf, reconciliationOk: false, reconciliationApplicable: false }), 'success');
  assert.equal(toneForPdfDetection({ ...pdf, accountMatches: 0 }), 'attention');
  assert.equal(toneForPdfDetection({ ...pdf, confidence: 'low' }), 'attention');

  assert.equal(toneForReconciliation({ ok: true, applicable: true }), 'success');
  assert.equal(toneForReconciliation({ ok: false, applicable: true }), 'attention');
  assert.equal(toneForReconciliation({ ok: false, applicable: false }), 'info');
});

// ── Spreadsheet files ─────────────────────────────────────────────────────

test('sniffSpreadsheet: a text ".xls" reads as text; a real workbook does not', () => {
  assert.equal(sniffSpreadsheet(new TextEncoder().encode('01/05/2026\t$-25.00\tPAYMENT\tpayment')), 'text');
  assert.equal(sniffSpreadsheet(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1])), 'binary');
  assert.equal(sniffSpreadsheet(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), 'binary');
  assert.equal(sniffSpreadsheet(new Uint8Array([0x41, 0x00, 0x42])), 'binary');
});

// ── Website activity printouts (Capital One, Discover, PayPal Credit) ─────

/** A line from [x, text] pairs at a given height. */
function at(page: number, y: number, ...items: [number, string][]): PdfLine {
  const built = items.map(([x, str]) => ({ x, y, w: str.length * 4.4, str }));
  return { page, y, items: built, text: built.map((item) => item.str).join(' ') };
}

/** A Capital One printout: a pending section, the current period, and one closed statement. */
function capitalOnePrintout(discover = false): PdfLine[] {
  return [
    at(1, 770, [24, '3/20/26, 9:15 AM'], [332, 'Capital One']),
    at(1, 674, [237, '...9876']),
    ...(discover ? [at(1, 597, [265, 'Discover it ...9876'])] : []),
    at(1, 120, [32, 'Pending Transactions']),
    at(1, 100, [85, 'DATE'], [202, 'DESCRIPTION'], [528, 'AMOUNT']),
    at(1, 60, [523, '$9.99']),
    at(1, 57, [202, 'HOLLOW TREE APP']),
    at(1, 40, [80, 'Pending'], [456, 'Pat Q. ...9876']),
    at(1, 17, [24, 'https://myaccounts.capitalone.com/Card/abc'], [578, '1/2']),
    at(2, 770, [24, '3/20/26, 9:15 AM'], [332, 'Capital One']),
    at(2, 708, [486, 'Total:'], [527, '$9.99']),
    at(2, 653, [32, 'Posted Transactions Since Your Last Statement']),
    at(2, 631, [85, 'DATE'], [202, 'DESCRIPTION'], [528, 'AMOUNT']),
    // A purchase: description, amount, then day + category on one line.
    at(2, 602, [88, 'Mar']),
    at(2, 599, [515, '$45.10']),
    at(2, 596, [202, 'BLUE HERON CAFE']),
    at(2, 580, [85, '12'], [202, 'Dining'], [255, '1.5% earn'], [453, 'Pat Q. ...9876']),
    // A payment with a wrapped description and its own day line.
    at(2, 540, [202, 'Payment from DESERT'], [510, '-$200.00']),
    at(2, 534, [88, 'Mar']),
    at(2, 520, [453, 'Pat Q. ...9876']),
    at(2, 516, [202, 'CREDIT UNION…']),
    at(2, 512, [85, '9']),
    at(2, 500, [202, 'Payment']),
    // A canceled payment moves no money.
    at(2, 460, [202, 'Canceled Payment from'], [510, '-$200.00']),
    at(2, 454, [88, 'Mar']),
    at(2, 440, [202, 'DESERT CREDIT…']),
    at(2, 436, [85, '8']),
    at(2, 425, [202, 'Payment']),
    at(2, 380, [32, 'Statement Ending Feb 25, 2026']),
    at(2, 360, [85, 'DATE'], [202, 'DESCRIPTION'], [528, 'AMOUNT']),
    at(2, 330, [202, 'INTEREST'], [515, '$12.34']),
    at(2, 324, [88, 'Feb']),
    at(2, 310, [453, 'Pat Q. ...9876']),
    at(2, 306, [202, 'CHARGE:PURCHASES']),
    at(2, 302, [85, '25']),
    at(2, 290, [202, 'Interest Charge']),
    at(2, 250, [88, 'Feb']),
    at(2, 247, [523, '$35.00']),
    at(2, 243, [202, 'PAST DUE FEE']),
    at(2, 228, [85, '20'], [202, 'Fee'], [453, 'Pat Q. ...9876']),
    // A block cut by the page break: it carries on at the top of page 3.
    at(2, 60, [88, 'Jan']),
    at(2, 57, [523, '-$15.00']),
    at(2, 53, [202, 'AUTOMATIC STATEMENT']),
    at(2, 17, [24, 'https://myaccounts.capitalone.com/Card/abc'], [578, '2/3']),
    at(3, 770, [24, '3/20/26, 9:15 AM'], [332, 'Capital One']),
    at(3, 740, [202, 'CREDIT']),
    at(3, 736, [85, '30']),
    at(3, 725, [202, 'Other']),
    at(3, 680, [237, 'Load Previous Statement']),
    at(3, 17, [24, 'https://myaccounts.capitalone.com/Card/abc'], [578, '3/3']),
  ];
}

test('web activity: Capital One printouts are recognized, read block by block, with no reconciliation', () => {
  const lines = capitalOnePrintout();
  assert.equal(detectIssuer(lines).id, 'capital-one-web');
  const parsed = parseWebActivity(lines);
  assert.equal(parsed.issuer, 'capital-one-web');
  assert.equal(parsed.documentKind, 'activity');
  assert.equal(parsed.accountLastFour, '9876');
  assert.equal(parsed.confidence, 'high');
  assert.deepEqual(
    parsed.rows.map((r) => [r.date, r.kind, r.type, r.amountCents, r.description]),
    [
      ['2026-03-12', 'purchase', 'expense', 4510, 'BLUE HERON CAFE'],
      ['2026-03-09', 'payment', 'income', 20000, 'Payment from DESERT CREDIT UNION'],
      ['2026-02-25', 'interest', 'expense', 1234, 'INTEREST CHARGE:PURCHASES'],
      ['2026-02-20', 'fee', 'expense', 3500, 'PAST DUE FEE'],
      ['2026-01-30', 'credit', 'income', 1500, 'AUTOMATIC STATEMENT CREDIT'],
    ],
  );
  assert.deepEqual(parsed.warnings, []);
  assert.deepEqual(parsed.notes, [
    '1 pending transaction was left out until it posts.',
    '1 canceled payment was left out: no money moved.',
  ]);
  const reconciliation = reconcileStatement(parsed);
  assert.deepEqual(reconciliation, { ok: false, checked: false, applicable: false, differences: [] });
  assert.equal(needsReconciliationConfirmation(reconciliation), false);
});

test('web activity: a Discover card on the Capital One site is labelled as Discover', () => {
  const parsed = parseWebActivity(capitalOnePrintout(true));
  assert.equal(parsed.issuer, 'discover-web');
  assert.match(parsed.issuerLabel, /Discover/);
});

test('web activity: PayPal Credit printouts, with the "-" printed apart from the amount', () => {
  const lines: PdfLine[] = [
    at(1, 770, [24, '3/20/26, 9:15 AM'], [302, 'PayPal Credit - BillingActivity']),
    at(1, 622, [383, 'Start Date'], [494, 'End Date']),
    at(1, 612, [383, '01/01/2026'], [494, '03/20/2026']),
    at(1, 472, [42, 'Pending transactions']),
    at(1, 418, [42, 'You have no pending transactions at this time.']),
    at(1, 364, [42, 'Completed transactions'], [174, 'Notify when large amount']),
    at(1, 335, [48, 'Mar']),
    at(1, 333, [152, 'ONLINE PAYMENT THANK YOU SAMPLETOWN GA']),
    at(1, 329, [530, '-'], [537, '$150.00']),
    at(1, 323, [47, '15'], [152, 'One-time payment']),
    at(1, 287, [48, 'Mar']),
    at(1, 285, [152, 'TICKET BOOTH'], [197, 'See all special'], [248, 'fi'], [252, 'nancing purchases']),
    at(1, 281, [537, '$220.00']),
    at(1, 275, [47, '2'], [152, 'No Interest if paid in full']),
    at(1, 95, [169, 'Transactions from your February 20, 2026 Statement']),
    at(1, 65, [48, 'Feb']),
    at(1, 59, [152, 'Interest Charge on Purchases'], [542, '$18.40']),
    at(1, 53, [47, '20']),
    at(1, 17, [24, 'https://paypalcredit.syf.com/eServicePayPal/BillingActivity'], [578, '1/1']),
  ];
  assert.equal(detectIssuer(lines).id, 'paypal-credit-web');
  const parsed = parseWebActivity(lines);
  assert.deepEqual(
    parsed.rows.map((r) => [r.date, r.kind, r.amountCents, r.description]),
    [
      ['2026-03-15', 'payment', 15000, 'ONLINE PAYMENT THANK YOU SAMPLETOWN GA'],
      ['2026-03-02', 'purchase', 22000, 'TICKET BOOTH'],
      ['2026-02-20', 'interest', 1840, 'Interest Charge on Purchases'],
    ],
  );
  assert.deepEqual(parsed.period, { start: '2026-01-01', end: '2026-03-20' });
  assert.deepEqual(parsed.notes, []);
});

test('webActivityKind: sign, subtitle and wording', () => {
  assert.equal(webActivityKind(-100, 'Payment from X', 'Payment'), 'payment');
  assert.equal(webActivityKind(-100, 'QUILL BOOKS', 'Merchandise'), 'credit');
  assert.equal(webActivityKind(100, 'INTEREST CHARGE:PURCHASES', 'Interest Charge'), 'interest');
  assert.equal(webActivityKind(100, 'LATE THING', 'Fee'), 'fee');
  assert.equal(webActivityKind(100, 'CASH ADVANCE ATM', null), 'cash_advance');
  assert.equal(webActivityKind(100, 'BLUE HERON CAFE', 'Dining'), 'purchase');
});
