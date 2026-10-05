// lib/finance/retirement/server.ts
// Database reads and writes for app/api/finance/retirement/*: investment accounts, balance
// snapshots, planner settings, and the overview the Retirement page draws (accounts with their
// latest balance, the projection from ./logic.ts, current spending, permanent-policy cash value).
//
// Callers pass the RLS session client and the signed-in user's id; every query is also scoped with
// `.eq('user_id', userId)`. Tables arrive with migration 215: before it is applied the overview
// answers { ready: false } and writes throw RETIREMENT_NOT_READY (503).
//
// Balances are entered by hand today (source = 'manual'). A statement import can add snapshots
// later through upsertSnapshot() with source = 'statement'; the importer files are not touched here.
//
// Currencies: each account has its own currency. Totals and the projection are in the person's
// home currency at today's cached rate (lib/finance/fx). An account with no cached rate is left out
// of the totals and counted in `unconverted`.

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingTable, loadFirstMonth, loadSpendingRows } from '@/lib/finance/budgets/server';
import { addMonths, firstDay, lastDay, monthOf } from '@/lib/finance/budgets/months';
import { monthlySurplus, isDateString } from '@/lib/finance/savings/logic';
import { loadHomeCurrency } from '@/lib/finance/fx/server';
import { getRate } from '@/lib/finance/fx/rates';
import { convert, normalizeCurrency } from '@/lib/finance/fx/math';
import { isPermanent } from '@/lib/finance/insurance/logic';
import {
  ACCOUNT_KINDS,
  annualContribution,
  annualMatch,
  buildPlan,
  CONTRIBUTION_FREQUENCIES,
  CONTRIBUTION_TYPES,
  isOneOf,
  latestSnapshots,
  matchSummary,
  num,
  PRESETS,
  resolveSettings,
  round2,
} from './logic';
import type { PlanResult, ResolvedSettings, SettingsRow } from './logic';

interface DbErr {
  code?: string | null;
  message?: string | null;
}

export class RetirementError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const RETIREMENT_NOT_READY = {
  error:
    'Retirement accounts and insurance need a database update first: run migration 215 ' +
    '(supabase/migrations/215_retirement_insurance.sql). Nothing was changed.',
  code: 'retirement_not_migrated',
} as const;

const TABLES = ['investment_accounts', 'investment_balance_snapshots', 'insurance_policies', 'retirement_plan_settings'];

export function notReady(error: DbErr | null | undefined): boolean {
  return TABLES.some((t) => isMissingTable(error, t));
}

export function fail(error: DbErr | null | undefined, fallback: string): never {
  if (notReady(error)) throw new RetirementError(RETIREMENT_NOT_READY.error, 503, RETIREMENT_NOT_READY.code);
  throw new RetirementError(error?.message || fallback, 500);
}

const ACCOUNT_SELECT =
  'id, kind, name, institution, last_four, currency, contribution_type, contribution_amount, contribution_percent, ' +
  'contribution_frequency, annual_pay, match_rate_percent, match_limit_percent, match_annual_cap, expected_annual_return, ' +
  'is_active, notes, created_at';
const SNAPSHOT_SELECT = 'id, account_id, as_of, balance, contributions_ytd, note, source';
const SETTINGS_SELECT =
  'birth_year, current_age, retirement_age, life_expectancy, spending_mode, desired_yearly_spending, spending_multiple, ' +
  'social_security_monthly, social_security_start_age, inflation_rate, return_conservative, return_middle, ' +
  'return_optimistic, selected_preset, target_method, withdrawal_rate';

export interface InvestmentAccountRow {
  id: string;
  kind: string;
  name: string;
  institution: string | null;
  last_four: string | null;
  currency: string;
  contribution_type: string;
  contribution_amount: number | null;
  contribution_percent: number | null;
  contribution_frequency: string;
  annual_pay: number | null;
  match_rate_percent: number | null;
  match_limit_percent: number | null;
  match_annual_cap: number | null;
  expected_annual_return: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface SnapshotView {
  id: string;
  account_id: string;
  as_of: string;
  balance: number;
  contributions_ytd: number | null;
  note: string | null;
  source: string;
}

export interface AccountView extends InvestmentAccountRow {
  latest: SnapshotView | null;
  /** Up to the last 12 snapshots, newest first. */
  history: SnapshotView[];
  /** Latest balance in the home currency; null when no rate is cached. */
  balance_home: number | null;
  annual_contribution: number;
  annual_match: number;
  match_needs_pay: boolean;
  match_summary: string | null;
}

export interface RetirementOverview {
  ready: boolean;
  today: string;
  home_currency: string;
  settings_row: SettingsRow | null;
  settings: ResolvedSettings;
  accounts: AccountView[];
  /** Average monthly spending over the window (transfers left out); null with no history. */
  current_spending: { monthly: number | null; yearly: number | null; months: number; window: number };
  /** Cash value of active permanent life policies (home currency, same-currency policies only). */
  policy_cash_value: number;
  unconverted: number;
  plan: PlanResult | null;
}

const toSnapshot = (r: Record<string, unknown>): SnapshotView => ({
  id: String(r.id),
  account_id: String(r.account_id),
  as_of: String(r.as_of),
  balance: Number(r.balance),
  contributions_ytd: num(r.contributions_ytd),
  note: (r.note as string | null) ?? null,
  source: String(r.source ?? 'manual'),
});

/** Average monthly spending over the `window` complete months before today's month. */
async function loadCurrentSpending(db: SupabaseClient, userId: string, today: string, window: 3 | 6 | 12) {
  const currentMonth = monthOf(new Date(`${today}T12:00:00Z`));
  const from = addMonths(currentMonth, -window);
  const [spend, first] = await Promise.all([
    loadSpendingRows(db, userId, firstDay(from), lastDay(addMonths(currentMonth, -1))),
    loadFirstMonth(db, userId),
  ]);
  if (spend.error || first.error) return { monthly: null, yearly: null, months: 0, window };
  const surplus = monthlySurplus(spend.rows, { window, method: 'average', currentMonth, firstMonth: first.month });
  const months = surplus.per_month.filter((m) => m.spending > 0 || m.income > 0);
  if (months.length === 0) return { monthly: null, yearly: null, months: 0, window };
  const monthly = round2(months.reduce((s, m) => s + m.spending, 0) / months.length);
  return { monthly, yearly: round2(monthly * 12), months: months.length, window };
}

export async function loadRetirementOverview(
  db: SupabaseClient,
  userId: string,
  today: string,
  window: 3 | 6 | 12 = 12,
): Promise<RetirementOverview> {
  const home = await loadHomeCurrency(db, userId);
  const [accRes, snapRes, setRes] = await Promise.all([
    db.from('investment_accounts').select(ACCOUNT_SELECT).eq('user_id', userId).order('created_at', { ascending: true }),
    db.from('investment_balance_snapshots').select(SNAPSHOT_SELECT).eq('user_id', userId).order('as_of', { ascending: false }).limit(2000),
    db.from('retirement_plan_settings').select(SETTINGS_SELECT).eq('user_id', userId).maybeSingle(),
  ]);
  const err = accRes.error ?? snapRes.error ?? setRes.error;
  if (err && notReady(err)) {
    return {
      ready: false,
      today,
      home_currency: home,
      settings_row: null,
      settings: resolveSettings(null, today),
      accounts: [],
      current_spending: { monthly: null, yearly: null, months: 0, window },
      policy_cash_value: 0,
      unconverted: 0,
      plan: null,
    };
  }
  if (err) fail(err, 'Could not load retirement accounts.');

  const settingsRow = (setRes.data as SettingsRow | null) ?? null;
  const settings = resolveSettings(settingsRow, today);
  const snapshots = ((snapRes.data ?? []) as unknown as Record<string, unknown>[]).map(toSnapshot);
  const latest = latestSnapshots(snapshots);
  const rateCache = new Map<string, number | null>();
  const rateFor = async (currency: string): Promise<number | null> => {
    if (currency === home) return 1;
    if (!rateCache.has(currency)) {
      const { rate } = await getRate(db, userId, currency, home, today, { allowFetch: false });
      rateCache.set(currency, rate ? rate.rate : null);
    }
    return rateCache.get(currency) ?? null;
  };

  let unconverted = 0;
  const accounts: AccountView[] = [];
  for (const row of (accRes.data ?? []) as unknown as InvestmentAccountRow[]) {
    const last = latest.get(row.id) ?? null;
    const rate = await rateFor(row.currency);
    if (rate === null) unconverted += 1;
    const match = annualMatch(row);
    accounts.push({
      ...row,
      latest: last,
      history: snapshots.filter((s) => s.account_id === row.id).slice(0, 12),
      balance_home: rate === null ? null : round2(convert(last?.balance ?? 0, rate)),
      annual_contribution: annualContribution(row),
      annual_match: match.amount,
      match_needs_pay: match.needs_pay,
      match_summary: matchSummary(row),
    });
  }

  const [spending, cash] = await Promise.all([loadCurrentSpending(db, userId, today, window), loadPolicyCashValue(db, userId, home)]);

  const plan = buildPlan({
    accounts: accounts
      .filter((a) => a.balance_home !== null)
      .map((a) => {
        const rate = a.currency === home ? 1 : (rateCache.get(a.currency) ?? 1);
        return {
          id: a.id,
          name: a.name,
          balance: a.balance_home ?? 0,
          annual_contribution: round2(a.annual_contribution * rate),
          annual_match: round2(a.annual_match * rate),
          expected_return: num(a.expected_annual_return),
          is_active: a.is_active,
        };
      }),
    settings,
    currentYearlySpending: spending.yearly,
    today,
  });

  return {
    ready: true,
    today,
    home_currency: home,
    settings_row: settingsRow,
    settings,
    accounts,
    current_spending: spending,
    policy_cash_value: cash,
    unconverted,
    plan,
  };
}

async function loadPolicyCashValue(db: SupabaseClient, userId: string, home: string): Promise<number> {
  const { data, error } = await db
    .from('insurance_policies')
    .select('kind, cash_value, currency, is_active')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) return 0;
  return round2(
    ((data ?? []) as { kind: string; cash_value: number | null; currency: string }[])
      .filter((p) => isPermanent(p.kind) && p.currency === home)
      .reduce((s, p) => s + (num(p.cash_value) ?? 0), 0),
  );
}

// ── Input parsing ────────────────────────────────────────────────────────────

type Body = Record<string, unknown>;

function asBody(raw: unknown): Body {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new RetirementError('The request body must be a JSON object.');
  return raw as Body;
}

function text(body: Body, key: string, max = 200): string | null | undefined {
  if (!(key in body)) return undefined;
  const v = body[key];
  if (v === null || v === '') return null;
  if (typeof v !== 'string') throw new RetirementError(`${key} must be text.`);
  const t = v.trim();
  if (t.length > max) throw new RetirementError(`${key} is too long (at most ${max} characters).`);
  return t || null;
}

function number(body: Body, key: string, min: number, max: number): number | null | undefined {
  if (!(key in body)) return undefined;
  const v = body[key];
  if (v === null || v === '') return null;
  const n = num(v);
  if (n === null || n < min || n > max) throw new RetirementError(`${key} must be a number from ${min} to ${max}.`);
  return n;
}

function int(body: Body, key: string, min: number, max: number): number | null | undefined {
  const n = number(body, key, min, max);
  if (n === undefined || n === null) return n;
  if (!Number.isInteger(n)) throw new RetirementError(`${key} must be a whole number.`);
  return n;
}

function choice<T extends string>(body: Body, key: string, list: readonly T[]): T | undefined {
  if (!(key in body) || body[key] === null || body[key] === '') return undefined;
  if (!isOneOf(list, body[key])) throw new RetirementError(`${key} must be one of: ${list.join(', ')}.`);
  return body[key] as T;
}

function lastFour(body: Body, key: string): string | null | undefined {
  const v = text(body, key, 4);
  if (v && !/^[0-9A-Za-z]{1,4}$/.test(v)) throw new RetirementError(`${key} must be up to 4 letters or digits.`);
  return v;
}

function clean<T extends Body>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function parseAccountInput(raw: unknown, partial: boolean): Body {
  const body = asBody(raw);
  const out = clean({
    kind: choice(body, 'kind', ACCOUNT_KINDS),
    name: text(body, 'name', 120),
    institution: text(body, 'institution', 120),
    last_four: lastFour(body, 'last_four'),
    currency: undefined as string | undefined,
    contribution_type: choice(body, 'contribution_type', CONTRIBUTION_TYPES),
    contribution_amount: number(body, 'contribution_amount', 0, 9_999_999_999),
    contribution_percent: number(body, 'contribution_percent', 0, 100),
    contribution_frequency: choice(body, 'contribution_frequency', CONTRIBUTION_FREQUENCIES),
    annual_pay: number(body, 'annual_pay', 0, 999_999_999_999),
    match_rate_percent: number(body, 'match_rate_percent', 0, 1000),
    match_limit_percent: number(body, 'match_limit_percent', 0, 100),
    match_annual_cap: number(body, 'match_annual_cap', 0, 9_999_999_999),
    expected_annual_return: number(body, 'expected_annual_return', -50, 50),
    is_active: typeof body.is_active === 'boolean' ? body.is_active : undefined,
    notes: text(body, 'notes', 2000),
  });
  if ('currency' in body && body.currency) {
    const c = normalizeCurrency(body.currency);
    if (!c) throw new RetirementError('Currency must be a three-letter code, like USD.');
    out.currency = c;
  }
  if (!partial && !out.name) throw new RetirementError('Give the account a name.');
  if ('name' in out && !out.name) throw new RetirementError('The name cannot be empty.');
  return out;
}

export function parseSnapshotInput(raw: unknown): { account_id: string; as_of: string; balance: number; contributions_ytd: number | null; note: string | null } {
  const body = asBody(raw);
  if (typeof body.account_id !== 'string' || !body.account_id) throw new RetirementError('Pick an account.');
  if (!isDateString(body.as_of)) throw new RetirementError('as_of must be a date (YYYY-MM-DD).');
  const balance = number(body, 'balance', -999_999_999_999, 999_999_999_999);
  if (balance === null || balance === undefined) throw new RetirementError('Enter the balance.');
  return {
    account_id: body.account_id,
    as_of: body.as_of,
    balance,
    contributions_ytd: number(body, 'contributions_ytd', 0, 999_999_999_999) ?? null,
    note: text(body, 'note', 500) ?? null,
  };
}

export function parseSettingsInput(raw: unknown): Body {
  const body = asBody(raw);
  const out = clean({
    birth_year: int(body, 'birth_year', 1900, 2100),
    current_age: int(body, 'current_age', 0, 120),
    retirement_age: int(body, 'retirement_age', 0, 120),
    life_expectancy: int(body, 'life_expectancy', 0, 130),
    spending_mode: choice(body, 'spending_mode', ['amount', 'multiple'] as const),
    desired_yearly_spending: number(body, 'desired_yearly_spending', 0, 999_999_999_999),
    spending_multiple: number(body, 'spending_multiple', 0, 100),
    social_security_monthly: number(body, 'social_security_monthly', 0, 9_999_999_999),
    social_security_start_age: int(body, 'social_security_start_age', 0, 120),
    inflation_rate: number(body, 'inflation_rate', -50, 50),
    return_conservative: number(body, 'return_conservative', -50, 50),
    return_middle: number(body, 'return_middle', -50, 50),
    return_optimistic: number(body, 'return_optimistic', -50, 50),
    selected_preset: choice(body, 'selected_preset', PRESETS),
    target_method: choice(body, 'target_method', ['years', 'withdrawal_rate'] as const),
    withdrawal_rate: number(body, 'withdrawal_rate', 0.1, 50),
  });
  const ret = out.retirement_age;
  const life = out.life_expectancy;
  if (typeof ret === 'number' && typeof life === 'number' && life < ret) {
    throw new RetirementError('Life expectancy must be at or after the retirement age.');
  }
  return out;
}

// ── Writes ───────────────────────────────────────────────────────────────────

export async function createAccount(db: SupabaseClient, userId: string, input: Body) {
  const currency = (input.currency as string | undefined) ?? (await loadHomeCurrency(db, userId));
  const { data, error } = await db
    .from('investment_accounts')
    .insert({ ...input, currency, user_id: userId })
    .select(ACCOUNT_SELECT)
    .maybeSingle();
  if (error || !data) fail(error, 'Could not save the account.');
  return data;
}

export async function updateAccount(db: SupabaseClient, userId: string, id: string, input: Body) {
  if (Object.keys(input).length === 0) throw new RetirementError('Nothing to change.');
  const { data, error } = await db
    .from('investment_accounts')
    .update(input)
    .eq('id', id)
    .eq('user_id', userId)
    .select(ACCOUNT_SELECT)
    .maybeSingle();
  if (error) fail(error, 'Could not save the account.');
  if (!data) throw new RetirementError('Account not found.', 404);
  return data;
}

export async function deleteAccount(db: SupabaseClient, userId: string, id: string) {
  const { data, error } = await db.from('investment_accounts').delete().eq('id', id).eq('user_id', userId).select('id');
  if (error) fail(error, 'Could not delete the account.');
  if (!data || data.length === 0) throw new RetirementError('Account not found.', 404);
}

/** One balance per account per date: a second entry for the same date replaces the first. */
export async function upsertSnapshot(
  db: SupabaseClient,
  userId: string,
  input: ReturnType<typeof parseSnapshotInput>,
  source: 'manual' | 'statement' = 'manual',
) {
  const owner = await db.from('investment_accounts').select('id').eq('id', input.account_id).eq('user_id', userId).maybeSingle();
  if (owner.error) fail(owner.error, 'Could not check the account.');
  if (!owner.data) throw new RetirementError('Account not found.', 404);
  const { data, error } = await db
    .from('investment_balance_snapshots')
    .upsert({ ...input, user_id: userId, source }, { onConflict: 'account_id,as_of' })
    .select(SNAPSHOT_SELECT)
    .maybeSingle();
  if (error || !data) fail(error, 'Could not save the balance.');
  return toSnapshot(data as unknown as Record<string, unknown>);
}

export async function deleteSnapshot(db: SupabaseClient, userId: string, id: string) {
  const { data, error } = await db.from('investment_balance_snapshots').delete().eq('id', id).eq('user_id', userId).select('id');
  if (error) fail(error, 'Could not delete the balance.');
  if (!data || data.length === 0) throw new RetirementError('Balance not found.', 404);
}

export async function saveSettings(db: SupabaseClient, userId: string, input: Body) {
  const { data, error } = await db
    .from('retirement_plan_settings')
    .upsert({ ...input, user_id: userId }, { onConflict: 'user_id' })
    .select(SETTINGS_SELECT)
    .maybeSingle();
  if (error) fail(error, 'Could not save the planner settings.');
  return data;
}
