// tests/unit/csv-import-ui.test.ts
// Unit tests for the statement import page's own decisions in
// lib/finance/csv-import/ui-helpers.ts: starting settings, mapping checks,
// the sample rows, review actions and counts, and error wording.
// Run: npm run test:unit
//   (node --test --experimental-strip-types tests/unit/*.test.ts)
//
// Every merchant, account and amount is made up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAX_IMPORT_ROWS } from '../../lib/finance/csv-import/commit.ts';
import { detectMapping, parseStatementCsv } from '../../lib/finance/csv-import/parse.ts';
import { allowedActions } from '../../lib/finance/csv-import/plan.ts';
import { MAX_CSV_CHARS } from '../../lib/finance/csv-import/service.ts';
import type { PlanStatus, PlannedRow, SavedCsvMapping } from '../../lib/finance/csv-import/types.ts';
import {
  MAX_STATEMENT_CHARS,
  MAX_STATEMENT_ROWS,
  MIGRATION_REQUIRED_TEXT,
  TOO_LARGE_TEXT,
  accountLabel,
  actionLabel,
  applyDecision,
  buildRowActions,
  categorySuggestionNote,
  certainlyTooLarge,
  cleanMapping,
  countAmountSigns,
  countTransferSuggestions,
  describeDetection,
  effectiveDecision,
  fileSizeProblem,
  filterRows,
  formatCents,
  formatIsoDate,
  importErrorText,
  importedDateRange,
  initialSettings,
  mappingProblems,
  matchSummaryText,
  pageCount,
  pageOf,
  previewMapping,
  readSavedMapping,
  rowCountProblem,
  savedMappingFits,
  signFromAccountType,
  sortAccountsForPicker,
  statusCounts,
  summarizeDecisions,
  summaryLine,
} from '../../lib/finance/csv-import/ui-helpers.ts';

// ── Fixtures ──────────────────────────────────────────────────────────────

const SIMPLE = [
  'Date,Description,Amount',
  '01/13/2026,BLUE HERON CAFE,-4.75',
  '01/14/2026,SUNNY BAGELS,-12.00',
  '01/15/2026,PAYROLL EXAMPLE CO,1500.00',
].join('\n');

const CHASE_CARD = [
  'Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
  '01/13/2026,01/14/2026,SQ *BLUE HERON CAFE,Food & Drink,Sale,-4.75,',
  '01/15/2026,01/16/2026,Payment Thank You-Mobile,,Payment,250.00,',
].join('\n');

/** Dates that read both ways, and as many positive amounts as negative ones. */
const UNDECIDED = [
  'Date,Description,Amount',
  '03/04/2026,BLUE HERON CAFE,4.75',
  '05/06/2026,REFUND SUNNY BAGELS,-4.75',
].join('\n');

function read(text: string) {
  const table = parseStatementCsv(text);
  return { table, detected: detectMapping(table.headers, table.rows) };
}

/** A planned row with the server's own allowedActions for its status. */
function planned(
  rowNumber: number,
  status: PlanStatus,
  extra: Partial<PlannedRow> = {},
): PlannedRow {
  const defaultAction = status === 'new' ? 'insert' : status === 'matches' ? 'link' : 'skip';
  const row: PlannedRow = {
    rowNumber,
    date: '2026-01-13',
    amountCents: 475,
    type: 'expense',
    description: 'BLUE HERON CAFE',
    vendor: 'Blue Heron Cafe',
    hints: [],
    issues: [],
    externalId: status === 'invalid' ? null : `hash:row-${rowNumber}`,
    status,
    suggestedCategoryId: null,
    suggestedCategorySource: null,
    defaultAction,
    allowedActions: [],
    ...extra,
  };
  row.allowedActions = extra.allowedActions ?? allowedActions(row);
  return row;
}

const CATEGORY_A = '11111111-1111-4111-8111-111111111111';
const CATEGORY_B = '22222222-2222-4222-8222-222222222222';

// ── Limits ────────────────────────────────────────────────────────────────

test('the page limits match the server limits', () => {
  assert.equal(MAX_STATEMENT_CHARS, MAX_CSV_CHARS);
  assert.equal(MAX_STATEMENT_ROWS, MAX_IMPORT_ROWS);
});

test('fileSizeProblem: only a file over the character limit is refused', () => {
  assert.equal(fileSizeProblem(0), null);
  assert.equal(fileSizeProblem(MAX_STATEMENT_CHARS), null);
  const problem = fileSizeProblem(MAX_STATEMENT_CHARS + 1);
  assert.ok(problem);
  assert.match(problem, /4,000,001 characters/);
  assert.match(problem, /limit is 4,000,000/);
});

test('certainlyTooLarge: a file is refused unread only when no encoding could fit it', () => {
  assert.equal(certainlyTooLarge(MAX_STATEMENT_CHARS), false);
  assert.equal(certainlyTooLarge(MAX_STATEMENT_CHARS * 3), false);
  assert.equal(certainlyTooLarge(MAX_STATEMENT_CHARS * 3 + 1), true);
});

test('rowCountProblem: no rows and too many rows are both refused', () => {
  assert.equal(rowCountProblem(0), 'No transactions were found in this file.');
  assert.equal(rowCountProblem(1), null);
  assert.equal(rowCountProblem(MAX_STATEMENT_ROWS), null);
  assert.match(rowCountProblem(MAX_STATEMENT_ROWS + 1) ?? '', /5,001 rows.*up to 5,000/);
});

// ── Accounts ──────────────────────────────────────────────────────────────

test('accountLabel: institution, name and last four tell same-named accounts apart', () => {
  assert.equal(
    accountLabel({ name: 'EveryDay Checking', institution_name: 'Example Federal', last_four: '1234' }),
    'Example Federal EveryDay Checking ••1234',
  );
  assert.equal(
    accountLabel({ name: 'EveryDay Checking', institution_name: 'Example Federal', last_four: '9876' }),
    'Example Federal EveryDay Checking ••9876',
  );
  // The institution isn't repeated when the name already starts with it.
  assert.equal(
    accountLabel({ name: 'Example Federal Savings', institution_name: 'Example Federal', last_four: null }),
    'Example Federal Savings',
  );
  assert.equal(accountLabel({ name: 'Cash', institution_name: null, last_four: null }), 'Cash');
  assert.equal(accountLabel({ name: '  ', institution_name: '', last_four: '' }), 'Account');
  assert.equal(accountLabel(null), 'An account that was removed');
});

test('sortAccountsForPicker: active accounts first, then by label, input untouched', () => {
  const accounts = [
    { id: 'c', name: 'Old Card', account_type: 'credit_card', is_active: false },
    { id: 'b', name: 'Savings', account_type: 'savings', is_active: true },
    { id: 'a', name: 'Checking', account_type: 'checking' },
  ];
  assert.deepEqual(sortAccountsForPicker(accounts).map((a) => a.id), ['a', 'b', 'c']);
  assert.deepEqual(accounts.map((a) => a.id), ['c', 'b', 'a']);
});

// ── Mapping ───────────────────────────────────────────────────────────────

test('cleanMapping: drops blanks and the money columns the sign convention does not read', () => {
  const mapping = { date: 'date', description: 'desc', amount: 'amt', debit: 'out', credit: 'in', type: 'kind', memo: '' };
  assert.deepEqual(cleanMapping(mapping, 'negative_is_expense'), { date: 'date', description: 'desc', amount: 'amt' });
  assert.deepEqual(cleanMapping(mapping, 'split_columns'), { date: 'date', description: 'desc', debit: 'out', credit: 'in' });
  assert.deepEqual(cleanMapping(mapping, 'type_column'), { date: 'date', description: 'desc', amount: 'amt', type: 'kind' });
});

test('mappingProblems: names every required column that is missing', () => {
  const headers = ['date', 'description', 'amount', 'debit', 'credit'];
  assert.deepEqual(mappingProblems({ date: 'date', description: 'description', amount: 'amount' }, 'negative_is_expense', headers), []);
  assert.deepEqual(mappingProblems({ description: 'description' }, 'positive_is_expense', headers), [
    'Choose a column for "Date".',
    'Choose a column for "Amount".',
  ]);
  // An amount column doesn't satisfy split columns, and the two must differ.
  assert.deepEqual(mappingProblems({ date: 'date', description: 'description', amount: 'amount' }, 'split_columns', headers), [
    'Choose a column for "Debit (money out)".',
    'Choose a column for "Credit (money in)".',
  ]);
  assert.deepEqual(
    mappingProblems({ date: 'date', description: 'description', debit: 'debit', credit: 'debit' }, 'split_columns', headers),
    ['Debit and credit must be two different columns.'],
  );
  assert.deepEqual(mappingProblems({ date: 'date', description: 'description', amount: 'amount' }, 'type_column', headers), [
    'Choose a column for "Type (debit or credit)".',
  ]);
  // A column from some other file.
  assert.deepEqual(
    mappingProblems({ date: 'posting_date', description: 'description', amount: 'amount' }, 'negative_is_expense', headers),
    ['The column chosen for "Date" is not in this file.'],
  );
});

test('readSavedMapping: keeps a well-formed value and refuses everything else', () => {
  const saved = readSavedMapping({
    mapping: { date: 'date', description: 'description', amount: 'amount', bogus: 'x', memo: '' },
    sign: 'positive_is_expense',
    dateOrder: 'MDY',
    includePending: true,
    preset: ' amex ',
  });
  assert.deepEqual(saved, {
    mapping: { date: 'date', description: 'description', amount: 'amount' },
    sign: 'positive_is_expense',
    dateOrder: 'MDY',
    includePending: true,
    preset: 'amex',
  });
  assert.equal(readSavedMapping(null), null);
  assert.equal(readSavedMapping(undefined), null);
  assert.equal(readSavedMapping('{"mapping":{}}'), null);
  assert.equal(readSavedMapping({ mapping: {}, sign: 'sideways', dateOrder: 'MDY' }), null);
  assert.equal(readSavedMapping({ mapping: {}, sign: 'split_columns', dateOrder: 'YDM' }), null);
  assert.equal(readSavedMapping({ mapping: [], sign: 'split_columns', dateOrder: 'MDY' }), null);
});

test('savedMappingFits: saved settings fit only a file that has their columns', () => {
  const saved: SavedCsvMapping = {
    mapping: { date: 'date', description: 'description', amount: 'amount' },
    sign: 'negative_is_expense',
    dateOrder: 'MDY',
  };
  assert.equal(savedMappingFits(saved, ['date', 'description', 'amount', 'balance']), true);
  assert.equal(savedMappingFits(saved, ['transaction_date', 'description', 'amount']), false);
  assert.equal(savedMappingFits({ ...saved, mapping: { date: 'date' } }, ['date', 'description', 'amount']), false);
});

// ── Starting settings ─────────────────────────────────────────────────────

test('signFromAccountType: only a credit card defaults to purchases positive', () => {
  assert.equal(signFromAccountType('credit_card'), 'positive_is_expense');
  for (const type of ['checking', 'savings', 'loan', 'cash', '', null, undefined]) {
    assert.equal(signFromAccountType(type), 'negative_is_expense');
  }
});

test('countAmountSigns: counts readable non-zero amounts by sign', () => {
  const { table } = read(SIMPLE);
  assert.deepEqual(countAmountSigns(table.rows, 'amount'), { negative: 2, positive: 1 });
  assert.deepEqual(countAmountSigns(table.rows, undefined), { negative: 0, positive: 0 });
  assert.deepEqual(countAmountSigns(table.rows, 'description'), { negative: 0, positive: 0 });
});

test('initialSettings: saved settings win when they fit the file', () => {
  const { table, detected } = read(SIMPLE);
  const saved: SavedCsvMapping = {
    mapping: { date: 'date', description: 'description', amount: 'amount' },
    sign: 'positive_is_expense',
    dateOrder: 'DMY',
    includePending: true,
  };
  const initial = initialSettings({ saved, detected, table, accountType: 'checking' });
  assert.equal(initial.mappingSource, 'saved');
  assert.equal(initial.signSource, 'saved');
  assert.equal(initial.savedIgnored, false);
  assert.deepEqual(initial.settings, {
    mapping: saved.mapping,
    sign: 'positive_is_expense',
    dateOrder: 'DMY',
    includePending: true,
    remember: true,
  });
  // A copy: editing the settings must not change the saved value.
  assert.notEqual(initial.settings.mapping, saved.mapping);
});

test('initialSettings: saved settings for another layout are set aside and reported', () => {
  const { table, detected } = read(SIMPLE);
  const saved: SavedCsvMapping = {
    mapping: { date: 'transaction_date', description: 'description', amount: 'amount' },
    sign: 'positive_is_expense',
    dateOrder: 'MDY',
    includePending: true,
  };
  const initial = initialSettings({ saved, detected, table, accountType: 'checking' });
  assert.equal(initial.mappingSource, 'detected');
  assert.equal(initial.savedIgnored, true);
  assert.equal(initial.settings.mapping.date, 'date');
  assert.equal(initial.settings.includePending, false);
});

test('initialSettings: detection is used when the file shows which sign is spending', () => {
  // Two negative amounts against one positive: purchases are negative, even on a credit card account.
  const simple = read(SIMPLE);
  const fromFile = initialSettings({ saved: null, ...simple, accountType: 'credit_card' });
  assert.equal(fromFile.settings.sign, 'negative_is_expense');
  assert.equal(fromFile.signSource, 'detected');
  assert.equal(fromFile.settings.dateOrder, 'MDY');
  assert.equal(fromFile.settings.remember, true);
  assert.equal(fromFile.savedIgnored, false);

  // A known layout is evidence in itself.
  const chase = read(CHASE_CARD);
  assert.equal(chase.detected.preset, 'chase_card');
  const fromPreset = initialSettings({ saved: null, ...chase, accountType: 'credit_card' });
  assert.equal(fromPreset.settings.sign, 'negative_is_expense');
  assert.equal(fromPreset.signSource, 'detected');
});

test('initialSettings: with no evidence in the file the account type decides the sign', () => {
  const undecided = read(UNDECIDED);
  const card = initialSettings({ saved: null, ...undecided, accountType: 'credit_card' });
  assert.equal(card.settings.sign, 'positive_is_expense');
  assert.equal(card.signSource, 'account_type');
  const checking = initialSettings({ saved: null, ...undecided, accountType: 'checking' });
  assert.equal(checking.settings.sign, 'negative_is_expense');
  assert.equal(checking.signSource, 'account_type');
});

test('initialSettings: an ambiguous date order is left for the person to choose', () => {
  const undecided = read(UNDECIDED);
  assert.equal(undecided.detected.dateOrderAmbiguous, true);
  assert.equal(initialSettings({ saved: null, ...undecided, accountType: 'checking' }).settings.dateOrder, null);
});

// ── What was detected ─────────────────────────────────────────────────────

test('describeDetection: names a known layout, the header line and the rows', () => {
  const { table, detected } = read(CHASE_CARD);
  assert.deepEqual(describeDetection(detected, table), {
    headline: 'Looks like a Chase credit card export.',
    details: ['Header row found on line 1.', '2 transaction rows found (rows 2 to 3).'],
  });
});

test('describeDetection: lines above the table and an unknown layout', () => {
  const { table, detected } = read(`Account ending 1234\n\n${SIMPLE}`);
  const described = describeDetection(detected, table);
  assert.match(described.headline, /^No known bank layout matched/);
  assert.deepEqual(described.details, [
    'Header row found on line 3.',
    '3 transaction rows found (rows 4 to 6).',
    '1 line above the table was skipped (a summary or account banner).',
  ]);
});

test('describeDetection: a file with no header row, and "an" before a vowel', () => {
  const headerless = read('01/13/2026,-4.75,BLUE HERON CAFE\n01/14/2026,-12.00,SUNNY BAGELS\n');
  const described = describeDetection(headerless.detected, headerless.table);
  assert.match(described.headline, /^This file has no header row/);
  assert.equal(described.details[0], 'No header row found: columns are numbered in file order.');

  const single = read('Date,Description,Amount\n01/13/2026,BLUE HERON CAFE,-4.75\n');
  assert.equal(describeDetection(single.detected, single.table).details[1], '1 transaction row found (row 2).');

  assert.equal(
    describeDetection({ preset: 'apple_card', confidence: 'high' }, single.table).headline,
    'Looks like an Apple Card export.',
  );
  assert.match(
    describeDetection({ preset: 'generic', confidence: 'low' }, single.table).headline,
    /couldn't be worked out from their names/,
  );
});

// ── The sample ────────────────────────────────────────────────────────────

test('previewMapping: the first rows read the way the import will read them', () => {
  const { table, detected } = read(SIMPLE);
  const preview = previewMapping(table.rows, detected.mapping, 'negative_is_expense', 'MDY', 2);
  assert.deepEqual(preview.missingColumns, []);
  assert.deepEqual(preview.sample, [
    { rowNumber: 2, ok: true, date: '2026-01-13', amountCents: 475, type: 'expense', description: 'BLUE HERON CAFE' },
    { rowNumber: 3, ok: true, date: '2026-01-14', amountCents: 1200, type: 'expense', description: 'SUNNY BAGELS' },
  ]);
  assert.equal(preview.readable, 3);
  assert.equal(preview.unreadable, 0);
  assert.equal(preview.expenses, 2);
  assert.equal(preview.income, 1);
});

test('previewMapping: the wrong sign convention flips every row, which the counts show', () => {
  const { table, detected } = read(SIMPLE);
  const preview = previewMapping(table.rows, detected.mapping, 'positive_is_expense', 'MDY');
  assert.deepEqual(preview.sample.map((row) => row.type), ['income', 'income', 'expense']);
  assert.equal(preview.expenses, 1);
  assert.equal(preview.income, 2);
});

test('previewMapping: an unreadable row keeps its place and says why', () => {
  const { table, detected } = read('Date,Description,Amount\n13/01/2026,BLUE HERON CAFE,-4.75\n01/14/2026,SUNNY BAGELS,abc\n');
  const preview = previewMapping(table.rows, detected.mapping, 'negative_is_expense', 'MDY');
  assert.equal(preview.readable, 0);
  assert.equal(preview.unreadable, 2);
  assert.deepEqual(preview.sample.map((row) => [row.rowNumber, row.ok]), [[2, false], [3, false]]);
  assert.match(preview.sample[0].reason ?? '', /doesn't fit month\/day\/year order/);
  assert.match(preview.sample[1].reason ?? '', /is not a number/);
});

test('previewMapping: a mapping that lacks a column reads nothing and names the column', () => {
  const { table } = read(SIMPLE);
  const preview = previewMapping(table.rows, { date: 'date', description: 'description' }, 'negative_is_expense', 'MDY');
  assert.deepEqual(preview.missingColumns, ['amount']);
  assert.deepEqual(preview.sample, []);
  // A debit column chosen earlier is ignored once the file is read as one signed amount.
  const stale = previewMapping(
    table.rows,
    { date: 'date', description: 'description', amount: 'amount', debit: 'not_in_file' },
    'negative_is_expense',
    'MDY',
  );
  assert.deepEqual(stale.missingColumns, []);
  assert.equal(stale.readable, 3);
});

test('the simple template still imports through the statement flow', () => {
  const text = readFileSync(new URL('../../public/templates/finance-import-template.csv', import.meta.url), 'utf8');
  const { table, detected } = read(text);
  assert.equal(table.headerRowNumber, 1);
  const initial = initialSettings({ saved: null, detected, table, accountType: 'checking' });
  assert.deepEqual(mappingProblems(initial.settings.mapping, initial.settings.sign, table.headers), []);
  assert.ok(initial.settings.dateOrder);
  const preview = previewMapping(table.rows, initial.settings.mapping, initial.settings.sign, initial.settings.dateOrder);
  assert.equal(preview.unreadable, 0);
  assert.equal(preview.readable, table.rows.length);
  assert.ok(preview.readable >= 4);
  assert.deepEqual(preview.sample.map((row) => row.type), ['expense', 'expense', 'income', 'expense']);
});

// ── Review ────────────────────────────────────────────────────────────────

test('statusCounts and filterRows: one tab per status plus all', () => {
  const rows = [
    planned(2, 'new'),
    planned(3, 'new'),
    planned(4, 'matches'),
    planned(5, 'duplicate', { duplicateRule: 'external_id' }),
    planned(6, 'duplicate_in_file'),
    planned(7, 'invalid'),
  ];
  assert.deepEqual(statusCounts(rows), { all: 6, new: 2, matches: 1, duplicate: 1, duplicate_in_file: 1, invalid: 1 });
  assert.deepEqual(filterRows(rows, 'new').map((r) => r.rowNumber), [2, 3]);
  assert.deepEqual(filterRows(rows, 'all').map((r) => r.rowNumber), [2, 3, 4, 5, 6, 7]);
  assert.deepEqual(filterRows(rows, 'invalid').map((r) => r.rowNumber), [7]);
});

test('effectiveDecision: an action the row does not allow falls back to the default', () => {
  const fresh = planned(2, 'new', { suggestedCategoryId: CATEGORY_A });
  assert.deepEqual(effectiveDecision(fresh, undefined), { action: 'insert', type: 'expense', categoryId: CATEGORY_A });
  assert.deepEqual(effectiveDecision(fresh, { action: 'skip' }).action, 'skip');
  // A new row has no entry to link to.
  assert.equal(effectiveDecision(fresh, { action: 'link' }).action, 'insert');
  assert.deepEqual(effectiveDecision(fresh, { type: 'income', categoryId: null }), {
    action: 'insert',
    type: 'income',
    categoryId: null,
  });

  const imported = planned(3, 'duplicate', { duplicateRule: 'external_id' });
  assert.equal(effectiveDecision(imported, { action: 'insert' }).action, 'skip');
  const sameTransaction = planned(4, 'duplicate', { duplicateRule: 'same_transaction' });
  assert.equal(effectiveDecision(sameTransaction, { action: 'insert' }).action, 'insert');
  const invalid = planned(5, 'invalid');
  assert.equal(effectiveDecision(invalid, { action: 'insert' }).action, 'skip');
  const matched = planned(6, 'matches');
  assert.equal(effectiveDecision(matched, undefined).action, 'link');
  assert.equal(effectiveDecision(matched, { action: 'insert' }).action, 'insert');
});

test('applyDecision: records allowed changes and leaves the rest alone', () => {
  const fresh = planned(2, 'new');
  const imported = planned(3, 'duplicate', { duplicateRule: 'external_id' });
  const start = {};

  const skipped = applyDecision(start, [fresh, imported], { action: 'skip' });
  assert.deepEqual(skipped, { 2: { action: 'skip' }, 3: { action: 'skip' } });
  assert.deepEqual(start, {});

  // "Import" is not allowed on the row that is already imported.
  const inserted = applyDecision(skipped, [fresh, imported], { action: 'insert' });
  assert.deepEqual(inserted, { 2: { action: 'insert' }, 3: { action: 'skip' } });

  const categorized = applyDecision(inserted, [fresh], { categoryId: CATEGORY_A });
  assert.deepEqual(categorized[2], { action: 'insert', categoryId: CATEGORY_A });
  const cleared = applyDecision(categorized, [fresh], { categoryId: null });
  assert.equal(cleared[2].categoryId, null);

  // Nothing changed: the same object comes back, so React skips the re-render.
  assert.equal(applyDecision(cleared, [fresh], { categoryId: null }), cleared);
  assert.equal(applyDecision(start, [imported], { action: 'insert' }), start);
});

test('summarizeDecisions and summaryLine: counts follow the choices', () => {
  const rows = [
    planned(2, 'new'),
    planned(3, 'new'),
    planned(4, 'matches'),
    planned(5, 'duplicate', { duplicateRule: 'external_id' }),
    planned(6, 'duplicate', { duplicateRule: 'same_transaction' }),
    planned(7, 'invalid'),
  ];
  assert.deepEqual(summarizeDecisions(rows, {}), { add: 2, link: 1, skip: 3 });
  assert.equal(summaryLine(summarizeDecisions(rows, {})), 'Will add 2, link 1, skip 3');

  const decisions = { 3: { action: 'skip' as const }, 4: { action: 'insert' as const }, 6: { action: 'insert' as const }, 7: { action: 'insert' as const } };
  assert.deepEqual(summarizeDecisions(rows, decisions), { add: 3, link: 0, skip: 3 });
  assert.equal(summaryLine({ add: 1234, link: 0, skip: 7 }), 'Will add 1,234, link 0, skip 7');
});

test('buildRowActions: sends only what differs from the default', () => {
  const rows = [
    planned(2, 'new', { suggestedCategoryId: CATEGORY_A }),
    planned(3, 'new'),
    planned(4, 'matches'),
    planned(5, 'duplicate', { duplicateRule: 'same_transaction' }),
    planned(6, 'invalid'),
  ];
  assert.deepEqual(buildRowActions(rows, {}), []);
  // Choices equal to the defaults are not sent either.
  assert.deepEqual(
    buildRowActions(rows, { 2: { action: 'insert', type: 'expense', categoryId: CATEGORY_A }, 4: { action: 'link' } }),
    [],
  );

  assert.deepEqual(
    buildRowActions(rows, {
      2: { categoryId: CATEGORY_B },
      3: { action: 'skip', categoryId: CATEGORY_B },
      4: { action: 'insert' },
      5: { action: 'insert', categoryId: null },
      6: { action: 'insert' },
    }),
    [
      { row: 2, category_id: CATEGORY_B },
      // A skipped row's category is not sent.
      { row: 3, action: 'skip' },
      { row: 4, action: 'insert' },
      // Null equals this row's (empty) suggestion, so only the action goes.
      { row: 5, action: 'insert' },
      // Row 6 can't be imported, whatever was asked.
    ],
  );
});

test('buildRowActions: a flipped direction always carries its category', () => {
  const rows = [planned(2, 'new', { suggestedCategoryId: CATEGORY_A }), planned(3, 'new')];
  assert.deepEqual(buildRowActions(rows, { 2: { type: 'income' }, 3: { type: 'income' } }), [
    { row: 2, type: 'income', category_id: CATEGORY_A },
    { row: 3, type: 'income', category_id: null },
  ]);
  // "No category" on a row that had a suggestion is sent as null.
  assert.deepEqual(buildRowActions(rows, { 2: { categoryId: null } }), [{ row: 2, category_id: null }]);
});

test('actionLabel: the import option is worded for the row it is on', () => {
  assert.equal(actionLabel({ status: 'new' }, 'insert'), 'Import');
  assert.equal(actionLabel({ status: 'duplicate' }, 'insert'), 'Import anyway');
  assert.equal(actionLabel({ status: 'matches' }, 'insert'), 'Import as a new transaction');
  assert.equal(actionLabel({ status: 'matches' }, 'link'), 'Link to my entry');
  assert.equal(actionLabel({ status: 'new' }, 'skip'), 'Skip');
});

test('categorySuggestionNote: marks a suggestion until the person changes it', () => {
  const learned = { suggestedCategoryId: CATEGORY_A, suggestedCategorySource: 'learned' as const };
  assert.equal(categorySuggestionNote(learned, CATEGORY_A), 'Learned from this vendor');
  assert.equal(categorySuggestionNote(learned, CATEGORY_B), null);
  assert.equal(categorySuggestionNote(learned, null), null);
  assert.equal(
    categorySuggestionNote({ suggestedCategoryId: CATEGORY_A, suggestedCategorySource: 'category_name' }, CATEGORY_A),
    "From the file's category column",
  );
  assert.equal(categorySuggestionNote({ suggestedCategoryId: null, suggestedCategorySource: null }, null), null);
});

test('pageCount and pageOf: 200 rows a page, never an empty page', () => {
  const rows = Array.from({ length: 450 }, (_, i) => i + 1);
  assert.equal(pageCount(0), 1);
  assert.equal(pageCount(200), 1);
  assert.equal(pageCount(201), 2);
  assert.equal(pageCount(450), 3);
  assert.equal(pageOf(rows, 1).length, 200);
  assert.deepEqual([pageOf(rows, 2)[0], pageOf(rows, 2)[199]], [201, 400]);
  assert.deepEqual([pageOf(rows, 3)[0], pageOf(rows, 3).length], [401, 50]);
  // Out of range lands on the nearest real page.
  assert.equal(pageOf(rows, 9)[0], 401);
  assert.equal(pageOf(rows, 0)[0], 1);
  assert.deepEqual(pageOf([], 1), []);
});

test('importedDateRange: spans the rows that will be added or linked', () => {
  const rows = [
    planned(2, 'new', { date: '2026-01-20' }),
    planned(3, 'new', { date: '2026-01-05' }),
    planned(4, 'matches', { date: '2026-02-02' }),
    planned(5, 'duplicate', { duplicateRule: 'external_id', date: '2025-12-01' }),
  ];
  assert.deepEqual(importedDateRange(rows, {}), { from: '2026-01-05', to: '2026-02-02' });
  assert.deepEqual(importedDateRange(rows, { 3: { action: 'skip' }, 4: { action: 'skip' } }), {
    from: '2026-01-20',
    to: '2026-01-20',
  });
  assert.equal(importedDateRange(rows, { 2: { action: 'skip' }, 3: { action: 'skip' }, 4: { action: 'skip' } }), null);
  assert.equal(importedDateRange([], {}), null);
});

// ── After the import ──────────────────────────────────────────────────────

test('countTransferSuggestions: pairs plus one-sided rows, zero for anything unexpected', () => {
  assert.equal(countTransferSuggestions({ pairs: [{}, {}], one_sided: [{}], accounts: [], truncated: false }), 3);
  assert.equal(countTransferSuggestions({ pairs: [], one_sided: [] }), 0);
  assert.equal(countTransferSuggestions({ pairs: [{}] }), 1);
  assert.equal(countTransferSuggestions({ error: 'Not found' }), 0);
  assert.equal(countTransferSuggestions([{}, {}]), 0);
  assert.equal(countTransferSuggestions(null), 0);
  assert.equal(countTransferSuggestions('<html>'), 0);
});

test('importErrorText: a sentence for every failure, never raw JSON', () => {
  assert.equal(
    importErrorText(503, { error: 'Statement import is not set up in the database yet. Run migration 203 first (supabase/migrations/203_bank_csv_import.sql).', code: 'migration_required' }),
    MIGRATION_REQUIRED_TEXT,
  );
  assert.equal(
    importErrorText(400, { error: "The column mapping doesn't fit this file. Choose a column for: amount.", code: 'mapping_incomplete' }),
    "The column mapping doesn't fit this file. Choose a column for: amount.",
  );
  assert.equal(importErrorText(404, { error: 'Not found' }), 'Not found');
  // The host refused the request before the app saw it: no JSON body.
  assert.equal(importErrorText(413, null), TOO_LARGE_TEXT);
  assert.equal(importErrorText(401, null), 'You are signed out. Sign in and try again.');
  assert.equal(importErrorText(500, '<html>Internal Server Error</html>'), 'The server could not finish the request (error 500). Try again in a moment.');
  assert.equal(importErrorText(500, { error: '   ' }), 'The server could not finish the request (error 500). Try again in a moment.');
});

// ── Formatting ────────────────────────────────────────────────────────────

test('formatIsoDate, formatCents and matchSummaryText', () => {
  assert.equal(formatIsoDate('2026-01-13'), 'Jan 13, 2026');
  assert.equal(formatIsoDate('2026-12-01T10:00:00Z'), 'Dec 1, 2026');
  assert.equal(formatIsoDate('yesterday'), 'yesterday');
  assert.equal(formatIsoDate(null), '');

  assert.equal(formatCents(475), '$4.75');
  assert.equal(formatCents(123456), '$1,234.56');
  assert.equal(formatCents(5), '$0.05');
  assert.equal(formatCents(100000000), '$1,000,000.00');
  assert.equal(formatCents(-1200), '-$12.00');

  assert.equal(
    matchSummaryText({ id: 'x', transaction_date: '2026-01-12', amount: 4.75, vendor: 'Blue Heron Cafe', description: 'coffee', account_id: null }),
    'Jan 12, 2026 · $4.75 · Blue Heron Cafe',
  );
  assert.equal(
    matchSummaryText({ id: 'x', transaction_date: '2026-01-12', amount: 19.99, vendor: null, description: 'Book', account_id: null }),
    'Jan 12, 2026 · $19.99 · Book',
  );
  assert.equal(
    matchSummaryText({ id: 'x', transaction_date: '2026-01-12', amount: 3, vendor: ' ', description: null, account_id: null }),
    'Jan 12, 2026 · $3.00 · No name',
  );
});
