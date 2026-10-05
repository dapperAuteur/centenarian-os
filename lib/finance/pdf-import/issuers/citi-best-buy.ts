// lib/finance/pdf-import/issuers/citi-best-buy.ts
// Best Buy credit card statements issued by Citibank (the store card and the
// My Best Buy Visa share one layout).
//
// Layout, as positioned text (built from real statements, read locally only):
//   Page 1  "Summary of Account Activity": Previous Balance, Payments, Other
//           Credits, Purchases/Other Debits, Cash Advances, Fees Charged,
//           Interest Charged, New Balance, Credit Limit, Statement Closing
//           Date, Days in Billing Cycle; beside it "Payment Information":
//           New Balance, Minimum Payment Due, Payment Due Date. "Account
//           number ending in NNNN".
//   TRANSACTIONS (may start on page 1 and continue as "TRANSACTIONS (cont.)"
//           after the legal page). Columns: Trans Date (MM/DD), Description,
//           Reference #, Amount (a "$" item, then the amount; a trailing "-"
//           is a payment or credit). Blocks inside it:
//             CARD ENDING NNNN <name>  purchases on one card, closed by
//             TOTAL CARD ENDING NNNN   (a subtotal, not a row)
//             "."                      payments and credits (no heading)
//             FEES / TOTAL FEES FOR THIS PERIOD
//             INTEREST CHARGED / TOTAL INTEREST FOR THIS PERIOD
//   "<year> Totals Year-to-Date", then ACTIVITY AND PROMOTIONS DETAIL: a
//           ten-column table per balance (PURCHASES / CASH ADVANCES, each
//           REGULAR or a promotion): Original Trans Amount, Promo Trans Date,
//           Previous Balance, Payments & Other Credits, Purchases/Cash
//           Adv/Fees & Other Debits, Interest Charged, New Balance, Promotion
//           Minimum Payment Due, Deferred Interest Charges, Promotion
//           Expiration Date. May continue on a later page "(cont.)".
//   INTEREST CHARGE CALCULATION: Type of Balance, APR ("28.74% (M)(V)"),
//           Balance Subject to Interest Rate, Interest Charge.
//   Then privacy notice, inserts and sometimes a full card agreement, whose
//   headings (PAYMENTS, FEES, TRANSACTIONS ...) are ignored because parsing
//   stops at the sections above.
//
// Page furniture lands inside lines: a control number at the far left margin
// and insert codes on top of table rows. Items left of LEFT_MARGIN are dropped.
//
// Relative imports end in `.ts` so tests/unit/pdf-import.test.ts can load this
// file under `node --test --experimental-strip-types`.

import {
  addDays,
  displayVendor,
  parseLongDate,
  parseMoneyCents,
  parseSlashDate,
  placeMonthDay,
} from '../lines.ts';
import { buildRows, emptyFacts, type RowInput } from '../rows.ts';
import type {
  IssuerParser,
  ParsedStatement,
  PdfLine,
  StatementApr,
  StatementFacts,
  StatementPromo,
  StatementRowKind,
  TextItem,
} from '../types.ts';

/** Control numbers sit at about x=16; real content starts near x=43. */
const LEFT_MARGIN = 30;

const clean = (line: PdfLine): TextItem[] => line.items.filter((item) => item.x >= LEFT_MARGIN);
const textOf = (items: readonly TextItem[]): string => items.map((item) => item.str).join(' ');

const MONTH_DAY = /^\d{2}\/\d{2}$/;
const REFERENCE = /^\*?[A-Z0-9][A-Z0-9-]{9,}$/;

export function detectCitiBestBuy(lines: readonly PdfLine[]): boolean {
  let bestBuy = false;
  let citi = false;
  let summary = false;
  for (const line of lines) {
    if (/BEST BUY CREDIT SERVICES|bestbuy\.accountonline\.com/i.test(line.text)) bestBuy = true;
    if (/Citibank/i.test(line.text)) citi = true;
    if (/Summary of Account Activity/i.test(line.text)) summary = true;
    if (bestBuy && citi && summary) return true;
  }
  return false;
}

/** The money item that follows the item whose text is `label`, on the first line that has it. */
function amountAfter(lines: readonly PdfLine[], label: string): number | null {
  for (const line of lines) {
    const items = clean(line);
    for (let i = 0; i < items.length; i++) {
      if (items[i].str !== label) continue;
      for (let j = i + 1; j < items.length; j++) {
        const cents = parseMoneyCents(items[j].str);
        if (cents !== null) return cents;
      }
    }
  }
  return null;
}

/** The item right after the item whose text is `label`. */
function itemAfter(lines: readonly PdfLine[], label: string): string | null {
  for (const line of lines) {
    const items = clean(line);
    const index = items.findIndex((item) => item.str === label);
    if (index >= 0 && items[index + 1]) return items[index + 1].str;
  }
  return null;
}

/** The page 1 summary, with payments and credits as positive amounts. */
export function readSummary(lines: readonly PdfLine[]): {
  facts: StatementFacts;
  closingDate: string | null;
  days: number | null;
  lastFour: string | null;
} {
  const summaryPage = lines.find((line) => /Summary of Account Activity/i.test(line.text))?.page ?? 1;
  const page = lines.filter((line) => line.page === summaryPage);
  const facts = emptyFacts();
  const abs = (value: number | null): number | null => (value === null ? null : Math.abs(value));

  facts.previousBalance = amountAfter(page, 'Previous Balance');
  facts.payments = abs(amountAfter(page, 'Payments'));
  facts.credits = abs(amountAfter(page, 'Other Credits'));
  facts.purchases = amountAfter(page, 'Purchases/Other Debits');
  facts.cashAdvances = amountAfter(page, 'Cash Advances');
  facts.fees = amountAfter(page, 'Fees Charged');
  facts.interestCharged = amountAfter(page, 'Interest Charged');
  facts.newBalance = amountAfter(page, 'New Balance');
  facts.minimumPayment = amountAfter(page, 'Minimum Payment Due');
  facts.creditLimit = amountAfter(page, 'Credit Limit');
  facts.dueDate = parseLongDate(itemAfter(page, 'Payment Due Date')) ?? parseSlashDate(itemAfter(page, 'Payment Due Date'));

  const closingDate = parseSlashDate(itemAfter(page, 'Statement Closing Date'));
  const daysText = itemAfter(page, 'Days in Billing Cycle');
  const days = daysText && /^\d{1,3}$/.test(daysText) ? Number(daysText) : null;

  let lastFour: string | null = null;
  for (const line of lines) {
    const match = /Account number ending in (\d{4})\b/i.exec(line.text);
    if (match) {
      lastFour = match[1];
      break;
    }
  }
  return { facts, closingDate, days, lastFour };
}

type TxSection = 'activity' | 'purchases' | 'cash' | 'fees' | 'interest';

export interface TransactionScan {
  rows: RowInput[];
  /** Lines that started with a date but could not be read as a row, for warnings. */
  unreadable: number;
  /** "TOTAL FEES / INTEREST FOR THIS PERIOD", when printed. */
  totals: { fees: number | null; interest: number | null };
}

function kindFor(section: TxSection, cents: number, description: string): StatementRowKind {
  if (cents < 0) {
    return /\bPAYMENT\b/i.test(description) && !/\bREVERSAL\b/i.test(description) ? 'payment' : 'credit';
  }
  if (section === 'fees') return 'fee';
  if (section === 'interest') return 'interest';
  if (section === 'cash') return 'cash_advance';
  return 'purchase';
}

/** The TRANSACTIONS section, across pages, up to the year-to-date totals or the activity detail. */
export function readTransactions(lines: readonly PdfLine[], periodEnd: string | null): TransactionScan {
  const scan: TransactionScan = { rows: [], unreadable: 0, totals: { fees: null, interest: null } };
  let inside = false;
  let section: TxSection = 'activity';

  for (const line of lines) {
    const items = clean(line);
    const head = items[0]?.str ?? '';
    const headX = items[0]?.x ?? 0;

    if (!inside) {
      // The card agreement has its own "TRANSACTIONS" heading, set further right.
      if (head === 'TRANSACTIONS' && headX < 80) inside = true;
      continue;
    }
    if (head === 'ACTIVITY AND PROMOTIONS DETAIL' || /Totals Year-to-Date/i.test(line.text)) break;
    if (head === 'TRANSACTIONS' || head === 'Trans Date') continue;

    if (/^CARD ENDING\b/.test(head)) { section = 'purchases'; continue; }
    if (head === 'TOTAL CARD') { section = 'activity'; continue; }
    if (head === '.') { section = 'activity'; continue; }
    if (head === 'FEES') { section = 'fees'; continue; }
    if (head === 'INTEREST CHARGED') { section = 'interest'; continue; }
    if (/^(PAYMENTS|PAYMENTS AND|PAYMENTS & |CREDITS)/.test(head) && items.length === 1) { section = 'activity'; continue; }
    if (/^(PURCHASES|STANDARD PURCHASES)$/.test(head)) { section = 'purchases'; continue; }
    if (head === 'CASH ADVANCES') { section = 'cash'; continue; }

    const total = /^TOTAL (FEES|INTEREST) FOR THIS PERIOD$/.exec(textOf(items.filter((item) => parseMoneyCents(item.str) === null && item.str !== '$')));
    if (total) {
      const cents = parseMoneyCents(items[items.length - 1]?.str);
      if (total[1] === 'FEES') scan.totals.fees = cents;
      else scan.totals.interest = cents;
      continue;
    }

    if (!MONTH_DAY.test(head)) continue;
    const amountItem = items[items.length - 1];
    const cents = parseMoneyCents(amountItem?.str);
    const date = placeMonthDay(head, periodEnd);
    if (cents === null || cents === 0 || !date || items.length < 3) {
      scan.unreadable += 1;
      continue;
    }

    // Everything between the date and the amount, minus the "$" column.
    const middle = items.slice(1, -1).filter((item) => item.str !== '$');
    let reference: string | null = null;
    const last = middle[middle.length - 1];
    if (last && REFERENCE.test(last.str) && middle.length > 1) {
      reference = last.str;
      middle.pop();
    }
    const description = textOf(middle);
    if (!description) {
      scan.unreadable += 1;
      continue;
    }
    scan.rows.push({ date, amountCents: Math.abs(cents), kind: kindFor(section, cents, description), description, reference });
  }
  return scan;
}

/** Column keys of the ACTIVITY AND PROMOTIONS DETAIL table, left to right. */
const ACTIVITY_COLUMNS = [
  'originalAmount', 'promoDate', 'previousBalance', 'credits', 'debits',
  'interest', 'newBalance', 'promoMinimum', 'deferredInterest', 'expiration',
] as const;
type ActivityColumn = (typeof ACTIVITY_COLUMNS)[number];

/** Column centers as printed on the real layout, used when the header row can't be found. */
const DEFAULT_ACTIVITY_CENTERS = [103, 143, 192, 244, 297, 348, 405, 455, 515, 562];

const center = (item: TextItem): number => item.x + item.w / 2;
const isValue = (text: string): boolean =>
  text === '-' || parseMoneyCents(text) !== null || parseSlashDate(text) !== null;

function assignColumns(items: readonly TextItem[], centers: readonly number[]): Partial<Record<ActivityColumn, string>> {
  const cells: Partial<Record<ActivityColumn, string>> = {};
  for (const item of items) {
    let best = 0;
    for (let i = 1; i < centers.length; i++) {
      if (Math.abs(center(item) - centers[i]) < Math.abs(center(item) - centers[best])) best = i;
    }
    cells[ACTIVITY_COLUMNS[best]] = item.str;
  }
  return cells;
}

const cellCents = (value: string | undefined): number | undefined => {
  if (value === undefined || value === '-') return undefined;
  const cents = parseMoneyCents(value);
  return cents === null ? undefined : Math.abs(cents);
};

/** Promotional balances from ACTIVITY AND PROMOTIONS DETAIL. REGULAR rows and the TOTAL row are not promotions. */
export function readPromotions(lines: readonly PdfLine[]): StatementPromo[] {
  const promos: StatementPromo[] = [];
  let inside = false;
  let centers: number[] = DEFAULT_ACTIVITY_CENTERS;
  let balanceGroup = '';
  let label: string | null = null;

  for (const line of lines) {
    const items = clean(line);
    const head = items[0]?.str ?? '';
    if (!inside) {
      if (head === 'ACTIVITY AND PROMOTIONS DETAIL') inside = true;
      continue;
    }
    if (head === 'INTEREST CHARGE CALCULATION') break;
    if (head === 'ACTIVITY AND PROMOTIONS DETAIL') continue;

    // The header's last line names every column; its centers place the values.
    const words = items.map((item) => item.str);
    if (words.includes('Amount') && words.includes('Credits') && items.length >= ACTIVITY_COLUMNS.length) {
      centers = items.slice(0, ACTIVITY_COLUMNS.length).map(center);
      continue;
    }
    if (head === 'PURCHASES' || head === 'CASH ADVANCES' || head === 'BALANCE TRANSFERS') {
      balanceGroup = head;
      label = null;
      continue;
    }
    if (head === 'TOTAL') {
      label = null;
      continue;
    }

    // A label (REGULAR, or a promotion's name) may share the line with its values or sit above them.
    const labelItems = items.filter((item) => !isValue(item.str) && item.x < 260);
    const valueItems = items.filter((item) => isValue(item.str));
    if (labelItems.length > 0 && valueItems.length === 0) {
      // Table header words (Original, Promotion, Trans ...) are not labels.
      if (/^(Original|Promotion|Trans|Amount)$/.test(labelItems[0].str)) continue;
      label = textOf(labelItems);
      continue;
    }
    if (valueItems.length < 5) continue;
    const rowLabel = labelItems.length > 0 ? textOf(labelItems) : label;
    label = null;

    const cells = assignColumns(valueItems, centers);
    const expiresOn = cells.expiration && cells.expiration !== '-' ? parseSlashDate(cells.expiration) : null;
    const original = cellCents(cells.originalAmount);
    const isRegular = !rowLabel || /^REGULAR$/i.test(rowLabel.trim());
    if (isRegular && !expiresOn && original === undefined) continue;

    const balance = cellCents(cells.newBalance) ?? 0;
    const promo: StatementPromo = {
      description: displayVendor(`${rowLabel ?? 'Promotion'}${balanceGroup ? ` (${balanceGroup.toLowerCase()})` : ''}`),
      balance,
      expiresOn,
    };
    const deferred = cellCents(cells.deferredInterest);
    if (deferred !== undefined) promo.deferredInterest = deferred;
    if (original !== undefined) promo.originalAmount = original;
    const minimum = cellCents(cells.promoMinimum);
    if (minimum !== undefined) promo.minimumPayment = minimum;
    const started = cells.promoDate && cells.promoDate !== '-' ? parseSlashDate(cells.promoDate) : null;
    if (started) promo.startedOn = started;
    promos.push(promo);
  }
  return promos;
}

const titleWord = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

/** APRs from INTEREST CHARGE CALCULATION. */
export function readAprs(lines: readonly PdfLine[]): StatementApr[] {
  const aprs: StatementApr[] = [];
  let inside = false;
  let group = '';
  for (const line of lines) {
    const items = clean(line);
    const head = items[0]?.str ?? '';
    if (!inside) {
      if (head === 'INTEREST CHARGE CALCULATION') inside = true;
      continue;
    }
    if (head.startsWith('(V)') || /^Page \d+ of \d+$/.test(head) || /= Variable Rate/.test(line.text)) break;
    if (head === 'Type of Balance') continue;
    if (items.length === 1 && /^[A-Z][A-Z &]+$/.test(head)) {
      group = head;
      continue;
    }
    const rateIndex = items.findIndex((item) => /^\d{1,2}\.\d{1,2}%/.test(item.str));
    if (rateIndex < 0) continue;
    const apr = Number(/^(\d{1,2}\.\d{1,2})%/.exec(items[rateIndex].str)![1]);
    // The label is what sits left of the rate, minus any insert code printed over the row.
    const labelText = items.slice(0, rateIndex).filter((item) => item.x < 130 && /^[A-Z0-9 &/-]+$/.test(item.str));
    const label = textOf(labelText) || 'Balance';
    const money = items.slice(rateIndex + 1).map((item) => parseMoneyCents(item.str)).filter((v): v is number => v !== null);
    const entry: StatementApr = {
      balanceType: group ? `${titleWord(group)} - ${titleWord(label)}` : titleWord(label),
      apr,
    };
    if (money[0] !== undefined) entry.balanceCents = Math.abs(money[0]);
    if (money[1] !== undefined) entry.interestCents = Math.abs(money[1]);
    aprs.push(entry);
  }
  return aprs;
}

export function parseCitiBestBuy(lines: readonly PdfLine[]): ParsedStatement {
  const warnings: string[] = [];
  const { facts, closingDate, days, lastFour } = readSummary(lines);
  const periodEnd = closingDate;
  const periodStart = closingDate && days ? addDays(closingDate, -(days - 1)) : null;
  if (!periodEnd) warnings.push("The statement closing date wasn't found, so transaction years may be wrong.");

  const scan = readTransactions(lines, periodEnd);
  if (scan.unreadable > 0) {
    warnings.push(`${scan.unreadable} ${scan.unreadable === 1 ? 'line looked' : 'lines looked'} like a transaction but couldn't be read.`);
  }
  facts.aprs = readAprs(lines);
  facts.promos = readPromotions(lines);

  if (facts.previousBalance === null || facts.newBalance === null) {
    warnings.push("The statement summary wasn't fully found. Check the totals against your statement.");
  }

  return {
    issuer: 'citi-best-buy',
    issuerLabel: 'Best Buy credit card (Citibank)',
    confidence: 'high',
    accountLastFour: lastFour,
    period: { start: periodStart, end: periodEnd },
    rows: buildRows(scan.rows),
    statement: facts,
    warnings,
  };
}

export const citiBestBuy: IssuerParser = {
  id: 'citi-best-buy',
  label: 'Best Buy credit card (Citibank)',
  detect: detectCitiBestBuy,
  parse: parseCitiBestBuy,
};
