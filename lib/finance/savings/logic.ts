// lib/finance/savings/logic.ts
// Pure math for savings goals as virtual envelopes (plans/60, Phase D).
//
// RULES (the help articles "Savings goals and envelopes" and "Does this goal
// fit?" say the same in plain words)
//
//   Envelopes
//     - Every goal draws from ONE real account (its funding account). Several
//       goals can share an account; the account's balance is split across
//       them. Allocating never moves money between real accounts.
//     - Saved so far = the goal's starting amount + all its allocations
//       (positive = put in, negative = taken out).
//     - Allocated for an account = the sum of saved-so-far of every goal that
//       draws from it, whatever the goal's status (money set aside stays set
//       aside until it is released). Unallocated = balance - allocated.
//     - Over-allocated: the balance is below what the goals hold (money was
//       spent from the account). Shown in amber with the shortfall; nothing
//       is changed automatically.
//     - An allocation may not take more than is unallocated, a release or move
//       may not take more than the goal holds, and a deposit can't be split
//       into more than its amount (minus what was already allocated from it).
//
//   Balance: the one balance rule in ../balance/logic.ts (re-exported here),
//     opening_balance + income - expenses on the account (asset accounts),
//     counting only transactions after the starting-balance date when set.
//
//   Monthly needed
//     - Months left = whole calendar months from today to the target date,
//       and at least 1 while the date is still ahead.
//     - Monthly needed = (target - saved) / months left. No target date -> no
//       monthly figure. Target date today or past -> the whole remainder is
//       due now (past_due).
//
//   Monthly surplus and "does it fit?"
//     - Surplus for a month = income - expenses, transfers between the
//       person's own accounts excluded (countsTowardTotals()).
//     - Window / method like budgets: the 3, 6 or 12 complete months before
//       this month (default 6), average (default) or median. Months before
//       the first transaction are left out.
//     - Goals take the surplus in priority order (1 first, ties by target
//       date, then by name). Only active, not-yet-reached goals with a target
//       date claim anything. A goal fits when its monthly needed is at most
//       what is left of the surplus after the goals before it.
//     - When it doesn't fit: "fits from" = the date the remainder would be
//       reached saving what is left of the surplus each month (null when
//       nothing is left).
//
//   Pace and projected date
//     - Pace = net allocations dated in the last PACE_MONTHS months, divided
//       by the months covered (the goal's age when younger, at least 1).
//     - Projected date = today + ceil(remaining / pace) months. No pace -> none.
//     - On track: reached, or projected date on or before the target date.
//       Behind (amber): has a target date and no pace, or later than target.
//
//   Milestones: 25, 50, 75 and 100% of the target. A change crosses a level
//   when the percent before is below it and the percent after is at or above.
//
// Imports only sibling files with .ts extensions, so it runs under
// `node --test --experimental-strip-types` (tests/unit/savings.test.ts).

import { countsTowardTotals } from '../transfers/schema.ts';
import { accountBalance, isDebtAccount } from '../balance/logic.ts';
import type { BalanceAccount, BalanceRow } from '../balance/logic.ts';

// The balance rule lives in ../balance/logic.ts; these names stay importable from here.
export { accountBalance, isDebtAccount };
export type { BalanceAccount, BalanceRow };
import { addMonths, monthOfDate, monthRange } from '../budgets/months.ts';
import type { MonthKey } from '../budgets/months.ts';
import { average, median } from '../budgets/logic.ts';
import type { BudgetMethod, BudgetWindow } from '../budgets/logic.ts';

export const GOAL_KINDS = ['equipment', 'house', 'trip', 'emergency', 'vehicle', 'education', 'other'] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];
export const GOAL_KIND_LABEL: Record<GoalKind, string> = {
  equipment: 'Equipment',
  house: 'House',
  trip: 'Trip',
  emergency: 'Emergency fund',
  vehicle: 'Vehicle',
  education: 'Education',
  other: 'Other',
};

export const GOAL_STATUSES = ['active', 'paused', 'done', 'archived'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const MILESTONES = [25, 50, 75, 100] as const;
export type Milestone = (typeof MILESTONES)[number];

/** How many months back the contribution pace looks. */
export const PACE_MONTHS = 3;

export function isGoalKind(value: unknown): value is GoalKind {
  return typeof value === 'string' && (GOAL_KINDS as readonly string[]).includes(value);
}

export function isGoalStatus(value: unknown): value is GoalStatus {
  return typeof value === 'string' && (GOAL_STATUSES as readonly string[]).includes(value);
}

// ── Rows ────────────────────────────────────────────────────────────────────

export interface GoalRow {
  id: string;
  name: string;
  kind: string;
  target_amount: number | string;
  target_date: string | null;
  funding_account_id: string | null;
  starting_amount: number | string | null;
  priority: number | null;
  status: string;
  linked_trip_id?: string | null;
  linked_equipment_id?: string | null;
  milestone_tasks?: boolean | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface AllocationRow {
  id?: string;
  goal_id: string;
  amount: number | string;
  allocated_on: string;
  transaction_id?: string | null;
  note?: string | null;
  created_at?: string | null;
}

// ── Money helpers ───────────────────────────────────────────────────────────

export const toCents = (value: number | string | null | undefined): number => Math.round(Number(value ?? 0) * 100);
export const fromCents = (cents: number): number => cents / 100;

// ── Saved so far and envelopes ──────────────────────────────────────────────

/** goal id -> its allocations' net total, in cents. */
export function allocationTotals(allocations: AllocationRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of allocations) out.set(a.goal_id, (out.get(a.goal_id) ?? 0) + toCents(a.amount));
  return out;
}

/** Starting amount + allocations, in dollars. */
export function savedSoFar(goal: Pick<GoalRow, 'id' | 'starting_amount'>, allocations: AllocationRow[]): number {
  const net = allocations.filter((a) => a.goal_id === goal.id).reduce((sum, a) => sum + toCents(a.amount), 0);
  return fromCents(toCents(goal.starting_amount) + net);
}

export interface EnvelopeSummary {
  balance: number;
  allocated: number;
  /** balance - allocated; negative when over-allocated. */
  unallocated: number;
  /** How far the goals exceed the balance (0 when they don't). */
  over_allocated: number;
}

/** Balance split across the goals that draw from one account. */
export function envelopeSummary(
  balance: number,
  goals: Pick<GoalRow, 'id' | 'starting_amount'>[],
  allocations: AllocationRow[],
): EnvelopeSummary {
  const totals = allocationTotals(allocations);
  const allocatedCents = goals.reduce((sum, g) => sum + toCents(g.starting_amount) + (totals.get(g.id) ?? 0), 0);
  const balanceCents = toCents(balance);
  return {
    balance: fromCents(balanceCents),
    allocated: fromCents(allocatedCents),
    unallocated: fromCents(balanceCents - allocatedCents),
    over_allocated: fromCents(Math.max(0, allocatedCents - balanceCents)),
  };
}

// ── Dates ───────────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Whole calendar months from `from` to `to` (dates 'YYYY-MM-DD'); negative when `to` is earlier. */
export function wholeMonthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (months > 0 && td < fd) months -= 1;
  if (months < 0 && td > fd) months += 1;
  return months;
}

/** Months left to the target date: whole months, at least 1 while it is still ahead, 0 when due. */
export function monthsLeft(today: string, targetDate: string): number {
  if (targetDate <= today) return 0;
  return Math.max(1, wholeMonthsBetween(today, targetDate));
}

/** `date` plus `n` months, the day clamped to the month's length. */
export function addMonthsToDate(date: string, n: number): string {
  const month = addMonths(monthOfDate(date), n);
  const day = Number(date.slice(8, 10));
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

// ── Monthly needed ──────────────────────────────────────────────────────────

export interface MonthlyNeeded {
  /** Null without a target date. */
  monthly: number | null;
  months_left: number | null;
  /** Target date is today or past and money is still missing. */
  past_due: boolean;
}

export function monthlyNeeded(target: number, saved: number, targetDate: string | null, today: string): MonthlyNeeded {
  const remainingCents = Math.max(0, toCents(target) - toCents(saved));
  if (!targetDate) return { monthly: null, months_left: null, past_due: false };
  const left = monthsLeft(today, targetDate);
  if (remainingCents === 0) return { monthly: 0, months_left: left, past_due: false };
  if (left === 0) return { monthly: fromCents(remainingCents), months_left: 0, past_due: true };
  return { monthly: fromCents(Math.ceil(remainingCents / left)), months_left: left, past_due: false };
}

// ── Monthly surplus ─────────────────────────────────────────────────────────

export interface SurplusRow {
  amount: number | string;
  type: string;
  transaction_date: string;
  source?: string | null;
  transfer_group_id?: string | null;
}

export interface SurplusOptions {
  window: BudgetWindow;
  method: BudgetMethod;
  /** This month; the window is the complete months before it. */
  currentMonth: MonthKey;
  /** Month of the first transaction; earlier months are left out. */
  firstMonth?: MonthKey | null;
}

export interface Surplus {
  /** Average or median monthly surplus, rounded to cents; null with no usable months. */
  amount: number | null;
  window: BudgetWindow;
  method: BudgetMethod;
  per_month: { month: MonthKey; income: number; spending: number; surplus: number }[];
}

export function monthlySurplus(rows: SurplusRow[], options: SurplusOptions): Surplus {
  const months = monthRange(addMonths(options.currentMonth, -options.window), addMonths(options.currentMonth, -1)).filter(
    (m) => !options.firstMonth || m >= options.firstMonth,
  );
  const income = new Map<MonthKey, number>();
  const spending = new Map<MonthKey, number>();
  for (const row of rows) {
    if (!countsTowardTotals(row)) continue;
    const month = monthOfDate(row.transaction_date);
    const map = row.type === 'income' ? income : row.type === 'expense' ? spending : null;
    if (map) map.set(month, (map.get(month) ?? 0) + toCents(row.amount));
  }
  const perMonth = months.map((month) => {
    const inc = income.get(month) ?? 0;
    const out = spending.get(month) ?? 0;
    return { month, income: fromCents(inc), spending: fromCents(out), surplus: fromCents(inc - out) };
  });
  const values = perMonth.map((p) => p.surplus);
  const picked = options.method === 'median' ? median(values) : average(values);
  return {
    amount: picked === null ? null : Math.round(picked * 100) / 100,
    window: options.window,
    method: options.method,
    per_month: perMonth,
  };
}

// ── Does it fit? ────────────────────────────────────────────────────────────

export interface FitInput {
  id: string;
  name: string;
  priority: number | null;
  status: string;
  target_date: string | null;
  remaining: number;
  monthly: number | null;
}

export interface FitResult {
  /** Null when the goal claims nothing (no date, not active, or reached) or there is no surplus figure. */
  fits: boolean | null;
  /** Surplus left for this goal after the goals before it. */
  available: number | null;
  /** When it doesn't fit: the date it would be reached saving `available` each month. */
  fits_from: string | null;
}

/** Order goals take the surplus in: priority, then target date (none last), then name. */
export function claimOrder<T extends Pick<FitInput, 'priority' | 'target_date' | 'name'>>(goals: T[]): T[] {
  return [...goals].sort((a, b) => {
    const pa = a.priority ?? Number.MAX_SAFE_INTEGER;
    const pb = b.priority ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    if (a.target_date !== b.target_date) {
      if (!a.target_date) return 1;
      if (!b.target_date) return -1;
      return a.target_date < b.target_date ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export function fitGoals(goals: FitInput[], surplus: number | null, today: string): Map<string, FitResult> {
  const out = new Map<string, FitResult>();
  let leftCents = surplus === null ? null : toCents(surplus);
  for (const goal of claimOrder(goals)) {
    const claims = goal.status === 'active' && goal.monthly !== null && goal.remaining > 0;
    if (!claims || leftCents === null) {
      out.set(goal.id, { fits: null, available: leftCents === null ? null : fromCents(Math.max(0, leftCents)), fits_from: null });
      continue;
    }
    const needCents = toCents(goal.monthly);
    const available = Math.max(0, leftCents);
    const fits = needCents <= available;
    let fitsFrom: string | null = null;
    if (!fits && available > 0) {
      fitsFrom = addMonthsToDate(today, Math.ceil(toCents(goal.remaining) / available));
    }
    out.set(goal.id, { fits, available: fromCents(available), fits_from: fitsFrom });
    leftCents -= needCents;
  }
  return out;
}

// ── Pace and projection ─────────────────────────────────────────────────────

/** Net allocations per month over the last PACE_MONTHS months (or the goal's age when younger). */
export function contributionPace(
  allocations: Pick<AllocationRow, 'amount' | 'allocated_on'>[],
  today: string,
  createdOn?: string | null,
): number {
  const since = addMonthsToDate(today, -PACE_MONTHS);
  let net = 0;
  for (const a of allocations) {
    if (a.allocated_on > since && a.allocated_on <= today) net += toCents(a.amount);
  }
  let months = PACE_MONTHS;
  if (createdOn && createdOn > since) months = Math.max(1, daysBetween(createdOn, today) / 30.4375);
  return fromCents(Math.round(net / months));
}

export function projectedDate(remaining: number, pace: number, today: string): string | null {
  if (toCents(remaining) <= 0) return today;
  if (toCents(pace) <= 0) return null;
  return addMonthsToDate(today, Math.ceil(toCents(remaining) / toCents(pace)));
}

export type TrackStatus = 'reached' | 'on_track' | 'behind' | 'no_date' | 'paused' | 'closed';

export function trackStatus(input: {
  status: string;
  remaining: number;
  target_date: string | null;
  projected: string | null;
}): TrackStatus {
  if (toCents(input.remaining) <= 0) return 'reached';
  if (input.status === 'paused') return 'paused';
  if (input.status === 'done' || input.status === 'archived') return 'closed';
  if (!input.target_date) return 'no_date';
  if (input.projected && input.projected <= input.target_date) return 'on_track';
  return 'behind';
}

// ── Milestones ──────────────────────────────────────────────────────────────

export function percentSaved(saved: number, target: number): number {
  const t = toCents(target);
  if (t <= 0) return 0;
  return (toCents(saved) / t) * 100;
}

/** The highest milestone reached, or 0. */
export function milestoneReached(saved: number, target: number): 0 | Milestone {
  const pct = percentSaved(saved, target);
  let reached: 0 | Milestone = 0;
  for (const m of MILESTONES) if (pct >= m) reached = m;
  return reached;
}

/** Milestones crossed going from `before` to `after` saved. */
export function milestonesCrossed(before: number, after: number, target: number): Milestone[] {
  const from = percentSaved(before, target);
  const to = percentSaved(after, target);
  return MILESTONES.filter((m) => from < m && to >= m);
}

// ── Deposits to allocate ────────────────────────────────────────────────────

export interface DepositRow {
  id: string;
  account_id: string | null;
  type: string;
  amount: number | string;
  transaction_date: string;
  description?: string | null;
  vendor?: string | null;
  source?: string | null;
  transfer_group_id?: string | null;
}

export interface Deposit {
  id: string;
  transaction_date: string;
  description: string | null;
  amount: number;
  allocated: number;
  remaining: number;
  /** One side of a linked transfer from another of the person's accounts. */
  is_transfer: boolean;
}

/** Money that arrived in the account and isn't fully allocated yet, newest first. */
export function depositsToAllocate(
  accountId: string,
  rows: DepositRow[],
  allocations: AllocationRow[],
  limit = 20,
): Deposit[] {
  const fromTx = new Map<string, number>();
  for (const a of allocations) {
    if (a.transaction_id) fromTx.set(a.transaction_id, (fromTx.get(a.transaction_id) ?? 0) + toCents(a.amount));
  }
  return rows
    .filter((r) => r.account_id === accountId && r.type === 'income')
    .map((r) => {
      const amount = toCents(r.amount);
      const allocated = fromTx.get(r.id) ?? 0;
      return {
        id: r.id,
        transaction_date: r.transaction_date,
        description: r.description || r.vendor || null,
        amount: fromCents(amount),
        allocated: fromCents(allocated),
        remaining: fromCents(amount - allocated),
        is_transfer: !!r.transfer_group_id || r.source === 'transfer',
      };
    })
    .filter((d) => toCents(d.remaining) > 0)
    .sort((a, b) => (a.transaction_date < b.transaction_date ? 1 : a.transaction_date > b.transaction_date ? -1 : a.id < b.id ? 1 : -1))
    .slice(0, limit);
}

// ── Allocation checks ───────────────────────────────────────────────────────

export class SavingsRuleError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface EnvelopeGoal {
  id: string;
  name: string;
  funding_account_id: string | null;
  saved: number;
}

export type AllocationRequest =
  | { action: 'allocate'; goal_id: string; amount: number; transaction_id?: string | null }
  | { action: 'release'; goal_id: string; amount: number }
  | { action: 'move'; from_goal_id: string; to_goal_id: string; amount: number }
  | { action: 'split'; transaction_id: string; parts: { goal_id: string; amount: number }[] };

export interface PlannedAllocation {
  goal_id: string;
  amount: number;
  transaction_id: string | null;
}

export interface AllocationContext {
  goals: Map<string, EnvelopeGoal>;
  /** Unallocated per funding account. */
  unallocated: Map<string, number>;
  /** For allocate-from-deposit and split: the deposit, and what was already allocated from it. */
  deposit?: { id: string; account_id: string | null; type: string; amount: number; allocated: number } | null;
}

function goalOrThrow(ctx: AllocationContext, id: string): EnvelopeGoal {
  const goal = ctx.goals.get(id);
  if (!goal) throw new SavingsRuleError('That savings goal was not found.', 404);
  return goal;
}

function accountOrThrow(goal: EnvelopeGoal): string {
  if (!goal.funding_account_id) {
    throw new SavingsRuleError(`Pick the account "${goal.name}" draws from before putting money in it.`);
  }
  return goal.funding_account_id;
}

function positiveCents(amount: number): number {
  const cents = toCents(amount);
  if (!Number.isFinite(amount) || cents <= 0) throw new SavingsRuleError('Enter an amount above $0.');
  return cents;
}

/**
 * Checks a request against the envelope rules and returns the rows to insert.
 * Throws SavingsRuleError with a message for the screen.
 */
export function planAllocation(req: AllocationRequest, ctx: AllocationContext): PlannedAllocation[] {
  if (req.action === 'allocate') {
    const goal = goalOrThrow(ctx, req.goal_id);
    const account = accountOrThrow(goal);
    const cents = positiveCents(req.amount);
    const free = toCents(ctx.unallocated.get(account) ?? 0);
    if (cents > free) {
      throw new SavingsRuleError(
        free > 0
          ? `Only ${money(fromCents(free))} is unallocated in that account. Allocate that much or less.`
          : 'Nothing is unallocated in that account. Release money from another goal first.',
      );
    }
    let txId: string | null = null;
    if (req.transaction_id) {
      checkDeposit(ctx, account, cents);
      txId = req.transaction_id;
    }
    return [{ goal_id: goal.id, amount: fromCents(cents), transaction_id: txId }];
  }

  if (req.action === 'release') {
    const goal = goalOrThrow(ctx, req.goal_id);
    const cents = positiveCents(req.amount);
    if (cents > toCents(goal.saved)) {
      throw new SavingsRuleError(`"${goal.name}" holds ${money(goal.saved)}. Release that much or less.`);
    }
    return [{ goal_id: goal.id, amount: -fromCents(cents), transaction_id: null }];
  }

  if (req.action === 'move') {
    if (req.from_goal_id === req.to_goal_id) throw new SavingsRuleError('Pick two different goals.');
    const from = goalOrThrow(ctx, req.from_goal_id);
    const to = goalOrThrow(ctx, req.to_goal_id);
    accountOrThrow(to);
    if (from.funding_account_id !== to.funding_account_id) {
      throw new SavingsRuleError(
        'Those goals draw from different accounts. Moving money between real accounts is a transfer: record it on the Transactions page, then allocate it.',
      );
    }
    const cents = positiveCents(req.amount);
    if (cents > toCents(from.saved)) {
      throw new SavingsRuleError(`"${from.name}" holds ${money(from.saved)}. Move that much or less.`);
    }
    return [
      { goal_id: from.id, amount: -fromCents(cents), transaction_id: null },
      { goal_id: to.id, amount: fromCents(cents), transaction_id: null },
    ];
  }

  // split
  const parts = req.parts.filter((p) => toCents(p.amount) !== 0);
  if (parts.length === 0) throw new SavingsRuleError('Enter an amount for at least one goal.');
  const seen = new Set<string>();
  let account: string | null = null;
  let total = 0;
  for (const part of parts) {
    if (seen.has(part.goal_id)) throw new SavingsRuleError('Each goal can appear only once in a split.');
    seen.add(part.goal_id);
    const goal = goalOrThrow(ctx, part.goal_id);
    const acct = accountOrThrow(goal);
    if (account && acct !== account) throw new SavingsRuleError('All goals in a split must draw from the same account.');
    account = acct;
    total += positiveCents(part.amount);
  }
  checkDeposit(ctx, account!, total);
  const free = toCents(ctx.unallocated.get(account!) ?? 0);
  if (total > free) {
    throw new SavingsRuleError(
      `Only ${money(fromCents(Math.max(0, free)))} is unallocated in that account, so this split is too large.`,
    );
  }
  return parts.map((p) => ({ goal_id: p.goal_id, amount: fromCents(toCents(p.amount)), transaction_id: req.transaction_id }));
}

function checkDeposit(ctx: AllocationContext, account: string, cents: number): void {
  const dep = ctx.deposit;
  if (!dep) throw new SavingsRuleError('That deposit was not found.', 404);
  if (dep.type !== 'income' || dep.account_id !== account) {
    throw new SavingsRuleError('That transaction is not a deposit into the account these goals draw from.');
  }
  const left = toCents(dep.amount) - toCents(dep.allocated);
  if (cents > left) {
    throw new SavingsRuleError(
      left > 0
        ? `Only ${money(fromCents(left))} of that deposit is left to allocate.`
        : 'That deposit is already fully allocated.',
    );
  }
}
