// app/api/finance/import/route.ts
// POST: import transactions. Two request shapes share this URL.
//
// 1. Statement import (commit):
//      { account_id, csv_text, mapping, sign, dateOrder, include_pending?,
//        file_name?, preset?, actions?: [{ row, action?, type?, category_id? }] }
//    The server parses csv_text itself, plans it against the account, applies
//    `actions` by spreadsheet row number and writes an import batch. Call
//    POST /api/finance/import/preview first to see what it will do.
//    -> { batchId, inserted, linked, duplicates, invalid, skipped, rejected, imported }
//    Needs migration 203; until it is applied the answer is 503 with
//    "Run migration 203 first".
//
// 2. Template import (the current Import page): { rows: [...] } already parsed
//    in the browser. No account, no duplicate check, no batch.
//    -> { imported, skipped, errors? }
//
// Every failure has a JSON body with `error` (a sentence) and `errors` (the
// same, as the list the Import page renders).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadLearnedCategoryIndex } from '@/lib/finance/learned-categories';
import { LEGACY_MAX_ROWS, readLegacyRows, type LegacyImportRow } from '@/lib/finance/csv-import/legacy';
import {
  importErrorBody,
  importErrorResponse,
  readJson,
  unauthorizedResponse,
} from '@/lib/finance/csv-import/respond';
import { runImport } from '@/lib/finance/csv-import/service';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorizedResponse();

  const body = await readJson(request);
  const fields = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

  // The statement import is recognized by the file text it carries.
  if (fields.csv_text !== undefined || fields.csvText !== undefined) {
    try {
      const result = await runImport(supabase, user.id, body);
      return NextResponse.json({ ...result, imported: result.inserted + result.linked });
    } catch (error) {
      return importErrorResponse(error);
    }
  }

  return importTemplateRows(supabase, user.id, fields.rows);
}

async function importTemplateRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rows: unknown,
) {
  const fail = (status: number, message: string, more: string[] = [], extra: Record<string, unknown> = {}) =>
    NextResponse.json(
      { ...importErrorBody(message, 'import_failed', extra), errors: [message, ...more] },
      { status },
    );

  if (!Array.isArray(rows) || rows.length === 0) return fail(400, 'No rows to import.');
  if (rows.length > LEGACY_MAX_ROWS) {
    return fail(400, `This file has ${rows.length} rows. One import takes up to ${LEGACY_MAX_ROWS}.`);
  }

  const { data: categories, error: categoryError } = await supabase
    .from('budget_categories')
    .select('id, name')
    .eq('user_id', userId);
  if (categoryError) return fail(500, `Could not read your budget categories: ${categoryError.message}`);

  const categoryIdByName = new Map<string, string>();
  for (const category of categories ?? []) {
    const name = String(category.name ?? '').trim().toLowerCase();
    if (name && !categoryIdByName.has(name)) categoryIdByName.set(name, category.id);
  }
  const learned = await loadLearnedCategoryIndex(supabase, userId);

  const { payloads, errors } = readLegacyRows(rows as LegacyImportRow[], { categoryIdByName, learned });
  const shownErrors = errors.slice(0, 10);
  if (errors.length > shownErrors.length) {
    shownErrors.push(`...and ${errors.length - shownErrors.length} more rows with problems.`);
  }

  if (payloads.length === 0) {
    return fail(400, 'None of the rows could be imported.', shownErrors, { skipped: rows.length });
  }

  const { data, error } = await supabase
    .from('financial_transactions')
    .insert(payloads.map((payload) => ({ ...payload, user_id: userId, source: 'csv_import' })))
    .select('id');
  if (error) return fail(500, `The transactions could not be saved: ${error.message}`);

  return NextResponse.json({
    imported: data?.length || 0,
    skipped: rows.length - payloads.length,
    errors: shownErrors.length > 0 ? shownErrors : undefined,
  });
}
