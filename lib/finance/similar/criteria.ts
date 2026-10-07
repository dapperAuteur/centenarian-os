// lib/finance/similar/criteria.ts
// "Find similar": the details other transactions can be asked to share with
// one transaction (or with a search), how each one is checked, and how typed
// words are made safe for a PostgREST filter.
//
// The details, each one optional (a criterion that is left out is not checked):
//   vendor       the same normalized vendor (vendorKey: "WAL-MART #12" = "Walmart")
//   words        every word appears in the description or the vendor, any case
//   amount       the same amount, give or take amount_tolerance (the account's currency)
//   account_id   the same account; null = transactions with no account
//   category_id  the same category; null = uncategorized
//   type         expense or income
//   from / to    a date range, both ends included
//
// No '@/' imports: this file runs in API routes, in client components, and
// under `node --test --experimental-strip-types` (tests/unit/find-similar.test.ts).

import { vendorKey } from '../transaction-matching.ts';
import { isUuid } from '../../auth/ownership.ts';

export type SimilarTxType = 'expense' | 'income';

export interface SimilarCriteria {
  vendor?: string;
  words?: string[];
  amount?: number;
  amount_tolerance?: number;
  account_id?: string | null;
  category_id?: string | null;
  type?: SimilarTxType;
  from?: string;
  to?: string;
}

/** The columns rowMatches() reads. */
export interface SimilarRow {
  vendor: string | null;
  description: string | null;
  amount: number | string;
  type: string;
  account_id: string | null;
  category_id: string | null;
  transaction_date: string;
}

/** At most this many words are matched; more would only narrow the search to nothing. */
export const MAX_WORDS = 8;
/** A typed word longer than this is cut. */
export const MAX_WORD_LENGTH = 40;
/** A vendor name longer than this is refused. */
export const MAX_VENDOR_LENGTH = 200;
/** The largest amount tolerance accepted. */
export const MAX_TOLERANCE = 1_000_000;

// Words bank exports put around the merchant. Matching on them would find
// every card purchase, so a description's suggested words leave them out.
const BOILERPLATE = new Set([
  'ach', 'and', 'card', 'checkcard', 'credit', 'debit', 'des', 'online', 'payment', 'pos', 'pmt',
  'purchase', 'recurring', 'the', 'transaction', 'visa', 'mastercard', 'web', 'www', 'com', 'with',
  'from', 'for', 'auth', 'pending',
]);

// Splits on anything that is not a letter, a combining mark or a digit, in any script.
const WORD_SPLIT = /[^\p{L}\p{M}\p{N}]+/u;

/**
 * The words a person typed (or a list of words), split the way the matcher
 * splits them: lower-cased, cut at spaces and punctuation, one-letter pieces
 * dropped, duplicates dropped, at most MAX_WORDS. Because every word is only
 * letters and digits, none of PostgREST's or LIKE's special characters can
 * survive in it; escapeLike() and quoteFilterValue() still run on top.
 *
 *   "McDonald's #12"   -> ["mcdonald", "12"]
 *   "50%, off (sale)"  -> ["50", "off", "sale"]
 */
export function searchWords(input: string | readonly string[] | null | undefined): string[] {
  const text = Array.isArray(input) ? input.join(' ') : typeof input === 'string' ? input : '';
  const words: string[] = [];
  for (const piece of text.toLowerCase().split(WORD_SPLIT)) {
    const word = piece.slice(0, MAX_WORD_LENGTH);
    if (word.length < 2 || words.includes(word)) continue;
    words.push(word);
    if (words.length >= MAX_WORDS) break;
  }
  return words;
}

/**
 * The words of a description worth suggesting as a match: three letters or
 * more, no digits (store, card and reference numbers change from one
 * transaction to the next), none of the bank boilerplate above.
 *
 *   "POS PURCHASE CHIPOTLE 0876 AUSTIN TX" -> ["chipotle", "austin"]
 */
export function significantWords(description: string | null | undefined, max = 3): string[] {
  return searchWords(description ?? '')
    .filter((word) => word.length >= 3 && !/\d/.test(word) && !BOILERPLATE.has(word))
    .slice(0, max);
}

/**
 * Escapes a value for use inside a LIKE / ILIKE pattern, so it only matches
 * itself: backslash, % and _ get a backslash. PostgREST turns * into % in a
 * like pattern, so a * becomes _ (any one character), which still matches a *.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`).replace(/\*/g, '_');
}

/**
 * Wraps a value in double quotes for a PostgREST logic filter (`or=(...)`),
 * where , . : ( ) would otherwise end the value. Inside the quotes a backslash
 * and a double quote are escaped with a backslash.
 */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/[\\"]/g, (char) => `\\${char}`)}"`;
}

/**
 * The or() filter that matches `text` anywhere in any of `columns`, case
 * insensitive and safe for any text:
 *
 *   ilikeAnyColumn(['description', 'vendor'], 'a,b')
 *   -> description.ilike."%a,b%",vendor.ilike."%a,b%"
 */
export function ilikeAnyColumn(columns: readonly string[], text: string): string {
  const value = quoteFilterValue(`%${escapeLike(text)}%`);
  return columns.map((column) => `${column}.ilike.${value}`).join(',');
}

function toCents(value: number | string | null | undefined): number {
  const n = Math.abs(Number(value));
  return Number.isFinite(n) ? Math.round(n * 100) : Number.NaN;
}

/** The amount range a criterion accepts, in currency units. */
export function amountRange(criteria: SimilarCriteria): { min: number; max: number } | null {
  if (criteria.amount === undefined) return null;
  const cents = toCents(criteria.amount);
  const tolerance = toCents(criteria.amount_tolerance ?? 0);
  return { min: Math.max(0, cents - tolerance) / 100, max: (cents + tolerance) / 100 };
}

/** The part of a PostgREST query builder applySimilarFilters() uses. */
export interface SimilarFilterable<Q> {
  eq(column: string, value: unknown): Q;
  is(column: string, value: null): Q;
  gte(column: string, value: string | number): Q;
  lte(column: string, value: string | number): Q;
  or(filters: string): Q;
  not(column: string, operator: string, value: unknown): Q;
}

/**
 * Narrows a financial_transactions query by every criterion the database can
 * check. The vendor check needs vendorKey(), which only runs here, so the
 * query only keeps rows that have a vendor and rowMatches() decides the rest.
 * Each word is its own or() (description or vendor), and PostgREST ANDs them.
 */
export function applySimilarFilters<Q extends SimilarFilterable<Q>>(query: Q, criteria: SimilarCriteria): Q {
  let q = query;
  if (criteria.type) q = q.eq('type', criteria.type);
  if (criteria.account_id !== undefined) {
    q = criteria.account_id === null ? q.is('account_id', null) : q.eq('account_id', criteria.account_id);
  }
  if (criteria.category_id !== undefined) {
    q = criteria.category_id === null ? q.is('category_id', null) : q.eq('category_id', criteria.category_id);
  }
  const range = amountRange(criteria);
  if (range) q = q.gte('amount', range.min).lte('amount', range.max);
  if (criteria.from) q = q.gte('transaction_date', criteria.from);
  if (criteria.to) q = q.lte('transaction_date', criteria.to);
  for (const word of criteria.words ?? []) q = q.or(ilikeAnyColumn(['description', 'vendor'], word));
  if (criteria.vendor !== undefined) q = q.not('vendor', 'is', null);
  return q;
}

/**
 * The whole rule in one function: does this row share every chosen detail?
 * The server runs it on every row the query returned, so a criterion the
 * database could not check (the vendor) or did not apply is still enforced.
 */
export function rowMatches(row: SimilarRow, criteria: SimilarCriteria): boolean {
  if (criteria.vendor !== undefined) {
    const key = vendorKey(criteria.vendor);
    if (!key || vendorKey(row.vendor) !== key) return false;
  }
  if (criteria.words && criteria.words.length > 0) {
    const description = (row.description ?? '').toLowerCase();
    const vendor = (row.vendor ?? '').toLowerCase();
    for (const word of criteria.words) {
      if (!description.includes(word) && !vendor.includes(word)) return false;
    }
  }
  const range = amountRange(criteria);
  if (range) {
    const cents = toCents(row.amount);
    if (!(cents >= Math.round(range.min * 100) && cents <= Math.round(range.max * 100))) return false;
  }
  if (criteria.account_id !== undefined && (row.account_id ?? null) !== criteria.account_id) return false;
  if (criteria.category_id !== undefined && (row.category_id ?? null) !== criteria.category_id) return false;
  if (criteria.type && row.type !== criteria.type) return false;
  const date = String(row.transaction_date ?? '').slice(0, 10);
  if (criteria.from && date < criteria.from) return false;
  if (criteria.to && date > criteria.to) return false;
  return true;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function optionalId(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null) return { ok: true, value: null };
  if (isUuid(value)) return { ok: true, value: value.toLowerCase() };
  return { ok: false };
}

export type ParsedCriteria = { ok: true; criteria: SimilarCriteria } | { ok: false; error: string };

/**
 * Reads the criteria a request sent. Anything malformed is refused with a
 * message a person can act on; a criterion that is absent is not checked.
 * At least one criterion is required.
 */
export function parseCriteria(input: unknown): ParsedCriteria {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Choose at least one detail to match.' };
  }
  const body = input as Record<string, unknown>;
  const criteria: SimilarCriteria = {};

  if (body.vendor !== undefined) {
    if (typeof body.vendor !== 'string' || body.vendor.length > MAX_VENDOR_LENGTH) {
      return { ok: false, error: 'The vendor name is not valid.' };
    }
    if (!vendorKey(body.vendor)) return { ok: false, error: 'The vendor name has no letters or digits to match on.' };
    criteria.vendor = body.vendor.trim();
  }

  if (body.words !== undefined) {
    const raw = body.words;
    if (typeof raw !== 'string' && !(Array.isArray(raw) && raw.every((w) => typeof w === 'string'))) {
      return { ok: false, error: 'The words to match are not valid.' };
    }
    const words = searchWords(raw as string | string[]);
    if (words.length === 0) return { ok: false, error: 'Type at least one word of two or more letters to match.' };
    criteria.words = words;
  }

  if (body.amount !== undefined) {
    const numeric = (value: unknown) => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : Number.NaN);
    const amount = Math.abs(numeric(body.amount));
    if (!Number.isFinite(amount)) return { ok: false, error: 'The amount to match is not a number.' };
    const tolerance = body.amount_tolerance === undefined || body.amount_tolerance === '' ? 0 : numeric(body.amount_tolerance);
    if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > MAX_TOLERANCE) {
      return { ok: false, error: 'The amount tolerance must be zero or more.' };
    }
    criteria.amount = amount;
    criteria.amount_tolerance = tolerance;
  }

  for (const field of ['account_id', 'category_id'] as const) {
    if (body[field] === undefined) continue;
    const id = optionalId(body[field]);
    if (!id.ok) return { ok: false, error: `${field === 'account_id' ? 'The account' : 'The category'} to match is not valid.` };
    criteria[field] = id.value;
  }

  if (body.type !== undefined) {
    if (body.type !== 'expense' && body.type !== 'income') return { ok: false, error: 'The type must be expense or income.' };
    criteria.type = body.type;
  }

  for (const field of ['from', 'to'] as const) {
    if (body[field] === undefined || body[field] === '') continue;
    if (!isDate(body[field])) return { ok: false, error: 'Dates must be written YYYY-MM-DD.' };
    criteria[field] = body[field] as string;
  }
  if (criteria.from && criteria.to && criteria.from > criteria.to) {
    return { ok: false, error: 'The start date is after the end date.' };
  }

  if (Object.keys(criteria).length === 0) return { ok: false, error: 'Choose at least one detail to match.' };
  return { ok: true, criteria };
}

// ─── The form ─────────────────────────────────────────────────────────────────

/** The details the panel shows, each with its value and whether it must match. */
export interface SimilarForm {
  vendor: { on: boolean; value: string };
  words: { on: boolean; value: string };
  amount: { on: boolean; value: string; tolerance: string };
  account: { on: boolean; value: string };
  category: { on: boolean; value: string };
  type: { on: boolean; value: SimilarTxType };
  dates: { on: boolean; from: string; to: string };
}

/** The transaction "Find similar" starts from. */
export interface SimilarSeedTx {
  vendor: string | null;
  description: string | null;
  amount: number | string;
  type: string;
  account_id: string | null;
  category_id: string | null;
  transaction_date: string;
}

/** The value the account and category pickers use for "none". */
export const NONE = '__none__';

/**
 * The starting form for one transaction: its vendor (or, with no vendor, the
 * telling words of its description) and its type are ticked; amount,
 * account, category and the dates (its calendar year) are filled in but not
 * ticked.
 */
export function formFromTransaction(tx: SimilarSeedTx): SimilarForm {
  const hasVendor = Boolean(vendorKey(tx.vendor));
  const words = significantWords(tx.description);
  const year = String(tx.transaction_date ?? '').slice(0, 4);
  const amount = Math.abs(Number(tx.amount));
  return {
    vendor: { on: hasVendor, value: (tx.vendor ?? '').trim() },
    words: { on: !hasVendor && words.length > 0, value: words.join(' ') },
    amount: { on: false, value: Number.isFinite(amount) ? amount.toFixed(2) : '', tolerance: '0' },
    account: { on: false, value: tx.account_id ?? NONE },
    category: { on: false, value: tx.category_id ?? NONE },
    type: { on: true, value: tx.type === 'income' ? 'income' : 'expense' },
    dates: { on: false, from: /^\d{4}$/.test(year) ? `${year}-01-01` : '', to: /^\d{4}$/.test(year) ? `${year}-12-31` : '' },
  };
}

/** The starting form for a search: its words, nothing else. */
export function formFromSearch(text: string): SimilarForm {
  return {
    vendor: { on: false, value: '' },
    words: { on: true, value: searchWords(text).join(' ') },
    amount: { on: false, value: '', tolerance: '0' },
    account: { on: false, value: NONE },
    category: { on: false, value: NONE },
    type: { on: false, value: 'expense' },
    dates: { on: false, from: '', to: '' },
  };
}

/** The request body for the ticked details (parseCriteria() checks it again on the server). */
export function criteriaFromForm(form: SimilarForm): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (form.vendor.on) out.vendor = form.vendor.value;
  if (form.words.on) out.words = form.words.value;
  if (form.amount.on) {
    out.amount = form.amount.value;
    out.amount_tolerance = form.amount.tolerance;
  }
  if (form.account.on) out.account_id = form.account.value === NONE ? null : form.account.value;
  if (form.category.on) out.category_id = form.category.value === NONE ? null : form.category.value;
  if (form.type.on) out.type = form.type.value;
  if (form.dates.on) {
    if (form.dates.from) out.from = form.dates.from;
    if (form.dates.to) out.to = form.dates.to;
  }
  return out;
}
