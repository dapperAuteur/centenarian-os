// lib/finance/pdf-import/issuers/generic.ts
// The fallback for a statement no issuer parser recognizes. It looks for
// lines that start with a date and end with an amount, and for the usual
// summary labels (Previous Balance, New Balance, Minimum Payment Due ...).
// Always low confidence: the person is told to check every row.
//
// Sign convention: card terms. A plain amount is a charge (expense); a
// negative amount, a trailing "-", "CR" or parentheses is a payment or credit
// (income). On a bank account statement that is often backwards, which is
// why the review step says so and lets each row be flipped.
//
// Relative imports end in `.ts` so tests/unit/pdf-import.test.ts can load this
// file under `node --test --experimental-strip-types`.

import {
  isoDate,
  parseAnyDate,
  parseMoneyCents,
  placeMonthDay,
} from '../lines.ts';
import { buildRows, emptyFacts, type RowInput } from '../rows.ts';
import type {
  IssuerParser,
  ParsedStatement,
  PdfLine,
  StatementApr,
  StatementFacts,
  StatementRowKind,
} from '../types.ts';

const MONEY = String.raw`(?:\(\$?[\d,]+\.\d{2}\)|[-+]?\$?-?[\d,]+\.\d{2}(?:-|\s?CR)?)`;
const SLASH_DATE = String.raw`\d{1,2}\/\d{1,2}(?:\/\d{2,4})?`;
const MONTH_NAME = String.raw`(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?`;
const DATE = `(?:${SLASH_DATE}|${MONTH_NAME})`;

// date [post date] description amount [running balance]
const ROW = new RegExp(`^(${DATE})\\s+(?:(${DATE})\\s+)?(.+?)\\s+(${MONEY})(?:\\s+(${MONEY}))?$`, 'i');

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** A row date in any of the forms ROW accepts, placed in the period when it has no year. */
export function genericDate(raw: string, periodEnd: string | null): string | null {
  const text = raw.trim();
  const full = parseAnyDate(text);
  if (full) return full;
  if (/^\d{1,2}\/\d{1,2}$/.test(text)) return placeMonthDay(text, periodEnd);
  const named = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})$/.exec(text);
  if (named && periodEnd) {
    const month = MONTHS.indexOf(named[1].toLowerCase()) + 1;
    if (month < 1) return null;
    return placeMonthDay(`${month}/${named[2]}`, periodEnd);
  }
  return null;
}

/** What a row is, from its sign and wording. */
export function genericKind(cents: number, description: string): StatementRowKind {
  if (cents < 0) return /\bpayment\b/i.test(description) && !/\breversal\b/i.test(description) ? 'payment' : 'credit';
  if (/\b(?:interest charge|interest charged|finance charge)\b/i.test(description)) return 'interest';
  if (/\bcash advance\b/i.test(description)) return 'cash_advance';
  if (/\bfee\b/i.test(description)) return 'fee';
  return 'purchase';
}

function labelled(lines: readonly PdfLine[], label: RegExp): number | null {
  for (const line of lines) {
    const match = new RegExp(`${label.source}[:\\s]*(${MONEY})`, 'i').exec(line.text);
    if (match) return parseMoneyCents(match[1]);
  }
  return null;
}

function labelledDate(lines: readonly PdfLine[], label: RegExp): string | null {
  for (const line of lines) {
    const match = new RegExp(`${label.source}[:\\s]*(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}|[A-Za-z]{3,9}\\.?\\s+\\d{1,2},?\\s+\\d{4})`, 'i').exec(line.text);
    if (match) return parseAnyDate(match[1].replace(/\s+/g, ' '));
  }
  return null;
}

/** "01/01/2026 - 01/31/2026", "01/01/26 through 01/31/26", "January 1, 2026 to January 31, 2026". */
function periodRange(lines: readonly PdfLine[]): { start: string | null; end: string | null } {
  const date = String.raw`(\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})`;
  const range = new RegExp(`${date}\\s*(?:-|–|to|through|thru)\\s*${date}`, 'i');
  for (const line of lines) {
    const match = range.exec(line.text);
    if (!match) continue;
    const start = parseAnyDate(match[1]);
    const end = parseAnyDate(match[2]);
    if (start && end && start <= end) return { start, end };
  }
  return { start: null, end: null };
}

function readFacts(lines: readonly PdfLine[]): StatementFacts {
  const facts = emptyFacts();
  const abs = (value: number | null): number | null => (value === null ? null : Math.abs(value));
  facts.previousBalance = labelled(lines, /Previous Balance/);
  facts.newBalance = labelled(lines, /New Balance(?: Total)?/);
  facts.payments = abs(labelled(lines, /Payments(?:, Credits)?/));
  facts.credits = abs(labelled(lines, /Other Credits/));
  facts.purchases = labelled(lines, /Purchases(?:\/Other Debits)?/);
  facts.cashAdvances = labelled(lines, /Cash Advances/);
  facts.fees = labelled(lines, /Fees Charged/);
  facts.interestCharged = labelled(lines, /Interest Charged/);
  facts.minimumPayment = labelled(lines, /Minimum Payment(?: Due)?/);
  facts.creditLimit = labelled(lines, /Credit Limit/);
  facts.dueDate = labelledDate(lines, /Payment Due Date/);

  const seen = new Set<string>();
  const aprs: StatementApr[] = [];
  for (const line of lines) {
    const match = /\b(purchases?|cash advances?|balance transfers?)\b.*?\b(\d{1,2}\.\d{2})%/i.exec(line.text);
    if (!match) continue;
    const type = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    if (seen.has(type)) continue;
    seen.add(type);
    aprs.push({ balanceType: type, apr: Number(match[2]) });
  }
  facts.aprs = aprs;
  return facts;
}

export function parseGeneric(lines: readonly PdfLine[]): ParsedStatement {
  const warnings = [
    "This statement's layout isn't one CentenarianOS knows, so rows were found by looking for a date and an amount on the same line. Check every row, its direction (expense or income) and the totals before importing.",
  ];
  const facts = readFacts(lines);
  let period = periodRange(lines);
  const closing = labelledDate(lines, /(?:Statement )?Closing Date/);
  if (closing) period = { start: period.start, end: closing };

  // Without a period, borrow the year from the first full date anywhere in the file.
  let yearEnd = period.end;
  if (!yearEnd) {
    for (const line of lines) {
      const match = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(line.text);
      if (match) {
        yearEnd = isoDate(Number(match[3]), 12, 31);
        break;
      }
    }
  }

  const inputs: RowInput[] = [];
  for (const line of lines) {
    const match = ROW.exec(line.text);
    if (!match) continue;
    const description = match[3].trim();
    if (/^(total|balance|previous balance|new balance|minimum)/i.test(description)) continue;
    const date = genericDate(match[1], yearEnd);
    const cents = parseMoneyCents(match[4]);
    if (!date || cents === null || cents === 0) continue;
    inputs.push({ date, amountCents: Math.abs(cents), kind: genericKind(cents, description), description });
  }
  if (inputs.length === 0) warnings.push('No transaction lines were found in this PDF.');

  let lastFour: string | null = null;
  for (const line of lines) {
    const match = /(?:ending in|account (?:number|no\.?)[:\s]*(?:[x*•]+[\s-]*)+)\s*(\d{4})\b/i.exec(line.text);
    if (match) {
      lastFour = match[1];
      break;
    }
  }

  return {
    issuer: 'generic',
    issuerLabel: 'Unrecognized statement layout',
    confidence: 'low',
    accountLastFour: lastFour,
    period,
    rows: buildRows(inputs),
    statement: facts,
    warnings,
  };
}

export const generic: IssuerParser = {
  id: 'generic',
  label: 'Unrecognized statement layout',
  detect: () => true,
  parse: parseGeneric,
};
