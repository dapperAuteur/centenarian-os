// lib/finance/vendor-match.ts
// Pure helpers for comparing merchant names: matching a synced bank transaction
// to a manual or scanned entry, and looking up a vendor's learned category.
//
// No imports on purpose. This file runs in API routes, in client components,
// and under `node --test --experimental-strip-types` (tests/vendor-match.test.ts).

/** A bank transaction and a manual entry match when their dates are this many days apart or fewer. */
export const MATCH_WINDOW_DAYS = 5;

/** A bank transaction and a manual entry match when their amounts differ by this much or less. */
export const MATCH_AMOUNT_TOLERANCE = 0.01;

/**
 * A substring comparison only counts when the shorter name has at least this
 * many characters, so a one- or two-letter vendor can't match every merchant.
 * Identical names always count.
 */
export const MIN_PARTIAL_MATCH_LENGTH = 3;

// Payment-processor tags some banks put in front of the merchant name,
// written with an asterisk: "SQ *BLUE BOTTLE", "TST* CHIPOTLE", "PAYPAL *ETSY".
const PROCESSOR_PREFIX = /^\s*(?:sq|tst|paypal)\s*\*\s*/;

// "#1234", "# 12"
const HASH_NUMBER = /#\s*\d+/g;

// "store 123", "str 12", "no. 45", "unit 3", "loc 9"
const LABELED_STORE_NUMBER = /\b(?:store|str|no|num|unit|loc|location)\.?\s*\d+\b/g;

// ASCII punctuation and symbols, Latin-1 punctuation, and the common Unicode
// dashes, quotes, bullets, and ellipsis. Letters in any script are kept.
const PUNCTUATION = /[!-/:-@[-`{-~¡-¿×÷‐-‧‰-⁞]/g;

// A standalone run of three or more digits: a store or terminal number.
const LONG_NUMBER = /\b\d{3,}\b/g;

/**
 * Normalizes a merchant or vendor string for comparison: lowercase, accents
 * removed, a leading processor tag ("SQ *") removed, store numbers removed,
 * punctuation turned into spaces, whitespace collapsed.
 *
 *   "CHIPOTLE #1234"          -> "chipotle"
 *   "Starbucks Store 12345"   -> "starbucks"
 *   "McDonald's"              -> "mcdonalds"
 *   "TST* Chipotle 0876"      -> "chipotle"
 *   "7-Eleven"                -> "7 eleven"
 *
 * Returns "" when nothing meaningful is left.
 */
export function normalizeMerchant(input: string | null | undefined): string {
  if (!input) return '';
  let s = input.toLowerCase();
  // Split accented letters into letter + combining mark, then drop the marks.
  s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  s = s.replace(PROCESSOR_PREFIX, '');
  // Apostrophes join words ("mcdonald's" -> "mcdonalds") instead of splitting them.
  s = s.replace(/['‘’`]/g, '');
  s = s.replace(HASH_NUMBER, ' ');
  s = s.replace(LABELED_STORE_NUMBER, ' ');
  s = s.replace(PUNCTUATION, ' ');
  s = s.replace(LONG_NUMBER, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * The comparison key for a vendor: the normalized name with spaces removed, so
 * "WAL-MART #12" and "Walmart" share the key "walmart". Returns "" when the
 * name is empty after normalizing.
 */
export function vendorKey(input: string | null | undefined): string {
  return normalizeMerchant(input).replace(/\s+/g, '');
}

/**
 * Compares two names by their vendor keys.
 * - "exact": the keys are identical.
 * - "partial": one key contains the other, and the shorter one has at least
 *   MIN_PARTIAL_MATCH_LENGTH characters.
 * - null: no match, or either name is empty after normalizing.
 */
export function compareNames(
  a: string | null | undefined,
  b: string | null | undefined,
): 'exact' | 'partial' | null {
  const ka = vendorKey(a);
  const kb = vendorKey(b);
  if (!ka || !kb) return null;
  if (ka === kb) return 'exact';
  const [shorter, longer] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  if (shorter.length >= MIN_PARTIAL_MATCH_LENGTH && longer.includes(shorter)) return 'partial';
  return null;
}

/** Whole days between two YYYY-MM-DD dates (always zero or positive). */
export function daysBetween(a: string, b: string): number {
  const ta = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const tb = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.POSITIVE_INFINITY;
  return Math.round(Math.abs(ta - tb) / 86_400_000);
}

/** Shifts a YYYY-MM-DD date by a number of days (negative goes back). */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A manual or scanned transaction that has not been linked to a bank transaction yet. */
export interface ManualCandidate {
  id: string;
  amount: number | string;
  transaction_date: string;
  vendor: string | null;
  description: string | null;
  account_id: string | null;
}

/** The fields of a synced bank transaction that matching looks at. */
export interface BankTransactionForMatch {
  /** Absolute amount. */
  amount: number;
  /** YYYY-MM-DD. */
  date: string;
  /** Counterparty or merchant name, when the bank provides one. */
  merchant: string | null;
  /** The bank's raw description. */
  description: string | null;
  /** The app's financial_accounts.id the bank transaction belongs to. */
  accountId: string;
}

export interface MatchScore {
  dateDistance: number;
  exactName: boolean;
  sameAccount: boolean;
}

/**
 * Scores a manual entry against a bank transaction, or returns null when they
 * can't be the same purchase. A match needs all of:
 * - the entry has no account, or the same account as the bank transaction;
 * - amounts within MATCH_AMOUNT_TOLERANCE;
 * - dates within MATCH_WINDOW_DAYS;
 * - the entry's vendor or description matches the bank's merchant name or
 *   description (see compareNames). An entry with neither never matches.
 */
export function scoreCandidate(
  bank: BankTransactionForMatch,
  candidate: ManualCandidate,
): MatchScore | null {
  if (candidate.account_id && candidate.account_id !== bank.accountId) return null;

  const amount = Math.abs(Number(candidate.amount));
  if (!Number.isFinite(amount)) return null;
  // Compare in cents so float error can't push a one-cent difference over the line.
  const centsApart = Math.abs(Math.round(amount * 100) - Math.round(Math.abs(bank.amount) * 100));
  if (centsApart > Math.round(MATCH_AMOUNT_TOLERANCE * 100)) return null;

  const dateDistance = daysBetween(bank.date, candidate.transaction_date);
  if (dateDistance > MATCH_WINDOW_DAYS) return null;

  const entryNames = [candidate.vendor, candidate.description].filter((n) => vendorKey(n));
  const bankNames = [bank.merchant, bank.description].filter((n) => vendorKey(n));
  if (entryNames.length === 0 || bankNames.length === 0) return null;

  let matched = false;
  let exactName = false;
  for (const e of entryNames) {
    for (const b of bankNames) {
      const result = compareNames(e, b);
      if (result) matched = true;
      if (result === 'exact') exactName = true;
    }
  }
  if (!matched) return null;

  return { dateDistance, exactName, sameAccount: candidate.account_id === bank.accountId };
}

/**
 * Picks the manual entry a bank transaction should link to, or null. Among
 * entries that match (see scoreCandidate), prefers the closest date, then an
 * exact name match, then an entry already on the same account. Entries whose
 * id is in `claimed` are skipped, so two bank transactions in one sync can't
 * link to the same entry.
 */
export function findBestMatch<T extends ManualCandidate>(
  bank: BankTransactionForMatch,
  candidates: readonly T[],
  claimed?: ReadonlySet<string>,
): T | null {
  let best: { candidate: T; score: MatchScore } | null = null;
  for (const candidate of candidates) {
    if (claimed?.has(candidate.id)) continue;
    const score = scoreCandidate(bank, candidate);
    if (!score) continue;
    if (!best || isBetter(score, best.score)) best = { candidate, score };
  }
  return best?.candidate ?? null;
}

function isBetter(a: MatchScore, b: MatchScore): boolean {
  if (a.dateDistance !== b.dateDistance) return a.dateDistance < b.dateDistance;
  if (a.exactName !== b.exactName) return a.exactName;
  if (a.sameAccount !== b.sameAccount) return a.sameAccount;
  return false;
}

// ── Learned vendor categories ─────────────────────────────────────────────

export type LearnableTransactionType = 'expense' | 'income';

/**
 * The saved-contact type that holds a transaction's learned category: vendors
 * for expenses, customers (payers) for income. Matches the contact type the
 * Add Transaction form's autocomplete uses.
 */
export function contactTypeForTransaction(type: string | null | undefined): 'vendor' | 'customer' {
  return type === 'income' ? 'customer' : 'vendor';
}

export interface LearnedCategoryContact {
  name: string;
  contact_type: string;
  default_category_id: string | null;
  use_count?: number | null;
}

export interface LearnedCategoryIndex {
  vendor: Map<string, string>;
  customer: Map<string, string>;
}

/**
 * Builds a vendor-key -> category lookup from saved contacts that have a
 * default category. When two contacts share a key (for example "Chipotle" and
 * "CHIPOTLE #12"), the one used more often wins.
 */
export function buildLearnedCategoryIndex(
  contacts: readonly LearnedCategoryContact[],
): LearnedCategoryIndex {
  const index: LearnedCategoryIndex = { vendor: new Map(), customer: new Map() };
  const sorted = [...contacts].sort((a, b) => (b.use_count ?? 0) - (a.use_count ?? 0));
  for (const c of sorted) {
    if (!c.default_category_id) continue;
    if (c.contact_type !== 'vendor' && c.contact_type !== 'customer') continue;
    const key = vendorKey(c.name);
    if (!key) continue;
    const map = index[c.contact_type];
    if (!map.has(key)) map.set(key, c.default_category_id);
  }
  return index;
}

/** The learned category for a vendor on a transaction of this type, or null. */
export function lookupLearnedCategory(
  index: LearnedCategoryIndex,
  vendor: string | null | undefined,
  type: string | null | undefined,
): string | null {
  const key = vendorKey(vendor);
  if (!key) return null;
  return index[contactTypeForTransaction(type)].get(key) ?? null;
}
