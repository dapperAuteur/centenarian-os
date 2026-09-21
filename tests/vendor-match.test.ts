// tests/vendor-match.test.ts
// Unit tests for the bank-matching and learned-category helpers in
// lib/finance/vendor-match.ts. Run with `npm run test:unit`.
//
// Uses the Node built-in test runner with type stripping, so it adds no
// test-framework dependency. Pure functions only: nothing here touches a
// database or the network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMerchant,
  vendorKey,
  compareNames,
  daysBetween,
  shiftDate,
  scoreCandidate,
  findBestMatch,
  buildLearnedCategoryIndex,
  lookupLearnedCategory,
  contactTypeForTransaction,
  MATCH_WINDOW_DAYS,
  type BankTransactionForMatch,
  type ManualCandidate,
} from '../lib/finance/vendor-match.ts';

const ACCT = 'acct-checking';
const OTHER_ACCT = 'acct-credit';

function bank(overrides: Partial<BankTransactionForMatch> = {}): BankTransactionForMatch {
  return {
    amount: 12.4,
    date: '2026-09-10',
    merchant: 'CHIPOTLE',
    description: 'CHIPOTLE 1234 AUSTIN TX',
    accountId: ACCT,
    ...overrides,
  };
}

function entry(overrides: Partial<ManualCandidate> = {}): ManualCandidate {
  return {
    id: 'manual-1',
    amount: 12.4,
    transaction_date: '2026-09-10',
    vendor: 'Chipotle',
    description: null,
    account_id: null,
    ...overrides,
  };
}

// ── normalizeMerchant / vendorKey ─────────────────────────────────────────

test('normalizeMerchant lowercases and strips store numbers', () => {
  assert.equal(normalizeMerchant('CHIPOTLE #1234'), 'chipotle');
  assert.equal(normalizeMerchant('CHIPOTLE # 12'), 'chipotle');
  assert.equal(normalizeMerchant('Starbucks Store 12345'), 'starbucks');
  assert.equal(normalizeMerchant('Target No. 0445'), 'target');
  assert.equal(normalizeMerchant('CHIPOTLE 1234 AUSTIN TX'), 'chipotle austin tx');
});

test('normalizeMerchant strips punctuation, apostrophes, and accents', () => {
  assert.equal(normalizeMerchant("McDonald's"), 'mcdonalds');
  assert.equal(normalizeMerchant('McDonald’s'), 'mcdonalds');
  assert.equal(normalizeMerchant('WAL-MART'), 'wal mart');
  assert.equal(normalizeMerchant('H&M'), 'h m');
  assert.equal(normalizeMerchant('Café Rio'), 'cafe rio');
  assert.equal(normalizeMerchant('  Whole   Foods  Market. '), 'whole foods market');
});

test('normalizeMerchant removes a leading processor tag', () => {
  assert.equal(normalizeMerchant('SQ *BLUE BOTTLE'), 'blue bottle');
  assert.equal(normalizeMerchant('TST* Chipotle 0876'), 'chipotle');
  assert.equal(normalizeMerchant('PAYPAL *ETSY'), 'etsy');
});

test('normalizeMerchant keeps short numbers that are part of a name', () => {
  assert.equal(normalizeMerchant('7-Eleven'), '7 eleven');
  assert.equal(normalizeMerchant('76 Gas'), '76 gas');
});

test('normalizeMerchant returns an empty string when nothing is left', () => {
  assert.equal(normalizeMerchant(''), '');
  assert.equal(normalizeMerchant(null), '');
  assert.equal(normalizeMerchant(undefined), '');
  assert.equal(normalizeMerchant('   '), '');
  assert.equal(normalizeMerchant('#1234'), '');
  assert.equal(normalizeMerchant('--- ***'), '');
});

test('vendorKey removes spaces so spelling variants share a key', () => {
  assert.equal(vendorKey('WAL-MART #12'), 'walmart');
  assert.equal(vendorKey('Walmart'), 'walmart');
  assert.equal(vendorKey('CHIPOTLE'), vendorKey('Chipotle #0876'));
  assert.equal(vendorKey(''), '');
});

// ── compareNames ──────────────────────────────────────────────────────────

test('compareNames finds exact and partial matches', () => {
  assert.equal(compareNames('Chipotle', 'CHIPOTLE #1234'), 'exact');
  assert.equal(compareNames('Chipotle', 'CHIPOTLE 1234 AUSTIN TX'), 'partial');
  assert.equal(compareNames('Whole Foods Market', 'whole foods'), 'partial');
  assert.equal(compareNames('Chipotle', 'Starbucks'), null);
});

test('compareNames never matches an empty name', () => {
  // The old sync code used `merchant.includes(vendor)`, which is true for "".
  assert.equal(compareNames('', 'CHIPOTLE'), null);
  assert.equal(compareNames(null, 'CHIPOTLE'), null);
  assert.equal(compareNames('   ', 'CHIPOTLE'), null);
  assert.equal(compareNames('#12', 'CHIPOTLE'), null);
});

test('compareNames needs 3+ characters for a substring match', () => {
  assert.equal(compareNames('ab', 'crab shack'), null);
  assert.equal(compareNames('ab', 'AB'), 'exact');
  assert.equal(compareNames('crab', 'crab shack'), 'partial');
});

// ── dates ─────────────────────────────────────────────────────────────────

test('daysBetween and shiftDate work across month and year edges', () => {
  assert.equal(daysBetween('2026-09-10', '2026-09-10'), 0);
  assert.equal(daysBetween('2026-09-10', '2026-09-15'), 5);
  assert.equal(daysBetween('2026-09-15', '2026-09-10'), 5);
  assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3);
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDate('2026-12-30', 5), '2027-01-04');
});

// ── scoreCandidate ────────────────────────────────────────────────────────

test('an entry with no account matches a bank transaction on any account', () => {
  const score = scoreCandidate(bank(), entry({ account_id: null }));
  assert.ok(score);
  assert.equal(score.sameAccount, false);
});

test('an entry on the same account matches; one on another account does not', () => {
  assert.equal(scoreCandidate(bank(), entry({ account_id: ACCT }))?.sameAccount, true);
  assert.equal(scoreCandidate(bank(), entry({ account_id: OTHER_ACCT })), null);
});

test('an entry with an empty vendor and description never matches', () => {
  assert.equal(scoreCandidate(bank(), entry({ vendor: '', description: '' })), null);
  assert.equal(scoreCandidate(bank(), entry({ vendor: null, description: null })), null);
  assert.equal(scoreCandidate(bank(), entry({ vendor: '  ', description: null })), null);
});

test('the description can carry the match when the vendor is empty', () => {
  const score = scoreCandidate(bank(), entry({ vendor: null, description: 'chipotle' }));
  assert.ok(score);
});

test('the bank description can carry the match when the merchant name differs', () => {
  const score = scoreCandidate(
    bank({ merchant: 'Chipotle Mexican Grill', description: 'TST* CHIPOTLE 0876' }),
    entry({ vendor: 'Chipotle' }),
  );
  assert.ok(score);
  assert.equal(score.exactName, true);
});

test('amounts must agree within one cent', () => {
  assert.ok(scoreCandidate(bank({ amount: 12.4 }), entry({ amount: '12.41' })));
  assert.ok(scoreCandidate(bank({ amount: 12.4 }), entry({ amount: 12.39 })));
  assert.equal(scoreCandidate(bank({ amount: 12.4 }), entry({ amount: 12.42 })), null);
  assert.equal(scoreCandidate(bank({ amount: 12.4 }), entry({ amount: 'not a number' })), null);
});

test(`dates must be within ${MATCH_WINDOW_DAYS} days`, () => {
  assert.ok(scoreCandidate(bank({ date: '2026-09-15' }), entry({ transaction_date: '2026-09-10' })));
  assert.ok(scoreCandidate(bank({ date: '2026-09-05' }), entry({ transaction_date: '2026-09-10' })));
  assert.equal(scoreCandidate(bank({ date: '2026-09-16' }), entry({ transaction_date: '2026-09-10' })), null);
});

test('different merchants do not match even with the same amount and date', () => {
  assert.equal(scoreCandidate(bank(), entry({ vendor: 'Starbucks' })), null);
});

// ── findBestMatch ─────────────────────────────────────────────────────────

test('findBestMatch prefers the closest date', () => {
  const candidates = [
    entry({ id: 'far', transaction_date: '2026-09-06' }),
    entry({ id: 'near', transaction_date: '2026-09-11' }),
    entry({ id: 'mid', transaction_date: '2026-09-13' }),
  ];
  assert.equal(findBestMatch(bank(), candidates)?.id, 'near');
});

test('findBestMatch breaks a date tie with an exact vendor', () => {
  const candidates = [
    entry({ id: 'partial', vendor: 'Chipotle Austin' }),
    entry({ id: 'exact', vendor: 'CHIPOTLE' }),
  ];
  const result = findBestMatch(bank({ merchant: 'Chipotle', description: null }), candidates);
  assert.equal(result?.id, 'exact');
});

test('findBestMatch then prefers an entry already on the same account', () => {
  const candidates = [
    entry({ id: 'no-account', account_id: null }),
    entry({ id: 'same-account', account_id: ACCT }),
  ];
  assert.equal(findBestMatch(bank(), candidates)?.id, 'same-account');
});

test('findBestMatch skips claimed entries and returns null when none fit', () => {
  const candidates = [entry({ id: 'a' }), entry({ id: 'b', transaction_date: '2026-09-12' })];
  assert.equal(findBestMatch(bank(), candidates, new Set(['a']))?.id, 'b');
  assert.equal(findBestMatch(bank(), candidates, new Set(['a', 'b'])), null);
  assert.equal(findBestMatch(bank(), []), null);
});

test('two $5 coffees: each bank charge takes the entry closest in date', () => {
  const coffees = [
    entry({ id: 'mon', amount: 5, vendor: 'Blue Bottle', transaction_date: '2026-09-07' }),
    entry({ id: 'thu', amount: 5, vendor: 'Blue Bottle', transaction_date: '2026-09-10' }),
  ];
  const claimed = new Set<string>();
  const first = findBestMatch(
    bank({ amount: 5, merchant: 'SQ *BLUE BOTTLE', description: null, date: '2026-09-11' }),
    coffees,
    claimed,
  );
  assert.equal(first?.id, 'thu');
  claimed.add(first!.id);
  const second = findBestMatch(
    bank({ amount: 5, merchant: 'SQ *BLUE BOTTLE', description: null, date: '2026-09-08' }),
    coffees,
    claimed,
  );
  assert.equal(second?.id, 'mon');
});

// ── learned categories ────────────────────────────────────────────────────

test('contactTypeForTransaction maps expenses to vendors and income to customers', () => {
  assert.equal(contactTypeForTransaction('expense'), 'vendor');
  assert.equal(contactTypeForTransaction('income'), 'customer');
  assert.equal(contactTypeForTransaction(undefined), 'vendor');
});

test('lookupLearnedCategory matches case-insensitively after normalizing', () => {
  const index = buildLearnedCategoryIndex([
    { name: 'Chipotle', contact_type: 'vendor', default_category_id: 'dining' },
    { name: 'Acme Payroll', contact_type: 'customer', default_category_id: 'salary' },
  ]);
  assert.equal(lookupLearnedCategory(index, 'CHIPOTLE #1234', 'expense'), 'dining');
  assert.equal(lookupLearnedCategory(index, 'tst* chipotle', 'expense'), 'dining');
  assert.equal(lookupLearnedCategory(index, 'ACME PAYROLL', 'income'), 'salary');
});

test('lookupLearnedCategory keeps vendor and customer categories apart', () => {
  const index = buildLearnedCategoryIndex([
    { name: 'Chipotle', contact_type: 'vendor', default_category_id: 'dining' },
  ]);
  assert.equal(lookupLearnedCategory(index, 'Chipotle', 'income'), null);
});

test('lookupLearnedCategory needs an exact key, not a substring', () => {
  const index = buildLearnedCategoryIndex([
    { name: 'Target', contact_type: 'vendor', default_category_id: 'shopping' },
  ]);
  assert.equal(lookupLearnedCategory(index, 'Target Optical', 'expense'), null);
  assert.equal(lookupLearnedCategory(index, '', 'expense'), null);
  assert.equal(lookupLearnedCategory(index, null, 'expense'), null);
});

test('buildLearnedCategoryIndex ignores contacts without a category and prefers the most-used duplicate', () => {
  const index = buildLearnedCategoryIndex([
    { name: 'CHIPOTLE #12', contact_type: 'vendor', default_category_id: 'groceries', use_count: 1 },
    { name: 'Chipotle', contact_type: 'vendor', default_category_id: 'dining', use_count: 9 },
    { name: 'Starbucks', contact_type: 'vendor', default_category_id: null, use_count: 50 },
    { name: 'Home', contact_type: 'location', default_category_id: 'rent', use_count: 3 },
  ]);
  assert.equal(lookupLearnedCategory(index, 'chipotle', 'expense'), 'dining');
  assert.equal(lookupLearnedCategory(index, 'Starbucks', 'expense'), null);
  assert.equal(index.vendor.size, 1);
  assert.equal(index.customer.size, 0);
});
