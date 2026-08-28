// lib/finance/income-source.ts
// Single read path for "money CentOS expects to receive."
//
// Stage 2, Phase 2 (plans/55-stage2-db-split.md). CentOS is migrating off the cross-app
// `expected_payments` VIEW — which selects from Work.WitUS's `contractor_jobs` and `invoices` —
// and onto `income_events`, a local projection Work.WitUS pushes to via /api/events/income.
//
// Every consumer goes through this function so the cutover is one edit, not four.

import type { SupabaseClient } from '@supabase/supabase-js';

/** Shape shared by the legacy view and the projection. Migration 196 mirrors the view 1:1. */
export interface ExpectedPaymentRow {
  user_id: string;
  source_type: string;
  source_id: string | null;
  expected_date: string;
  label: string | null;
  reference_number: string | null;
  expected_amount: number;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  brand_id: string | null;
  [key: string]: unknown;
}

const COLUMNS =
  'user_id, source_type, source_id, expected_date, label, reference_number, ' +
  'expected_amount, status, start_date, end_date, brand_id';

/**
 * Expected income for a user in a date window, ascending by date.
 *
 * Reads the local projection first. During Phase 2 the projection may be empty — the backfill
 * is an operator step and Work.WitUS's emitter ships separately — so an empty result falls back
 * to the legacy view rather than silently showing a user zero income.
 *
 * TRANSITIONAL: delete `readLegacyView` and its call site in Phase 3, once the backfill has run
 * and the emitter is live. Tracked in plans/55-stage2-db-split.md Phase 3.
 */
export async function getExpectedIncome(
  db: SupabaseClient,
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<ExpectedPaymentRow[]> {
  const projection = await readProjection(db, userId, fromDate, toDate);
  if (projection.length > 0) return projection;
  return readLegacyView(db, userId, fromDate, toDate);
}

async function readProjection(
  db: SupabaseClient,
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<ExpectedPaymentRow[]> {
  try {
    const { data, error } = await db
      .from('income_events')
      .select(COLUMNS)
      .eq('user_id', userId)
      .eq('is_active', true)
      .gte('expected_date', fromDate)
      .lte('expected_date', toDate)
      .order('expected_date');
    if (error) return [];
    return (data ?? []) as unknown as ExpectedPaymentRow[];
  } catch {
    // Table may not exist yet if migration 196 has not been applied to this environment.
    return [];
  }
}

/** TRANSITIONAL — see getExpectedIncome. Removed in Phase 3. */
async function readLegacyView(
  db: SupabaseClient,
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<ExpectedPaymentRow[]> {
  try {
    const { data, error } = await db
      .from('expected_payments')
      .select('*')
      .eq('user_id', userId)
      .gte('expected_date', fromDate)
      .lte('expected_date', toDate)
      .order('expected_date');
    if (error) return [];
    return (data ?? []) as unknown as ExpectedPaymentRow[];
  } catch {
    return [];
  }
}
