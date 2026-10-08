// app/api/health-metrics/import/route.ts
// POST: bulk import daily health metrics (the metrics import page and the Data Hub).
// Supports: Garmin, Apple Health, Oura, Whoop, Google Health, InBody, Hume Health, generic CSV, manual.
//
// Duplicates are handled in lib/fitness-import/daily-metrics.ts: one row per
// (user, date, source); a file's repeated dates are merged; by default a
// re-import only adds new days and fills blank fields, and never changes or
// erases a stored value ("replace": true opts in to overwriting).

import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { FitnessImportError } from '@/lib/fitness-import/db';
import {
  HEALTH_SOURCES,
  cleanDayValues,
  describeDailyCounts,
  hasMetric,
  importDailyMetrics,
  isHealthSource,
  isIsoDate,
  type DayInput,
} from '@/lib/fitness-import/daily-metrics';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const MAX_ROWS = 365;

/** Days listed in a preview; the counts always cover every day. */
const PREVIEW_DAYS = 400;

interface ImportBody {
  source?: unknown;
  rows?: unknown;
  /** Classify only, write nothing. Also accepted as ?dryRun=1. */
  dryRun?: unknown;
  /** Let the file's values replace stored ones (default: keep stored values). */
  replace?: unknown;
}

/**
 * POST /api/health-metrics/import
 * Body: { source?: string (default 'manual'), rows: { logged_date: 'YYYY-MM-DD', ...metrics }[],
 *         dryRun?: boolean, replace?: boolean }
 * Answers the counts: inserted, filled, unchanged, conflicts, replaced,
 * repeated_in_file, invalid; `imported` = days written (inserted + filled +
 * replaced, plus conflict days that also gained blank fields).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ImportBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const source = body.source === undefined || body.source === null || body.source === '' ? 'manual' : body.source;
  if (!isHealthSource(source)) {
    return NextResponse.json(
      { error: `Unknown source. Use one of: ${HEALTH_SOURCES.join(', ')}.` },
      { status: 400 },
    );
  }

  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_ROWS} rows per import` }, { status: 400 });
  }

  const dryRunParam = request.nextUrl.searchParams.get('dryRun');
  const dryRun = body.dryRun === true || dryRunParam === '1' || dryRunParam === 'true';
  const mode = body.replace === true ? 'replace' : 'add_only';

  const days: DayInput[] = [];
  const errors: string[] = [];
  rows.forEach((raw, i) => {
    const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    if (!isIsoDate(row.logged_date)) {
      errors.push(`Row ${i + 1}: invalid or missing logged_date`);
      return;
    }
    const values = cleanDayValues(row);
    if (!hasMetric(values)) {
      errors.push(`Row ${i + 1}: no valid metric columns`);
      return;
    }
    days.push({ logged_date: row.logged_date, values });
  });

  if (days.length === 0) {
    return NextResponse.json({ error: 'No valid rows', details: errors.slice(0, 10) }, { status: 400 });
  }

  try {
    const result = await importDailyMetrics(getDb(), { userId: user.id, source, rows: days, mode, dryRun });
    const { counts } = result;
    const written = result.days.filter((d) => d.write !== null).length;
    return NextResponse.json({
      dryRun,
      source,
      mode,
      ...counts,
      invalid: errors.length,
      imported: dryRun ? 0 : written,
      // Kept for older callers: rows that were not imported for being invalid.
      skipped: errors.length,
      message: `${describeDailyCounts(counts, dryRun)}${errors.length > 0 ? ` · ${errors.length} invalid ${errors.length === 1 ? 'row' : 'rows'}` : ''}.`,
      days: result.days.slice(0, PREVIEW_DAYS).map((d) => ({
        logged_date: d.logged_date,
        status: d.status,
        filled: d.filled,
        conflicts: d.conflicts,
        replaced: d.replaced,
      })),
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    if (error instanceof FitnessImportError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
}
