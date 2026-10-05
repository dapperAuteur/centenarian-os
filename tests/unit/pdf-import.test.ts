// tests/unit/pdf-import.test.ts
// Unit tests for the PDF statement import in lib/finance/pdf-import/.
// Run: npm run test:unit
//
// Every fixture here is SYNTHETIC: the same positioned-text shape a real
// Best Buy / Citibank statement produces (section names, column positions,
// page furniture), with made-up names, numbers, merchants and references.
// No real statement content is in this file. Fixtures are the extracted
// lines the parsers consume, not PDFs, so pdfjs is never loaded.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { undoBatch } from '../../lib/finance/csv-import/undo.ts';
import { ImportError } from '../../lib/finance/csv-import/errors.ts';
import { extractPdfLines, looksLikePdf } from '../../lib/finance/pdf-import/extract.ts';
import {
  detectCitiBestBuy,
  parseCitiBestBuy,
  readAprs,
  readPromotions,
} from '../../lib/finance/pdf-import/issuers/citi-best-buy.ts';
import { genericDate, genericKind, parseGeneric } from '../../lib/finance/pdf-import/issuers/generic.ts';
import { detectIssuer, parseStatementLines } from '../../lib/finance/pdf-import/issuers/index.ts';
import {
  groupIntoLines,
  parseLongDate,
  parseMoneyCents,
  parseSlashDate,
  placeMonthDay,
} from '../../lib/finance/pdf-import/lines.ts';
import { expectedNewBalance, reconcileStatement } from '../../lib/finance/pdf-import/reconcile.ts';
import { buildRows, typeForKind } from '../../lib/finance/pdf-import/rows.ts';
import { decodePdfBase64, isPdfBody, parsePdfRequest, toStatementRow } from '../../lib/finance/pdf-import/service.ts';
import {
  STATEMENTS_MIGRATION_MESSAGE,
  deleteBatchStatements,
  isStatementsTableMissing,
} from '../../lib/finance/pdf-import/statements.ts';
import type { PdfLine, TextItem } from '../../lib/finance/pdf-import/types.ts';
import { FakeDb } from './fake-supabase.ts';

const asDb = (fake: FakeDb) => fake as unknown as SupabaseClient;
const USER = '11111111-1111-4111-8111-111111111111';
const ACCOUNT = '22222222-2222-4222-8222-222222222222';

// ── Fixture builders ──────────────────────────────────────────────────────

/** One text item; width is estimated from the text, as pdfjs would measure it. */
const t = (x: number, str: string): TextItem => ({ x, y: 0, w: str.length * 4.4, str });

let nextY = 800;
/** A line on a page from [x, text] pairs. */
function line(page: number, ...items: [number, string][]): PdfLine {
  nextY -= 12;
  const built = items.map(([x, str]) => ({ ...t(x, str), y: nextY }));
  return { page, y: nextY, items: built, text: built.map((item) => item.str).join(' ') };
}
const textLine = (page: number, text: string): PdfLine => line(page, [40, text]);

/**
 * A made-up Best Buy / Citibank statement in the real layout:
 *   previous 1,000.00 - payment 100.00 - credit 25.00 + purchases 100.00 + fee 30.00 + interest 20.00 = 1,025.00
 * Variants covered: transactions starting on page 1 and continuing on page 3,
 * a CARD ENDING block with its TOTAL CARD subtotal, the "." payments block, a
 * credit (fee reversal), FEES and INTEREST CHARGED blocks, the activity
 * detail with a promotion, the APR table with an insert code printed over a
 * row, a control number in the left margin, and a later card agreement whose
 * own TRANSACTIONS heading must be ignored.
 */
function syntheticCiti(options: { newBalance?: string; withPromo?: boolean } = {}): PdfLine[] {
  const newBalance = options.newBalance ?? '$1,025.00';
  const lines: PdfLine[] = [
    line(1, [412, 'Account Statement']),
    line(1, [249, 'bestbuy.accountonline.com'], [412, 'BEST BUY CREDIT SERVICES']),
    line(1, [431, 'Account number ending in 4321']),
    line(1, [47, 'Summary of Account Activity'], [299, 'Payment Information']),
    line(1, [47, 'Previous Balance'], [239, '$1,000.00']),
    line(1, [299, 'New Balance'], [524, newBalance]),
    line(1, [47, 'Payments'], [243, '-$100.00']),
    line(1, [299, 'Minimum Payment Due'], [537, '$35.00']),
    line(1, [47, 'Other Credits'], [248, '-$25.00']),
    line(1, [299, 'Payment Due Date'], [491, 'February 21, 2026']),
    line(1, [47, 'Purchases/Other Debits'], [246, '+$100.00']),
    line(1, [47, 'Cash Advances'], [251, '+$0.00'], [299, 'Late Payment Warning:']),
    line(1, [47, 'Fees Charged'], [246, '+$30.00']),
    line(1, [47, 'Interest Charged'], [246, '+$20.00'], [299, 'Minimum Payment Warning:']),
    line(1, [47, 'New Balance'], [239, newBalance]),
    line(1, [47, 'Credit Limit'], [239, '$2,000.00']),
    line(1, [47, 'Statement Closing Date'], [234, '01/27/2026']),
    line(1, [16, '400001'], [47, 'Next Statement Closing Date'], [234, '02/24/2026']),
    line(1, [47, 'Days in Billing Cycle'], [269, '31']),
    line(1, [43, 'TRANSACTIONS']),
    line(1, [43, 'Trans Date'], [87, 'Description'], [407, 'Reference #'], [527, 'Amount']),
    line(1, [43, 'CARD ENDING 4321 PAT SAMPLE']),
    line(1, [43, '12/30'], [87, 'SAMPLE ELECTRONICS STORE 12'], [407, 'REF0000000000AAA1'], [528, '$'], [557, '40.00']),
    line(1, [566, 'HM 18']),
    line(1, [43, 'PLEASE SEE IMPORTANT INFORMATION ON PAGE 2.'], [286, 'Page 1 of 4'], [450, 'This Account is Issued by Citibank, N.A.']),
    line(1, [398, 'Payment Due Date'], [530, 'February 21, 2026']),
    // Page 2: legal text, nothing to read.
    line(2, [28, 'Information About Your Account.'], [331, 'For AutoPay, you also authorize us...']),
    line(2, [28, 'interest on cash advances and balance transfers on the transaction date.']),
    // Page 3: the rest of the transactions.
    line(3, [43, 'Account number ending in 4321']),
    line(3, [43, 'TRANSACTIONS'], [115, '(cont.)']),
    line(3, [43, 'Trans Date'], [87, 'Description'], [407, 'Reference #'], [527, 'Amount']),
    line(3, [43, '01/03'], [87, 'TST* MADE UP CAFE ANYTOWN ZZ'], [407, 'REF0000000000AAA2'], [528, '$'], [557, '60.00']),
    line(3, [43, 'TOTAL CARD'], [91, 'ENDING 4321'], [528, '$'], [553, '100.00']),
    line(3, [43, '.']),
    line(3, [43, '01/10'], [87, 'ONLINE PAYMENT'], [169, 'SAMPLETOWN'], [216, 'ZZ'], [407, 'PAY0000000000AAA3'], [528, '$'], [553, '100.00-']),
    line(3, [43, '01/12'], [87, 'LATE FEE REVERSAL'], [407, 'F0000000000AAA4'], [528, '$'], [557, '25.00-']),
    line(3, [43, 'FEES']),
    line(3, [43, '01/21'], [87, 'LATE FEE'], [528, '$'], [557, '30.00']),
    line(3, [86, 'TOTAL FEES FOR THIS PERIOD'], [528, '$'], [557, '30.00']),
    line(3, [43, 'INTEREST CHARGED']),
    line(3, [43, '01/27'], [87, 'INTEREST CHARGE ON PURCHASES'], [528, '$'], [557, '20.00']),
    line(3, [87, 'TOTAL INTEREST FOR THIS PERIOD'], [528, '$'], [557, '20.00']),
    line(3, [150, '2026 Totals Year-to-Date']),
    line(3, [97, 'Total Fees Charged in 2026'], [301, '$30.00']),
    line(3, [43, 'ACTIVITY AND PROMOTIONS DETAIL']),
    line(3, [88, 'Original'], [273, 'Purchases,']),
    line(3, [83, 'Promotion'], [130, 'Promo'], [224, 'Payments'], [275, 'Cash Adv,'], [439, 'Promotion'], [497, 'Deferred'], [540, 'Promotion']),
    line(3, [92, 'Trans'], [131, 'Trans'], [175, 'Previous'], [228, '& Other'], [281, 'Fees &'], [335, 'Interest'], [398, 'New'], [441, 'Minimum'], [500, 'Interest'], [541, 'Expiration']),
    line(3, [16, '400002'], [88, 'Amount'], [133, 'Date'], [177, 'Balance'], [229, 'Credits'], [272, 'Other Debits'], [332, 'Charged'], [392, 'Balance'], [434, 'Payment Due'], [498, 'Charges'], [552, 'Date']),
    line(3, [43, 'PURCHASES']),
    line(3, [58, 'REGULAR']),
    line(3, [108, '-'], [141, '-'], [177, '$750.00'], [233, '$75.00-'], [293, '$130.00'], [349, '$20.00'], [395, '$825.00'], [468, '-'], [520, '-'], [559, '-']),
  ];
  if (options.withPromo !== false) {
    lines.push(
      line(3, [58, 'DEFERRED INTEREST 12 MONTHS']),
      line(3, [95, '$300.00'], [135, '01/15/26'], [182, '$250.00'], [236, '$50.00-'], [306, '-'], [359, '-'], [400, '$200.00'], [463, '$25.00'], [505, '$45.00'], [545, '01/15/27']),
    );
  }
  lines.push(
    line(3, [43, 'CASH ADVANCES']),
    line(3, [58, 'REGULAR']),
    line(3, [108, '-'], [141, '-'], [196, '-'], [246, '-'], [306, '-'], [359, '-'], [414, '-'], [468, '-'], [520, '-'], [559, '-']),
    line(3, [43, 'TOTAL'], [177, '$1,000.00'], [233, '$125.00-'], [297, '$130.00'], [349, '$20.00'], [395, newBalance], [463, '$25.00'], [514, '$45.00']),
    line(3, [48, 'INTEREST CHARGE CALCULATION'], [330, 'Your'], [347, 'Annual Percentage Rate (APR)']),
    line(3, [45, 'Type of Balance'], [235, 'Annual Percentage Rate (APR)'], [366, 'Balance Subject to Interest Rate'], [512, 'Interest Charge']),
    line(3, [45, 'PURCHASES']),
    line(3, [58, 'REGULAR'], [268, '27.49% (M)(V)'], [417, '$900.00'], [541, '$20.00']),
    line(3, [45, 'CASH ADVANCES']),
    line(3, [58, 'REGULAR'], [136, 'insert_code_sample_0000 vf'], [268, '29.99% (M)(V)'], [432, '$0.00'], [545, '$0.00']),
    line(3, [47, '(V)'], [58, '= Variable Rate']),
    line(3, [293, 'Page 3 of 4']),
    // A card agreement insert: its headings must not be read as statement sections.
    line(4, [250, 'CARD AGREEMENT']),
    line(4, [278, 'TRANSACTIONS']),
    line(4, [43, '02/01'], [87, 'EXAMPLE LINE IN AN AGREEMENT'], [528, '$'], [557, '99.00']),
    line(4, [94, 'Notices. We send any notices to your billing address.']),
  );
  return lines;
}

// ── Lines, money and dates ────────────────────────────────────────────────

test('groupIntoLines: items within 2pt share a line, lines run top to bottom, items left to right', () => {
  const lines = groupIntoLines([
    {
      page: 1,
      items: [
        { x: 200, y: 700.5, w: 20, str: 'right' },
        { x: 40, y: 700, w: 20, str: 'left' },
        { x: 40, y: 650, w: 20, str: 'lower' },
        { x: 100, y: 701.8, w: 20, str: 'middle' },
        { x: 60, y: 600, w: 0, str: '   ' },
      ],
    },
    { page: 2, items: [{ x: 10, y: 790, w: 5, str: 'next  page' }] },
  ]);
  assert.deepEqual(
    lines.map((l) => [l.page, l.text]),
    [
      [1, 'left middle right'],
      [1, 'lower'],
      [2, 'next page'],
    ],
  );
});

test('parseMoneyCents reads every sign style statements use', () => {
  assert.equal(parseMoneyCents('$1,234.56'), 123456);
  assert.equal(parseMoneyCents('-$40.00'), -4000);
  assert.equal(parseMoneyCents('40.00-'), -4000);
  assert.equal(parseMoneyCents('$200.00-'), -20000);
  assert.equal(parseMoneyCents('($12.50)'), -1250);
  assert.equal(parseMoneyCents('12.50 CR'), -1250);
  assert.equal(parseMoneyCents('+$0.00'), 0);
  assert.equal(parseMoneyCents('$'), null);
  assert.equal(parseMoneyCents('-'), null);
  assert.equal(parseMoneyCents('27.49%'), null);
  assert.equal(parseMoneyCents('1,23.45'), null);
});

test('dates: slash, long form, and month/day placed in the statement period', () => {
  assert.equal(parseSlashDate('01/27/2026'), '2026-01-27');
  assert.equal(parseSlashDate('01/15/27'), '2027-01-15');
  assert.equal(parseSlashDate('02/30/2026'), null);
  assert.equal(parseLongDate('February 21, 2026'), '2026-02-21');
  assert.equal(parseLongDate('Sept 3, 2026'), '2026-09-03');
  // A December row on a January statement belongs to the year before.
  assert.equal(placeMonthDay('12/30', '2026-01-27'), '2025-12-30');
  assert.equal(placeMonthDay('01/03', '2026-01-27'), '2026-01-03');
  assert.equal(placeMonthDay('01/03', null), null);
});

// ── Best Buy / Citibank ───────────────────────────────────────────────────

test('detect: the Best Buy / Citibank layout is recognized; anything else falls to generic', () => {
  const lines = syntheticCiti();
  assert.equal(detectCitiBestBuy(lines), true);
  assert.equal(detectIssuer(lines).id, 'citi-best-buy');
  const other = [textLine(1, 'Some Other Bank'), textLine(1, 'Summary of Account Activity')];
  assert.equal(detectCitiBestBuy(other), false);
  assert.equal(detectIssuer(other).id, 'generic');
});

test('citi-best-buy: summary, period, last four and due date', () => {
  const parsed = parseCitiBestBuy(syntheticCiti());
  assert.equal(parsed.issuer, 'citi-best-buy');
  assert.equal(parsed.confidence, 'high');
  assert.equal(parsed.accountLastFour, '4321');
  assert.deepEqual(parsed.period, { start: '2025-12-28', end: '2026-01-27' });
  const f = parsed.statement;
  assert.equal(f.previousBalance, 100000);
  assert.equal(f.payments, 10000);
  assert.equal(f.credits, 2500);
  assert.equal(f.purchases, 10000);
  assert.equal(f.cashAdvances, 0);
  assert.equal(f.fees, 3000);
  assert.equal(f.interestCharged, 2000);
  assert.equal(f.newBalance, 102500);
  assert.equal(f.minimumPayment, 3500);
  assert.equal(f.creditLimit, 200000);
  assert.equal(f.dueDate, '2026-02-21');
  assert.deepEqual(parsed.warnings, []);
});

test('citi-best-buy: every transaction block across pages, with card sign conventions and references', () => {
  const parsed = parseCitiBestBuy(syntheticCiti());
  assert.deepEqual(
    parsed.rows.map((r) => [r.rowNumber, r.date, r.amountCents, r.kind, r.type, r.bankId ?? null]),
    [
      [1, '2025-12-30', 4000, 'purchase', 'expense', 'REF0000000000AAA1'],
      [2, '2026-01-03', 6000, 'purchase', 'expense', 'REF0000000000AAA2'],
      [3, '2026-01-10', 10000, 'payment', 'income', 'PAY0000000000AAA3'],
      [4, '2026-01-12', 2500, 'credit', 'income', 'F0000000000AAA4'],
      [5, '2026-01-21', 3000, 'fee', 'expense', null],
      [6, '2026-01-27', 2000, 'interest', 'expense', null],
    ],
  );
  // The reference column is not part of the description; the payment gets a card-payment hint.
  assert.equal(parsed.rows[2].description, 'ONLINE PAYMENT SAMPLETOWN ZZ');
  assert.deepEqual(parsed.rows[2].hints, ['card_payment']);
  assert.equal(parsed.rows[1].vendor, 'Made Up Cafe Anytown Zz');
  // Nothing from the card agreement on page 4.
  assert.ok(parsed.rows.every((r) => !r.description.includes('AGREEMENT')));
});

test('citi-best-buy: APRs by balance type, ignoring an insert code printed over a row', () => {
  assert.deepEqual(readAprs(syntheticCiti()), [
    { balanceType: 'Purchases - Regular', apr: 27.49, balanceCents: 90000, interestCents: 2000 },
    { balanceType: 'Cash advances - Regular', apr: 29.99, balanceCents: 0, interestCents: 0 },
  ]);
});

test('citi-best-buy: a promotional balance with expiry and deferred interest; REGULAR and TOTAL rows are not promotions', () => {
  assert.deepEqual(readPromotions(syntheticCiti()), [
    {
      description: 'Deferred Interest 12 Months (purchases)',
      balance: 20000,
      expiresOn: '2027-01-15',
      deferredInterest: 4500,
      originalAmount: 30000,
      minimumPayment: 2500,
      startedOn: '2026-01-15',
    },
  ]);
  assert.deepEqual(readPromotions(syntheticCiti({ withPromo: false })), []);
});

test('citi-best-buy: a statement with only fees and interest (no transactions block content)', () => {
  const lines = syntheticCiti().filter(
    (l) => !/^(12\/30|01\/03|01\/10|01\/12)$/.test(l.items[0]?.str ?? '') && !/CARD ENDING|TOTAL CARD/.test(l.text),
  );
  const parsed = parseCitiBestBuy(lines);
  assert.deepEqual(parsed.rows.map((r) => r.kind), ['fee', 'interest']);
});

// ── Reconciliation ────────────────────────────────────────────────────────

test('reconcile: the synthetic statement adds up', () => {
  const parsed = parseCitiBestBuy(syntheticCiti());
  assert.equal(expectedNewBalance(parsed.statement), 102500);
  assert.deepEqual(reconcileStatement(parsed), { ok: true, checked: true, applicable: true, differences: [] });
});

test('reconcile: a wrong new balance and a missing row are each reported', () => {
  const parsed = parseCitiBestBuy(syntheticCiti({ newBalance: '$1,030.00' }));
  parsed.rows = parsed.rows.filter((r) => r.kind !== 'fee');
  const result = reconcileStatement(parsed);
  assert.equal(result.ok, false);
  assert.equal(result.checked, true);
  assert.deepEqual(
    result.differences.map((d) => [d.check, d.expected, d.actual, d.difference]),
    [
      ['balance', 102500, 103000, 500],
      ['fees', 3000, 0, -3000],
    ],
  );
});

test('reconcile: without a previous balance the statement is not checked, and not ok', () => {
  const parsed = parseCitiBestBuy(syntheticCiti());
  parsed.statement.previousBalance = null;
  const result = reconcileStatement(parsed);
  assert.equal(result.checked, false);
  assert.equal(result.ok, false);
});

// ── Generic fallback ──────────────────────────────────────────────────────

function syntheticGeneric(): PdfLine[] {
  return [
    textLine(1, 'Example Credit Union Card'),
    textLine(1, 'Account number: XXXX XXXX XXXX 9876'),
    textLine(1, 'Statement Period 01/01/2026 - 01/31/2026'),
    textLine(1, 'Previous Balance $500.00'),
    textLine(1, 'Payments -$100.00'),
    textLine(1, 'Purchases $4.50'),
    textLine(1, 'Fees Charged $25.00'),
    textLine(1, 'New Balance $429.50'),
    textLine(1, 'Purchases 19.99% APR'),
    textLine(2, '01/05 COFFEE SHOP 4.50'),
    textLine(2, '01/10 PAYMENT THANK YOU -100.00'),
    textLine(2, '01/20 LATE FEE 25.00'),
    textLine(2, 'TOTAL 129.50'),
  ];
}

test('generic: finds date + description + amount lines, low confidence, with a warning', () => {
  const parsed = parseStatementLines(syntheticGeneric());
  assert.equal(parsed.issuer, 'generic');
  assert.equal(parsed.confidence, 'low');
  assert.ok(parsed.warnings.length > 0);
  assert.equal(parsed.accountLastFour, '9876');
  assert.deepEqual(parsed.period, { start: '2026-01-01', end: '2026-01-31' });
  assert.deepEqual(
    parsed.rows.map((r) => [r.date, r.amountCents, r.kind, r.type]),
    [
      ['2026-01-05', 450, 'purchase', 'expense'],
      ['2026-01-10', 10000, 'payment', 'income'],
      ['2026-01-20', 2500, 'fee', 'expense'],
    ],
  );
  assert.deepEqual(parsed.statement.aprs, [{ balanceType: 'Purchases', apr: 19.99 }]);
  assert.equal(reconcileStatement(parsed).ok, true);
});

test('generic: kinds and dates', () => {
  assert.equal(genericKind(-500, 'REFUND SAMPLE STORE'), 'credit');
  assert.equal(genericKind(-500, 'PAYMENT REVERSAL'), 'credit');
  assert.equal(genericKind(900, 'FINANCE CHARGE'), 'interest');
  assert.equal(genericKind(900, 'CASH ADVANCE ATM'), 'cash_advance');
  assert.equal(genericDate('Jan 5', '2026-01-31'), '2026-01-05');
  assert.equal(genericDate('12/28/2025', null), '2025-12-28');
  assert.equal(genericDate('01/05', null), null);
});

test('generic: a PDF with no transaction lines says so', () => {
  const parsed = parseGeneric([textLine(1, 'Nothing to see here'), textLine(1, 'Another line of text')]);
  assert.equal(parsed.rows.length, 0);
  assert.ok(parsed.warnings.some((w) => /No transaction lines/.test(w)));
});

// ── Rows, requests, storage ───────────────────────────────────────────────

test('card sign conventions: purchases, cash advances, fees and interest are expenses; payments and credits income', () => {
  assert.equal(typeForKind('purchase'), 'expense');
  assert.equal(typeForKind('cash_advance'), 'expense');
  assert.equal(typeForKind('fee'), 'expense');
  assert.equal(typeForKind('interest'), 'expense');
  assert.equal(typeForKind('payment'), 'income');
  assert.equal(typeForKind('credit'), 'income');
  const [row] = buildRows([{ date: '2026-01-02', amountCents: -1234, kind: 'credit', description: '  SAMPLE   REFUND ' }]);
  assert.equal(row.amountCents, 1234);
  assert.equal(row.description, 'SAMPLE REFUND');
  assert.equal(row.bankId, undefined);
});

test('requests: PDF bodies are recognized and checked', () => {
  assert.equal(isPdfBody({ pdf_base64: 'x' }), true);
  assert.equal(isPdfBody({ csv_text: 'x' }), false);
  const pdf = Buffer.from('%PDF-1.7 synthetic').toString('base64');
  const request = parsePdfRequest({ account_id: ACCOUNT, pdf_base64: pdf, file_name: ' s.pdf ', confirm_unreconciled: true }, { requireAccount: true });
  assert.equal(request.accountId, ACCOUNT);
  assert.equal(request.fileName, 's.pdf');
  assert.equal(request.confirmUnreconciled, true);
  assert.equal(looksLikePdf(request.bytes), true);
  assert.throws(() => parsePdfRequest({ pdf_base64: pdf }, { requireAccount: true }), (e: unknown) => e instanceof ImportError && e.code === 'account_required');
  assert.throws(() => decodePdfBase64('not base64!'), (e: unknown) => e instanceof ImportError && e.code === 'not_pdf');
  assert.throws(() => decodePdfBase64(''), (e: unknown) => e instanceof ImportError && e.code === 'file_required');
});

test('extract: a file that is not a PDF is refused before pdfjs loads', async () => {
  await assert.rejects(
    extractPdfLines(new TextEncoder().encode('Date,Description,Amount\n01/01/2026,Sample,1.00')),
    (e: unknown) => e instanceof ImportError && e.code === 'not_pdf',
  );
});

test('toStatementRow: money in dollars, APRs and promotions as JSON', () => {
  const parsed = parseCitiBestBuy(syntheticCiti());
  const row = toStatementRow(parsed, reconcileStatement(parsed), { userId: USER, accountId: ACCOUNT, batchId: null });
  assert.equal(row.previous_balance, 1000);
  assert.equal(row.new_balance, 1025);
  assert.equal(row.period_end, '2026-01-27');
  assert.equal(row.due_date, '2026-02-21');
  assert.equal(row.reconciled, true);
  assert.deepEqual((row.aprs as unknown[])[0], { balance_type: 'Purchases - Regular', apr: 27.49, balance: 900, interest: 20 });
  assert.deepEqual(row.promos, [
    {
      description: 'Deferred Interest 12 Months (purchases)',
      balance: 200,
      expires_on: '2027-01-15',
      deferred_interest: 45,
      original_amount: 300,
      minimum_payment: 25,
      started_on: '2026-01-15',
    },
  ]);
});

test('statements table: missing-table errors are recognized and the message names migration 209', async () => {
  assert.equal(isStatementsTableMissing({ code: 'PGRST205', message: "Could not find the table 'public.account_statements'" }), true);
  assert.equal(isStatementsTableMissing({ code: 'PGRST205', message: "Could not find the table 'public.other'" }), false);
  assert.match(STATEMENTS_MIGRATION_MESSAGE, /Run migration 209 first/);
  const db = new FakeDb();
  db.missingTables.push('account_statements');
  assert.equal(await deleteBatchStatements(asDb(db), USER, 'batch'), 0);
});

test('undo removes the statement facts its import saved, and only those', async () => {
  const db = new FakeDb();
  const [batch] = db.seed('import_batches', [{ user_id: USER, account_id: ACCOUNT, source: 'pdf_import' }]);
  db.seed('account_statements', [
    { user_id: USER, account_id: ACCOUNT, import_batch_id: batch.id, period_end: '2026-01-27' },
    { user_id: USER, account_id: ACCOUNT, import_batch_id: 'another-batch', period_end: '2025-12-27' },
  ]);
  const result = await undoBatch(asDb(db), USER, batch.id as string);
  assert.equal(result.alreadyUndone, false);
  assert.deepEqual(db.rows('account_statements').map((r) => r.period_end), ['2025-12-27']);
});
