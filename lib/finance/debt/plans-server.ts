// lib/finance/debt/plans-server.ts
// Compute and store debt-free plans (debt_plans, migration 211) for the plan routes.

import type { SupabaseClient } from '@supabase/supabase-js';
import { comparePlan } from './plan.ts';
import type { PlanComparison, Strategy } from './plan.ts';
import { toPlanDebts } from './overview.ts';
import { makeBaseline, planProgress } from './progress.ts';
import type { PlanBaseline, PlanProgress } from './progress.ts';
import { buildOverview, loadDebtData } from './server.ts';
import type { DebtData } from './server.ts';

export interface DebtPlanRow {
  id: string;
  user_id: string;
  name: string;
  strategy: Strategy;
  extra_monthly: number | string;
  custom_order: string[] | null;
  protect_promos: boolean | null;
  baseline: PlanBaseline | null;
  created_at: string;
  updated_at: string;
}

export const PLAN_SELECT = 'id, user_id, name, strategy, extra_monthly, custom_order, protect_promos, baseline, created_at, updated_at';

export interface PlanSettings {
  strategy: Strategy;
  extra_monthly: number;
  custom_order: string[];
  protect_promos: boolean;
}

/** The plan for the user's current debts with these settings, and the minimums-only comparison. */
export function computePlan(data: DebtData, settings: PlanSettings, today: string): { comparison: PlanComparison; debts: ReturnType<typeof toPlanDebts> } {
  const overview = buildOverview(data, today);
  const debts = toPlanDebts(overview.debts);
  const ids = new Set(debts.map((d) => d.id));
  const comparison = comparePlan(debts, {
    strategy: settings.strategy,
    extraMonthly: settings.extra_monthly,
    customOrder: settings.custom_order.filter((id) => ids.has(id)),
    protectPromos: settings.protect_promos,
    startDate: today,
  });
  return { comparison, debts };
}

export function baselineFor(data: DebtData, settings: PlanSettings, today: string): PlanBaseline {
  const { comparison, debts } = computePlan(data, settings, today);
  return makeBaseline(comparison.plan, debts, today);
}

export function settingsOf(row: DebtPlanRow): PlanSettings {
  return {
    strategy: row.strategy,
    extra_monthly: Number(row.extra_monthly) || 0,
    custom_order: Array.isArray(row.custom_order) ? row.custom_order : [],
    protect_promos: row.protect_promos ?? true,
  };
}

export async function loadPlanWithSchedule(
  db: SupabaseClient,
  userId: string,
  row: DebtPlanRow,
  today: string,
): Promise<{ plan: DebtPlanRow; comparison: PlanComparison; progress: PlanProgress | null }> {
  const data = await loadDebtData(db, userId);
  const { comparison } = computePlan(data, settingsOf(row), today);
  const progress = row.baseline ? planProgress(row.baseline, data.txns, today) : null;
  return { plan: row, comparison, progress };
}
