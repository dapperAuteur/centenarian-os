// lib/finance/review/schema.ts
// Recognizing "migration 219 isn't applied yet" (import_drafts and
// finance_review_dismissals), and the sentence the pages show when it isn't.
//
// No imports on purpose: runs in API routes, client components and under
// `node --test --experimental-strip-types`.

export const REVIEW_MIGRATION_MESSAGE =
  'Saving an import to finish later, and remembering "not a transfer" answers, are not set up in the database yet. Run migration 219 first (supabase/migrations/219_finance_review_import_drafts.sql).';

/** The code the API answers with when migration 219 is missing. */
export const REVIEW_MIGRATION_CODE = 'review_migration_required';

interface DbErrorLike {
  code?: string | null;
  message?: string | null;
}

// Postgres: undefined_table, undefined_column. PostgREST: a table, column or relationship missing
// from its schema cache.
const MISSING_SCHEMA_CODES = new Set(['42P01', '42703', 'PGRST200', 'PGRST204', 'PGRST205']);

/** True when an error says a table from migration 219 doesn't exist yet. */
export function isReviewSchemaMissing(error: DbErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (!MISSING_SCHEMA_CODES.has(error.code ?? '')) return false;
  return /import_drafts|finance_review_dismissals/i.test(error.message ?? '');
}
