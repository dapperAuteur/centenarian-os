// lib/finance/debt/progress.ts
// A saved plan's baseline (what it planned to pay, month by month, when it was saved) and its
// progress against the linked card/loan payments made since. Pure.
//
// PROGRESS
//   planned to date = the baseline's payments dated on or before today.
//   paid to date    = linked payments (overview.ts isLinkedPayment) into the plan's accounts dated
//                     after the baseline's start date and on or before today.
//   on track        = paid to date >= planned to date (a cent of rounding allowed).

import type { PlanResult } from './plan.ts';
import type { TxnRow } from './overview.ts';
import { isLinkedPayment } from './overview.ts';

/** Months of planned payments kept in the baseline: 10 years. */
export const BASELINE_MONTHS = 120;

export interface PlanBaseline {
  start_date: string;
  debts: { id: string; name: string; balance: number; apr: number | null; min: number | null }[];
  months: { date: string; payments: Record<string, number> }[];
  debt_free_date: string | null;
  total_interest: number;
}

export function makeBaseline(
  plan: PlanResult,
  debts: { id: string; name: string; balance: number; apr: number | null; minPayment: number | null }[],
  startDate: string,
): PlanBaseline {
  return {
    start_date: startDate,
    debts: debts.map((d) => ({ id: d.id, name: d.name, balance: d.balance, apr: d.apr, min: d.minPayment })),
    months: plan.schedule.slice(0, BASELINE_MONTHS).map((m) => ({
      date: m.date,
      payments: Object.fromEntries(Object.entries(m.debts).filter(([, v]) => v.payment > 0).map(([id, v]) => [id, v.payment])),
    })),
    debt_free_date: plan.debtFreeDate,
    total_interest: plan.totalInterest,
  };
}

export interface PlanProgress {
  startDate: string;
  plannedToDate: number;
  paidToDate: number;
  difference: number;
  onTrack: boolean;
  debts: { id: string; name: string; planned: number; paid: number }[];
}

export function planProgress(baseline: PlanBaseline, txns: TxnRow[], today: string): PlanProgress {
  const ids = new Set(baseline.debts.map((d) => d.id));
  const planned = new Map<string, number>();
  for (const m of baseline.months) {
    if (m.date > today) break;
    for (const [id, amount] of Object.entries(m.payments)) planned.set(id, (planned.get(id) ?? 0) + Math.round(amount * 100));
  }
  const paid = new Map<string, number>();
  for (const t of txns) {
    if (!t.account_id || !ids.has(t.account_id) || !isLinkedPayment(t)) continue;
    if (t.transaction_date <= baseline.start_date || t.transaction_date > today) continue;
    paid.set(t.account_id, (paid.get(t.account_id) ?? 0) + Math.round(Math.abs(Number(t.amount)) * 100));
  }
  const debts = baseline.debts.map((d) => ({
    id: d.id,
    name: d.name,
    planned: (planned.get(d.id) ?? 0) / 100,
    paid: (paid.get(d.id) ?? 0) / 100,
  }));
  const plannedCents = [...planned.values()].reduce((s, v) => s + v, 0);
  const paidCents = [...paid.values()].reduce((s, v) => s + v, 0);
  return {
    startDate: baseline.start_date,
    plannedToDate: plannedCents / 100,
    paidToDate: paidCents / 100,
    difference: (paidCents - plannedCents) / 100,
    onTrack: paidCents + 1 >= plannedCents,
    debts,
  };
}
