// lib/finance/csv-import/parse.ts
// Reads a bank or card statement CSV and turns its rows into transactions:
// finds the table inside the file, guesses which column is which, and
// normalizes dates, amounts and the direction of the money.
//
// Pure functions: no database, no network. This file runs in API routes, in
// client components, and under `node --test --experimental-strip-types`
// (tests/unit/csv-import.test.ts). Its relative imports end in `.ts` because
// Node's type stripping does not resolve extensionless paths.
//
// The usual order of calls:
//   parseStatementCsv(text)  -> the table: headers + raw rows
//   detectMapping(...)       -> a guess at the column mapping (the user confirms it)
//   applyMapping(...)        -> normalized rows + rejected rows with reasons
//   assignExternalIds(rows)  -> a dedupe key per row

import Papa from 'papaparse';
import { normalizeHeader } from '../../csv/normalize-header.ts';
import { normalizeMerchant, vendorKey } from '../transaction-matching.ts';
import { BANK_PRESETS, GENERIC_PRESET_ID } from './presets.ts';
import type {
  BankPreset,
  ColumnMapping,
  ColumnRole,
  DateOrder,
  MappingConfidence,
  MappingGuess,
  NormalizedRow,
  RawRow,
  RejectedRow,
  SignConvention,
  StatementCsv,
  StatementParseResult,
  TransactionType,
  TransferHint,
} from './types.ts';

export { BANK_PRESETS, GENERIC_PRESET_ID };

// ── Amounts ───────────────────────────────────────────────────────────────

// A leading sign may sit on either side of the dollar sign: "-$5.00", "$-5.00".
// The minus can be a hyphen, the Unicode minus (U+2212) or an en dash (U+2013).
const AMOUNT_PREFIX = /^([+\-\u2212\u2013]?)\$?([+\-\u2212\u2013]?)/;

// Digits with optional thousands commas, then optional cents: "1,234.56", "12", ".5".
// A comma that isn't a thousands separator ("12,34") fails on purpose: guessing
// at a decimal comma would silently import the wrong amount.
const AMOUNT_BODY = /^(\d{1,3}(?:,\d{3})+|\d*)(?:\.(\d*))?$/;

// "12.34 CR", "12.34DR": some statements mark direction with a suffix.
const AMOUNT_MARKER = /(cr|dr)\.?$/i;

interface ReadAmount {
  /** Signed cents. */
  cents: number;
  /** The CR / DR suffix, when the cell had one. */
  marker: 'CR' | 'DR' | null;
}

function readAmount(raw: string | null | undefined): ReadAmount | null {
  if (raw == null) return null;
  let s = String(raw).replace(/\s+/g, '');
  if (!s) return null;

  let marker: ReadAmount['marker'] = null;
  const suffix = AMOUNT_MARKER.exec(s);
  if (suffix) {
    marker = suffix[1].toUpperCase() as 'CR' | 'DR';
    s = s.slice(0, suffix.index);
  }

  // Accounting style: "(12.34)" is negative.
  let negative = false;
  const parens = /^\((.*)\)$/.exec(s);
  if (parens) {
    negative = true;
    s = parens[1];
  }

  const prefix = AMOUNT_PREFIX.exec(s);
  if (!prefix || (prefix[1] && prefix[2])) return null;
  const signChar = prefix[1] || prefix[2];
  if (signChar && signChar !== '+') negative = true;
  s = s.slice(prefix[0].length);

  const body = AMOUNT_BODY.exec(s);
  if (!body || !/\d/.test(s)) return null;
  const whole = body[1].replace(/,/g, '');
  const fraction = body[2] ?? '';
  // Built from the digits, not parseFloat, so 0.1 + 0.2 style float error can't shift a cent.
  let cents = Number(whole || '0') * 100 + Number((fraction + '00').slice(0, 2));
  if (fraction.length > 2 && fraction[2] >= '5') cents += 1;
  if (!Number.isSafeInteger(cents)) return null;

  // A suffix wins over any sign: DR is money out, CR is money in.
  if (marker) negative = marker === 'DR';
  return { cents: negative && cents !== 0 ? -cents : cents, marker };
}

/**
 * Reads a money cell as signed integer cents, or null when it isn't a number.
 *
 *   "$1,234.56"  -> 123456      "(12.34)"   -> -1234
 *   "-$5"        -> -500        "−5.00"     -> -500   (Unicode minus)
 *   "+12.3"      -> 1230        "12.34 DR"  -> -1234
 *   "12.34 CR"   -> 1234        "12,34"     -> null
 *
 * A third decimal rounds half up. CR and DR are direction markers, not signs:
 * applyMapping reads CR as money in and DR as money out under every sign
 * convention.
 */
export function parseAmount(raw: string | null | undefined): number | null {
  return readAmount(raw)?.cents ?? null;
}

// ── Dates ─────────────────────────────────────────────────────────────────

// Three numeric parts with one separator used twice, optionally followed by a
// time: "1/31/2026", "01-31-26", "2026-01-31", "2026-01-31T14:05:00Z",
// "1/31/2026 2:05 PM".
const NUMERIC_DATE = /^(\d{1,4})([/.-])(\d{1,2})\2(\d{1,4})(?:[T\s]\s*\d{1,2}:\d{2}.*)?$/;

// "Jan 31, 2026", "January 31 2026", "Sept. 3, 2026"
const MONTH_FIRST_DATE = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*|\s+)(\d{4})$/;

// "31 Jan 2026", "31-Jan-2026"
const DAY_FIRST_DATE = /^(\d{1,2})[\s-]([A-Za-z]{3,9})\.?,?[\s-](\d{4})$/;

const MONTH_NUMBERS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** "jan", "Sept", "January" -> 1..12, or null for anything that isn't a month name. */
function monthNumber(name: string): number | null {
  const lower = name.toLowerCase();
  if (lower.length < 3 || !MONTH_NAMES.some((full) => full.startsWith(lower))) return null;
  return MONTH_NUMBERS[lower.slice(0, 3)] ?? null;
}

/** Two-digit years: 00-69 are 2000s, 70-99 are 1900s. */
function fullYear(text: string): number {
  const year = Number(text);
  if (text.length > 2) return year;
  return year < 70 ? 2000 + year : 1900 + year;
}

/** YYYY-MM-DD for a real calendar date between 1900 and 2100, else null. */
function toIsoDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return null;
  // Day 0 of the next month is the last day of this one, so Feb 30 and Apr 31 fail.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Reads a date cell as YYYY-MM-DD, or null when it isn't a real date.
 *
 * Understands ISO dates with or without a time ("2026-01-31",
 * "2026-01-31T14:05:00Z"), numeric dates with a 2- or 4-digit year
 * ("1/31/2026", "1/31/26", "01-31-2026"), and month names ("Jan 31, 2026").
 * `order` only matters for numeric dates that don't start with the year. A
 * time or time zone is dropped, never converted: the date is the one the bank
 * printed.
 */
export function parseDate(raw: string | null | undefined, order: DateOrder): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;

  const numeric = NUMERIC_DATE.exec(s);
  if (numeric) {
    const [, a, , b, c] = numeric;
    if (a.length === 4) {
      return c.length <= 2 ? toIsoDate(Number(a), Number(b), Number(c)) : null;
    }
    if (a.length > 2 || (c.length !== 2 && c.length !== 4)) return null;
    // "26/01/31" only reads year-first when asked to; a 4-digit year at the end can't.
    if (order === 'YMD' && c.length === 2) return toIsoDate(fullYear(a), Number(b), Number(c));
    return order === 'DMY'
      ? toIsoDate(fullYear(c), Number(b), Number(a))
      : toIsoDate(fullYear(c), Number(a), Number(b));
  }

  const monthFirst = MONTH_FIRST_DATE.exec(s);
  if (monthFirst) {
    const month = monthNumber(monthFirst[1]);
    return month ? toIsoDate(Number(monthFirst[3]), month, Number(monthFirst[2])) : null;
  }

  const dayFirst = DAY_FIRST_DATE.exec(s);
  if (dayFirst) {
    const month = monthNumber(dayFirst[2]);
    return month ? toIsoDate(Number(dayFirst[3]), month, Number(dayFirst[1])) : null;
  }

  return null;
}

/**
 * Works out whether a column of numeric dates is day-first or month-first.
 * - `DMY` when any first part is over 12 (it can't be a month).
 * - `MDY` when any second part is over 12.
 * - Otherwise `MDY` with `ambiguous: true`: every date reads both ways, so ask.
 *
 * Dates that start with a 4-digit year, or spell the month, carry no
 * ambiguity; a column of only those returns `ambiguous: false` (`YMD` when
 * year-first dates were seen). `ambiguous` is also true when the column
 * contradicts itself (both a first and a second part over 12).
 */
export function detectDateOrder(
  samples: readonly (string | null | undefined)[],
): { order: DateOrder; ambiguous: boolean } {
  let firstOver12 = false;
  let secondOver12 = false;
  let undecided = 0;
  let yearFirst = 0;
  for (const sample of samples) {
    const numeric = NUMERIC_DATE.exec((sample ?? '').trim());
    if (!numeric) continue;
    const [, a, , b] = numeric;
    if (a.length === 4) {
      yearFirst += 1;
      continue;
    }
    if (a.length > 2) continue;
    undecided += 1;
    if (Number(a) > 12) firstOver12 = true;
    if (Number(b) > 12) secondOver12 = true;
  }
  if (undecided === 0) return { order: yearFirst > 0 ? 'YMD' : 'MDY', ambiguous: false };
  if (firstOver12) return { order: 'DMY', ambiguous: secondOver12 };
  if (secondOver12) return { order: 'MDY', ambiguous: false };
  return { order: 'MDY', ambiguous: true };
}

// ── Money direction ───────────────────────────────────────────────────────

const EXPENSE_WORDS = new Set(['debit', 'withdrawal', 'purchase', 'charge', 'sale', 'expense']);
const INCOME_WORDS = new Set(['credit', 'deposit', 'refund', 'income']);

/**
 * Reads a type cell as expense or income, ignoring case: debit, withdrawal,
 * purchase, charge, sale and expense are money out; credit, deposit, refund
 * and income are money in. The word may sit inside a longer value
 * ("ACH_DEBIT", "Debit Card"). Returns null when the cell names neither
 * direction, or both.
 */
export function normalizeType(raw: string | null | undefined): TransactionType | null {
  const words = (raw ?? '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const expense = words.some((w) => EXPENSE_WORDS.has(w));
  const income = words.some((w) => INCOME_WORDS.has(w));
  if (expense === income) return null;
  return expense ? 'expense' : 'income';
}

// ── Transfer hints ────────────────────────────────────────────────────────

// Tested against the description lowercased with punctuation turned into
// spaces, so "E-PAY" and "ACCT_XFER" match "e pay" and "xfer".
const HINT_PATTERNS: readonly (readonly [TransferHint, RegExp])[] = [
  ['transfer', /\b(?:transfer|xfer|zelle|venmo)\b/],
  ['card_payment', /\b(?:payment thank you|auto ?pay(?:ment)?|online payment|e ?pay(?:ment)?|card payment)\b/],
  ['loan_payment', /\b(?:loan|mortgage)\b/],
  ['insurance', /\b(?:insurance|premium)\b/],
];

/**
 * What a description's wording suggests the row is: a transfer between the
 * person's own accounts, a card payment, a loan payment, or insurance. Pattern
 * matching only, so expect false positives ("premium" also matches a streaming
 * plan). Callers decide what, if anything, to do with a hint.
 */
export function transferHints(description: string | null | undefined): TransferHint[] {
  const text = (description ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!text) return [];
  return HINT_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([hint]) => hint);
}

// ── Reading the file ──────────────────────────────────────────────────────

/** One line of the file as papaparse read it, with its spreadsheet row number. */
interface FileRecord {
  rowNumber: number;
  cells: string[];
}

const isBlank = (cell: string): boolean => cell.trim() === '';

// A cell that is a whole date in either day/month order. "Balance as of
// 01/31/2026" is not: the date has to be the entire cell.
const isDateLike = (cell: string): boolean =>
  parseDate(cell, 'MDY') !== null || parseDate(cell, 'DMY') !== null;

const hasDateCell = (record: FileRecord): boolean => record.cells.some(isDateLike);

// A line of column names: something filled in, and no cell that is a date or a number.
const isLabelRow = (cells: readonly string[]): boolean =>
  cells.some((c) => !isBlank(c)) &&
  cells.every((c) => isBlank(c) || (!isDateLike(c) && parseAmount(c) === null));

/** The cell count most records share. On a tie, the count seen first wins. */
function mostCommonWidth(records: readonly FileRecord[]): number {
  const counts = new Map<number, number>();
  for (const r of records) counts.set(r.cells.length, (counts.get(r.cells.length) ?? 0) + 1);
  let best = 0;
  let bestCount = 0;
  for (const [width, count] of counts) {
    if (count > bestCount) {
      best = width;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Whether a line can be the header of a table `width` cells wide. Cell counts
 * may differ only by a trailing comma: blank extra cells on the header line,
 * or blank extra cells on every data line.
 */
function headerFits(cells: readonly string[], width: number, tableRows: readonly FileRecord[]): boolean {
  if (cells.length === width) return true;
  if (cells.length > width) return cells.slice(width).every(isBlank);
  return cells.length >= 2 && tableRows.every((r) => r.cells.slice(cells.length).every(isBlank));
}

/** Makes a header key unique the way papaparse does: `amount`, `amount_1`, `amount_2`. */
function uniqueKey(key: string, taken: readonly string[]): string {
  if (!taken.includes(key)) return key;
  let n = 1;
  while (taken.includes(`${key}_${n}`)) n += 1;
  return `${key}_${n}`;
}

/**
 * Finds the transaction table inside a statement CSV.
 *
 * - A byte-order mark is stripped; quoted fields may contain commas and line
 *   breaks; fully blank lines are skipped (and still count toward row numbers).
 * - Lines above the table (Bank of America's summary block, an account
 *   banner) are returned in `preambleLines`, not as rows. The header is the
 *   line of column names, as wide as the table, directly above the first
 *   line with a date in it. Full-width lines with numbers but no date (a
 *   pending charge, an opening balance) may sit between the two: they stay
 *   in `rows` for applyMapping to reject by name.
 * - Every line from the first data line down is a row, whatever its width:
 *   a short line is padded with blanks and extra cells are ignored.
 * - A file with no header row (Wells Fargo) gets the keys `col_1..col_n` and
 *   `hasHeader: false`.
 * - Header keys go through normalizeHeader; a blank header cell becomes
 *   `col_<position>` and a repeated one gets a numeric suffix.
 *
 * papaparse runs without `header: true` because that mode assumes the header
 * is line 1; the header row is located and applied here instead.
 */
export function parseStatementCsv(text: string): StatementCsv {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    header: false,
    skipEmptyLines: false,
  });

  // An unclosed quote swallows every line after it into one cell, which would
  // otherwise look like a short statement with nothing wrong.
  const warnings: string[] = [];
  for (const error of parsed.errors) {
    if (error.type !== 'Quotes') continue;
    const where = typeof error.row === 'number' ? `Row ${error.row + 1}` : 'A row';
    const message =
      error.code === 'MissingQuotes'
        ? `${where} has a quotation mark that is never closed, so the rows after it may have been read wrong.`
        : `${where} has a quotation mark in an unexpected place. Check that it was read correctly.`;
    if (!warnings.includes(message)) warnings.push(message);
  }

  // Blank lines are dropped here rather than by papaparse so every record
  // keeps the row number a spreadsheet would show for it.
  const records: FileRecord[] = [];
  parsed.data.forEach((cells, index) => {
    if (!Array.isArray(cells) || cells.every((c) => isBlank(String(c)))) return;
    records.push({ rowNumber: index + 1, cells: cells.map((c) => String(c).trim()) });
  });
  if (records.length === 0) {
    return { headers: [], headerLabels: [], hasHeader: false, rows: [], preambleLines: [], warnings };
  }

  // The table's width is the width most dated lines share; summary lines above
  // the table rarely have a date cell and rarely have the same width.
  const dated = records.filter(hasDateCell);
  const width = dated.length > 0 ? mostCommonWidth(dated) : records[0].cells.length;
  const tableRows = dated.filter((r) => r.cells.length === width);

  let headerIndex = -1;
  let dataStart = 0;
  if (tableRows.length === 0) {
    // No date anywhere: nothing to go on, so treat line 1 as the header and
    // let applyMapping explain what is wrong with the rows.
    headerIndex = 0;
    dataStart = 1;
  } else {
    // Walk up from the first dated line. No header found means the file has none.
    dataStart = records.indexOf(tableRows[0]);
    for (let i = dataStart - 1; i >= 0; i--) {
      const record = records[i];
      if (isLabelRow(record.cells)) {
        if (headerFits(record.cells, width, tableRows)) headerIndex = i;
        break;
      }
      // Not column names. A full-width line with no date, or a dated line of
      // the wrong width (a stray comma in a description), is still a data
      // line: keep it, so it is rejected by name rather than dropped, and
      // keep looking above it. Anything else ends the table.
      if (record.cells.length !== width && !hasDateCell(record)) break;
      dataStart = i;
    }
  }

  const hasHeader = headerIndex >= 0;
  const headerCells = hasHeader ? records[headerIndex].cells : [];
  const columnCount = hasHeader ? Math.min(headerCells.length, width) : width;

  const headers: string[] = [];
  const headerLabels: string[] = [];
  for (let i = 0; i < columnCount; i++) {
    const label = headerCells[i] ?? '';
    const key = normalizeHeader(label);
    headerLabels.push(label || `Column ${i + 1}`);
    // "__proto__" can't be stored as an ordinary object key, so it gets a positional one.
    headers.push(uniqueKey(key && key !== '__proto__' ? key : `col_${i + 1}`, headers));
  }

  const rows: RawRow[] = records.slice(dataStart).map((record) => {
    const cells: Record<string, string> = {};
    headers.forEach((key, i) => {
      cells[key] = record.cells[i] ?? '';
    });
    return { rowNumber: record.rowNumber, cells };
  });

  const preambleLines = records
    .slice(0, hasHeader ? headerIndex : dataStart)
    .map((record) => record.cells.filter((c) => c !== '').join(', '));

  return { headers, headerLabels, hasHeader, rows, preambleLines, warnings };
}

// ── Guessing the column mapping ───────────────────────────────────────────

// Header names tried, in order, for a file no preset recognizes. The first
// name found wins, and a column is given to one role only. Roles are filled
// in this order, so a lone "Posting Date" becomes the date, not the post date.
const GENERIC_ALIASES: readonly (readonly [ColumnRole, readonly string[]])[] = [
  ['date', ['date', 'transaction date', 'trans. date', 'posting date', 'posted date', 'post date']],
  ['amount', ['amount', 'amount (usd)', 'gross']],
  ['debit', ['debit']],
  ['credit', ['credit']],
  ['description', ['description', 'transaction description', 'payee', 'name', 'memo']],
  ['merchant', ['merchant', 'vendor']],
  ['type', ['type']],
  ['category', ['category']],
  ['bankId', ['transaction id', 'reference']],
  ['status', ['status']],
  ['postDate', ['post date', 'posting date', 'posted date', 'clearing date']],
  ['memo', ['memo']],
];

const has = (object: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(object, key);

/** The text of one column in one row; "" when the row has no such column. */
function cellOf(row: RawRow, header: string | undefined): string {
  if (typeof header !== 'string' || !has(row.cells, header)) return '';
  const value = row.cells[header];
  return typeof value === 'string' ? value.trim() : '';
}

function matchPreset(headers: readonly string[], rows: readonly RawRow[]): BankPreset | null {
  let best: BankPreset | null = null;
  for (const preset of BANK_PRESETS) {
    if (!preset.headers.every((h) => headers.includes(h))) continue;
    if (preset.headerless && headers.length !== preset.headers.length) continue;
    if (preset.cellEquals) {
      const expected = Object.entries(preset.cellEquals);
      const matches =
        rows.length > 0 && rows.every((row) => expected.every(([h, text]) => cellOf(row, h) === text));
      if (!matches) continue;
    }
    if (!best || preset.headers.length > best.headers.length) best = preset;
  }
  return best;
}

function guessByAlias(headers: readonly string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  const used = new Set<string>();
  for (const [role, names] of GENERIC_ALIASES) {
    const found = names.map(normalizeHeader).find((key) => headers.includes(key) && !used.has(key));
    if (!found) continue;
    mapping[role] = found;
    used.add(found);
  }
  return mapping;
}

/**
 * For a file with no header row: guesses date, amount and description from
 * what the columns hold. The date is the first column of dates; the amount is
 * the first column of numbers, preferring one written with a decimal point or
 * a sign (a check-number column is also all numbers); the description is the
 * remaining column with the longest text.
 */
function guessByContent(headers: readonly string[], rows: readonly RawRow[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  let amountIsMoneyLike = false;
  let longestText = 1;
  for (const header of headers) {
    const values = rows.map((row) => cellOf(row, header)).filter((v) => v !== '');
    if (values.length === 0) continue;
    if (values.every(isDateLike)) {
      if (!mapping.date) mapping.date = header;
      continue;
    }
    if (values.every((v) => parseAmount(v) !== null)) {
      const moneyLike = values.some((v) => /[.()+\-\u2212$]/.test(v));
      if (!mapping.amount || (moneyLike && !amountIsMoneyLike)) {
        mapping.amount = header;
        amountIsMoneyLike = moneyLike;
      }
      continue;
    }
    const averageLength = values.reduce((sum, v) => sum + v.length, 0) / values.length;
    if (averageLength > longestText) {
      mapping.description = header;
      longestText = averageLength;
    }
  }
  return mapping;
}

/**
 * Guesses the sign convention of a file no preset recognizes.
 * - Debit and credit columns with no single amount column: split columns.
 * - A type column whose every sampled value reads as debit or credit: trust it.
 * - Otherwise the commoner sign is taken to be spending, since a statement
 *   usually has more purchases than deposits or payments.
 */
function guessSign(mapping: Partial<ColumnMapping>, rows: readonly RawRow[]): SignConvention {
  if (!mapping.amount) {
    return mapping.debit && mapping.credit ? 'split_columns' : 'negative_is_expense';
  }
  if (mapping.type) {
    const types = rows.map((row) => cellOf(row, mapping.type)).filter((t) => t !== '');
    if (types.length > 0 && types.every((t) => normalizeType(t) !== null)) return 'type_column';
  }
  let negative = 0;
  let positive = 0;
  for (const row of rows) {
    const cents = parseAmount(cellOf(row, mapping.amount));
    if (cents === null || cents === 0) continue;
    if (cents < 0) negative += 1;
    else positive += 1;
  }
  return positive > negative ? 'positive_is_expense' : 'negative_is_expense';
}

/**
 * Guesses which column is which, how the file signs its amounts, and its date
 * order, from the header keys and some sample rows (pass all of them or the
 * first few dozen; both are what parseStatementCsv returned).
 *
 * A known bank layout (BANK_PRESETS) is tried first, then header names any
 * export might use, then, for a file with no header, the contents of the
 * columns. The result is a default for the person to confirm: nothing here
 * is applied until the caller passes it to applyMapping, changed or not.
 */
export function detectMapping(headers: readonly string[], sampleRows: readonly RawRow[]): MappingGuess {
  const preset = matchPreset(headers, sampleRows);

  let mapping: Partial<ColumnMapping>;
  let sign: SignConvention;
  let confidence: MappingConfidence;
  if (preset) {
    // Some exports of the same layout leave optional columns out (the short
    // Amex file has no Reference or Category).
    mapping = {};
    for (const [role, header] of Object.entries(preset.mapping) as [ColumnRole, string][]) {
      if (headers.includes(header)) mapping[role] = header;
    }
    sign = preset.sign;
    confidence = 'high';
  } else {
    const headerless = headers.length > 0 && headers.every((h) => /^col_\d+$/.test(h));
    mapping = headerless ? guessByContent(headers, sampleRows) : guessByAlias(headers);
    sign = guessSign(mapping, sampleRows);
    const complete = Boolean(
      mapping.date && mapping.description && (mapping.amount || (mapping.debit && mapping.credit)),
    );
    confidence = complete && !headerless ? 'medium' : 'low';
  }

  const dateCells = mapping.date ? sampleRows.map((row) => cellOf(row, mapping.date)) : [];
  const { order, ambiguous } = detectDateOrder(dateCells);
  return {
    mapping,
    sign,
    dateOrder: order,
    dateOrderAmbiguous: ambiguous,
    preset: preset?.id ?? GENERIC_PRESET_ID,
    confidence,
  };
}

// ── Applying the mapping ──────────────────────────────────────────────────

const ALL_ROLES: readonly ColumnRole[] = [
  'date', 'description', 'amount', 'debit', 'credit', 'type',
  'postDate', 'merchant', 'memo', 'category', 'bankId', 'status',
];

const ORDER_WORDS: Record<DateOrder, string> = {
  MDY: 'month/day/year',
  DMY: 'day/month/year',
  YMD: 'year/month/day',
};

/** The roles a sign convention needs, on top of date and description. */
function moneyRoles(sign: SignConvention): ColumnRole[] {
  if (sign === 'split_columns') return ['debit', 'credit'];
  if (sign === 'type_column') return ['amount', 'type'];
  return ['amount'];
}

/**
 * Roles the mapping must name but doesn't, plus any role mapped to a column
 * the file doesn't have (a saved mapping used on a different bank's file).
 */
function findMissingColumns(
  rows: readonly RawRow[],
  mapping: Partial<ColumnMapping>,
  sign: SignConvention,
): string[] {
  const required: ColumnRole[] = ['date', 'description', ...moneyRoles(sign)];
  const firstRow = rows[0];
  return ALL_ROLES.filter((role) => {
    const header = mapping[role];
    if (typeof header !== 'string' || header === '') return required.includes(role);
    return firstRow !== undefined && !has(firstRow.cells, header);
  });
}

/** "blue bottle coffee" -> "Blue Bottle Coffee" */
function displayCase(text: string): string {
  return text
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function dateIssue(text: string, order: DateOrder): string {
  if (!text) return 'No date';
  const otherOrder: DateOrder = order === 'DMY' ? 'MDY' : 'DMY';
  if (parseDate(text, otherOrder) !== null) {
    return `Date "${text}" doesn't fit ${ORDER_WORDS[order]} order`;
  }
  return `Date "${text}" is not a real date`;
}

/**
 * Works out a row's direction and absolute cents under a sign convention.
 * Pushes the reason onto `issues` and returns null when it can't.
 */
function resolveMoney(
  cell: (role: ColumnRole) => string,
  sign: SignConvention,
  issues: string[],
): { amountCents: number; type: TransactionType } | null {
  if (sign === 'split_columns') {
    const debitText = cell('debit');
    const creditText = cell('credit');
    const debit = debitText ? parseAmount(debitText) : 0;
    const credit = creditText ? parseAmount(creditText) : 0;
    if (debit === null) issues.push(`Debit "${debitText}" is not a number`);
    if (credit === null) issues.push(`Credit "${creditText}" is not a number`);
    if (debit === null || credit === null) return null;
    if (debit !== 0 && credit !== 0) {
      issues.push('Both the debit and the credit column have an amount');
      return null;
    }
    if (debit === 0 && credit === 0) {
      issues.push(debitText || creditText ? 'Amount is zero' : 'No amount');
      return null;
    }
    // Some banks write credits as negative numbers (Citi), so only the column counts.
    return debit !== 0
      ? { amountCents: Math.abs(debit), type: 'expense' }
      : { amountCents: Math.abs(credit), type: 'income' };
  }

  const text = cell('amount');
  if (!text) {
    issues.push('No amount');
    return null;
  }
  const amount = readAmount(text);
  if (!amount) {
    issues.push(`Amount "${text}" is not a number`);
    return null;
  }
  if (amount.cents === 0) {
    issues.push('Amount is zero');
    return null;
  }
  const amountCents = Math.abs(amount.cents);

  if (sign === 'type_column') {
    const typeText = cell('type');
    const type = normalizeType(typeText);
    if (!type) {
      issues.push(
        typeText
          ? `Type "${typeText}" doesn't say whether money came in or went out`
          : 'No type, so it is unclear whether money came in or went out',
      );
      return null;
    }
    return { amountCents, type };
  }

  // "12.34 CR" is money in and "12.34 DR" money out whichever way the file signs amounts.
  if (amount.marker) return { amountCents, type: amount.marker === 'CR' ? 'income' : 'expense' };

  const expenseIsNegative = sign === 'negative_is_expense';
  const isNegative = amount.cents < 0;
  return { amountCents, type: isNegative === expenseIsNegative ? 'expense' : 'income' };
}

/**
 * Turns raw rows into transactions using a column mapping, a sign convention
 * and a date order (detectMapping's guess, or the person's corrections).
 *
 * - `type` and a positive `amountCents` come from the sign convention.
 * - `vendor` is the merchant column when one is mapped and filled, else the
 *   description run through normalizeMerchant and capitalized.
 * - `pending` is set when a status column is mapped: true when it says pending.
 *   Pending rows are returned like any other; the caller decides to skip them.
 * - `hints` holds transferHints(description).
 * - A row with a bad date, a zero or unreadable amount, or no description
 *   goes to `rejected` with its spreadsheet row number and every reason.
 *
 * When the mapping lacks a column the sign convention needs, or names a
 * column the file doesn't have, nothing is parsed and `missingColumns` lists
 * the roles.
 */
export function applyMapping(
  rows: readonly RawRow[],
  mapping: Partial<ColumnMapping>,
  sign: SignConvention,
  dateOrder: DateOrder,
): StatementParseResult {
  const missingColumns = findMissingColumns(rows, mapping, sign);
  if (missingColumns.length > 0) return { rows: [], rejected: [], missingColumns };

  const normalized: NormalizedRow[] = [];
  const rejected: RejectedRow[] = [];

  for (const raw of rows) {
    const cell = (role: ColumnRole): string => cellOf(raw, mapping[role]);
    const issues: string[] = [];

    const dateText = cell('date') || cell('postDate');
    const date = parseDate(dateText, dateOrder);
    if (!date) issues.push(dateIssue(dateText, dateOrder));

    const description = cell('description') || cell('memo');
    if (!description) issues.push('No description');

    const money = resolveMoney(cell, sign, issues);

    if (!date || !money || issues.length > 0) {
      rejected.push({ row: raw.rowNumber, reason: issues.join('; ') });
      continue;
    }

    const row: NormalizedRow = {
      rowNumber: raw.rowNumber,
      date,
      amountCents: money.amountCents,
      type: money.type,
      description,
      vendor: cell('merchant') || displayCase(normalizeMerchant(description)) || description,
      hints: transferHints(description),
      issues: [],
    };
    const bankId = cell('bankId');
    if (bankId) row.bankId = bankId;
    const categoryName = cell('category');
    if (categoryName) row.categoryName = categoryName;
    if (mapping.status) row.pending = /\bpending\b/i.test(cell('status'));
    normalized.push(row);
  }

  return { rows: normalized, rejected, missingColumns: [] };
}

// ── Dedupe keys ───────────────────────────────────────────────────────────

/**
 * Gives each row the key that makes importing the same statement twice a
 * no-op.
 * - A row with a bank ID gets `bank:<id>`.
 * - Any other row gets `hash:<date>|<amountCents>|<type>|<vendorKey(description)>|<n>`,
 *   where `<n>` counts rows with that same key from the top of the file (1, 2, ...).
 *   Two identical coffees on one day are both real, so they get |1 and |2,
 *   and the same file always produces the same keys.
 *
 * The count covers the rows passed in, so pass the same selection each time
 * (all rows, or all rows minus pending ones). Returns new objects; the input
 * is not changed.
 */
export function assignExternalIds<T extends NormalizedRow>(
  rows: readonly T[],
): (T & { externalId: string })[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    if (row.bankId) return { ...row, externalId: `bank:${row.bankId}` };
    const key = [row.date, row.amountCents, row.type, vendorKey(row.description)].join('|');
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return { ...row, externalId: `hash:${key}|${n}` };
  });
}
