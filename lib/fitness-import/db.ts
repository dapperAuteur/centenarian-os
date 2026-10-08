// lib/fitness-import/db.ts
// The error type and database helpers shared by the fitness imports: daily
// health metrics (CSV, Data Hub, InBody, wearable syncs), Garmin activities to
// trips, and workout logs.
//
// Relative imports end in `.ts` so tests/unit/fitness-dedupe.test.ts can load
// this file under `node --test --experimental-strip-types`. The page size and
// `chunk` come from the statement import, which hit the same PostgREST row cap
// first (lib/finance/csv-import/db.ts).

import { PAGE_SIZE, chunk } from '../finance/csv-import/db.ts';
import { isUniqueViolation } from '../finance/csv-import/errors.ts';

export { PAGE_SIZE, chunk, isUniqueViolation };

/** A fitness import failure with an HTTP status and a message that is safe to show. */
export class FitnessImportError extends Error {
  status: number;
  /** A stable word for the UI to branch on: `database_error`, `bad_request`, ... */
  code: string;
  details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'FitnessImportError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** The slice of a PostgREST / Postgres error this code looks at. */
export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
}

// Postgres: undefined_column, undefined_table. PostgREST: column or table
// missing from its schema cache.
const MISSING_SCHEMA_CODES = new Set(['42703', '42P01', 'PGRST200', 'PGRST204', 'PGRST205']);

/** True when the error says this column does not exist yet (its migration is not applied). */
export function isMissingColumn(error: DbErrorLike | null | undefined, column: string): boolean {
  if (!error) return false;
  if (!MISSING_SCHEMA_CODES.has(error.code ?? '')) return false;
  return (error.message ?? '').includes(column);
}

/** The error to throw for a failed read or write. */
export function fitnessDbFailure(error: DbErrorLike | null | undefined, doing: string): FitnessImportError {
  const detail = error?.message?.trim();
  return new FitnessImportError(500, 'database_error', detail ? `Could not ${doing}: ${detail}` : `Could not ${doing}.`);
}

/** A stop for a read that never ends: 200 pages is far more than one import touches. */
const MAX_PAGES = 200;

export type PageResult<T> = PromiseLike<{ data: T[] | null; error: DbErrorLike | null }>;

/**
 * Reads every row of a query, a page at a time, so a duplicate check never
 * stops at PostgREST's row cap (1000 rows on hosted Supabase unless changed).
 * `page(from, to)` must apply a stable order and `.range(from, to)`.
 *
 * It keeps asking until a page comes back empty, moving on by the number of
 * rows actually received: a server capped below PAGE_SIZE returns short pages
 * that are not the last one, and a partial read here means duplicates.
 *
 * Throws (never returns a partial list) when a read fails. The raw error is
 * kept on `details.dbError` so callers can tell "column not there yet" apart.
 */
export async function readAllRows<T>(
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
      const failure = fitnessDbFailure(error, doing);
      failure.details.dbError = { code: error.code ?? null, message: error.message ?? null };
      throw failure;
    }
    if (!data || data.length === 0) return rows;
    for (const row of data) rows.push(row);
    from += data.length;
  }
  throw new FitnessImportError(
    400,
    'too_many_existing_rows',
    'There are too many existing records in this file\'s date range to check in one import. Split the file into shorter date ranges.',
  );
}

/** The database error a readAllRows failure carries, if any. */
export function dbErrorOf(error: unknown): DbErrorLike | null {
  if (error instanceof FitnessImportError) {
    const raw = error.details.dbError as DbErrorLike | undefined;
    return raw ?? null;
  }
  return null;
}

/**
 * Groups rows that carry exactly the same columns.
 *
 * supabase-js sends a bulk insert or upsert with `columns` set to the union of
 * every row's keys, and a row that lacks one of them gets NULL for it
 * (postgrest-js `defaultToNull`, on by default). On conflict that NULL
 * overwrites the stored value. Writing each group on its own means a column a
 * row leaves out is never in the request, so its stored value stays.
 */
export function groupByKeySet<T extends Record<string, unknown>>(rows: readonly T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const signature = Object.keys(row).sort().join(',');
    const group = groups.get(signature);
    if (group) group.push(row);
    else groups.set(signature, [row]);
  }
  return [...groups.values()];
}
