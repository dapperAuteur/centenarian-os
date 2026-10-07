// lib/finance/review/sections.ts
// What the finance Review page lists, worked out from saved transactions.
// Pure functions: no database, no network. lib/finance/review/server.ts does
// the reads and hands the rows here. Tested in tests/unit/finance-review.test.ts.
//
// The sections:
//   transfers      two rows that look like the two sides of one transfer
//                  between the person's own accounts (the transfer detector,
//                  lib/finance/transfers/detect.ts, unchanged)
//   payments       a card or loan payment whose other side isn't linked:
//                  - on the card or loan: money in with payment wording and no
//                    "Paid from" account
//                  - on a bank account: money out to a card or loan with no
//                    matching row there (the detector's one-sided payments)
//   matches        an imported row and an entry the person typed or scanned
//                  that look like the same purchase but were never linked
//                  (the importer's own matching rule, findBestMatch)
//   uncategorized  counted and paged by the database (server.ts)
//
// A suggestion the person turned down (finance_review_dismissals, migration
// 219) is left out. Its key is dismissalKey(section, transaction, other).
//
// Relative imports end in `.ts` for `node --test --experimental-strip-types`.

import { transferHints } from '../csv-import/parse.ts';
import { LINKABLE_SOURCES } from '../csv-import/plan.ts';
import { suggestTransferPairs, type DetectRow, type TransferSuggestions } from '../transfers/detect.ts';
import { accountClass, accountLabel, kindForDestination, toCents, type TransferKind } from '../transfers/pairing.ts';
import { daysBetween, scoreCandidate, type ManualCandidate } from '../transaction-matching.ts';

export type DismissalSection = 'transfer_pair' | 'one_sided_payment' | 'possible_match';

export const DISMISSAL_SECTIONS: readonly DismissalSection[] = ['transfer_pair', 'one_sided_payment', 'possible_match'];

export type ReviewSectionName = 'transfers' | 'payments' | 'matches' | 'uncategorized';

export const REVIEW_SECTIONS: readonly ReviewSectionName[] = ['transfers', 'payments', 'matches', 'uncategorized'];

/** A transaction as the review reads it. */
export interface ReviewTxn {
  id: string;
  account_id: string | null;
  transaction_date: string;
  amount: number | string;
  type: 'expense' | 'income';
  description: string | null;
  vendor: string | null;
  source: string | null;
  external_id: string | null;
  import_batch_id: string | null;
  category_id: string | null;
}

export interface ReviewAccount {
  id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  last_four: string | null;
  is_active?: boolean | null;
}

/** A transaction as the page shows it. */
export interface TxnView {
  id: string;
  date: string;
  /** Dollars, positive; `type` carries the direction. */
  amount: number;
  type: 'expense' | 'income';
  description: string | null;
  vendor: string | null;
  account_id: string | null;
  account_label: string;
  account_type: string | null;
  source: string | null;
  import_batch_id: string | null;
}

export interface TransferPairItem {
  key: string;
  from: TxnView;
  to: TxnView;
  kind: TransferKind;
  confidence: 'high' | 'low';
  days_apart: number;
  reasons: string[];
}

export interface PaymentItem {
  key: string;
  transaction: TxnView;
  /**
   * 'paid_from': a payment on a card or loan; choose the account it was paid from.
   * 'paid_to':   money out of a bank account to a card or loan; choose which one.
   */
  side: 'paid_from' | 'paid_to';
  kind: TransferKind;
  /** The account to offer first, when one can be worked out. */
  suggested_account_id: string | null;
  reasons: string[];
}

export interface MatchItem {
  key: string;
  /** The row a statement import added. */
  imported: TxnView;
  /** The entry the person typed or scanned. */
  entry: TxnView;
  days_apart: number;
  exact_name: boolean;
  reasons: string[];
}

/** The key a dismissal is stored and looked up by. */
export function dismissalKey(section: DismissalSection, transactionId: string, otherId?: string | null): string {
  return `${section}|${transactionId.toLowerCase()}|${(otherId ?? '').toLowerCase()}`;
}

export function isDismissalSection(value: unknown): value is DismissalSection {
  return typeof value === 'string' && (DISMISSAL_SECTIONS as readonly string[]).includes(value);
}

/**
 * The Possible transfers panel's own keys ("pair:<from>:<to>", "one:<id>"),
 * which it kept in localStorage before migration 219, as a dismissal. Null for
 * anything else.
 */
export function panelKeyToDismissal(
  key: string,
): { section: DismissalSection; transaction_id: string; other_transaction_id: string | null } | null {
  const pair = /^pair:([0-9a-f-]{36}):([0-9a-f-]{36})$/i.exec(key);
  if (pair) return { section: 'transfer_pair', transaction_id: pair[1], other_transaction_id: pair[2] };
  const one = /^one:([0-9a-f-]{36})$/i.exec(key);
  if (one) return { section: 'one_sided_payment', transaction_id: one[1], other_transaction_id: null };
  return null;
}

/** A dismissal as the panel's key ("pair:<from>:<to>" / "one:<id>"); null for a section the panel doesn't show. */
export function dismissalToPanelKey(item: {
  section: string;
  transaction_id: string;
  other_transaction_id: string | null;
}): string | null {
  if (item.section === 'transfer_pair' && item.other_transaction_id) {
    return `pair:${item.transaction_id}:${item.other_transaction_id}`;
  }
  if (item.section === 'one_sided_payment') return `one:${item.transaction_id}`;
  return null;
}

export function viewTxn(row: ReviewTxn, accountsById: ReadonlyMap<string, ReviewAccount>): TxnView {
  const account = row.account_id ? accountsById.get(row.account_id) : undefined;
  return {
    id: row.id,
    date: row.transaction_date,
    amount: toCents(row.amount) / 100,
    type: row.type,
    description: row.description,
    vendor: row.vendor,
    account_id: row.account_id,
    account_label: account ? accountLabel(account) : row.account_id ? 'an account that was removed' : 'No account',
    account_type: account?.account_type ?? null,
    source: row.source,
    import_batch_id: row.import_batch_id,
  };
}

export function toDetectRow(row: ReviewTxn): DetectRow {
  return {
    id: row.id,
    account_id: row.account_id,
    date: row.transaction_date,
    amountCents: toCents(row.amount),
    type: row.type,
    description: row.description,
    vendor: row.vendor,
  };
}

const newestFirst = (a: { date: string; id: string }, b: { date: string; id: string }): number =>
  b.date.localeCompare(a.date) || a.id.localeCompare(b.id);

/** Runs the transfer detector over the rows (unchanged rules: see lib/finance/transfers/detect.ts). */
export function detectTransfers(rows: readonly ReviewTxn[], accounts: readonly ReviewAccount[]): TransferSuggestions {
  return suggestTransferPairs(rows.map(toDetectRow), accounts);
}

/**
 * Suggested transfer pairs, minus the dismissed ones. `inWindow` keeps a pair
 * when either side is in the date range the page asked for (rows a few days
 * either side are loaded so a pair across the edge is still found).
 */
export function buildTransferSection(
  rows: readonly ReviewTxn[],
  accounts: readonly ReviewAccount[],
  suggestions: TransferSuggestions,
  dismissed: ReadonlySet<string>,
  inWindow: (row: ReviewTxn) => boolean = () => true,
): TransferPairItem[] {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const items: TransferPairItem[] = [];
  for (const pair of suggestions.pairs) {
    const from = rowsById.get(pair.fromId);
    const to = rowsById.get(pair.toId);
    if (!from || !to) continue;
    if (!inWindow(from) && !inWindow(to)) continue;
    if (dismissed.has(dismissalKey('transfer_pair', pair.fromId, pair.toId))) continue;
    items.push({
      key: dismissalKey('transfer_pair', pair.fromId, pair.toId),
      from: viewTxn(from, accountsById),
      to: viewTxn(to, accountsById),
      kind: pair.kind,
      confidence: pair.confidence,
      days_apart: pair.daysApart,
      reasons: pair.reasons,
    });
  }
  return items;
}

// Money in on a card or loan is a payment or a refund. These say payment...
const PAYMENT_WORDS = /\b(?:payment|pymt|pmt|autopay|auto pay|epay|e payment|thank you)\b/;
// ...and these say it is money back, not a payment.
const MONEY_BACK_WORDS =
  /\b(?:refund|return|returned|reversal|reversed|adjustment|adj|cashback|cash back|reward|rewards|dispute|statement credit|merchandise credit)\b/;

/** True when a row's wording reads like a payment, not a refund or credit. Pure. */
export function looksLikePayment(description: string | null | undefined, vendor?: string | null): boolean {
  const raw = `${description ?? ''} ${vendor ?? ''}`.trim();
  const text = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!text || MONEY_BACK_WORDS.test(text)) return false;
  if (PAYMENT_WORDS.test(text)) return true;
  return transferHints(raw).some((hint) => hint === 'card_payment' || hint === 'loan_payment' || hint === 'transfer');
}

/**
 * Card and loan payments with no other side:
 *   - money in on a card or loan (not one the transfer feature recorded), whose
 *     wording reads like a payment, that isn't already part of a suggested pair;
 *   - the detector's one-sided payments: money out of a bank account whose
 *     wording says card or loan payment, with no matching row anywhere.
 * `paidFromDefaults` maps a card or loan to the account its payments usually
 * come from (worked out from history by the server).
 */
export function buildPaymentSection(
  rows: readonly ReviewTxn[],
  accounts: readonly ReviewAccount[],
  suggestions: TransferSuggestions,
  dismissed: ReadonlySet<string>,
  options: { paidFromDefaults?: ReadonlyMap<string, string | null>; inWindow?: (row: ReviewTxn) => boolean } = {},
): PaymentItem[] {
  const inWindow = options.inWindow ?? (() => true);
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const paired = new Set<string>();
  for (const pair of suggestions.pairs) {
    paired.add(pair.fromId);
    paired.add(pair.toId);
  }

  const items: PaymentItem[] = [];
  for (const row of rows) {
    if (row.type !== 'income' || row.source === 'transfer' || paired.has(row.id)) continue;
    const account = row.account_id ? accountsById.get(row.account_id) : undefined;
    if (!account || accountClass(account.account_type) !== 'debt') continue;
    if (!Number.isFinite(toCents(row.amount)) || toCents(row.amount) <= 0) continue;
    if (!inWindow(row) || !looksLikePayment(row.description, row.vendor)) continue;
    const key = dismissalKey('one_sided_payment', row.id);
    if (dismissed.has(key)) continue;
    items.push({
      key,
      transaction: viewTxn(row, accountsById),
      side: 'paid_from',
      kind: kindForDestination(account.account_type),
      suggested_account_id: options.paidFromDefaults?.get(account.id) ?? null,
      reasons: ['The wording looks like a payment', 'It is not linked to the account it was paid from'],
    });
  }

  for (const item of suggestions.oneSided) {
    const row = rowsById.get(item.rowId);
    if (!row || !inWindow(row)) continue;
    const key = dismissalKey('one_sided_payment', row.id);
    if (dismissed.has(key)) continue;
    items.push({
      key,
      transaction: viewTxn(row, accountsById),
      side: 'paid_to',
      kind: item.kind,
      suggested_account_id: item.toAccountId,
      reasons: item.reasons,
    });
  }

  return items.sort((a, b) => newestFirst(a.transaction, b.transaction));
}

/**
 * Imported rows and the person's own entries that look like the same purchase
 * but were never linked: the import's matching rule (findBestMatch: the
 * amount within a cent, dates within 5 days, the names agree, the entry has no
 * account or the same one), one entry per imported row, newest imported row
 * first. Only rows a statement import added and that aren't part of a
 * transfer; only entries typed or scanned that aren't linked to anything.
 */
export function buildMatchSection(
  rows: readonly ReviewTxn[],
  accounts: readonly ReviewAccount[],
  dismissed: ReadonlySet<string>,
  inWindow: (row: ReviewTxn) => boolean = () => true,
): MatchItem[] {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const imported = rows
    .filter((row) => row.source === 'csv_import' && row.external_id && row.account_id && inWindow(row))
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || a.id.localeCompare(b.id));
  const entries = rows.filter(
    (row) => LINKABLE_SOURCES.includes(row.source ?? '') && !row.external_id,
  );

  // Entries by cents, so each imported row only looks at entries within a cent of it.
  const byCents = new Map<number, (ManualCandidate & { type: string })[]>();
  for (const entry of entries) {
    const cents = toCents(entry.amount);
    if (!Number.isFinite(cents)) continue;
    const list = byCents.get(cents);
    const candidate = { ...entry, type: entry.type };
    if (list) list.push(candidate);
    else byCents.set(cents, [candidate]);
  }

  // Every possible pairing, then the closest ones first (the rule findBestMatch ranks by: the
  // closest date, then an exact name, then the same account), each row and entry used once.
  const edges: { row: ReviewTxn; entry: ReviewTxn; days: number; exact: boolean; sameAccount: boolean }[] = [];
  for (const row of imported) {
    const cents = toCents(row.amount);
    const nearby = [cents - 1, cents, cents + 1]
      .flatMap((value) => byCents.get(value) ?? [])
      .filter((entry) => entry.type === row.type && !dismissed.has(dismissalKey('possible_match', row.id, entry.id)));
    if (nearby.length === 0) continue;
    for (const entry of nearby) {
      const score = scoreCandidate(bankOf(row), entry);
      if (!score) continue;
      edges.push({
        row,
        entry: entry as unknown as ReviewTxn,
        days: score.dateDistance,
        exact: score.exactName,
        sameAccount: score.sameAccount,
      });
    }
  }
  edges.sort(
    (a, b) =>
      a.days - b.days ||
      Number(b.exact) - Number(a.exact) ||
      Number(b.sameAccount) - Number(a.sameAccount) ||
      b.row.transaction_date.localeCompare(a.row.transaction_date) ||
      a.row.id.localeCompare(b.row.id) ||
      a.entry.id.localeCompare(b.entry.id),
  );

  const used = new Set<string>();
  const items: MatchItem[] = [];
  for (const edge of edges) {
    if (used.has(edge.row.id) || used.has(edge.entry.id)) continue;
    used.add(edge.row.id);
    used.add(edge.entry.id);
    const reasons = [
      edge.days === 0 ? 'Same amount on the same day' : `Same amount, ${edge.days} day${edge.days === 1 ? '' : 's'} apart`,
      edge.exact ? 'The names match' : 'The names are alike',
    ];
    if (!edge.entry.account_id) reasons.push('Your entry has no account yet');
    items.push({
      key: dismissalKey('possible_match', edge.row.id, edge.entry.id),
      imported: viewTxn(edge.row, accountsById),
      entry: viewTxn(edge.entry, accountsById),
      days_apart: daysBetween(edge.row.transaction_date, edge.entry.transaction_date),
      exact_name: edge.exact,
      reasons,
    });
  }
  return items.sort((a, b) => newestFirst(a.imported, b.imported));
}

function bankOf(row: ReviewTxn) {
  return {
    amount: toCents(row.amount) / 100,
    date: row.transaction_date,
    merchant: row.vendor,
    description: row.description,
    accountId: row.account_id as string,
  };
}

/** One page of a list. Offsets and limits outside the list are clamped. Pure. */
export function pageOf<T>(items: readonly T[], offset: number, limit: number): T[] {
  const start = Math.max(0, Math.trunc(offset) || 0);
  const size = Math.max(1, Math.trunc(limit) || 1);
  return items.slice(start, start + size);
}
