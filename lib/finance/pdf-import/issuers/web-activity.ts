// lib/finance/pdf-import/issuers/web-activity.ts
// Transaction lists printed to PDF from a card's website, rather than
// periodic statements:
//   - Capital One (myaccounts.capitalone.com): Capital One cards such as the
//     REI Co-op Mastercard, and Discover cards, which are now serviced on the
//     Capital One site ("Discover it ...NNNN").
//   - PayPal Credit (paypalcredit.syf.com, "PayPal Credit - BillingActivity").
//
// Layout, as positioned text (built from real printouts, read locally only):
//   Every page starts with the print date and time ("9/30/26, 10:15 AM") and
//   ends with the page URL. Transactions sit in sections:
//     Capital One: "Pending Transactions", "Posted Transactions Since Your
//       Last Statement", "Statement Ending Sep 15, 2026", ... or, for a
//       Discover card, one "Posted Transactions" list under a date range
//       ("MM/DD/YYYY - MM/DD/YYYY"). Column heads DATE, DESCRIPTION, AMOUNT.
//     PayPal Credit: "Pending transactions", "Completed transactions", then
//       "Transactions from your September 15, 2026 Statement" per statement.
//   Each transaction is a small block of 2 to 6 lines: the month name and
//   the day number under each other on the left, the description (wrapped
//   over two lines when long) in the middle, the amount on the right
//   ("$12.34", "-$40.00", or "-" and "$40.00" as two items), and under the
//   description a category or subtitle ("Dining", "Payment", "Interest
//   Charge", "One-time payment", "Purchase"). Capital One adds the card
//   holder and "...NNNN" and a rewards rate ("1.5% earn"), which are dropped.
//   Blocks are separated by a wider gap than the lines inside them.
//
// A transaction list has no previous or new balance, so it is marked
// documentKind 'activity': nothing is reconciled and no statement summary is
// saved. Pending transactions and canceled payments are left out (they move
// no money) and counted in the warnings.
//
// Relative imports end in `.ts` so tests/unit/pdf-import.test.ts can load
// this file under `node --test --experimental-strip-types`.

import { isoDate, parseLongDate, parseMoneyCents, parseSlashDate, placeMonthDay } from '../lines.ts';
import { buildRows, emptyFacts, type RowInput } from '../rows.ts';
import type { IssuerParser, ParsedStatement, PdfLine, StatementRowKind, TextItem } from '../types.ts';

/** Lines closer than this (points) belong to the same transaction block. */
export const BLOCK_GAP = 22;

/** Items left of this are the date column (month name, day number). */
const DATE_COLUMN_MAX_X = 140;
/** Items from this x on are the amount and card holder columns. */
const AMOUNT_COLUMN_MIN_X = 400;

const MONTH = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?$/i;
const DAY = /^\d{1,2}$/;
const MONTH_NUMBER: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// Page furniture: the print date line at the top and the URL at the bottom.
const TOP_FURNITURE_Y = 760;
const BOTTOM_FURNITURE_Y = 25;

type Site = 'capital-one' | 'discover' | 'paypal-credit';

function siteOf(lines: readonly PdfLine[]): Site | null {
  let capitalOne = false;
  let paypal = false;
  let discover = false;
  let columns = false;
  for (const line of lines) {
    if (/myaccounts\.capitalone\.com/i.test(line.text)) capitalOne = true;
    if (/paypalcredit\.syf\.com|PayPal Credit - BillingActivity/i.test(line.text)) paypal = true;
    if (line.page === 1 && /\bDiscover it\b/i.test(line.text)) discover = true;
    const words = line.items.map((item) => item.str);
    if (words.includes('DATE') && words.includes('DESCRIPTION') && words.includes('AMOUNT')) columns = true;
  }
  if (paypal) return 'paypal-credit';
  if (capitalOne && columns) return discover ? 'discover' : 'capital-one';
  return null;
}

/** "9/30/26, 10:15 AM" at the top of the first page -> 2026-09-30. */
function printDate(lines: readonly PdfLine[]): string | null {
  for (const line of lines) {
    if (line.page !== 1) break;
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4}),/.exec(line.items[0]?.str ?? '');
    if (match) {
      const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
      return isoDate(year, Number(match[1]), Number(match[2]));
    }
  }
  return null;
}

/** A "MM/DD/YYYY - MM/DD/YYYY" range, or PayPal's Start Date / End Date pair. */
function dateRange(lines: readonly PdfLine[]): { start: string | null; end: string | null } {
  for (const line of lines) {
    const range = /(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/.exec(line.text);
    if (range) return { start: parseSlashDate(range[1]), end: parseSlashDate(range[2]) };
    const dates = line.items.map((item) => parseSlashDate(item.str)).filter((d): d is string => d !== null);
    if (dates.length === 2 && line.items.length === 2) return { start: dates[0], end: dates[1] };
  }
  return { start: null, end: null };
}

function lastFourOf(lines: readonly PdfLine[]): string | null {
  for (const line of lines) {
    if (line.page !== 1) break;
    const match = /(?:\.\.\.|…)\s?(\d{4})\b/.exec(line.text);
    if (match) return match[1];
  }
  return null;
}

type Mode = 'none' | 'pending' | 'posted';

/** What a line says about the section it opens, or null for an ordinary line. */
function sectionOf(text: string, fallbackEnd: string | null): { mode: Mode; end: string | null } | 'stop' | null {
  const trimmed = text.trim();
  if (/^Pending transactions\b/i.test(trimmed)) return { mode: 'pending', end: null };
  if (/^(?:Posted Transactions(?: Since Your Last Statement)?|Completed transactions)\b/i.test(trimmed)) {
    return { mode: 'posted', end: fallbackEnd };
  }
  const ending = /^Statement Ending (.+)$/i.exec(trimmed);
  if (ending) return { mode: 'posted', end: parseLongDate(ending[1]) ?? fallbackEnd };
  const fromStatement = /^Transactions from your (.+) Statement$/i.exec(trimmed);
  if (fromStatement) return { mode: 'posted', end: parseLongDate(fromStatement[1]) ?? fallbackEnd };
  if (/^(?:Load Previous Statement|Export|Dispute a charge|PRODUCTS|To help you identify)\b/.test(trimmed)) return 'stop';
  return null;
}

interface Block {
  lines: PdfLine[];
  /** The date the section's month/day dates are placed before. */
  sectionEnd: string | null;
}

const isFurniture = (line: PdfLine): boolean => line.y > TOP_FURNITURE_Y || line.y < BOTTOM_FURNITURE_Y;
const isColumnHead = (line: PdfLine): boolean => {
  const words = line.items.map((item) => item.str);
  return words.includes('DATE') && words.includes('DESCRIPTION');
};
const isTotal = (line: PdfLine): boolean => /^Total:/.test(line.items.find((item) => item.x >= AMOUNT_COLUMN_MIN_X - 80)?.str ?? '');

const has = (block: Block, test: (item: TextItem) => boolean): boolean =>
  block.lines.some((line) => line.items.some(test));
const hasMonth = (block: Block) => has(block, (item) => item.x < DATE_COLUMN_MAX_X && MONTH.test(item.str));
const hasDay = (block: Block) => has(block, (item) => item.x < DATE_COLUMN_MAX_X && DAY.test(item.str));
const hasAmount = (block: Block) =>
  has(block, (item) => item.x >= AMOUNT_COLUMN_MIN_X && parseMoneyCents(item.str) !== null);

/** Groups the transaction lines of the posted sections into blocks; pending ones are counted, not read. */
export function readBlocks(lines: readonly PdfLine[], fallbackEnd: string | null): { blocks: Block[]; pending: number } {
  const blocks: Block[] = [];
  let pendingBlocks: Block[] = [];
  let mode: Mode = 'none';
  let sectionEnd: string | null = fallbackEnd;
  let current: Block | null = null;
  let last: PdfLine | null = null;

  const close = () => {
    if (current && current.lines.length > 0) (mode === 'pending' ? pendingBlocks : blocks).push(current);
    current = null;
  };

  for (const line of lines) {
    if (isFurniture(line)) continue;
    const section = sectionOf(line.text, fallbackEnd);
    if (section === 'stop') {
      close();
      mode = 'none';
      continue;
    }
    if (section) {
      close();
      mode = section.mode;
      sectionEnd = section.end;
      last = null;
      continue;
    }
    if (mode === 'none' || isColumnHead(line) || isTotal(line)) continue;

    const samePage = last !== null && last.page === line.page;
    const near = samePage && last !== null && last.y - line.y <= BLOCK_GAP;
    // A block cut by a page break carries on at the top of the next page.
    const continues = !samePage && current !== null && !(hasMonth(current) && hasDay(current) && hasAmount(current));
    if (!current || (!near && !continues)) {
      close();
      current = { lines: [], sectionEnd };
    }
    current.lines.push(line);
    last = line;
  }
  close();
  // PayPal prints "You have no pending transactions" in place of a list.
  pendingBlocks = pendingBlocks.filter((block) => hasAmount(block));
  return { blocks, pending: pendingBlocks.length };
}

const JUNK = [
  /\s*See all special\s*fi\s*nancing purchases/gi, // PayPal Credit's link beside a promotional purchase
  /\s*\d+(?:\.\d+)?% earn\b/gi, // Capital One rewards rate
];

function cleanText(text: string): string {
  let out = text;
  for (const pattern of JUNK) out = out.replace(pattern, '');
  return out.replace(/\s+/g, ' ').trim();
}

export interface WebActivityRow extends RowInput {
  /** The subtitle under the description ("Dining", "Payment", "One-time payment"). */
  subtitle: string | null;
}

/** What a block's row is, from its sign, subtitle and description. */
export function webActivityKind(cents: number, description: string, subtitle: string | null): StatementRowKind {
  const words = `${description} ${subtitle ?? ''}`;
  if (cents < 0) return /\bpayment\b/i.test(words) && !/\b(?:reversal|refund)\b/i.test(words) ? 'payment' : 'credit';
  if (/\binterest charge\b|^interest\b/i.test(words) || /^interest charge$/i.test(subtitle ?? '')) return 'interest';
  if (/^fee$/i.test(subtitle ?? '') || /\bfee\b/i.test(description)) return 'fee';
  if (/\bcash advance\b/i.test(words)) return 'cash_advance';
  return 'purchase';
}

/** One block as a row, or why it can't be one ('canceled' for a canceled payment, which moved no money). */
export function readBlock(block: Block): WebActivityRow | 'canceled' | null {
  let month: number | null = null;
  let day: number | null = null;
  let cents: number | null = null;
  const descriptionLines: string[] = [];

  for (const line of block.lines) {
    const middle: string[] = [];
    let minusSign = false;
    for (const item of line.items) {
      if (item.x < DATE_COLUMN_MAX_X) {
        if (MONTH.test(item.str)) month = MONTH_NUMBER[item.str.slice(0, 3).toLowerCase()] ?? null;
        else if (DAY.test(item.str)) day = Number(item.str);
        continue;
      }
      if (item.x >= AMOUNT_COLUMN_MIN_X) {
        if (item.str === '-') {
          minusSign = true;
          continue;
        }
        const money = parseMoneyCents(item.str);
        if (money !== null) cents = minusSign ? -Math.abs(money) : money;
        continue; // the card holder and "...NNNN"
      }
      middle.push(item.str);
    }
    const text = cleanText(middle.join(' '));
    if (text) descriptionLines.push(text);
  }

  if (month === null || day === null || cents === null || cents === 0 || descriptionLines.length === 0) return null;
  const subtitle = descriptionLines.length > 1 ? descriptionLines[descriptionLines.length - 1] : null;
  const description = (subtitle ? descriptionLines.slice(0, -1) : descriptionLines).join(' ').replace(/…$/, '').trim();
  if (/^canceled payment\b/i.test(description)) return 'canceled';
  const date = placeMonthDay(`${month}/${day}`, block.sectionEnd);
  if (!date) return null;
  return {
    date,
    amountCents: Math.abs(cents),
    kind: webActivityKind(cents, description, subtitle),
    description,
    subtitle,
  };
}

const LABELS: Record<Site, { id: string; label: string }> = {
  'capital-one': { id: 'capital-one-web', label: 'Capital One card (activity printed from capitalone.com)' },
  discover: { id: 'discover-web', label: 'Discover card (activity printed from the Capital One website)' },
  'paypal-credit': { id: 'paypal-credit-web', label: 'PayPal Credit (activity printed from its website)' },
};

export function parseWebActivity(lines: readonly PdfLine[]): ParsedStatement {
  const site = siteOf(lines) ?? 'capital-one';
  const printed = printDate(lines);
  const range = dateRange(lines);
  const fallbackEnd = range.end ?? printed;

  const { blocks, pending } = readBlocks(lines, fallbackEnd);
  const inputs: RowInput[] = [];
  let canceled = 0;
  let unreadable = 0;
  for (const block of blocks) {
    const row = readBlock(block);
    if (row === 'canceled') canceled += 1;
    else if (row === null) unreadable += 1;
    else inputs.push({ date: row.date, amountCents: row.amountCents, kind: row.kind, description: row.description });
  }

  const warnings: string[] = [];
  if (!fallbackEnd) warnings.push("The print date wasn't found, so transaction years may be wrong.");
  if (unreadable > 0) {
    warnings.push(`${unreadable} ${unreadable === 1 ? 'entry looked' : 'entries looked'} like a transaction but couldn't be read.`);
  }
  if (inputs.length === 0) warnings.push('No posted transactions were found in this PDF.');
  const notes: string[] = [];
  if (pending > 0) notes.push(`${pending} pending ${pending === 1 ? 'transaction was' : 'transactions were'} left out until ${pending === 1 ? 'it posts' : 'they post'}.`);
  if (canceled > 0) notes.push(`${canceled} canceled ${canceled === 1 ? 'payment was' : 'payments were'} left out: no money moved.`);

  const dates = inputs.map((input) => input.date).sort();
  const { id, label } = LABELS[site];
  return {
    issuer: id,
    issuerLabel: label,
    confidence: inputs.length > 0 && unreadable === 0 ? 'high' : 'low',
    accountLastFour: lastFourOf(lines),
    period: { start: range.start ?? dates[0] ?? null, end: range.end ?? dates[dates.length - 1] ?? printed },
    rows: buildRows(inputs),
    statement: emptyFacts(),
    warnings,
    notes,
    documentKind: 'activity',
  };
}

export const capitalOneWeb: IssuerParser = {
  id: 'capital-one-web',
  label: 'Capital One and Discover card activity (printed from capitalone.com)',
  detect: (lines) => {
    const site = siteOf(lines);
    return site === 'capital-one' || site === 'discover';
  },
  parse: parseWebActivity,
};

export const paypalCreditWeb: IssuerParser = {
  id: 'paypal-credit-web',
  label: 'PayPal Credit activity (printed from its website)',
  detect: (lines) => siteOf(lines) === 'paypal-credit',
  parse: parseWebActivity,
};
