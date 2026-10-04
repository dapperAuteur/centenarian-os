// lib/finance/csv-import/errors.ts
// The one error type the statement import throws, and the translation of
// database errors into sentences a person can act on. No imports: this file
// runs in API routes and under `node --test --experimental-strip-types`.

/** An import failure with an HTTP status and a message that is safe to show. */
export class ImportError extends Error {
  status: number;
  /** A stable word for the UI to branch on: `migration_required`, `too_many_rows`, ... */
  code: string;
  /** Extra fields for the response body (missing columns, the detected mapping, ...). */
  details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ImportError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const MIGRATION_REQUIRED_MESSAGE =
  'Statement import is not set up in the database yet. Run migration 203 first (supabase/migrations/203_bank_csv_import.sql).';

/** The slice of a PostgREST / Postgres error this code looks at. */
export interface DbError {
  code?: string | null;
  message?: string | null;
}

// Postgres: undefined_column, undefined_table. PostgREST: column or table (or
// the relationship between two tables) missing from its schema cache.
const MISSING_SCHEMA_CODES = new Set(['42703', '42P01', 'PGRST200', 'PGRST204', 'PGRST205']);

// The objects migration 203 creates. A missing-schema error that names none of
// them is some other problem and keeps its own message.
const MIGRATION_203_OBJECTS =
  /import_batches|import_batch_id|external_id|transfer_kind|csv_import_mapping/i;

/** True when the error says a table or column from migration 203 does not exist yet. */
export function isMissingSchemaError(error: DbError | null | undefined): boolean {
  if (!error) return false;
  if (!MISSING_SCHEMA_CODES.has(error.code ?? '')) return false;
  return MIGRATION_203_OBJECTS.test(error.message ?? '');
}

/** Postgres unique_violation: the row is already there. */
export function isUniqueViolation(error: DbError | null | undefined): boolean {
  return error?.code === '23505';
}

/** The error to throw for a failed read or write: "run the migration" when that is the cause. */
export function dbFailure(error: DbError | null | undefined, doing: string): ImportError {
  if (isMissingSchemaError(error)) {
    return new ImportError(503, 'migration_required', MIGRATION_REQUIRED_MESSAGE);
  }
  const detail = error?.message?.trim();
  return new ImportError(500, 'database_error', detail ? `Could not ${doing}: ${detail}` : `Could not ${doing}.`);
}

/** Throws dbFailure when a Supabase result carries an error. */
export function assertOk(result: { error: DbError | null }, doing: string): void {
  if (result.error) throw dbFailure(result.error, doing);
}
