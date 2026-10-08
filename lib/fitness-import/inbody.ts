// lib/fitness-import/inbody.ts
// InBody scans: one row per (user_id, measured_at) in inbody_scans (migration
// 145), and a copy of each day's latest scan in user_health_metrics with
// source 'inbody'.
//
//   - A file that lists one measured_at twice is merged first (the later row's
//     values win), so the upsert never touches a row twice (error 21000).
//   - Scans are written in groups that carry the same columns, so a blank cell
//     in a new file never erases a value an earlier import stored.
//   - The health-metrics copy is worked out from every stored scan of the
//     affected days, not just this file's, and goes through
//     importDailyMetrics, whose errors are checked.
//
// Relative imports end in `.ts` for the unit tests.

import type { SupabaseClient } from '@supabase/supabase-js';
import { chunk, fitnessDbFailure, groupByKeySet, readAllRows } from './db.ts';
import type { PageResult } from './db.ts';
import { importDailyMetrics, type DayInput, type DailyImportResult } from './daily-metrics.ts';

export type ScanRow = Record<string, unknown> & { measured_at: string; logged_date: string };

export interface ScanDedupe {
  scans: ScanRow[];
  /** measured_at values the file listed more than once. */
  repeated: string[];
}

/** One row per measured_at; a later row's non-blank values win. */
export function dedupeScans(rows: readonly ScanRow[]): ScanDedupe {
  const byTime = new Map<string, ScanRow>();
  const repeated = new Set<string>();
  for (const row of rows) {
    const earlier = byTime.get(row.measured_at);
    if (!earlier) {
      byTime.set(row.measured_at, { ...row });
      continue;
    }
    repeated.add(row.measured_at);
    for (const [key, value] of Object.entries(row)) {
      if (value !== null && value !== undefined && value !== '') earlier[key] = value;
    }
  }
  return { scans: [...byTime.values()], repeated: [...repeated].sort() };
}

interface StoredScan {
  logged_date: string;
  measured_at: string;
  weight_lbs: number | null;
  body_fat_pct: number | null;
  skeletal_muscle_mass_lbs: number | null;
  bmi: number | null;
}

/** The latest scan of each day -> the four fields user_health_metrics shows. */
export function latestScanDays(scans: readonly StoredScan[]): DayInput[] {
  const latest = new Map<string, StoredScan>();
  for (const scan of scans) {
    const current = latest.get(scan.logged_date);
    if (!current || Date.parse(scan.measured_at) > Date.parse(current.measured_at)) latest.set(scan.logged_date, scan);
  }
  return [...latest.values()]
    .map((scan) => ({
      logged_date: scan.logged_date,
      values: {
        ...(scan.weight_lbs != null ? { weight_lbs: scan.weight_lbs } : {}),
        ...(scan.body_fat_pct != null ? { body_fat_pct: scan.body_fat_pct } : {}),
        ...(scan.skeletal_muscle_mass_lbs != null ? { muscle_mass_lbs: scan.skeletal_muscle_mass_lbs } : {}),
        ...(scan.bmi != null ? { bmi: scan.bmi } : {}),
      },
    }))
    .filter((day) => Object.keys(day.values).length > 0)
    .sort((a, b) => a.logged_date.localeCompare(b.logged_date));
}

export interface InBodyImportResult {
  /** Scans written (new or updated). */
  scans: number;
  repeatedInFile: number;
  healthMetrics: DailyImportResult;
}

/** Rows per upsert request. */
export const SCAN_WRITE_CHUNK = 200;

/** Writes the scans, then refreshes the 'inbody' health-metrics rows of the days they touch. */
export async function importInBodyScans(db: SupabaseClient, userId: string, rows: readonly ScanRow[]): Promise<InBodyImportResult> {
  const { scans, repeated } = dedupeScans(rows);
  let written = 0;
  for (const group of groupByKeySet(scans)) {
    for (const part of chunk(group, SCAN_WRITE_CHUNK)) {
      const { error } = await db.from('inbody_scans').upsert(part, { onConflict: 'user_id,measured_at' });
      if (error) throw fitnessDbFailure(error, 'save the InBody scans');
      written += part.length;
    }
  }

  const days = [...new Set(scans.map((scan) => scan.logged_date))].sort();
  let stored: StoredScan[] = [];
  if (days.length > 0) {
    stored = await readAllRows<StoredScan>('read the stored InBody scans', (from, to) =>
      db
        .from('inbody_scans')
        .select('logged_date, measured_at, weight_lbs, body_fat_pct, skeletal_muscle_mass_lbs, bmi')
        .eq('user_id', userId)
        .gte('logged_date', days[0])
        .lte('logged_date', days[days.length - 1])
        .order('measured_at', { ascending: true })
        .range(from, to) as unknown as PageResult<StoredScan>,
    );
  }
  const touched = new Set(days);
  // The copy mirrors the latest scan, so its values replace older ones; a field
  // the scan left blank is still never erased.
  const healthMetrics = await importDailyMetrics(db, {
    userId,
    source: 'inbody',
    rows: latestScanDays(stored.filter((scan) => touched.has(scan.logged_date))),
    mode: 'replace',
  });
  return { scans: written, repeatedInFile: repeated.length, healthMetrics };
}
