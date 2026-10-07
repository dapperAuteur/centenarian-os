// lib/finance/review/server.ts
// The reads behind the finance Review page (GET /api/finance/review and
// GET /api/finance/review/summary). Every query is scoped to the user. The
// decisions are in ./sections.ts.
//
// Transfers, payments and matches are worked out in memory from the person's
// transactions that are not part of a transfer, newest first, up to
// REVIEW_MAX_ROWS (the same ceiling as the Possible transfers panel). Past
// that the answer says `truncated` and the page offers a date range.
// Uncategorized rows are counted and paged by the database, so there is no
// ceiling on them.
//
// Relative imports end in `.ts` for `node --test --experimental-strip-types`.

import type { SupabaseClient } from '@supabase/supabase-js';
import { ImportError } from '../csv-import/errors.ts';
import { suggestPaidFrom } from '../csv-import/service.ts';
import { listDrafts, type DraftSummary } from '../import-drafts/drafts.ts';
import { TRANSFER_WINDOW_DAYS } from '../transfers/detect.ts';
import { accountLabel } from '../transfers/pairing.ts';
import { TRANSFERS_NOT_READY, missingTransferColumn } from '../transfers/schema.ts';
import { shiftDate } from '../transaction-matching.ts';
import { isReviewSchemaMissing } from './schema.ts';
import {
  buildMatchSection,
  buildPaymentSection,
  buildTransferSection,
  detectTransfers,
  dismissalKey,
  pageOf,
  viewTxn,
  type DismissalSection,
  type MatchItem,
  type PaymentItem,
  type ReviewAccount,
  type ReviewTxn,
  type TransferPairItem,
  type TxnView,
} from './sections.ts';

/** The most rows the in-memory sections look at. */
export const REVIEW_MAX_ROWS = 5000;
const PAGE_SIZE = 1000;
export const DEFAULT_REVIEW_LIMIT = 25;
export const MAX_REVIEW_LIMIT = 100;

const ROW_COLUMNS =
  'id, account_id, amount, type, transaction_date, description, vendor, source, external_id, import_batch_id, category_id';
const ACCOUNT_COLUMNS = 'id, name, account_type, institution_name, last_four, is_active';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ReviewRange {
  from: string | null;
  to: string | null;
}

/** Checks ?from= and ?to=. Throws ImportError 400 on a malformed or reversed range. */
export function readRange(from: string | null | undefined, to: string | null | undefined): ReviewRange {
  const clean = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null);
  const range = { from: clean(from), to: clean(to) };
  if ((range.from && !ISO_DATE.test(range.from)) || (range.to && !ISO_DATE.test(range.to))) {
    throw new ImportError(400, 'bad_range', 'Dates must be written YYYY-MM-DD.');
  }
  if (range.from && range.to && range.from > range.to) {
    throw new ImportError(400, 'bad_range', 'The start date must not be after the end date.');
  }
  return range;
}

function transfersNotReady(): ImportError {
  return new ImportError(503, TRANSFERS_NOT_READY.code, TRANSFERS_NOT_READY.error);
}

function readFailure(error: { code?: string | null; message?: string | null } | null, doing: string): ImportError {
  if (missingTransferColumn(error)) return transfersNotReady();
  const detail = error?.message?.trim();
  return new ImportError(500, 'database_error', detail ? `Could not ${doing}: ${detail}` : `Could not ${doing}.`);
}

export async function loadAccounts(db: SupabaseClient, userId: string): Promise<ReviewAccount[]> {
  const { data, error } = await db
    .from('financial_accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw readFailure(error, 'read your accounts');
  return (data ?? []) as ReviewAccount[];
}

/**
 * The person's rows that are not part of a transfer, newest first, between
 * two dates (either may be null), up to REVIEW_MAX_ROWS.
 */
export async function loadOpenRows(
  db: SupabaseClient,
  userId: string,
  range: ReviewRange,
): Promise<{ rows: ReviewTxn[]; truncated: boolean }> {
  const rows: ReviewTxn[] = [];
  for (let offset = 0; offset < REVIEW_MAX_ROWS; offset += PAGE_SIZE) {
    let query = db
      .from('financial_transactions')
      .select(ROW_COLUMNS)
      .eq('user_id', userId)
      .is('transfer_group_id', null)
      .order('transaction_date', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (range.from) query = query.gte('transaction_date', range.from);
    if (range.to) query = query.lte('transaction_date', range.to);
    const { data, error } = await query;
    if (error) throw readFailure(error, 'read your transactions');
    const page = (data ?? []) as ReviewTxn[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

export interface DismissalSet {
  keys: Set<string>;
  /** False before migration 219: nothing is remembered yet. */
  available: boolean;
}

export async function loadDismissals(db: SupabaseClient, userId: string): Promise<DismissalSet> {
  const { data, error } = await db
    .from('finance_review_dismissals')
    .select('section, transaction_id, other_transaction_id')
    .eq('user_id', userId)
    .limit(20000);
  if (error) {
    if (isReviewSchemaMissing(error)) return { keys: new Set(), available: false };
    throw readFailure(error, 'read the suggestions you turned down');
  }
  const keys = new Set<string>();
  for (const row of (data ?? []) as { section: string; transaction_id: string; other_transaction_id: string | null }[]) {
    keys.add(dismissalKey(row.section as DismissalSection, row.transaction_id, row.other_transaction_id));
  }
  return { keys, available: true };
}

/** The filter "uncategorized and real spending or income": no category, not a transfer. */
function uncategorizedQuery(db: SupabaseClient, userId: string, columns: string, range: ReviewRange, head: boolean) {
  let query = db
    .from('financial_transactions')
    .select(columns, { count: 'exact', head })
    .eq('user_id', userId)
    .is('category_id', null)
    .is('transfer_group_id', null)
    // `source` may be null on old rows; a plain "not equal" would drop those too.
    .or('source.is.null,source.neq.transfer');
  if (range.from) query = query.gte('transaction_date', range.from);
  if (range.to) query = query.lte('transaction_date', range.to);
  return query;
}

export async function countUncategorized(db: SupabaseClient, userId: string, range: ReviewRange): Promise<number> {
  const { count, error } = await uncategorizedQuery(db, userId, 'id', range, true);
  if (error) throw readFailure(error, 'count your uncategorized transactions');
  return count ?? 0;
}

export async function listUncategorized(
  db: SupabaseClient,
  userId: string,
  range: ReviewRange,
  offset: number,
  limit: number,
  accountsById: ReadonlyMap<string, ReviewAccount>,
): Promise<{ items: TxnView[]; total: number }> {
  const { data, count, error } = await uncategorizedQuery(db, userId, ROW_COLUMNS, range, false)
    .order('transaction_date', { ascending: false })
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw readFailure(error, 'read your uncategorized transactions');
  return {
    items: ((data ?? []) as unknown as ReviewTxn[]).map((row) => viewTxn(row, accountsById)),
    total: count ?? 0,
  };
}

/** Drafts for the page, or null before migration 219. */
async function loadDraftList(db: SupabaseClient, userId: string): Promise<DraftSummary[] | null> {
  try {
    return await listDrafts(db, userId);
  } catch (error) {
    if (error instanceof ImportError && error.status === 503) return null;
    throw error;
  }
}

/** The account each card or loan's payments usually come from, for the accounts that need one. */
async function paidFromDefaults(
  db: SupabaseClient,
  userId: string,
  accounts: readonly ReviewAccount[],
  accountIds: ReadonlySet<string>,
): Promise<Map<string, string | null>> {
  const defaults = new Map<string, string | null>();
  await Promise.all(
    accounts
      .filter((account) => accountIds.has(account.id))
      .map(async (account) => {
        defaults.set(account.id, await suggestPaidFrom(db, userId, account));
      }),
  );
  return defaults;
}

export interface SectionPage<T> {
  items: T[];
  total: number;
  offset: number;
}

export interface ReviewOffsets {
  transfers?: number;
  payments?: number;
  matches?: number;
  uncategorized?: number;
}

export interface ReviewCounts {
  transfers: number;
  payments: number;
  matches: number;
  uncategorized: number;
  /** Saved imports waiting to be finished (0 before migration 219). */
  drafts: number;
  total: number;
}

export interface ReviewResponse {
  counts: ReviewCounts;
  sections: {
    transfers: SectionPage<TransferPairItem>;
    payments: SectionPage<PaymentItem>;
    matches: SectionPage<MatchItem>;
    uncategorized: SectionPage<TxnView>;
  };
  accounts: { id: string; label: string; account_type: string; is_active: boolean }[];
  drafts: DraftSummary[] | null;
  /** False before migration 219: "Not a transfer" answers can't be remembered and drafts can't be saved. */
  saved_answers_available: boolean;
  /** Only the newest REVIEW_MAX_ROWS transactions were checked for transfers, payments and matches. */
  truncated: boolean;
  window: ReviewRange;
}

/** Keeps a row when it is inside the range the page asked for. */
function inRange(range: ReviewRange) {
  return (row: ReviewTxn): boolean =>
    (!range.from || row.transaction_date >= range.from) && (!range.to || row.transaction_date <= range.to);
}

const clampOffset = (value: number | undefined): number => Math.max(0, Math.trunc(Number(value) || 0));

/**
 * Everything the Review page shows: each section's count and one page of it,
 * the saved imports, and the accounts for the pickers.
 */
export async function buildReview(
  db: SupabaseClient,
  userId: string,
  options: { range?: ReviewRange; offsets?: ReviewOffsets; limit?: number } = {},
): Promise<ReviewResponse> {
  const range = options.range ?? { from: null, to: null };
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? DEFAULT_REVIEW_LIMIT) || DEFAULT_REVIEW_LIMIT, 1), MAX_REVIEW_LIMIT);
  const offsets = options.offsets ?? {};

  // A transfer's other side can sit just outside the range: load a few days more, trim afterwards.
  const loadRange: ReviewRange = {
    from: range.from ? shiftDate(range.from, -TRANSFER_WINDOW_DAYS) : null,
    to: range.to ? shiftDate(range.to, TRANSFER_WINDOW_DAYS) : null,
  };
  const [accounts, loaded, dismissals, drafts] = await Promise.all([
    loadAccounts(db, userId),
    loadOpenRows(db, userId, loadRange),
    loadDismissals(db, userId),
    loadDraftList(db, userId),
  ]);
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const keep = inRange(range);

  const suggestions = detectTransfers(loaded.rows, accounts);
  const transfers = buildTransferSection(loaded.rows, accounts, suggestions, dismissals.keys, keep);
  const debtAccountIds = new Set(
    loaded.rows
      .filter((row) => row.type === 'income' && row.account_id)
      .map((row) => row.account_id as string)
      .filter((id) => {
        const type = accountsById.get(id)?.account_type;
        return type === 'credit_card' || type === 'loan';
      }),
  );
  const defaults = await paidFromDefaults(db, userId, accounts, debtAccountIds);
  const payments = buildPaymentSection(loaded.rows, accounts, suggestions, dismissals.keys, {
    paidFromDefaults: defaults,
    inWindow: keep,
  });
  const matches = buildMatchSection(loaded.rows, accounts, dismissals.keys, keep);
  const uncategorizedOffset = clampOffset(offsets.uncategorized);
  const uncategorized = await listUncategorized(db, userId, range, uncategorizedOffset, limit, accountsById);

  const page = <T,>(items: T[], offset: number | undefined): SectionPage<T> => {
    const start = clampOffset(offset);
    return { items: pageOf(items, start, limit), total: items.length, offset: start };
  };
  const draftCount = drafts?.length ?? 0;

  return {
    counts: {
      transfers: transfers.length,
      payments: payments.length,
      matches: matches.length,
      uncategorized: uncategorized.total,
      drafts: draftCount,
      total: transfers.length + payments.length + matches.length + uncategorized.total + draftCount,
    },
    sections: {
      transfers: page(transfers, offsets.transfers),
      payments: page(payments, offsets.payments),
      matches: page(matches, offsets.matches),
      uncategorized: { items: uncategorized.items, total: uncategorized.total, offset: uncategorizedOffset },
    },
    accounts: accounts.map((account) => ({
      id: account.id,
      label: accountLabel(account),
      account_type: account.account_type,
      is_active: account.is_active !== false,
    })),
    drafts,
    saved_answers_available: dismissals.available && drafts !== null,
    truncated: loaded.truncated,
    window: range,
  };
}

/** Just the counts, for the badge on the Finance dashboard. */
export async function reviewCounts(db: SupabaseClient, userId: string): Promise<ReviewCounts> {
  return (await buildReview(db, userId, { limit: 1 })).counts;
}
