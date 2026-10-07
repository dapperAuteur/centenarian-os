// lib/finance/similar/server.ts
// Runs "Find similar" on the server: which of a person's transactions share
// the chosen details (see criteria.ts), newest first.
//
// The database filters by everything it can (type, account, category, amount
// range, dates, each word); the vendor needs vendorKey(), so the rows that are
// left are read in pages of SCAN_PAGE (a few light columns each, several pages
// at once) and rowMatches() decides. That keeps one request fast for a person
// with years of imported statements, and every criterion is checked twice.
//
// The caller passes an authenticated user's id; every query is scoped to it.
// No '@/' imports: runs under node --test (tests/unit/find-similar.test.ts).

import { applySimilarFilters, rowMatches, type SimilarCriteria, type SimilarRow } from './criteria.ts';
import { missingTransferColumn, type DbErrorLike } from '../transfers/schema.ts';

/** Rows per read. PostgREST's default max-rows; a smaller server cap is detected. */
export const SCAN_PAGE = 1000;
/** Stop after reading this many rows; the answer then says it was cut short. */
export const MAX_SCAN = 30_000;
/** At most this many matching ids are returned (and can be edited in one go). */
export const MAX_MATCH_IDS = 10_000;
/** Pages read at the same time. */
const PARALLEL_PAGES = 4;

const BASE_COLUMNS = 'id, user_id, vendor, description, amount, type, account_id, category_id, transaction_date';

/**
 * The client this file needs. `from` returns `any` because the real builder's
 * generics are too deep to compare with a structural type (see OwnershipDb).
 */
export interface SimilarDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface SimilarMatches {
  /** Matching rows found. */
  total: number;
  /** Their ids, newest first, at most MAX_MATCH_IDS. */
  ids: string[];
  /** Of the matches, how many are one side of a transfer. */
  transferCount: number;
  /** More rows than MAX_SCAN passed the database filters; the rest were not read. */
  truncated: boolean;
  error: DbErrorLike | null;
}

interface ScanRow extends SimilarRow {
  id: string;
  user_id: string;
  transfer_group_id?: string | null;
}

/**
 * Finds the user's transactions that share every detail in `criteria`.
 * Reads at most MAX_SCAN rows; `truncated` says when there were more.
 */
export async function findSimilarIds(
  db: SimilarDb,
  userId: string,
  criteria: SimilarCriteria,
): Promise<SimilarMatches> {
  const empty = (error: DbErrorLike | null): SimilarMatches => ({ total: 0, ids: [], transferCount: 0, truncated: false, error });
  if (!userId) return empty(null);

  // transfer_group_id arrives with migration 202; without it nothing is a transfer.
  let columns = `${BASE_COLUMNS}, transfer_group_id`;
  const read = (from: number, to: number, withCount: boolean) => {
    const query = applySimilarFilters(
      db.from('financial_transactions').select(columns, withCount ? { count: 'exact' } : undefined).eq('user_id', userId),
      criteria,
    );
    // id breaks ties, so pages read at the same time never overlap or skip.
    return query.order('transaction_date', { ascending: false }).order('id', { ascending: true }).range(from, to);
  };

  let first = await read(0, SCAN_PAGE - 1, true);
  if (first.error && missingTransferColumn(first.error) === 'transfer_group_id') {
    columns = BASE_COLUMNS;
    first = await read(0, SCAN_PAGE - 1, true);
  }
  if (first.error) return empty(first.error);

  const rows: ScanRow[] = [...((first.data ?? []) as ScanRow[])];
  // A server with a smaller max-rows returns fewer rows than asked for; read in its page size.
  const pageSize = rows.length > 0 && rows.length < SCAN_PAGE ? rows.length : SCAN_PAGE;
  const counted = typeof first.count === 'number' ? first.count : null;
  let truncated = false;

  if (counted !== null) {
    const toRead = Math.min(counted, MAX_SCAN);
    truncated = counted > MAX_SCAN;
    const starts: number[] = [];
    for (let start = rows.length; start < toRead; start += pageSize) starts.push(start);
    for (let i = 0; i < starts.length; i += PARALLEL_PAGES) {
      const batch = starts.slice(i, i + PARALLEL_PAGES);
      const results = await Promise.all(batch.map((start) => read(start, Math.min(start + pageSize, toRead) - 1, false)));
      for (const result of results) {
        if (result.error) return empty(result.error);
        rows.push(...((result.data ?? []) as ScanRow[]));
      }
    }
  } else if (rows.length === pageSize) {
    // No count came back: read page after page until a short one.
    for (let start = rows.length; ; start += pageSize) {
      if (start >= MAX_SCAN) {
        truncated = true;
        break;
      }
      const result = await read(start, start + pageSize - 1, false);
      if (result.error) return empty(result.error);
      const page = (result.data ?? []) as ScanRow[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
  }

  const seen = new Set<string>();
  const ids: string[] = [];
  let total = 0;
  let transferCount = 0;
  for (const row of rows) {
    // Decided again from the row: someone else's row never counts, and a row
    // read twice (a page boundary moving under a concurrent insert) counts once.
    if (row.user_id !== userId || seen.has(row.id) || !rowMatches(row, criteria)) continue;
    seen.add(row.id);
    total += 1;
    if (row.transfer_group_id) transferCount += 1;
    if (ids.length < MAX_MATCH_IDS) ids.push(row.id);
  }
  return { total, ids, transferCount, truncated, error: null };
}
