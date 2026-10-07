// lib/finance/savings/server.ts
// Database reads and writes for the savings routes (app/api/finance/savings/*).
//
// Callers pass the RLS session client and the signed-in user's id; every
// query is also scoped with `.eq('user_id', userId)`. The rules live in
// ./logic.ts; this file loads the rows those rules need and writes the result.
//
// savings_goals / savings_allocations arrive with migration 212. Before it is
// applied, reads answer { ready: false } and writes throw SAVINGS_NOT_READY.
//
// Writes are check-then-insert: two allocations sent at the same moment could
// each pass the "unallocated" check. The page then shows the account as
// over-allocated in amber, and releasing money fixes it.
//
// Imports only sibling files with .ts extensions (and types), so the tests run
// it against the in-memory fake (tests/unit/savings.test.ts).

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingTable, loadFirstMonth, loadSpendingRows } from '../budgets/server.ts';
import { addMonths, firstDay, lastDay, monthOf } from '../budgets/months.ts';
import type { BudgetMethod, BudgetWindow } from '../budgets/logic.ts';
import { accountLabel } from '../transfers/pairing.ts';
import { missingTransferColumn } from '../transfers/schema.ts';
import type { DbErrorLike } from '../transfers/schema.ts';
import {
  accountBalance,
  allocationTotals,
  contributionPace,
  depositsToAllocate,
  envelopeSummary,
  fitGoals,
  fromCents,
  GOAL_KIND_LABEL,
  isDateString,
  isDebtAccount,
  isGoalKind,
  isGoalStatus,
  milestoneReached,
  milestonesCrossed,
  monthlyNeeded,
  monthlySurplus,
  percentSaved,
  planAllocation,
  projectedDate,
  SavingsRuleError,
  toCents,
  trackStatus,
} from './logic.ts';
import type {
  AllocationRequest,
  AllocationRow,
  Deposit,
  DepositRow,
  EnvelopeGoal,
  FitResult,
  GoalKind,
  GoalRow,
  GoalStatus,
  Milestone,
  Surplus,
  TrackStatus,
} from './logic.ts';

export { SavingsRuleError };

export const SAVINGS_NOT_READY = {
  error:
    'Savings goals need a database update first: run migration 212 (supabase/migrations/212_savings_goals.sql). ' +
    'Nothing was changed.',
  code: 'savings_not_migrated',
} as const;

const PAGE_SIZE = 1000;
const MAX_AMOUNT = 9_999_999_999.99; // numeric(12,2)

export const GOAL_SELECT =
  'id, name, kind, target_amount, target_date, funding_account_id, starting_amount, priority, status, ' +
  'linked_trip_id, linked_equipment_id, milestone_tasks, notes, created_at';
const ALLOCATION_SELECT = 'id, goal_id, amount, allocated_on, transaction_id, note, created_at';
// '*' so opening_balance_date (migration 221) comes along once it exists, and nothing breaks before.
const ACCOUNT_SELECT = '*';
const TX_SELECT = 'id, account_id, type, amount, transaction_date, description, vendor, source, transfer_group_id';
const TX_SELECT_NO_GROUP = 'id, account_id, type, amount, transaction_date, description, vendor, source';

/** The first row of an insert/update ... select() result. */
function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T) ?? null;
  return (data as T) ?? null;
}

function notReady(error: DbErrorLike | null | undefined): boolean {
  return isMissingTable(error, 'savings_goals') || isMissingTable(error, 'savings_allocations');
}

function fail(error: DbErrorLike | null | undefined, fallback: string): never {
  if (notReady(error)) throw new SavingsRuleError(SAVINGS_NOT_READY.error, 503, SAVINGS_NOT_READY.code);
  throw new SavingsRuleError(error?.message || fallback, 500);
}

// ── Loading ─────────────────────────────────────────────────────────────────

export interface AccountRecord {
  id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  last_four: string | null;
  opening_balance: number | string | null;
  /** Migration 221: the day the opening balance is as of. */
  opening_balance_date?: string | null;
  is_active: boolean | null;
}

/** Every transaction on the given accounts, all pages. Works before migration 202 (no transfer_group_id). */
export async function loadAccountRows(
  db: SupabaseClient,
  userId: string,
  accountIds: string[],
): Promise<{ rows: DepositRow[]; error: DbErrorLike | null }> {
  if (accountIds.length === 0) return { rows: [], error: null };
  const run = async (select: string) => {
    const rows: DepositRow[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const res = await db
        .from('financial_transactions')
        .select(select)
        .eq('user_id', userId)
        .in('account_id', accountIds)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (res.error) return { rows, error: res.error as DbErrorLike };
      const page = (res.data ?? []) as unknown as DepositRow[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) return { rows, error: null };
    }
  };
  const first = await run(TX_SELECT);
  if (missingTransferColumn(first.error) === 'transfer_group_id') return run(TX_SELECT_NO_GROUP);
  return first;
}

async function loadGoalsAndAllocations(
  db: SupabaseClient,
  userId: string,
): Promise<{ goals: GoalRow[]; allocations: AllocationRow[]; ready: boolean; error: DbErrorLike | null }> {
  const goalRes = await db.from('savings_goals').select(GOAL_SELECT).eq('user_id', userId).order('created_at');
  if (notReady(goalRes.error)) return { goals: [], allocations: [], ready: false, error: null };
  if (goalRes.error) return { goals: [], allocations: [], ready: true, error: goalRes.error };
  const allocations: AllocationRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await db
      .from('savings_allocations')
      .select(ALLOCATION_SELECT)
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (notReady(res.error)) return { goals: [], allocations: [], ready: false, error: null };
    if (res.error) return { goals: [], allocations: [], ready: true, error: res.error };
    const page = (res.data ?? []) as AllocationRow[];
    allocations.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return { goals: (goalRes.data ?? []) as unknown as GoalRow[], allocations, ready: true, error: null };
}

export interface GoalView {
  id: string;
  name: string;
  kind: GoalKind;
  kind_label: string;
  target_amount: number;
  target_date: string | null;
  funding_account_id: string | null;
  starting_amount: number;
  priority: number;
  status: GoalStatus;
  linked_trip_id: string | null;
  linked_equipment_id: string | null;
  linked_label: string | null;
  milestone_tasks: boolean;
  notes: string | null;
  saved: number;
  remaining: number;
  /** 0-100+, one decimal. */
  percent: number;
  milestone: 0 | Milestone;
  monthly_needed: number | null;
  months_left: number | null;
  past_due: boolean;
  pace: number;
  projected_date: string | null;
  track: TrackStatus;
  fit: FitResult;
  recent: AllocationRow[];
}

export interface AccountView {
  id: string;
  label: string;
  account_type: string;
  is_active: boolean;
  balance: number;
  allocated: number;
  unallocated: number;
  over_allocated: number;
  goals: GoalView[];
  deposits: Deposit[];
}

export interface FundingOption {
  id: string;
  label: string;
  account_type: string;
}

export interface LinkOption {
  id: string;
  label: string;
  amount: number | null;
  date: string | null;
}

export interface SavingsOverview {
  ready: boolean;
  today: string;
  surplus: Surplus | null;
  accounts: AccountView[];
  /** Goals whose funding account was removed. */
  unassigned: GoalView[];
  funding_options: FundingOption[];
  link_options: { trips: LinkOption[]; equipment: LinkOption[] };
}

function tripLabel(t: { origin?: string | null; destination?: string | null; date?: string | null }): string {
  const route = t.origin && t.destination ? `${t.origin} to ${t.destination}` : t.destination || t.origin || 'Trip';
  return t.date ? `${route} (${t.date})` : route;
}

export async function loadSavingsOverview(
  db: SupabaseClient,
  userId: string,
  options: { today: string; window: BudgetWindow; method: BudgetMethod },
): Promise<{ overview: SavingsOverview | null; error: DbErrorLike | null }> {
  const { today, window, method } = options;
  const currentMonth = monthOf(new Date(`${today}T12:00:00Z`));

  const [acctRes, gaRes, tripRes, equipRes] = await Promise.all([
    db.from('financial_accounts').select(ACCOUNT_SELECT).eq('user_id', userId).order('created_at', { ascending: true }),
    loadGoalsAndAllocations(db, userId),
    db
      .from('trips')
      .select('id, origin, destination, date, budget_amount, trip_status')
      .eq('user_id', userId)
      .eq('trip_status', 'planned')
      .order('date', { ascending: true }),
    db
      .from('equipment')
      .select('id, name, purchase_price, is_active')
      .eq('user_id', userId)
      .order('name', { ascending: true }),
  ]);
  if (acctRes.error) return { overview: null, error: acctRes.error };
  if (gaRes.error) return { overview: null, error: gaRes.error };

  const accounts = (acctRes.data ?? []) as AccountRecord[];
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const fundingOptions: FundingOption[] = accounts
    .filter((a) => !isDebtAccount(a.account_type) && a.is_active !== false)
    .sort((a, b) => Number(b.account_type === 'savings') - Number(a.account_type === 'savings'))
    .map((a) => ({ id: a.id, label: accountLabel(a), account_type: a.account_type }));

  // Planned trips / equipment only feed the link pickers; a failed read just leaves them empty.
  type TripRec = { id: string; origin: string | null; destination: string | null; date: string | null; budget_amount: number | string | null };
  type EquipRec = { id: string; name: string; purchase_price: number | string | null; is_active: boolean | null };
  const trips = (tripRes.error ? [] : (tripRes.data ?? [])) as TripRec[];
  const equipment = (equipRes.error ? [] : (equipRes.data ?? [])) as EquipRec[];
  const linkOptions = {
    trips: trips.map((t) => ({
      id: t.id,
      label: tripLabel(t),
      amount: t.budget_amount == null ? null : Number(t.budget_amount),
      date: t.date,
    })),
    equipment: equipment.map((e) => ({
      id: e.id,
      label: e.is_active === false ? `${e.name} (retired)` : e.name,
      amount: e.purchase_price == null ? null : Number(e.purchase_price),
      date: null,
    })),
  };

  if (!gaRes.ready) {
    return {
      overview: { ready: false, today, surplus: null, accounts: [], unassigned: [], funding_options: fundingOptions, link_options: linkOptions },
      error: null,
    };
  }

  const { goals, allocations } = gaRes;
  const fundingIds = [...new Set(goals.map((g) => g.funding_account_id).filter((id): id is string => !!id && accountById.has(id)))];

  const surplusFrom = addMonths(currentMonth, -window);
  const [txRes, spendRes, firstRes] = await Promise.all([
    loadAccountRows(db, userId, fundingIds),
    loadSpendingRows(db, userId, firstDay(surplusFrom), lastDay(addMonths(currentMonth, -1))),
    loadFirstMonth(db, userId),
  ]);
  const error = txRes.error ?? spendRes.error ?? firstRes.error;
  if (error) return { overview: null, error };

  const surplus = monthlySurplus(spendRes.rows, { window, method, currentMonth, firstMonth: firstRes.month });

  const totals = allocationTotals(allocations);
  const byGoal = new Map<string, AllocationRow[]>();
  for (const a of allocations) {
    const list = byGoal.get(a.goal_id) ?? [];
    list.push(a);
    byGoal.set(a.goal_id, list);
  }

  const tripLabels = new Map(linkOptions.trips.map((t) => [t.id, t.label]));
  const equipLabels = new Map(linkOptions.equipment.map((e) => [e.id, e.label]));

  // First pass: saved, remaining, monthly needed (the fit check needs them all).
  const base = goals.map((g) => {
    const saved = fromCents(toCents(g.starting_amount) + (totals.get(g.id) ?? 0));
    const target = Number(g.target_amount);
    const remaining = fromCents(Math.max(0, toCents(target) - toCents(saved)));
    const need = monthlyNeeded(target, saved, g.target_date, today);
    return { g, saved, target, remaining, need };
  });
  const fits = fitGoals(
    base.map(({ g, remaining, need }) => ({
      id: g.id,
      name: g.name,
      priority: g.priority,
      status: g.status,
      target_date: g.target_date,
      remaining,
      monthly: need.monthly,
    })),
    surplus.amount,
    today,
  );

  const views = new Map<string, GoalView>();
  for (const { g, saved, target, remaining, need } of base) {
    const own = byGoal.get(g.id) ?? [];
    const pace = contributionPace(own, today, g.created_at ? g.created_at.slice(0, 10) : null);
    const projected = projectedDate(remaining, pace, today);
    const linked = g.linked_trip_id
      ? tripLabels.get(g.linked_trip_id) ?? 'A trip'
      : g.linked_equipment_id
        ? equipLabels.get(g.linked_equipment_id) ?? 'An equipment item'
        : null;
    const kind: GoalKind = isGoalKind(g.kind) ? g.kind : 'other';
    views.set(g.id, {
      id: g.id,
      name: g.name,
      kind,
      kind_label: GOAL_KIND_LABEL[kind],
      target_amount: target,
      target_date: g.target_date,
      funding_account_id: g.funding_account_id,
      starting_amount: Number(g.starting_amount ?? 0),
      priority: g.priority ?? 1,
      status: isGoalStatus(g.status) ? g.status : 'active',
      linked_trip_id: g.linked_trip_id ?? null,
      linked_equipment_id: g.linked_equipment_id ?? null,
      linked_label: linked,
      milestone_tasks: g.milestone_tasks === true,
      notes: g.notes ?? null,
      saved,
      remaining,
      percent: Math.round(percentSaved(saved, target) * 10) / 10,
      milestone: milestoneReached(saved, target),
      monthly_needed: need.monthly,
      months_left: need.months_left,
      past_due: need.past_due,
      pace,
      projected_date: projected,
      track: trackStatus({ status: g.status, remaining, target_date: g.target_date, projected }),
      fit: fits.get(g.id) ?? { fits: null, available: null, fits_from: null },
      recent: [...own].sort((a, b) => (a.allocated_on < b.allocated_on ? 1 : a.allocated_on > b.allocated_on ? -1 : 0)).slice(0, 5),
    });
  }

  const accountViews: AccountView[] = fundingIds.map((id) => {
    const account = accountById.get(id)!;
    const accountGoals = goals.filter((g) => g.funding_account_id === id);
    const rows = txRes.rows.filter((r) => r.account_id === id);
    const balance = accountBalance(account, rows);
    const env = envelopeSummary(balance, accountGoals, allocations);
    return {
      id,
      label: accountLabel(account),
      account_type: account.account_type,
      is_active: account.is_active !== false,
      ...env,
      goals: accountGoals.map((g) => views.get(g.id)!),
      deposits: depositsToAllocate(id, rows, allocations),
    };
  });

  const unassigned = goals
    .filter((g) => !g.funding_account_id || !accountById.has(g.funding_account_id))
    .map((g) => views.get(g.id)!);

  return {
    overview: {
      ready: true,
      today,
      surplus,
      accounts: accountViews,
      unassigned,
      funding_options: fundingOptions,
      link_options: linkOptions,
    },
    error: null,
  };
}

// ── Envelope for one account ────────────────────────────────────────────────

interface EnvelopeState {
  account: AccountRecord;
  goals: GoalRow[];
  allocations: AllocationRow[];
  unallocated: number;
}

async function loadAccountOrThrow(db: SupabaseClient, userId: string, accountId: string): Promise<AccountRecord> {
  const res = await db.from('financial_accounts').select(ACCOUNT_SELECT).eq('user_id', userId).eq('id', accountId).maybeSingle();
  if (res.error) throw new SavingsRuleError(res.error.message || 'Could not read the account.', 500);
  const account = res.data as AccountRecord | null;
  if (!account) throw new SavingsRuleError('That account was not found.', 404);
  if (isDebtAccount(account.account_type)) {
    throw new SavingsRuleError('A goal has to draw from money you have (savings, checking or cash), not a card or loan.');
  }
  return account;
}

async function envelopeState(db: SupabaseClient, userId: string, accountId: string): Promise<EnvelopeState> {
  const account = await loadAccountOrThrow(db, userId, accountId);
  const ga = await loadGoalsAndAllocations(db, userId);
  if (!ga.ready) throw new SavingsRuleError(SAVINGS_NOT_READY.error, 503, SAVINGS_NOT_READY.code);
  if (ga.error) fail(ga.error, 'Could not read savings goals.');
  const tx = await loadAccountRows(db, userId, [accountId]);
  if (tx.error) throw new SavingsRuleError(tx.error.message || 'Could not read the account.', 500);
  const goals = ga.goals.filter((g) => g.funding_account_id === accountId);
  const env = envelopeSummary(accountBalance(account, tx.rows), goals, ga.allocations);
  return { account, goals, allocations: ga.allocations, unallocated: env.unallocated };
}

// ── Goal input ──────────────────────────────────────────────────────────────

export interface GoalInput {
  name?: string;
  kind?: GoalKind;
  target_amount?: number;
  target_date?: string | null;
  funding_account_id?: string | null;
  starting_amount?: number;
  priority?: number;
  status?: GoalStatus;
  linked_trip_id?: string | null;
  linked_equipment_id?: string | null;
  milestone_tasks?: boolean;
  notes?: string | null;
}

function money(value: unknown, label: string, allowZero: boolean): number {
  const n = Number(value);
  if (value === '' || value === null || !Number.isFinite(n) || n < 0 || (!allowZero && n === 0) || n > MAX_AMOUNT) {
    throw new SavingsRuleError(`${label} must be a number${allowZero ? ' of zero or more' : ' above zero'}.`);
  }
  return Math.round(n * 100) / 100;
}

function optionalId(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new SavingsRuleError(`${label} is not valid.`);
  return value;
}

/** Checks a create (partial = false) or update (partial = true) body. */
export function parseGoalInput(raw: unknown, partial: boolean): GoalInput {
  if (!raw || typeof raw !== 'object') throw new SavingsRuleError('Send the goal as JSON.');
  const body = raw as Record<string, unknown>;
  const out: GoalInput = {};
  const has = (key: string) => body[key] !== undefined;

  if (!partial || has('name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new SavingsRuleError('Give the goal a name.');
    if (name.length > 120) throw new SavingsRuleError('Keep the name to 120 characters or fewer.');
    out.name = name;
  }
  if (!partial || has('kind')) {
    const kind = body.kind ?? 'other';
    if (!isGoalKind(kind)) throw new SavingsRuleError('Pick what the goal is for.');
    out.kind = kind;
  }
  if (!partial || has('target_amount')) out.target_amount = money(body.target_amount, 'The target', false);
  if (has('target_date')) {
    if (body.target_date === null || body.target_date === '') out.target_date = null;
    else if (!isDateString(body.target_date)) throw new SavingsRuleError('The target date must look like 2027-06-30.');
    else out.target_date = body.target_date;
  }
  if (!partial || has('funding_account_id')) {
    const id = optionalId(body.funding_account_id, 'The account');
    if (!id) throw new SavingsRuleError('Pick the account this goal draws from.');
    out.funding_account_id = id;
  }
  if (has('starting_amount')) out.starting_amount = money(body.starting_amount ?? 0, 'The starting amount', true);
  if (has('priority')) {
    const p = Number(body.priority);
    if (!Number.isInteger(p) || p < 1 || p > 99) throw new SavingsRuleError('Priority must be a whole number from 1 to 99.');
    out.priority = p;
  }
  if (has('status')) {
    if (!isGoalStatus(body.status)) throw new SavingsRuleError('Status must be active, paused, done or archived.');
    out.status = body.status;
  }
  if (has('linked_trip_id')) out.linked_trip_id = optionalId(body.linked_trip_id, 'The trip');
  if (has('linked_equipment_id')) out.linked_equipment_id = optionalId(body.linked_equipment_id, 'The equipment item');
  if (out.linked_trip_id && out.linked_equipment_id) {
    throw new SavingsRuleError('Link a goal to a trip or an equipment item, not both.');
  }
  if (has('milestone_tasks')) {
    if (typeof body.milestone_tasks !== 'boolean') throw new SavingsRuleError('Milestone tasks must be on or off.');
    out.milestone_tasks = body.milestone_tasks;
  }
  if (has('notes')) {
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    if (notes.length > 2000) throw new SavingsRuleError('Keep notes to 2000 characters or fewer.');
    out.notes = notes || null;
  }
  if (partial && Object.keys(out).length === 0) throw new SavingsRuleError('Nothing to change.');
  return out;
}

async function checkLinks(db: SupabaseClient, userId: string, input: GoalInput): Promise<void> {
  if (input.linked_trip_id) {
    const res = await db.from('trips').select('id').eq('user_id', userId).eq('id', input.linked_trip_id).maybeSingle();
    if (res.error || !res.data) throw new SavingsRuleError('That trip was not found.', 404);
  }
  if (input.linked_equipment_id) {
    const res = await db.from('equipment').select('id').eq('user_id', userId).eq('id', input.linked_equipment_id).maybeSingle();
    if (res.error || !res.data) throw new SavingsRuleError('That equipment item was not found.', 404);
  }
}

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function tooMuch(amount: number, unallocated: number, what: string): SavingsRuleError {
  return new SavingsRuleError(
    `${what} of ${usd(amount)} is more than the ${usd(Math.max(0, unallocated))} unallocated in that account. ` +
      'Lower it, or release money from another goal first.',
  );
}

export async function createGoal(db: SupabaseClient, userId: string, input: GoalInput): Promise<GoalRow> {
  await checkLinks(db, userId, input);
  const state = await envelopeState(db, userId, input.funding_account_id!);
  const starting = input.starting_amount ?? 0;
  if (toCents(starting) > toCents(state.unallocated)) throw tooMuch(starting, state.unallocated, 'A starting amount');
  const res = await db
    .from('savings_goals')
    .insert({
      user_id: userId,
      name: input.name,
      kind: input.kind ?? 'other',
      target_amount: input.target_amount,
      target_date: input.target_date ?? null,
      funding_account_id: input.funding_account_id,
      starting_amount: starting,
      priority: input.priority ?? 1,
      status: input.status ?? 'active',
      linked_trip_id: input.linked_trip_id ?? null,
      linked_equipment_id: input.linked_equipment_id ?? null,
      milestone_tasks: input.milestone_tasks ?? false,
      notes: input.notes ?? null,
    })
    .select(GOAL_SELECT);
  const created = firstRow<GoalRow>(res.data);
  if (res.error || !created) fail(res.error, 'The goal could not be saved.');
  return created;
}

async function loadGoalOrThrow(db: SupabaseClient, userId: string, goalId: string): Promise<GoalRow> {
  const res = await db.from('savings_goals').select(GOAL_SELECT).eq('user_id', userId).eq('id', goalId).maybeSingle();
  if (res.error) fail(res.error, 'Could not read the goal.');
  if (!res.data) throw new SavingsRuleError('That savings goal was not found.', 404);
  return res.data as unknown as GoalRow;
}

async function goalSaved(db: SupabaseClient, userId: string, goal: GoalRow): Promise<number> {
  const res = await db.from('savings_allocations').select('amount').eq('user_id', userId).eq('goal_id', goal.id);
  if (res.error) fail(res.error, 'Could not read the goal.');
  const net = ((res.data ?? []) as { amount: number | string }[]).reduce((s, a) => s + toCents(a.amount), 0);
  return fromCents(toCents(goal.starting_amount) + net);
}

export interface UpdateResult {
  goal: GoalRow;
  /** Money returned to unallocated because the goal was archived. */
  released: number;
}

/**
 * Updates a goal. Archiving releases what the goal holds back to unallocated
 * (a negative allocation). Raising the starting amount, or switching to
 * another account, must fit in that account's unallocated money.
 */
export async function updateGoal(
  db: SupabaseClient,
  userId: string,
  goalId: string,
  input: GoalInput,
  today: string,
): Promise<UpdateResult> {
  const current = await loadGoalOrThrow(db, userId, goalId);
  await checkLinks(db, userId, input);

  const changes: Record<string, unknown> = { ...input };
  if (input.linked_trip_id) changes.linked_equipment_id = null;
  if (input.linked_equipment_id) changes.linked_trip_id = null;

  const newAccount = input.funding_account_id ?? current.funding_account_id;
  const startDelta = input.starting_amount !== undefined ? toCents(input.starting_amount) - toCents(current.starting_amount) : 0;
  const switching = input.funding_account_id !== undefined && input.funding_account_id !== current.funding_account_id;

  const saved = await goalSaved(db, userId, current);
  if ((startDelta > 0 || switching) && newAccount) {
    const state = await envelopeState(db, userId, newAccount);
    if (switching) {
      const moving = toCents(saved) + startDelta;
      if (moving > toCents(state.unallocated)) throw tooMuch(fromCents(moving), state.unallocated, 'This goal holds money: moving it');
    } else if (startDelta > 0 && startDelta > toCents(state.unallocated)) {
      throw tooMuch(fromCents(startDelta), state.unallocated, 'Raising the starting amount');
    }
  }

  const res = await db
    .from('savings_goals')
    .update(changes)
    .eq('user_id', userId)
    .eq('id', goalId)
    .select(GOAL_SELECT);
  const updated = firstRow<GoalRow>(res.data);
  if (res.error || !updated) fail(res.error, 'The goal could not be saved.');

  let released = 0;
  if (input.status === 'archived' && current.status !== 'archived') {
    const holds = toCents(saved) + startDelta;
    if (holds > 0) {
      const ins = await db.from('savings_allocations').insert({
        goal_id: goalId,
        user_id: userId,
        amount: -fromCents(holds),
        allocated_on: today,
        transaction_id: null,
        note: 'Released when the goal was archived',
      });
      if (ins.error) fail(ins.error, 'The goal was archived, but its money could not be released.');
      released = fromCents(holds);
    }
  }
  return { goal: updated, released };
}

export async function deleteGoal(db: SupabaseClient, userId: string, goalId: string): Promise<void> {
  await loadGoalOrThrow(db, userId, goalId);
  const res = await db.from('savings_allocations').delete().eq('user_id', userId).eq('goal_id', goalId);
  if (res.error) fail(res.error, 'The goal could not be deleted.');
  const del = await db.from('savings_goals').delete().eq('user_id', userId).eq('id', goalId);
  if (del.error) fail(del.error, 'The goal could not be deleted.');
}

// ── Allocations ─────────────────────────────────────────────────────────────

/** Checks an allocation request body. */
export function parseAllocationRequest(raw: unknown): AllocationRequest {
  if (!raw || typeof raw !== 'object') throw new SavingsRuleError('Send the allocation as JSON.');
  const body = raw as Record<string, unknown>;
  const id = (value: unknown, label: string) => {
    if (typeof value !== 'string' || !value) throw new SavingsRuleError(`Pick ${label}.`);
    return value;
  };
  const amount = (value: unknown) => {
    const n = Number(value);
    if (value === '' || value === null || !Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) {
      throw new SavingsRuleError('Enter an amount above $0.');
    }
    return n;
  };
  switch (body.action) {
    case 'allocate':
      return {
        action: 'allocate',
        goal_id: id(body.goal_id, 'a goal'),
        amount: amount(body.amount),
        transaction_id: typeof body.transaction_id === 'string' && body.transaction_id ? body.transaction_id : null,
      };
    case 'release':
      return { action: 'release', goal_id: id(body.goal_id, 'a goal'), amount: amount(body.amount) };
    case 'move':
      return {
        action: 'move',
        from_goal_id: id(body.from_goal_id, 'the goal to move money from'),
        to_goal_id: id(body.to_goal_id, 'the goal to move money to'),
        amount: amount(body.amount),
      };
    case 'split': {
      if (!Array.isArray(body.parts)) throw new SavingsRuleError('Enter an amount for at least one goal.');
      if (body.parts.length > 50) throw new SavingsRuleError('Too many goals in one split.');
      const parts = body.parts
        .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
        .filter((p) => p.amount !== '' && p.amount !== null && p.amount !== undefined && Number(p.amount) !== 0)
        .map((p) => ({ goal_id: id(p.goal_id, 'a goal'), amount: amount(p.amount) }));
      return { action: 'split', transaction_id: id(body.transaction_id, 'a deposit'), parts };
    }
    default:
      throw new SavingsRuleError('Action must be allocate, release, move or split.');
  }
}

export interface CrossedMilestones {
  goal: GoalRow;
  levels: Milestone[];
  saved: number;
}

export interface AllocationResult {
  inserted: number;
  crossed: CrossedMilestones[];
}

export async function applyAllocation(
  db: SupabaseClient,
  userId: string,
  req: AllocationRequest,
  today: string,
): Promise<AllocationResult> {
  const ga = await loadGoalsAndAllocations(db, userId);
  if (!ga.ready) throw new SavingsRuleError(SAVINGS_NOT_READY.error, 503, SAVINGS_NOT_READY.code);
  if (ga.error) fail(ga.error, 'Could not read savings goals.');

  const goalIds =
    req.action === 'move' ? [req.from_goal_id, req.to_goal_id] : req.action === 'split' ? req.parts.map((p) => p.goal_id) : [req.goal_id];
  const involved = ga.goals.filter((g) => goalIds.includes(g.id));
  const accountIds = [...new Set(involved.map((g) => g.funding_account_id).filter((id): id is string => !!id))];

  const accounts = new Map<string, AccountRecord>();
  for (const id of accountIds) accounts.set(id, await loadAccountOrThrow(db, userId, id));
  const tx = await loadAccountRows(db, userId, accountIds);
  if (tx.error) throw new SavingsRuleError(tx.error.message || 'Could not read the account.', 500);

  const totals = allocationTotals(ga.allocations);
  const savedOf = (g: GoalRow) => fromCents(toCents(g.starting_amount) + (totals.get(g.id) ?? 0));
  const goals = new Map<string, EnvelopeGoal>(
    ga.goals.map((g) => [g.id, { id: g.id, name: g.name, funding_account_id: g.funding_account_id, saved: savedOf(g) }]),
  );
  const unallocated = new Map<string, number>();
  for (const [id, account] of accounts) {
    const balance = accountBalance(account, tx.rows.filter((r) => r.account_id === id));
    const env = envelopeSummary(balance, ga.goals.filter((g) => g.funding_account_id === id), ga.allocations);
    unallocated.set(id, env.unallocated);
  }

  const depositId = req.action === 'split' ? req.transaction_id : req.action === 'allocate' ? req.transaction_id ?? null : null;
  let deposit = null;
  if (depositId) {
    const row = tx.rows.find((r) => r.id === depositId);
    if (row) {
      const already = ga.allocations.filter((a) => a.transaction_id === depositId).reduce((s, a) => s + toCents(a.amount), 0);
      deposit = { id: row.id, account_id: row.account_id, type: row.type, amount: Number(row.amount), allocated: fromCents(already) };
    }
  }

  const planned = planAllocation(req, { goals, unallocated, deposit });
  const note =
    req.action === 'move'
      ? `Moved from "${goals.get(req.from_goal_id)!.name}" to "${goals.get(req.to_goal_id)!.name}"`
      : req.action === 'release'
        ? 'Released to unallocated'
        : depositId
          ? 'From a deposit'
          : null;
  const res = await db.from('savings_allocations').insert(
    planned.map((p) => ({
      goal_id: p.goal_id,
      user_id: userId,
      amount: p.amount,
      allocated_on: today,
      transaction_id: p.transaction_id,
      note,
    })),
  );
  if (res.error) fail(res.error, 'The allocation could not be saved.');

  const crossed: CrossedMilestones[] = [];
  for (const p of planned) {
    const goal = ga.goals.find((g) => g.id === p.goal_id)!;
    const before = savedOf(goal);
    const after = fromCents(toCents(before) + toCents(p.amount));
    const levels = milestonesCrossed(before, after, Number(goal.target_amount));
    if (levels.length) crossed.push({ goal, levels, saved: after });
  }
  return { inserted: planned.length, crossed };
}

// ── Milestone planner tasks ─────────────────────────────────────────────────

export const MILESTONE_SOURCE_PREFIX = 'savings_milestone_';

export function milestoneTaskTitle(goalName: string, level: Milestone): string {
  return level === 100 ? `Savings goal reached: ${goalName} (100%)` : `Savings goal ${level}% saved: ${goalName}`;
}

/**
 * Adds one completed note task under Inbox per milestone crossed, when the
 * goal has milestone tasks turned on. Idempotent: a task with the same
 * source_type (savings_milestone_<level>) and source_id (the goal) is never
 * added twice. Returns how many tasks were added. Never throws: a failed note
 * must not undo the allocation.
 */
export async function noteMilestones(
  db: SupabaseClient,
  crossed: CrossedMilestones,
  resolveMilestone: () => Promise<string | null>,
  today: string,
  nowIso: string,
): Promise<number> {
  if (crossed.goal.milestone_tasks !== true) return 0;
  let added = 0;
  let milestoneId: string | null | undefined;
  for (const level of crossed.levels) {
    const sourceType = `${MILESTONE_SOURCE_PREFIX}${level}`;
    const existing = await db
      .from('tasks')
      .select('id')
      .eq('source_type', sourceType)
      .eq('source_id', crossed.goal.id)
      .limit(1)
      .maybeSingle();
    if (existing.error || existing.data) continue;
    if (milestoneId === undefined) milestoneId = await resolveMilestone();
    if (!milestoneId) return added;
    const res = await db.from('tasks').insert({
      milestone_id: milestoneId,
      date: today,
      time: '12:00',
      activity: milestoneTaskTitle(crossed.goal.name, level),
      description: `${usd(crossed.saved)} of ${usd(Number(crossed.goal.target_amount))} saved. Added by Finance → Savings.`,
      tag: 'LIFESTYLE',
      priority: 3,
      completed: true,
      completed_at: nowIso,
      source_type: sourceType,
      source_id: crossed.goal.id,
    });
    if (!res.error) added += 1;
  }
  return added;
}
