// lib/finance/csv-import/db.ts
// Small database helpers shared by the statement import's plan, commit and
// undo steps. Relative imports end in `.ts` so the unit tests can load this
// file under `node --test --experimental-strip-types`.

import { ImportError, dbFailure } from './errors.ts';
import type { DbError } from './errors.ts';

/** Rows asked for per request. PostgREST may return fewer (its max-rows setting). */
export const PAGE_SIZE = 1000;

/** A stop for a read that never ends: 200 pages is far more than one import touches. */
const MAX_PAGES = 200;

/** Ids per `in (...)` filter, keeping the request URL short. */
export const ID_CHUNK = 100;

export type PageResult<T> = PromiseLike<{ data: T[] | null; error: DbError | null }>;

/**
 * Reads every row of a query, a page at a time. `page(from, to)` must apply a
 * stable order and `.range(from, to)`.
 *
 * It keeps asking until a page comes back empty, moving on by the number of
 * rows actually received. Stopping at the first short page would be one
 * request cheaper, but a server capped below PAGE_SIZE returns short pages
 * that are not the last one, and a partial read here means duplicates.
 *
 * Throws (never returns a partial list) when a read fails.
 */
export async function readAllPages<T>(
  doing: string,
  page: (from: number, to: number) => PageResult<T>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (let pages = 0; pages < MAX_PAGES; pages++) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) {
      // PostgREST's "range not satisfiable": the offset is past the last row.
      if (error.code === 'PGRST103') return rows;
      throw dbFailure(error, doing);
    }
    if (!data || data.length === 0) return rows;
    for (const row of data) rows.push(row);
    from += data.length;
  }
  throw new ImportError(
    400,
    'too_many_existing_rows',
    'This account has too many transactions in the statement\'s date range to check in one import. Split the file into shorter date ranges.',
  );
}

/** Splits a list into runs of at most `size`. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
