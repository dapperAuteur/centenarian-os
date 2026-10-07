// tests/unit/csv-import.test.ts
// Unit tests for the bank-statement CSV parser in lib/finance/csv-import/.
// Run: npm run test:unit
//   (node --test --experimental-strip-types tests/unit/*.test.ts)
//
// Every fixture is synthetic: made-up merchants, people and amounts, laid out
// the way each bank's export is believed to look (see the UNVERIFIED note on
// BANK_PRESETS). None of it comes from a real statement.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHeader } from '../../lib/csv/normalize-header.ts';
import {
  BANK_PRESETS,
  applyMapping,
  assignExternalIds,
  cleanDetail,
  detectDateOrder,
  detectMapping,
  normalizeType,
  parseAmount,
  parseDate,
  parseStatementCsv,
  transferHints,
} from '../../lib/finance/csv-import/parse.ts';
import type { NormalizedRow, RawRow } from '../../lib/finance/csv-import/types.ts';

// Written with char codes so the source file holds no invisible characters.
const BOM = String.fromCharCode(0xfeff);
const UNICODE_MINUS = String.fromCharCode(0x2212);

/** Parses a file, takes detectMapping's guess as is, and applies it. */
function importWithGuess(text: string) {
  const parsed = parseStatementCsv(text);
  const guess = detectMapping(parsed.headers, parsed.rows);
  const result = applyMapping(parsed.rows, guess.mapping, guess.sign, guess.dateOrder, { preset: guess.preset });
  return { parsed, guess, result };
}

/** The fields most tests care about, one compact tuple per row. */
function summarize(rows: readonly NormalizedRow[]) {
  return rows.map((r) => [r.rowNumber, r.date, r.type, r.amountCents, r.vendor]);
}

function rawRows(headers: string[], lines: string[][]): RawRow[] {
  return lines.map((cells, i) => ({
    rowNumber: i + 2,
    cells: Object.fromEntries(headers.map((h, j) => [h, cells[j] ?? ''])),
  }));
}

// The plainest file there is: one signed amount column.
const SIMPLE_HEADERS = ['date', 'description', 'amount'];
const SIMPLE_MAPPING = { date: 'date', description: 'description', amount: 'amount' };

// ── Fixtures: one per bank layout ─────────────────────────────────────────

const CHASE_CARD = [
  'Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
  '01/13/2026,01/14/2026,SQ *BLUE HERON CAFE,Food & Drink,Sale,-4.75,',
  '01/15/2026,01/16/2026,Payment Thank You-Mobile,,Payment,250.00,',
].join('\n');

// Data lines end with an extra comma, so they have one more cell than the header.
const CHASE_CHECKING = [
  'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #',
  'DEBIT,01/14/2026,"NORTHWIND GROCERY #1234",-52.10,DEBIT_CARD,1947.90,,',
  'CREDIT,01/15/2026,"ACME PAYROLL PPD ID: 123",1500.00,ACH_CREDIT,3447.90,,',
].join('\n');

// The extended export, with addresses that span lines inside quotes.
const AMEX = [
  'Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category',
  '01/13/2026,FERNWOOD BOOKS,PAT EXAMPLE,-12345,23.50,"FERNWOOD BOOKS\nPORTLAND\nOR",FERNWOOD BOOKS,1 EXAMPLE ST,"PORTLAND\nOR",97201,UNITED STATES,\'320260130000000001\',Merchandise & Supplies-Book Stores',
  '01/15/2026,ONLINE PAYMENT - THANK YOU,PAT EXAMPLE,-12345,-100.00,ONLINE PAYMENT - THANK YOU,ONLINE PAYMENT - THANK YOU,,,,,\'320260150000000002\',',
].join('\n');

const AMEX_SHORT = [
  'Date,Description,Card Member,Account #,Amount',
  '01/13/2026,FERNWOOD BOOKS,PAT EXAMPLE,-12345,23.50',
].join('\n');

const CAPITAL_ONE_CARD = [
  'Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit',
  '2026-01-13,2026-01-14,1234,HILLTOP HARDWARE,Merchandise,18.25,',
  '2026-01-15,2026-01-15,1234,CAPITAL ONE AUTOPAY PYMT,Payment/Credit,,75.00',
].join('\n');

const CAPITAL_ONE_360 = [
  'Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance',
  '1234,Withdrawal from MAPLE UTILITIES,01/13/26,Debit,64.20,935.80',
  '1234,Monthly Interest Paid,01/31/26,Credit,1.15,936.95',
].join('\n');

const APPLE_CARD = [
  'Transaction Date,Clearing Date,Description,Merchant,Category,Type,Amount (USD),Purchased By',
  '01/13/2026,01/14/2026,"RIVERBEND TACOS 123 MAIN ST PORTLAND OR",Riverbend Tacos,Restaurants,Purchase,12.40,Pat Example',
  '01/15/2026,01/15/2026,"ACH DEPOSIT INTERNET TRANSFER FROM ACCOUNT ENDING IN 1234",Ach Deposit,Payment,Payment,-200.00,Pat Example',
].join('\n');

const DISCOVER = [
  'Trans. Date,Post Date,Description,Amount,Category',
  '01/13/2026,01/13/2026,LANTERN CINEMA 0042,15.00,Travel/ Entertainment',
  '01/15/2026,01/15/2026,INTERNET PAYMENT - THANK YOU,-60.00,Payments and Credits',
].join('\n');

// Debits are positive and credits negative; the last row has not cleared.
const CITI = [
  'Status,Date,Description,Debit,Credit',
  'Cleared,01/13/2026,"OAKLINE PHARMACY",9.99,',
  'Cleared,01/15/2026,"ONLINE PAYMENT, THANK YOU",,-45.00',
  'Pending,01/16/2026,"COPPER KETTLE DINER",21.00,',
].join('\n');

// A summary block and a blank line sit above the real header.
const BOFA_CHECKING = [
  'Description,,Summary Amt.',
  'Beginning balance as of 01/01/2026,,"1,234.56"',
  'Total credits,,"1,500.00"',
  'Total debits,,"-52.10"',
  'Ending balance as of 01/31/2026,,"2,682.46"',
  '',
  'Date,Description,Amount,Running Bal.',
  '01/01/2026,Beginning balance as of 01/01/2026,,"1,234.56"',
  '01/14/2026,"CHECKCARD 0113 GREENLEAF MARKET",-52.10,"1,182.46"',
  '01/15/2026,"ACME PAYROLL DES:DIRECT DEP",1500.00,"2,682.46"',
].join('\n');

const BOFA_CARD = [
  'Posted Date,Reference Number,Payee,Address,Amount',
  '01/13/2026,24000000000000000000001,"GREENLEAF MARKET","PORTLAND      OR ",-31.07',
  '01/15/2026,24000000000000000000002,"PAYMENT - THANK YOU","",120.00',
].join('\n');

// No header: date, amount, an asterisk, a blank cell, description.
const WELLS_FARGO = [
  '"01/13/2026","-8.50","*","","PURCHASE AUTHORIZED ON 01/12 SUNNY BAGELS"',
  '"01/15/2026","1200.00","*","","ACME PAYROLL DIRECT DEP"',
].join('\n');

const PAYPAL = [
  '"Date","Time","TimeZone","Name","Type","Status","Currency","Gross","Fee","Net","From Email Address","To Email Address","Transaction ID","Balance"',
  '"01/13/2026","10:15:00","PST","Larkspur Games","Express Checkout Payment","Completed","USD","-19.99","0.00","-19.99","pat@example.com","sales@example.com","1AB23456CD789012E","80.01"',
  '"01/15/2026","09:00:00","PST","","General Withdrawal","Pending","USD","-50.00","0.00","-50.00","","","9ZY87654XW321098V","30.01"',
].join('\n');

// A PayPal activity export with the rows that move no money: an item detail
// line (blank Balance Impact), an authorization ("Memo"), a denied payment,
// a hold, and the euro side of a currency conversion.
const PAYPAL_ACTIVITY = [
  '"Date","Time","TimeZone","Name","Type","Status","Currency","Gross","Fee","Net","Transaction ID","Balance Impact"',
  '"02/01/2026","10:00:00","PST","Larkspur Games","Express Checkout Payment","Completed","USD","-19.99","0.00","-19.99","1AAA","Debit"',
  '"02/01/2026","10:00:00","PST","Larkspur Games","Shopping Cart Item","Completed","USD","19.99","0.00","19.99","1AAB",""',
  '"02/01/2026","10:00:00","PST","","Bank Deposit to PP Account","Completed","USD","19.99","0.00","19.99","1AAC","Credit"',
  '"02/02/2026","11:00:00","PST","Fernwood Supply","General Authorization","Pending","USD","-40.00","0.00","-40.00","1AAD","Memo"',
  '"02/03/2026","12:00:00","PST","Quill Books","PreApproved Payment Bill User Payment","Denied","USD","-12.00","0.00","-12.00","1AAE","Debit"',
  '"02/04/2026","13:00:00","PST","","Account Hold for Open Authorization","Completed","USD","-5.00","0.00","-5.00","1AAF","Debit"',
  '"02/05/2026","14:00:00","PST","Atelier Nord","General Currency Conversion","Completed","EUR","-10.00","0.00","-10.00","1AAG","Debit"',
  '"02/05/2026","14:00:00","PST","Atelier Nord","General Currency Conversion","Completed","USD","-11.20","0.00","-11.20","1AAH","Debit"',
  '"02/06/2026","15:00:00","PST","Quill Books","Payment Refund","Completed","USD","8.00","0.00","8.00","1AAI","Credit"',
].join('\n');

// Arizona Federal Credit Union: a summary block, then the table. The merchant
// is in Memo, with the card's own date and a reference after it.
const AZFCU = [
  'Account Name : SAMPLE CHECKING',
  'Account Number : 00000000S0001',
  'Date Range : 01/01/2026-01/31/2026',
  'Transaction Number,Date,Description,Memo,Amount Debit,Amount Credit,Balance,Check Number',
  '"000000101",01/20/2026,"Withdrawal Debit Card ","BLUE HERON CAFE TEMPE AZ Date 01/19/26 12345678901234567890 5814",-4.75,,995.25,',
  '"000000102",01/21/2026,"Withdrawal SAMPLE CARD ONLINE ","TYPE: PAYMENT ID: 0000 CO: SAMPLE CARD ONLINE",-120.00,,875.25,',
  '"000000103",01/22/2026,"Deposit Dividend 0.100% ","%% APY Earned 0.10% %% Avg Daily Bal 900.00",,0.11,875.36,',
  '"000000104",01/23/2026,"COMMENT","",,,875.36,',
].join('\n');

// Navy Federal: an unsigned amount and a Credit Debit Indicator column.
const NAVY_FEDERAL = [
  BOM + 'Posting Date,Transaction Date,Amount,Credit Debit Indicator,type,Type Group,Reference,Instructed Currency,Currency Exchange Rate,Instructed Amount,Description,Category,Check Serial Number,Card Ending,Rewards Total,Rewards Type',
  '01/14/2026,01/13/2026,4.75,Debit,POS,POS,,,,,Blue Heron Cafe,Dining Out,,,,',
  '01/15/2026,01/15/2026,1500.00,Credit,ACH Credit,ACH Credit,,,,,Acme Payroll,Income,,,,',
].join('\n');

// Best Buy's ".xls" download: tab-separated text, no header.
const BEST_BUY_TEXT = ['01/05/2026\t$-25.00\tONLINE PAYMENT           SAMPLETOWN    IL\tpayment', '01/07/2026\t$89.99\tBEST BUY 00123\tpurchase'].join('\n');

// ── normalizeHeader ───────────────────────────────────────────────────────

test('normalizeHeader: trims, lowercases, and joins words with underscores', () => {
  assert.equal(normalizeHeader('  Transaction   Date '), 'transaction_date');
  assert.equal(normalizeHeader('Amount (USD)'), 'amount_(usd)');
  assert.equal(normalizeHeader('Trans. Date'), 'trans._date');
  assert.equal(normalizeHeader('media_type'), 'media_type');
});

// ── parseAmount ───────────────────────────────────────────────────────────

test('parseAmount: plain numbers become integer cents', () => {
  assert.equal(parseAmount('12.34'), 1234);
  assert.equal(parseAmount('12'), 1200);
  assert.equal(parseAmount('12.3'), 1230);
  assert.equal(parseAmount('.5'), 50);
  assert.equal(parseAmount('0.00'), 0);
  // 19.99 * 100 is 1998.9999999999998 in floating point.
  assert.equal(parseAmount('19.99'), 1999);
  assert.equal(parseAmount('1.005'), 101);
});

test('parseAmount: dollar signs, commas and whitespace', () => {
  assert.equal(parseAmount('$1,234.56'), 123456);
  assert.equal(parseAmount(' $ 1,234,567.00 '), 123456700);
  assert.equal(parseAmount('1234.56'), 123456);
});

test('parseAmount: negatives written with parentheses or a leading minus', () => {
  assert.equal(parseAmount('(12.34)'), -1234);
  assert.equal(parseAmount('($1,000.00)'), -100000);
  assert.equal(parseAmount('-12.34'), -1234);
  assert.equal(parseAmount('-$12.34'), -1234);
  assert.equal(parseAmount('$-12.34'), -1234);
  assert.equal(parseAmount(`${UNICODE_MINUS}12.34`), -1234);
  assert.equal(parseAmount('+12.34'), 1234);
  assert.equal(parseAmount('+$12.34'), 1234);
  assert.equal(Object.is(parseAmount('-0.00'), 0), true);
});

test('parseAmount: a trailing CR is money in and DR is money out', () => {
  assert.equal(parseAmount('12.34 CR'), 1234);
  assert.equal(parseAmount('12.34CR'), 1234);
  assert.equal(parseAmount('12.34 DR'), -1234);
  assert.equal(parseAmount('$1,000.00 dr'), -100000);
});

test('parseAmount: anything that is not a number is null', () => {
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('   '), null);
  assert.equal(parseAmount(null), null);
  assert.equal(parseAmount(undefined), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('$'), null);
  assert.equal(parseAmount('-'), null);
  assert.equal(parseAmount('.'), null);
  assert.equal(parseAmount('12.34.56'), null);
  assert.equal(parseAmount('--5'), null);
  assert.equal(parseAmount('*'), null);
});

test('parseAmount: a comma that is not a thousands separator is refused, not guessed', () => {
  assert.equal(parseAmount('12,34'), null);
  assert.equal(parseAmount('1.234,56'), null);
  assert.equal(parseAmount('1,23,456'), null);
});

// ── parseDate ─────────────────────────────────────────────────────────────

test('parseDate: ISO dates, with or without a time', () => {
  assert.equal(parseDate('2026-01-31', 'MDY'), '2026-01-31');
  assert.equal(parseDate('2026-01-31T14:05:00Z', 'MDY'), '2026-01-31');
  assert.equal(parseDate('2026-01-31 14:05:00', 'DMY'), '2026-01-31');
  assert.equal(parseDate('2026/1/5', 'MDY'), '2026-01-05');
  // The time zone is dropped, not applied: the date stays the one printed.
  assert.equal(parseDate('2026-01-31T23:30:00-08:00', 'MDY'), '2026-01-31');
});

test('parseDate: month-first numeric dates', () => {
  assert.equal(parseDate('1/5/2026', 'MDY'), '2026-01-05');
  assert.equal(parseDate('01/31/2026', 'MDY'), '2026-01-31');
  assert.equal(parseDate('1/5/26', 'MDY'), '2026-01-05');
  assert.equal(parseDate('01-31-2026', 'MDY'), '2026-01-31');
  assert.equal(parseDate('12/31/99', 'MDY'), '1999-12-31');
  assert.equal(parseDate('1/31/2026 2:05 PM', 'MDY'), '2026-01-31');
});

test('parseDate: the order decides which part is the month', () => {
  assert.equal(parseDate('05/01/2026', 'MDY'), '2026-05-01');
  assert.equal(parseDate('05/01/2026', 'DMY'), '2026-01-05');
  assert.equal(parseDate('31/01/2026', 'DMY'), '2026-01-31');
  assert.equal(parseDate('31/01/2026', 'MDY'), null);
  assert.equal(parseDate('26/01/31', 'YMD'), '2026-01-31');
  // A 4-digit year at the end can't be year-first, so YMD falls back to month-first.
  assert.equal(parseDate('01/31/2026', 'YMD'), '2026-01-31');
});

test('parseDate: month names', () => {
  assert.equal(parseDate('Jan 5, 2026', 'MDY'), '2026-01-05');
  assert.equal(parseDate('January 31, 2026', 'DMY'), '2026-01-31');
  assert.equal(parseDate('Sept. 3, 2026', 'MDY'), '2026-09-03');
  assert.equal(parseDate('Dec 31 2026', 'MDY'), '2026-12-31');
  assert.equal(parseDate('31 Jan 2026', 'MDY'), '2026-01-31');
  assert.equal(parseDate('31-Jan-2026', 'MDY'), '2026-01-31');
  assert.equal(parseDate('Foo 5, 2026', 'MDY'), null);
});

test('parseDate: dates that do not exist are null', () => {
  assert.equal(parseDate('02/30/2026', 'MDY'), null);
  assert.equal(parseDate('2026-02-30', 'MDY'), null);
  assert.equal(parseDate('02/29/2026', 'MDY'), null);
  assert.equal(parseDate('02/29/2028', 'MDY'), '2028-02-29');
  assert.equal(parseDate('04/31/2026', 'MDY'), null);
  assert.equal(parseDate('13/13/2026', 'MDY'), null);
  assert.equal(parseDate('00/10/2026', 'MDY'), null);
  assert.equal(parseDate('Feb 30, 2026', 'MDY'), null);
});

test('parseDate: text that is not a date is null', () => {
  assert.equal(parseDate('', 'MDY'), null);
  assert.equal(parseDate(null, 'MDY'), null);
  assert.equal(parseDate('Pending', 'MDY'), null);
  assert.equal(parseDate('12.34', 'MDY'), null);
  assert.equal(parseDate('-4.50', 'MDY'), null);
  assert.equal(parseDate('Balance as of 01/31/2026', 'MDY'), null);
  assert.equal(parseDate('1/2/3', 'MDY'), null);
  assert.equal(parseDate('01/02/0026', 'MDY'), null);
});

// ── detectDateOrder ───────────────────────────────────────────────────────

test('detectDateOrder: a first part over 12 means day-first', () => {
  assert.deepEqual(detectDateOrder(['05/01/2026', '13/01/2026']), { order: 'DMY', ambiguous: false });
});

test('detectDateOrder: a second part over 12 means month-first', () => {
  assert.deepEqual(detectDateOrder(['01/05/2026', '01/13/2026']), { order: 'MDY', ambiguous: false });
});

test('detectDateOrder: when every date reads both ways it says so', () => {
  assert.deepEqual(detectDateOrder(['01/05/2026', '02/03/2026']), { order: 'MDY', ambiguous: true });
});

test('detectDateOrder: year-first and month-name dates carry no ambiguity', () => {
  assert.deepEqual(detectDateOrder(['2026-01-05', '2026-02-03']), { order: 'YMD', ambiguous: false });
  assert.deepEqual(detectDateOrder(['Jan 5, 2026']), { order: 'MDY', ambiguous: false });
  assert.deepEqual(detectDateOrder([]), { order: 'MDY', ambiguous: false });
  assert.deepEqual(detectDateOrder(['', null, 'n/a']), { order: 'MDY', ambiguous: false });
});

test('detectDateOrder: a column that contradicts itself is flagged', () => {
  assert.deepEqual(detectDateOrder(['13/01/2026', '01/13/2026']), { order: 'DMY', ambiguous: true });
});

// ── normalizeType ─────────────────────────────────────────────────────────

test('normalizeType: money-out words, ignoring case', () => {
  for (const word of ['debit', 'Withdrawal', 'PURCHASE', 'Charge', 'sale', 'Expense']) {
    assert.equal(normalizeType(word), 'expense', word);
  }
});

test('normalizeType: money-in words, ignoring case', () => {
  for (const word of ['credit', 'Deposit', 'REFUND', 'Income']) {
    assert.equal(normalizeType(word), 'income', word);
  }
});

test('normalizeType: finds the word inside a longer value', () => {
  assert.equal(normalizeType('ACH_DEBIT'), 'expense');
  assert.equal(normalizeType('Debit Card'), 'expense');
  assert.equal(normalizeType('MISC_CREDIT'), 'income');
  assert.equal(normalizeType('  credit  '), 'income');
});

test('normalizeType: null when the value names neither direction, or both', () => {
  assert.equal(normalizeType(''), null);
  assert.equal(normalizeType(null), null);
  assert.equal(normalizeType('Payment'), null);
  assert.equal(normalizeType('General Withdrawals'), null);
  assert.equal(normalizeType('Credit Card Purchase'), null);
  // "discredit" is not the word "credit".
  assert.equal(normalizeType('discredit'), null);
});

// ── transferHints ─────────────────────────────────────────────────────────

test('transferHints: transfers between accounts', () => {
  assert.deepEqual(transferHints('ONLINE TRANSFER TO SAV ...1234'), ['transfer']);
  assert.deepEqual(transferHints('ACCT_XFER REF 99'), ['transfer']);
  assert.deepEqual(transferHints('Zelle payment to Sam Example'), ['transfer']);
  assert.deepEqual(transferHints('VENMO CASHOUT'), ['transfer']);
});

test('transferHints: card payments', () => {
  assert.deepEqual(transferHints('Payment Thank You-Mobile'), ['card_payment']);
  assert.deepEqual(transferHints('EXAMPLE CARD AUTOPAY PYMT'), ['card_payment']);
  assert.deepEqual(transferHints('ONLINE PAYMENT 0123'), ['card_payment']);
  assert.deepEqual(transferHints('EXAMPLE BANK E-PAYMENT'), ['card_payment']);
  assert.deepEqual(transferHints('EXAMPLE BANK EPAY'), ['card_payment']);
  assert.deepEqual(transferHints('CREDIT CARD PAYMENT'), ['card_payment']);
});

test('transferHints: loan payments and insurance', () => {
  assert.deepEqual(transferHints('EXAMPLE HOME MORTGAGE'), ['loan_payment']);
  assert.deepEqual(transferHints('STUDENT LOAN SERVICER'), ['loan_payment']);
  assert.deepEqual(transferHints('AUTO PAY LOAN 0042'), ['card_payment', 'loan_payment']);
  assert.deepEqual(transferHints('EXAMPLE MUTUAL INSURANCE'), ['insurance']);
  assert.deepEqual(transferHints('POLICY PREMIUM'), ['insurance']);
});

test('transferHints: whole words only, and nothing for an ordinary purchase', () => {
  assert.deepEqual(transferHints('SLOAN STREET CAFE'), []);
  assert.deepEqual(transferHints('BLUE HERON CAFE'), []);
  assert.deepEqual(transferHints('APPLE PAY CORNER STORE'), []);
  assert.deepEqual(transferHints(''), []);
  assert.deepEqual(transferHints(null), []);
});

// ── parseStatementCsv ─────────────────────────────────────────────────────

test('parseStatementCsv: a plain file with a header on line 1', () => {
  const parsed = parseStatementCsv('Date,Description,Amount\n01/13/2026,BLUE HERON CAFE,-4.75\n');
  assert.deepEqual(parsed.headers, ['date', 'description', 'amount']);
  assert.deepEqual(parsed.headerLabels, ['Date', 'Description', 'Amount']);
  assert.equal(parsed.hasHeader, true);
  assert.deepEqual(parsed.preambleLines, []);
  assert.deepEqual(parsed.warnings, []);
  assert.deepEqual(parsed.rows, [
    { rowNumber: 2, cells: { date: '01/13/2026', description: 'BLUE HERON CAFE', amount: '-4.75' } },
  ]);
});

test('parseStatementCsv: strips a byte-order mark', () => {
  const parsed = parseStatementCsv(`${BOM}Date,Description,Amount\n01/13/2026,BLUE HERON CAFE,-4.75\n`);
  assert.deepEqual(parsed.headers, ['date', 'description', 'amount']);
  assert.equal(parsed.rows.length, 1);
});

test('parseStatementCsv: Windows line endings and tab-separated files', () => {
  const crlf = parseStatementCsv('Date,Description,Amount\r\n01/13/2026,BLUE HERON CAFE,-4.75\r\n');
  assert.deepEqual(crlf.rows[0].cells, { date: '01/13/2026', description: 'BLUE HERON CAFE', amount: '-4.75' });
  const tabs = parseStatementCsv('Date\tDescription\tAmount\n01/13/2026\tBLUE HERON CAFE\t-4.75\n');
  assert.deepEqual(tabs.headers, ['date', 'description', 'amount']);
  assert.equal(tabs.rows[0].cells.amount, '-4.75');
});

test('parseStatementCsv: blank lines are skipped but still count toward row numbers', () => {
  const parsed = parseStatementCsv(
    'Date,Description,Amount\n01/13/2026,BLUE HERON CAFE,-4.75\n\n , ,\n01/14/2026,HILLTOP HARDWARE,-18.25\n',
  );
  assert.deepEqual(parsed.rows.map((r) => r.rowNumber), [2, 5]);
});

test('parseStatementCsv: a quoted field may hold commas and line breaks', () => {
  const parsed = parseStatementCsv(
    'Date,Description,Amount\n01/13/2026,"FERNWOOD BOOKS, INC\nPORTLAND OR","-1,004.75"\n01/14/2026,HILLTOP HARDWARE,-18.25\n',
  );
  assert.equal(parsed.rows[0].cells.description, 'FERNWOOD BOOKS, INC\nPORTLAND OR');
  assert.equal(parsed.rows[0].cells.amount, '-1,004.75');
  // The two-line field is one spreadsheet row, so the next row is row 3.
  assert.deepEqual(parsed.rows.map((r) => r.rowNumber), [2, 3]);
});

test('parseStatementCsv: skips summary lines above the table', () => {
  const parsed = parseStatementCsv(BOFA_CHECKING);
  assert.deepEqual(parsed.headers, ['date', 'description', 'amount', 'running_bal.']);
  assert.equal(parsed.hasHeader, true);
  assert.deepEqual(parsed.preambleLines, [
    'Description, Summary Amt.',
    'Beginning balance as of 01/01/2026, 1,234.56',
    'Total credits, 1,500.00',
    'Total debits, -52.10',
    'Ending balance as of 01/31/2026, 2,682.46',
  ]);
  // Five summary lines, a blank line, the header on line 7, data from line 8.
  assert.equal(parsed.headerRowNumber, 7);
  assert.deepEqual(parsed.rows.map((r) => r.rowNumber), [8, 9, 10]);
});

test('parseStatementCsv: a file with no header row gets positional keys', () => {
  const parsed = parseStatementCsv(WELLS_FARGO);
  assert.equal(parsed.hasHeader, false);
  assert.deepEqual(parsed.headers, ['col_1', 'col_2', 'col_3', 'col_4', 'col_5']);
  assert.deepEqual(parsed.headerLabels, ['Column 1', 'Column 2', 'Column 3', 'Column 4', 'Column 5']);
  assert.equal(parsed.headerRowNumber, null);
  assert.deepEqual(parsed.preambleLines, []);
  assert.deepEqual(parsed.rows.map((r) => r.rowNumber), [1, 2]);
  assert.equal(parsed.rows[0].cells.col_5, 'PURCHASE AUTHORIZED ON 01/12 SUNNY BAGELS');
});

test('parseStatementCsv: a banner line above a headerless table is preamble, not a header', () => {
  const parsed = parseStatementCsv(`Account ending 1234\n${WELLS_FARGO}`);
  assert.equal(parsed.hasHeader, false);
  assert.deepEqual(parsed.preambleLines, ['Account ending 1234']);
  assert.deepEqual(parsed.rows.map((r) => r.rowNumber), [2, 3]);
});

test('parseStatementCsv: an undated line under the header does not get mistaken for it', () => {
  const parsed = parseStatementCsv(
    [
      'Date,Description,Amount',
      'Pending,COPPER KETTLE DINER,-21.00',
      ',OPENING BALANCE,"1,234.56"',
      '01/13/2026,BLUE HERON CAFE,-4.75',
    ].join('\n'),
  );
  assert.equal(parsed.hasHeader, true);
  assert.deepEqual(parsed.headers, ['date', 'description', 'amount']);
  assert.deepEqual(parsed.preambleLines, []);
  // The undated lines stay in the table, so applyMapping can say why they were skipped.
  assert.deepEqual(parsed.rows.map((r) => r.rowNumber), [2, 3, 4]);
  const result = applyMapping(parsed.rows, SIMPLE_MAPPING, 'negative_is_expense', 'MDY');
  assert.deepEqual(result.rejected, [
    { row: 2, reason: 'Date "Pending" is not a real date' },
    { row: 3, reason: 'No date' },
  ]);
  assert.deepEqual(result.rows.map((r) => r.rowNumber), [4]);
});

test('parseStatementCsv: an account block as wide as the table is still preamble', () => {
  const parsed = parseStatementCsv(
    [
      'Account Name,Account Number,Balance',
      'Everyday Checking,****1234,"1,000.00"',
      '',
      'Date,Description,Amount',
      '01/13/2026,BLUE HERON CAFE,-4.75',
    ].join('\n'),
  );
  assert.deepEqual(parsed.headers, ['date', 'description', 'amount']);
  assert.deepEqual(parsed.preambleLines, [
    'Account Name, Account Number, Balance',
    'Everyday Checking, ****1234, 1,000.00',
  ]);
  assert.deepEqual(parsed.rows.map((r) => r.rowNumber), [5]);
});

test('parseStatementCsv: a first data line of the wrong width is kept, not dropped with the header', () => {
  // The stray comma after ACME gives line 2 four cells in a three-column table.
  const parsed = parseStatementCsv(
    [
      'Date,Description,Amount',
      '01/13/2026,ACME, INC,-4.75',
      '01/14/2026,HILLTOP HARDWARE,-18.25',
      '01/15/2026,OAKLINE PHARMACY,-9.99',
    ].join('\n'),
  );
  assert.equal(parsed.hasHeader, true);
  assert.deepEqual(parsed.headers, ['date', 'description', 'amount']);
  assert.deepEqual(parsed.preambleLines, []);
  assert.deepEqual(parsed.rows.map((r) => r.rowNumber), [2, 3, 4]);
  const result = applyMapping(parsed.rows, SIMPLE_MAPPING, 'negative_is_expense', 'MDY');
  assert.deepEqual(result.rejected, [{ row: 2, reason: 'Amount "INC" is not a number' }]);
  assert.deepEqual(result.rows.map((r) => r.rowNumber), [3, 4]);
});

test('parseStatementCsv: a header named like a built-in object key is still a usable column', () => {
  const parsed = parseStatementCsv('__proto__,constructor,Date\nx,y,01/13/2026\n');
  assert.deepEqual(parsed.headers, ['col_1', 'constructor', 'date']);
  assert.deepEqual(Object.entries(parsed.rows[0].cells), [
    ['col_1', 'x'],
    ['constructor', 'y'],
    ['date', '01/13/2026'],
  ]);
});

test('parseStatementCsv: a trailing comma on every data line does not hide the header', () => {
  const parsed = parseStatementCsv(CHASE_CHECKING);
  assert.equal(parsed.hasHeader, true);
  assert.equal(parsed.headers.length, 7);
  assert.equal(parsed.headers[6], 'check_or_slip_#');
  assert.deepEqual(Object.keys(parsed.rows[0].cells), parsed.headers);
});

test('parseStatementCsv: a trailing comma on the header line is ignored', () => {
  const parsed = parseStatementCsv('Date,Description,Amount,\n01/13/2026,BLUE HERON CAFE,-4.75\n');
  assert.deepEqual(parsed.headers, ['date', 'description', 'amount']);
  assert.equal(parsed.hasHeader, true);
});

test('parseStatementCsv: repeated and blank header cells still get unique keys', () => {
  const parsed = parseStatementCsv('Date,Amount,Amount,,Description\n01/13/2026,-4.75,10.00,x,BLUE HERON CAFE\n');
  assert.deepEqual(parsed.headers, ['date', 'amount', 'amount_1', 'col_4', 'description']);
  assert.deepEqual(parsed.headerLabels, ['Date', 'Amount', 'Amount', 'Column 4', 'Description']);
  assert.equal(parsed.rows[0].cells.amount_1, '10.00');
});

test('parseStatementCsv: short rows are padded and cell text is trimmed', () => {
  const parsed = parseStatementCsv('Date,Description,Amount\n01/13/2026,  BLUE HERON CAFE  ,-4.75\n01/14/2026,HILLTOP HARDWARE\n');
  assert.equal(parsed.rows[0].cells.description, 'BLUE HERON CAFE');
  assert.deepEqual(parsed.rows[1].cells, { date: '01/14/2026', description: 'HILLTOP HARDWARE', amount: '' });
});

test('parseStatementCsv: warns when a quote is never closed', () => {
  const parsed = parseStatementCsv('Date,Description,Amount\n01/13/2026,"BLUE HERON CAFE,-4.75\n01/14/2026,HILLTOP HARDWARE,-18.25\n');
  assert.equal(parsed.warnings.length, 1);
  assert.match(parsed.warnings[0], /^Row 2 has a quotation mark that is never closed/);
});

test('parseStatementCsv: an empty file and a file with no dates', () => {
  assert.deepEqual(parseStatementCsv(''), {
    headers: [],
    headerLabels: [],
    hasHeader: false,
    headerRowNumber: null,
    rows: [],
    preambleLines: [],
    warnings: [],
  });
  // Nothing looks like a date, so line 1 is taken as the header and the rows are kept for applyMapping to reject.
  const noDates = parseStatementCsv('Date,Description,Amount\nyesterday,BLUE HERON CAFE,-4.75\n');
  assert.deepEqual(noDates.headers, ['date', 'description', 'amount']);
  assert.equal(noDates.rows.length, 1);
});

// ── detectMapping + applyMapping, per bank layout ─────────────────────────

test('Chase card: purchases are negative', () => {
  const { guess, result } = importWithGuess(CHASE_CARD);
  assert.equal(guess.preset, 'chase_card');
  assert.equal(guess.confidence, 'high');
  assert.equal(guess.sign, 'negative_is_expense');
  assert.deepEqual(guess.mapping, {
    date: 'transaction_date',
    postDate: 'post_date',
    description: 'description',
    memo: 'memo',
    amount: 'amount',
    category: 'category',
  });
  assert.deepEqual(result.rows, [
    {
      rowNumber: 2,
      date: '2026-01-13',
      amountCents: 475,
      type: 'expense',
      description: 'SQ *BLUE HERON CAFE',
      vendor: 'Blue Heron Cafe',
      hints: [],
      issues: [],
      categoryName: 'Food & Drink',
    },
    {
      rowNumber: 3,
      date: '2026-01-15',
      amountCents: 25000,
      type: 'income',
      description: 'Payment Thank You-Mobile',
      vendor: 'Payment Thank You Mobile',
      hints: ['card_payment'],
      issues: [],
    },
  ]);
  assert.deepEqual(result.rejected, []);
  assert.deepEqual(result.missingColumns, []);
});

test('Chase checking: the posting date is the date', () => {
  const { guess, result } = importWithGuess(CHASE_CHECKING);
  assert.equal(guess.preset, 'chase_checking');
  assert.equal(guess.sign, 'negative_is_expense');
  assert.deepEqual(summarize(result.rows), [
    [2, '2026-01-14', 'expense', 5210, 'Northwind Grocery'],
    [3, '2026-01-15', 'income', 150000, 'Acme Payroll Ppd Id'],
  ]);
  assert.deepEqual(result.rejected, []);
});

test('Amex: charges are positive, and the reference becomes the bank ID', () => {
  const { guess, result } = importWithGuess(AMEX);
  assert.equal(guess.preset, 'amex');
  assert.equal(guess.sign, 'positive_is_expense');
  assert.deepEqual(summarize(result.rows), [
    [2, '2026-01-13', 'expense', 2350, 'Fernwood Books'],
    [3, '2026-01-15', 'income', 10000, 'Online Payment Thank You'],
  ]);
  assert.equal(result.rows[0].bankId, "'320260130000000001'");
  assert.equal(result.rows[0].categoryName, 'Merchandise & Supplies-Book Stores');
  assert.equal(result.rows[1].categoryName, undefined);
  assert.deepEqual(result.rows[1].hints, ['card_payment']);
});

test('Amex: the shorter export matches too, without the optional columns', () => {
  const { guess, result } = importWithGuess(AMEX_SHORT);
  assert.equal(guess.preset, 'amex');
  assert.deepEqual(guess.mapping, { date: 'date', description: 'description', amount: 'amount' });
  assert.deepEqual(summarize(result.rows), [[2, '2026-01-13', 'expense', 2350, 'Fernwood Books']]);
});

test('Capital One card: split debit and credit columns', () => {
  const { guess, result } = importWithGuess(CAPITAL_ONE_CARD);
  assert.equal(guess.preset, 'capital_one_card');
  assert.equal(guess.sign, 'split_columns');
  assert.equal(guess.dateOrder, 'YMD');
  assert.equal(guess.dateOrderAmbiguous, false);
  assert.deepEqual(summarize(result.rows), [
    [2, '2026-01-13', 'expense', 1825, 'Hilltop Hardware'],
    [3, '2026-01-15', 'income', 7500, 'Capital One Autopay Pymt'],
  ]);
  assert.deepEqual(result.rows[1].hints, ['card_payment']);
});

test('Capital One 360: an unsigned amount with a debit/credit type column', () => {
  const { guess, result } = importWithGuess(CAPITAL_ONE_360);
  assert.equal(guess.preset, 'capital_one_360');
  assert.equal(guess.sign, 'type_column');
  assert.deepEqual(summarize(result.rows), [
    [2, '2026-01-13', 'expense', 6420, 'Withdrawal From Maple Utilities'],
    [3, '2026-01-31', 'income', 115, 'Monthly Interest Paid'],
  ]);
});

test('Apple Card: purchases are positive, and the merchant column is the vendor', () => {
  const { guess, result } = importWithGuess(APPLE_CARD);
  assert.equal(guess.preset, 'apple_card');
  assert.equal(guess.sign, 'positive_is_expense');
  assert.equal(guess.mapping.amount, 'amount_(usd)');
  assert.deepEqual(summarize(result.rows), [
    [2, '2026-01-13', 'expense', 1240, 'Riverbend Tacos'],
    [3, '2026-01-15', 'income', 20000, 'Ach Deposit'],
  ]);
  assert.equal(result.rows[0].description, 'RIVERBEND TACOS 123 MAIN ST PORTLAND OR');
  assert.deepEqual(result.rows[1].hints, ['transfer']);
});

test('Discover: charges are positive', () => {
  const { guess, result } = importWithGuess(DISCOVER);
  assert.equal(guess.preset, 'discover');
  assert.equal(guess.sign, 'positive_is_expense');
  assert.equal(guess.mapping.date, 'trans._date');
  assert.deepEqual(summarize(result.rows), [
    [2, '2026-01-13', 'expense', 1500, 'Lantern Cinema'],
    [3, '2026-01-15', 'income', 6000, 'Internet Payment Thank You'],
  ]);
});

test('Citi: split columns with negative credits, and a pending row is flagged', () => {
  const { guess, result } = importWithGuess(CITI);
  assert.equal(guess.preset, 'citi');
  assert.equal(guess.sign, 'split_columns');
  assert.deepEqual(summarize(result.rows), [
    [2, '2026-01-13', 'expense', 999, 'Oakline Pharmacy'],
    [3, '2026-01-15', 'income', 4500, 'Online Payment Thank You'],
    [4, '2026-01-16', 'expense', 2100, 'Copper Kettle Diner'],
  ]);
  assert.deepEqual(result.rows.map((r) => r.pending), [false, false, true]);
});

test('Bank of America checking: the balance line is rejected, the rest import', () => {
  const { guess, result } = importWithGuess(BOFA_CHECKING);
  assert.equal(guess.preset, 'bofa_checking');
  assert.equal(guess.sign, 'negative_is_expense');
  assert.deepEqual(summarize(result.rows), [
    [9, '2026-01-14', 'expense', 5210, 'Checkcard Greenleaf Market'],
    [10, '2026-01-15', 'income', 150000, 'Acme Payroll Des Direct Dep'],
  ]);
  assert.deepEqual(result.rejected, [{ row: 8, reason: 'No amount' }]);
});

test('Bank of America card: the payee is the description', () => {
  const { guess, result } = importWithGuess(BOFA_CARD);
  assert.equal(guess.preset, 'bofa_card');
  assert.equal(guess.sign, 'negative_is_expense');
  assert.deepEqual(summarize(result.rows), [
    [2, '2026-01-13', 'expense', 3107, 'Greenleaf Market'],
    [3, '2026-01-15', 'income', 12000, 'Payment Thank You'],
  ]);
  assert.equal(result.rows[0].bankId, '24000000000000000000001');
});

test('Wells Fargo: recognized without a header row', () => {
  const { guess, result } = importWithGuess(WELLS_FARGO);
  assert.equal(guess.preset, 'wells_fargo');
  assert.equal(guess.confidence, 'high');
  assert.deepEqual(guess.mapping, { date: 'col_1', description: 'col_5', amount: 'col_2' });
  assert.deepEqual(summarize(result.rows), [
    [1, '2026-01-13', 'expense', 850, 'Purchase Authorized On 01 12 Sunny Bagels'],
    [2, '2026-01-15', 'income', 120000, 'Acme Payroll Direct Dep'],
  ]);
});

test('PayPal: transaction IDs, a pending row, and the type standing in for a blank name', () => {
  const { guess, result } = importWithGuess(PAYPAL);
  assert.equal(guess.preset, 'paypal');
  assert.equal(guess.sign, 'negative_is_expense');
  assert.deepEqual(summarize(result.rows), [
    [2, '2026-01-13', 'expense', 1999, 'Larkspur Games'],
    [3, '2026-01-15', 'expense', 5000, 'General Withdrawal'],
  ]);
  assert.deepEqual(result.rows.map((r) => r.pending), [false, true]);
  assert.deepEqual(result.rows.map((r) => r.bankId), ['1AB23456CD789012E', '9ZY87654XW321098V']);
  assert.deepEqual(
    assignExternalIds(result.rows).map((r) => r.externalId),
    ['bank:1AB23456CD789012E', 'bank:9ZY87654XW321098V'],
  );
});

test('PayPal activity: rows that move no money are left out with a reason, not rejected', () => {
  const { guess, result } = importWithGuess(PAYPAL_ACTIVITY);
  assert.equal(guess.preset, 'paypal');
  assert.deepEqual(
    result.rows.map((r) => [r.rowNumber, r.type, r.amountCents]),
    [
      [2, 'expense', 1999],
      [4, 'income', 1999],
      [9, 'expense', 1120],
      [10, 'income', 800],
    ],
  );
  assert.deepEqual(result.rejected, []);
  assert.deepEqual(result.skipped.map((r) => r.row), [3, 5, 6, 7, 8]);
  assert.match(result.skipped[0].reason, /item line/);
  assert.match(result.skipped[1].reason, /memo/i);
  assert.match(result.skipped[2].reason, /denied/);
  assert.match(result.skipped[3].reason, /hold/);
  assert.match(result.skipped[4].reason, /another currency/);
  // Funding from the bank reads as a transfer, from PayPal's own Type wording.
  assert.ok(result.rows[1].hints.includes('transfer'));
});

test('Arizona Federal: the memo is kept as detail, the vendor comes from it, comments are left out', () => {
  const { guess, result } = importWithGuess(AZFCU);
  assert.equal(guess.preset, 'azfcu');
  assert.equal(guess.sign, 'split_columns');
  assert.equal(guess.mapping.detail, 'memo');
  assert.deepEqual(summarize(result.rows), [
    [5, '2026-01-20', 'expense', 475, 'Blue Heron Cafe Tempe Az'],
    [6, '2026-01-21', 'expense', 12000, 'Sample Card Online'],
    [7, '2026-01-22', 'income', 11, 'Dividend'],
  ]);
  // The card date, the long reference and the %% note are cut from the description.
  assert.equal(result.rows[0].description, 'Withdrawal Debit Card - BLUE HERON CAFE TEMPE AZ');
  assert.equal(result.rows[2].description, 'Deposit Dividend 0.100%');
  assert.equal(result.rows[0].bankId, '000000101');
  assert.deepEqual(result.skipped.map((r) => r.row), [8]);
});

test('cleanDetail: collapses lines, cuts the card date, references and %% notes', () => {
  assert.equal(cleanDetail('SUNNY BAGELS\nPHOENIX AZ Date 01/02/26 99999999999999 5814'), 'SUNNY BAGELS PHOENIX AZ');
  assert.equal(cleanDetail('%% APY Earned 0.10%'), '');
  assert.equal(cleanDetail(''), '');
  assert.equal(cleanDetail('x'.repeat(100)).length, 80);
});

test('Navy Federal: the Credit Debit Indicator decides the direction', () => {
  const { guess, result } = importWithGuess(NAVY_FEDERAL);
  assert.equal(guess.preset, 'navy_federal');
  assert.equal(guess.sign, 'type_column');
  assert.deepEqual(summarize(result.rows), [
    [2, '2026-01-13', 'expense', 475, 'Blue Heron Cafe'],
    [3, '2026-01-15', 'income', 150000, 'Acme Payroll'],
  ]);
});

test('Best Buy text download: headerless, tab-separated, purchases positive', () => {
  const { guess, result } = importWithGuess(BEST_BUY_TEXT);
  assert.equal(guess.preset, 'best_buy_text');
  assert.equal(guess.sign, 'positive_is_expense');
  assert.deepEqual(
    result.rows.map((r) => [r.type, r.amountCents]),
    [
      ['income', 2500],
      ['expense', 8999],
    ],
  );
  assert.ok(result.rows[0].hints.includes('card_payment'));
});

test('transfer hints: a bank row that names a card issuer is a card payment', () => {
  assert.ok(transferHints('Withdrawal CITI CARD ONLINE').includes('card_payment'));
  assert.ok(transferHints('CAPITAL ONE MOBILE PMT').includes('card_payment'));
  assert.ok(transferHints('ELECTRONIC PAYMENT-THANK YOU').includes('card_payment'));
  assert.ok(transferHints('Buyer Credit Payment Withdrawal - Transfer To BML').includes('card_payment'));
  assert.deepEqual(transferHints('Withdrawal Debit Card - BLUE HERON CAFE'), []);
});

test('every preset has a fixture above', () => {
  const fixtures = [
    CHASE_CARD, CHASE_CHECKING, AMEX, CAPITAL_ONE_CARD, CAPITAL_ONE_360, APPLE_CARD,
    DISCOVER, CITI, BOFA_CHECKING, BOFA_CARD, WELLS_FARGO, PAYPAL, AZFCU, NAVY_FEDERAL, BEST_BUY_TEXT,
  ];
  const detected = fixtures.map((text) => importWithGuess(text).guess.preset).sort();
  assert.deepEqual(detected, BANK_PRESETS.map((p) => p.id).sort());
});

// ── detectMapping: files no preset recognizes ─────────────────────────────

test("generic: the app's own template maps by header name and trusts its type column", () => {
  const { guess, result } = importWithGuess(
    [
      'date,amount,type,description,vendor,category',
      '2026-01-15,-45.99,expense,Monthly supplements,Fernwood Supply,Supplements',
      '2026-01-20,3500.00,income,Freelance project,Client ABC,',
    ].join('\n'),
  );
  assert.equal(guess.preset, 'generic');
  assert.equal(guess.confidence, 'medium');
  assert.equal(guess.sign, 'type_column');
  assert.deepEqual(guess.mapping, {
    date: 'date',
    amount: 'amount',
    description: 'description',
    merchant: 'vendor',
    type: 'type',
    category: 'category',
  });
  assert.deepEqual(summarize(result.rows), [
    [2, '2026-01-15', 'expense', 4599, 'Fernwood Supply'],
    [3, '2026-01-20', 'income', 350000, 'Client ABC'],
  ]);
});

test('generic: aliases cover the common header names, one column per role', () => {
  const headers = ['posting_date', 'payee', 'debit', 'credit', 'reference', 'status'];
  const guess = detectMapping(headers, []);
  assert.equal(guess.preset, 'generic');
  assert.equal(guess.sign, 'split_columns');
  assert.equal(guess.confidence, 'medium');
  // A lone posting date is the date, not also the post date.
  assert.deepEqual(guess.mapping, {
    date: 'posting_date',
    description: 'payee',
    debit: 'debit',
    credit: 'credit',
    bankId: 'reference',
    status: 'status',
  });

  const second = detectMapping(['trans._date', 'posted_date', 'memo', 'gross', 'transaction_id'], []);
  assert.deepEqual(second.mapping, {
    date: 'trans._date',
    postDate: 'posted_date',
    description: 'memo',
    amount: 'gross',
    bankId: 'transaction_id',
  });
});

test('generic: the commoner sign is taken to be spending', () => {
  const headers = ['date', 'description', 'amount'];
  const mostlyNegative = rawRows(headers, [
    ['01/13/2026', 'BLUE HERON CAFE', '-4.75'],
    ['01/14/2026', 'HILLTOP HARDWARE', '-18.25'],
    ['01/15/2026', 'ACME PAYROLL', '1500.00'],
  ]);
  assert.equal(detectMapping(headers, mostlyNegative).sign, 'negative_is_expense');

  // Looks like the three-column Amex export: charges positive, one payment negative.
  const mostlyPositive = rawRows(headers, [
    ['01/13/2026', 'BLUE HERON CAFE', '4.75'],
    ['01/14/2026', 'HILLTOP HARDWARE', '18.25'],
    ['01/15/2026', 'ONLINE PAYMENT - THANK YOU', '-100.00'],
  ]);
  const guess = detectMapping(headers, mostlyPositive);
  assert.equal(guess.preset, 'generic');
  assert.equal(guess.sign, 'positive_is_expense');
});

test('generic: a type column is only trusted when every value names a direction', () => {
  const headers = ['date', 'description', 'type', 'amount'];
  const rows = rawRows(headers, [
    ['01/13/2026', 'BLUE HERON CAFE', 'Sale', '-4.75'],
    ['01/15/2026', 'PAYMENT RECEIVED', 'Payment', '100.00'],
  ]);
  assert.equal(detectMapping(headers, rows).sign, 'negative_is_expense');
});

test('generic: unknown headers leave the mapping incomplete with low confidence', () => {
  const guess = detectMapping(['when', 'what', 'how_much'], []);
  assert.deepEqual(guess.mapping, {});
  assert.equal(guess.confidence, 'low');
  assert.equal(guess.preset, 'generic');
});

test('generic: a headerless file is mapped from what its columns hold', () => {
  const { parsed, guess, result } = importWithGuess(
    ['1001,2026-01-13,BLUE HERON CAFE,X,-4.75', '1002,2026-01-14,HILLTOP HARDWARE,X,-18.25'].join('\n'),
  );
  assert.equal(parsed.hasHeader, false);
  assert.equal(guess.preset, 'generic');
  assert.equal(guess.confidence, 'low');
  // col_1 (check numbers) is all numbers too, but col_5 is written like money.
  assert.deepEqual(guess.mapping, { date: 'col_2', description: 'col_3', amount: 'col_5' });
  assert.deepEqual(summarize(result.rows), [
    [1, '2026-01-13', 'expense', 475, 'Blue Heron Cafe'],
    [2, '2026-01-14', 'expense', 1825, 'Hilltop Hardware'],
  ]);
});

test('detectMapping: reports when the date order cannot be told from the file', () => {
  const headers = ['date', 'description', 'amount'];
  const ambiguous = detectMapping(headers, rawRows(headers, [['01/05/2026', 'BLUE HERON CAFE', '-4.75']]));
  assert.equal(ambiguous.dateOrder, 'MDY');
  assert.equal(ambiguous.dateOrderAmbiguous, true);

  const dayFirst = detectMapping(headers, rawRows(headers, [['25/01/2026', 'BLUE HERON CAFE', '-4.75']]));
  assert.equal(dayFirst.dateOrder, 'DMY');
  assert.equal(dayFirst.dateOrderAmbiguous, false);
});

test('a preset is only a default: the caller can override the sign, mapping and date order', () => {
  const parsed = parseStatementCsv(CHASE_CARD);
  const guess = detectMapping(parsed.headers, parsed.rows);

  const flipped = applyMapping(parsed.rows, guess.mapping, 'positive_is_expense', guess.dateOrder);
  assert.deepEqual(flipped.rows.map((r) => r.type), ['income', 'expense']);

  const byPostDate = applyMapping(parsed.rows, { ...guess.mapping, date: 'post_date' }, guess.sign, guess.dateOrder);
  assert.deepEqual(byPostDate.rows.map((r) => r.date), ['2026-01-14', '2026-01-16']);

  const dayFirst = applyMapping(
    rawRows(['date', 'description', 'amount'], [['05/01/2026', 'BLUE HERON CAFE', '-4.75']]),
    { date: 'date', description: 'description', amount: 'amount' },
    'negative_is_expense',
    'DMY',
  );
  assert.equal(dayFirst.rows[0].date, '2026-01-05');
});

// ── applyMapping ──────────────────────────────────────────────────────────

test('applyMapping: negative_is_expense and positive_is_expense read the same amounts opposite ways', () => {
  const rows = rawRows(SIMPLE_HEADERS, [
    ['01/13/2026', 'BLUE HERON CAFE', '-4.75'],
    ['01/14/2026', 'ACME PAYROLL', '$1,500.00'],
    ['01/15/2026', 'HILLTOP HARDWARE', '(18.25)'],
  ]);
  const negative = applyMapping(rows, SIMPLE_MAPPING, 'negative_is_expense', 'MDY');
  assert.deepEqual(negative.rows.map((r) => [r.type, r.amountCents]), [
    ['expense', 475],
    ['income', 150000],
    ['expense', 1825],
  ]);
  const positive = applyMapping(rows, SIMPLE_MAPPING, 'positive_is_expense', 'MDY');
  assert.deepEqual(positive.rows.map((r) => [r.type, r.amountCents]), [
    ['income', 475],
    ['expense', 150000],
    ['income', 1825],
  ]);
});

test('applyMapping: CR and DR suffixes set the direction under either sign convention', () => {
  const rows = rawRows(SIMPLE_HEADERS, [
    ['01/13/2026', 'REFUND FROM HILLTOP', '18.25 CR'],
    ['01/14/2026', 'BLUE HERON CAFE', '4.75 DR'],
  ]);
  for (const sign of ['negative_is_expense', 'positive_is_expense'] as const) {
    const result = applyMapping(rows, SIMPLE_MAPPING, sign, 'MDY');
    assert.deepEqual(result.rows.map((r) => [r.type, r.amountCents]), [
      ['income', 1825],
      ['expense', 475],
    ], sign);
  }
});

test('applyMapping: split columns', () => {
  const headers = ['date', 'description', 'debit', 'credit'];
  const mapping = { date: 'date', description: 'description', debit: 'debit', credit: 'credit' };
  const rows = rawRows(headers, [
    ['01/13/2026', 'BLUE HERON CAFE', '4.75', ''],
    ['01/14/2026', 'ACME PAYROLL', '', '1,500.00'],
    ['01/15/2026', 'HILLTOP HARDWARE', '18.25', '0.00'],
    ['01/16/2026', 'BOTH FILLED', '5.00', '5.00'],
    ['01/17/2026', 'NEITHER FILLED', '', ''],
    ['01/18/2026', 'ZEROES', '0.00', '0.00'],
    ['01/19/2026', 'NOT A NUMBER', 'n/a', ''],
  ]);
  const result = applyMapping(rows, mapping, 'split_columns', 'MDY');
  assert.deepEqual(result.rows.map((r) => [r.rowNumber, r.type, r.amountCents]), [
    [2, 'expense', 475],
    [3, 'income', 150000],
    [4, 'expense', 1825],
  ]);
  assert.deepEqual(result.rejected, [
    { row: 5, reason: 'Both the debit and the credit column have an amount' },
    { row: 6, reason: 'No amount' },
    { row: 7, reason: 'Amount is zero' },
    { row: 8, reason: 'Debit "n/a" is not a number' },
  ]);
});

test('applyMapping: a type column decides the direction and the sign is ignored', () => {
  const headers = ['date', 'description', 'amount', 'type'];
  const mapping = { date: 'date', description: 'description', amount: 'amount', type: 'type' };
  const rows = rawRows(headers, [
    ['01/13/2026', 'BLUE HERON CAFE', '4.75', 'DEBIT'],
    ['01/14/2026', 'ACME PAYROLL', '1500.00', 'credit'],
    ['01/15/2026', 'HILLTOP HARDWARE', '-18.25', 'Purchase'],
    ['01/16/2026', 'MYSTERY', '5.00', 'Adjustment'],
    ['01/17/2026', 'NO TYPE', '5.00', ''],
  ]);
  const result = applyMapping(rows, mapping, 'type_column', 'MDY');
  assert.deepEqual(result.rows.map((r) => [r.type, r.amountCents]), [
    ['expense', 475],
    ['income', 150000],
    ['expense', 1825],
  ]);
  assert.deepEqual(result.rejected, [
    { row: 5, reason: 'Type "Adjustment" doesn\'t say whether money came in or went out' },
    { row: 6, reason: 'No type, so it is unclear whether money came in or went out' },
  ]);
});

test('applyMapping: rejected rows carry their spreadsheet row number and every reason', () => {
  const rows = rawRows(SIMPLE_HEADERS, [
    ['02/30/2026', 'BLUE HERON CAFE', '-4.75'],
    ['01/14/2026', 'ZERO', '0.00'],
    ['01/15/2026', 'WORDS', 'four dollars'],
    ['01/16/2026', '', '-4.75'],
    ['', 'NO DATE', '-4.75'],
    ['25/01/2026', 'DAY FIRST', '-4.75'],
    ['soon', '', ''],
    ['01/20/2026', 'GOOD ROW', '-4.75'],
  ]);
  const result = applyMapping(rows, SIMPLE_MAPPING, 'negative_is_expense', 'MDY');
  assert.deepEqual(result.rejected, [
    { row: 2, reason: 'Date "02/30/2026" is not a real date' },
    { row: 3, reason: 'Amount is zero' },
    { row: 4, reason: 'Amount "four dollars" is not a number' },
    { row: 5, reason: 'No description' },
    { row: 6, reason: 'No date' },
    { row: 7, reason: 'Date "25/01/2026" doesn\'t fit month/day/year order' },
    { row: 8, reason: 'Date "soon" is not a real date; No description; No amount' },
  ]);
  assert.deepEqual(result.rows.map((r) => r.rowNumber), [9]);
  assert.deepEqual(result.rows[0].issues, []);
});

test('applyMapping: the vendor is the merchant column, else the cleaned-up description', () => {
  const headers = ['date', 'description', 'merchant', 'amount'];
  const mapping = { date: 'date', description: 'description', merchant: 'merchant', amount: 'amount' };
  const rows = rawRows(headers, [
    ['01/13/2026', 'TST* RIVERBEND TACOS 0876', 'Riverbend Tacos', '-12.40'],
    ['01/14/2026', 'TST* RIVERBEND TACOS 0876', '', '-12.40'],
    ['01/15/2026', '12345', '', '-1.00'],
  ]);
  const result = applyMapping(rows, mapping, 'negative_is_expense', 'MDY');
  // A description that is only a number has nothing left after cleanup, so it is used as is.
  assert.deepEqual(result.rows.map((r) => r.vendor), ['Riverbend Tacos', 'Riverbend Tacos', '12345']);
  assert.equal(result.rows[1].description, 'TST* RIVERBEND TACOS 0876');
});

test('applyMapping: the post date and memo fill in for a blank date and description', () => {
  const headers = ['date', 'post_date', 'description', 'memo', 'amount'];
  const mapping = { date: 'date', postDate: 'post_date', description: 'description', memo: 'memo', amount: 'amount' };
  const rows = rawRows(headers, [
    ['', '01/14/2026', '', 'CHECK 1001', '-40.00'],
    ['01/13/2026', '01/14/2026', 'BLUE HERON CAFE', 'latte', '-4.75'],
  ]);
  const result = applyMapping(rows, mapping, 'negative_is_expense', 'MDY');
  assert.deepEqual(result.rows.map((r) => [r.date, r.description]), [
    ['2026-01-14', 'CHECK 1001'],
    ['2026-01-13', 'BLUE HERON CAFE'],
  ]);
});

test('applyMapping: pending is only set when a status column is mapped', () => {
  const headers = ['date', 'description', 'amount', 'status'];
  const rows = rawRows(headers, [
    ['01/13/2026', 'BLUE HERON CAFE', '-4.75', 'PENDING'],
    ['01/14/2026', 'HILLTOP HARDWARE', '-18.25', 'Posted'],
    ['01/15/2026', 'OAKLINE PHARMACY', '-9.99', ''],
  ]);
  const withStatus = applyMapping(rows, { ...SIMPLE_MAPPING, status: 'status' }, 'negative_is_expense', 'MDY');
  assert.deepEqual(withStatus.rows.map((r) => r.pending), [true, false, false]);
  // Pending rows are returned, not rejected: the caller chooses whether to skip them.
  assert.equal(withStatus.rejected.length, 0);

  const withoutStatus = applyMapping(rows, SIMPLE_MAPPING, 'negative_is_expense', 'MDY');
  assert.equal(withoutStatus.rows.every((r) => !('pending' in r)), true);
});

test('applyMapping: stores transfer hints on the row', () => {
  const rows = rawRows(SIMPLE_HEADERS, [
    ['01/13/2026', 'ONLINE TRANSFER TO SAVINGS', '-100.00'],
    ['01/14/2026', 'EXAMPLE HOME MORTGAGE', '-900.00'],
    ['01/15/2026', 'BLUE HERON CAFE', '-4.75'],
  ]);
  const result = applyMapping(rows, SIMPLE_MAPPING, 'negative_is_expense', 'MDY');
  assert.deepEqual(result.rows.map((r) => r.hints), [['transfer'], ['loan_payment'], []]);
});

test('applyMapping: a mapping that lacks what the sign convention needs parses nothing', () => {
  const rows = rawRows(SIMPLE_HEADERS, [['01/13/2026', 'BLUE HERON CAFE', '-4.75']]);
  assert.deepEqual(applyMapping(rows, {}, 'negative_is_expense', 'MDY'), {
    rows: [],
    rejected: [],
    skipped: [],
    missingColumns: ['date', 'description', 'amount'],
  });
  assert.deepEqual(
    applyMapping(rows, SIMPLE_MAPPING, 'split_columns', 'MDY').missingColumns,
    ['debit', 'credit'],
  );
  assert.deepEqual(applyMapping(rows, SIMPLE_MAPPING, 'type_column', 'MDY').missingColumns, ['type']);
});

test('applyMapping: a mapping that names a column the file lacks parses nothing', () => {
  const rows = rawRows(SIMPLE_HEADERS, [['01/13/2026', 'BLUE HERON CAFE', '-4.75']]);
  // A mapping saved for another bank, and one that names an inherited object key.
  const stale = { date: 'transaction_date', description: 'description', amount: 'amount', merchant: 'merchant' };
  assert.deepEqual(applyMapping(rows, stale, 'negative_is_expense', 'MDY').missingColumns, ['date', 'merchant']);
  const hostile = { date: 'constructor', description: '__proto__', amount: 'amount' };
  assert.deepEqual(applyMapping(rows, hostile, 'negative_is_expense', 'MDY').missingColumns, ['date', 'description']);
});

test('applyMapping: no rows in, nothing out', () => {
  assert.deepEqual(applyMapping([], SIMPLE_MAPPING, 'negative_is_expense', 'MDY'), {
    rows: [],
    rejected: [],
    skipped: [],
    missingColumns: [],
  });
});

// ── assignExternalIds ─────────────────────────────────────────────────────

const TWO_COFFEES = [
  'Date,Description,Amount',
  '01/13/2026,SQ *BLUE HERON CAFE #12,-4.75',
  '01/13/2026,HILLTOP HARDWARE,-18.25',
  '01/13/2026,SQ *BLUE HERON CAFE #12,-4.75',
  '01/14/2026,SQ *BLUE HERON CAFE #12,-4.75',
  '01/13/2026,BLUE HERON CAFE REFUND,4.75',
].join('\n');

function idsFor(text: string): string[] {
  const parsed = parseStatementCsv(text);
  const result = applyMapping(parsed.rows, SIMPLE_MAPPING, 'negative_is_expense', 'MDY');
  return assignExternalIds(result.rows).map((r) => r.externalId);
}

test('assignExternalIds: identical rows in one file get rising ordinals', () => {
  assert.deepEqual(idsFor(TWO_COFFEES), [
    'hash:2026-01-13|475|expense|blueheroncafe|1',
    'hash:2026-01-13|1825|expense|hilltophardware|1',
    'hash:2026-01-13|475|expense|blueheroncafe|2',
    'hash:2026-01-14|475|expense|blueheroncafe|1',
    'hash:2026-01-13|475|income|blueheroncaferefund|1',
  ]);
});

test('assignExternalIds: importing the same statement again gives the same ids', () => {
  assert.deepEqual(idsFor(TWO_COFFEES), idsFor(TWO_COFFEES));
  // A later, longer export of the same account still gives the old rows their old ids.
  const longer = `${TWO_COFFEES}\n01/15/2026,OAKLINE PHARMACY,-9.99`;
  assert.deepEqual(idsFor(longer).slice(0, 5), idsFor(TWO_COFFEES));
});

test('assignExternalIds: the key ignores how the bank dresses up the description', () => {
  const a = idsFor('Date,Description,Amount\n01/13/2026,SQ *BLUE HERON CAFE #12,-4.75');
  const b = idsFor('Date,Description,Amount\n1/13/26,Blue Heron Cafe,"-$4.75"');
  assert.deepEqual(a, b);
});

test('assignExternalIds: a bank ID wins, and the input rows are left alone', () => {
  const rows = applyMapping(
    rawRows(['date', 'description', 'amount', 'id'], [
      ['01/13/2026', 'BLUE HERON CAFE', '-4.75', 'TXN-001'],
      ['01/13/2026', 'BLUE HERON CAFE', '-4.75', ''],
    ]),
    { ...SIMPLE_MAPPING, bankId: 'id' },
    'negative_is_expense',
    'MDY',
  ).rows;
  const identified = assignExternalIds(rows);
  assert.deepEqual(identified.map((r) => r.externalId), [
    'bank:TXN-001',
    'hash:2026-01-13|475|expense|blueheroncafe|1',
  ]);
  assert.equal('externalId' in rows[0], false);
  assert.equal(identified[0].rowNumber, 2);
});

// A hand-kept spreadsheet with both Payee and Description columns, where some
// rows leave Description empty (synthetic rows, shaped like a categorized export).
test('detectMapping + applyMapping: Payee becomes the vendor and fills an empty description', () => {
  const file = [
    'Date,Account,Payee,Amount,Category,Description,TxnID',
    '2021-05-16,Card,"Example Eats, Inc.",-14.93,Food Takeout,,ABC123',
    '2021-05-17,Card,Sample Rides,-16.99,Travel,,DEF456',
    '2021-05-19,Card,Example Software,-99.00,Tools,Annual plan,GHI789',
  ].join('\n');
  const { guess, result } = importWithGuess(file);
  assert.equal(guess.mapping.description, 'description');
  assert.equal(guess.mapping.merchant, 'payee');
  assert.equal(guess.mapping.bankId, 'txnid');
  assert.deepEqual(result.rejected, []);
  assert.deepEqual(result.rows.map((r) => [r.description, r.vendor]), [
    ['Example Eats, Inc.', 'Example Eats, Inc.'],
    ['Sample Rides', 'Sample Rides'],
    ['Annual plan', 'Example Software'],
  ]);
});

test('detectMapping: a file with Payee but no Description still uses Payee as the description', () => {
  const file = ['Date,Payee,Amount', '2021-05-16,Example Eats,-14.93'].join('\n');
  const { guess, result } = importWithGuess(file);
  assert.equal(guess.mapping.description, 'payee');
  assert.equal(guess.mapping.merchant, undefined);
  assert.equal(result.rows[0].description, 'Example Eats');
});
