// components/finance/debt/types.ts
// Response shapes of /api/finance/debt/* as the debt page reads them.

import type { DebtSummary } from '@/lib/finance/debt/overview';
import type { DueSoonEntry, ReminderSetting } from '@/lib/finance/debt/due';
import type { PlanComparison, Strategy } from '@/lib/finance/debt/plan';
import type { PlanBaseline, PlanProgress } from '@/lib/finance/debt/progress';

export type DebtRow = DebtSummary & {
  interestYtd: number;
  nextDue: { date: string; minimum: number | null; statementBalance: number | null; paid: boolean } | null;
};

export interface DebtOverviewResponse {
  today: string;
  statementsReady: boolean;
  debts: DebtRow[];
  totals: { balance: number; minimums: number; interestYtd: number };
  dueSoon: DueSoonEntry[];
  interest: InterestResponse;
  reminders: { setting: ReminderSetting; ready: boolean };
}

export interface InterestResponse {
  year: number;
  total: number;
  accounts: { accountId: string; name?: string; total: number; months: { month: string; amount: number; source: string }[] }[];
  byMonth: { month: string; amount: number }[];
}

export interface SavedPlan {
  id: string;
  name: string;
  strategy: Strategy;
  extra_monthly: number | string;
  custom_order: string[] | null;
  protect_promos: boolean | null;
  baseline: PlanBaseline | null;
  created_at: string;
  updated_at: string;
}

export interface SavedPlanDetail {
  plan: SavedPlan;
  comparison: PlanComparison;
  progress: PlanProgress | null;
}
