// lib/finance/pdf-import/lines.ts
// Pure helpers shared by the PDF statement parsers: grouping positioned text
// into lines, and reading money and dates the way statements print them.
// No pdfjs here, so the parsers and tests never load it.
//
// Relative imports end in `.ts` so tests/unit/pdf-import.test.ts can load this
// file under `node --test --experimental-strip-types`.

import type { PdfLine, PdfPageText, TextItem } from './types.ts';

/** Items whose baselines are this close (in points) share a line. */
export const LINE_TOLERANCE = 2;

/**
 * Groups each page's text items into lines: items whose baselines are within
 * LINE_TOLERANCE points share a line, lines run top to bottom, and items in a
 * line run left to right. Blank items are dropped.
 */
export function groupIntoLines(pages: readonly PdfPageText[]): PdfLine[] {
  const lines: PdfLine[] = [];
  for (const { page, items } of pages) {
    const rows: { y: number; items: TextItem[] }[] = [];
    // Highest first, so each row's y is the first item seen at that height.
    const sorted = items
      .filter((item) => item.str.trim() !== '')
      .sort((a, b) => b.y - a.y || a.x - b.x);
    for (const item of sorted) {
      const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= LINE_TOLERANCE);
      if (row) row.items.push(item);
      else rows.push({ y: item.y, items: [item] });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      const ordered = row.items
        .map((item) => ({ ...item, str: item.str.replace(/\s+/g, ' ').trim() }))
        .sort((a, b) => a.x - b.x);
      lines.push({ page, y: row.y, items: ordered, text: ordered.map((item) => item.str).join(' ') });
    }
  }
  return lines;
}

/**
 * A printed amount as integer cents, keeping its sign: `$1,234.56` -> 123456,
 * `-$40.00`, `40.00-`, `($40.00)` and `40.00 CR` -> -4000, `+$0.00` -> 0.
 * Null when the text is not an amount.
 */
export function parseMoneyCents(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  let text = raw.trim().replace(/\s+/g, '');
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (/CR$/i.test(text)) {
    negative = true;
    text = text.slice(0, -2);
  }
  if (text.endsWith('-')) {
    negative = true;
    text = text.slice(0, -1);
  }
  if (text.startsWith('+')) text = text.slice(1);
  if (text.startsWith('-')) {
    negative = true;
    text = text.slice(1);
  }
  text = text.replace(/^\$/, '');
  if (text.startsWith('-')) {
    negative = true;
    text = text.slice(1);
  }
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}$/.test(text)) return null;
  const cents = Math.round(Number(text.replace(/,/g, '')) * 100);
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** YYYY-MM-DD when the parts make a real calendar date, else null. */
export function isoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const fullYear = (year: number): number => (year < 100 ? 2000 + year : year);

/** `01/27/2026` or `01/27/26` -> 2026-01-27. Null otherwise. */
export function parseSlashDate(raw: string | null | undefined): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec((raw ?? '').trim());
  if (!match) return null;
  return isoDate(fullYear(Number(match[3])), Number(match[1]), Number(match[2]));
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** `February 21, 2026` or `Feb 21, 2026` -> 2026-02-21. Null otherwise. */
export function parseLongDate(raw: string | null | undefined): string | null {
  const match = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec((raw ?? '').trim());
  if (!match) return null;
  const name = match[1].toLowerCase();
  const month = MONTHS.findIndex((candidate) => candidate === name || candidate.slice(0, 3) === name.slice(0, 3));
  if (month < 0) return null;
  return isoDate(Number(match[3]), month + 1, Number(match[2]));
}

/** Either date form. */
export function parseAnyDate(raw: string | null | undefined): string | null {
  return parseSlashDate(raw) ?? parseLongDate(raw);
}

/** Adds days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * A month/day with no year (`12/29`) placed in a statement period. The year
 * is the period end's year, or the year before when that would put the date
 * well after the period end (a December row on a January statement). Without
 * a period end, null.
 */
export function placeMonthDay(raw: string, periodEnd: string | null): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(raw.trim());
  if (!match || !periodEnd) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const endYear = Number(periodEnd.slice(0, 4));
  const sameYear = isoDate(endYear, month, day);
  // Rows can post a few days after the closing date on some statements; more than a month later means last year.
  if (sameYear && sameYear <= addDays(periodEnd, 31)) return sameYear;
  return isoDate(endYear - 1, month, day);
}

/** Title Case for an ALL CAPS description, so vendors read naturally. Mixed case is kept. */
export function displayVendor(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  if (text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}
