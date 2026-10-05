// lib/finance/insurance/server.ts
// Database reads and writes for app/api/finance/insurance/*: life insurance policies, their premium
// payments matched from transactions, and the optional premium due-date planner tasks.
//
// Policies and the overview use the RLS session client plus `.eq('user_id', userId)`. Premium
// tasks are written with the service-role client (like the card/loan due-date tasks in
// lib/finance/debt/bill-tasks.ts) under Inbox > Inbox > Bills (lib/planner/bills.ts).
//
// insurance_policies arrives with migration 215: before it is applied the overview answers
// { ready: false } and writes throw RETIREMENT_NOT_READY (503).
//
// Premium tasks, IDEMPOTENT: one task per policy per due date, found by
// source_type = 'insurance_premium', source_id = the policy id and the task date. Running twice
// changes nothing. When a matched payment covers the due date, the task is marked completed; a
// task someone completed by hand is never reopened. Never throws for one policy: a planner task is
// a convenience and must not break the page.

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveBillsMilestone } from '@/lib/planner/bills';
import { isDateString } from '@/lib/finance/savings/logic';
import { normalizeCurrency } from '@/lib/finance/fx/math';
import { loadHomeCurrency } from '@/lib/finance/fx/server';
import { fail, notReady, RetirementError } from '@/lib/finance/retirement/server';
import {
  addDaysTo,
  isPermanent,
  POLICY_KIND_LABEL,
  POLICY_KINDS,
  policyTotals,
  PREMIUM_FREQUENCIES,
  premiumStatus,
  termStatus,
} from './logic';
import type { PolicyKind, PolicyRow, PolicyTotals, PremiumStatus, PremiumTxn, TermStatus } from './logic';

export const PREMIUM_SOURCE_TYPE = 'insurance_premium';
const PAGE_SIZE = 1000;
const TASK_TIME = '09:00';

const POLICY_SELECT =
  'id, kind, insurer, policy_last_four, currency, coverage_amount, premium_amount, premium_frequency, start_date, ' +
  'term_end_date, cash_value, cash_value_as_of, beneficiaries, premium_category_id, premium_vendor, premium_tasks, ' +
  'is_active, notes, created_at';

export interface PolicyRecord extends PolicyRow {
  policy_last_four: string | null;
  currency: string;
  cash_value_as_of: string | null;
  beneficiaries: string | null;
  premium_tasks: boolean;
  notes: string | null;
  created_at: string;
}

export interface PolicyView extends PolicyRecord {
  premium: PremiumStatus;
  term: { status: TermStatus; days_left: number | null };
  permanent: boolean;
  category_name: string | null;
}

export interface InsuranceOverview {
  ready: boolean;
  today: string;
  home_currency: string;
  policies: PolicyView[];
  totals: PolicyTotals;
  categories: { id: string; name: string }[];
}

async function loadCategories(db: SupabaseClient, userId: string) {
  const { data } = await db.from('budget_categories').select('id, name').eq('user_id', userId).order('name', { ascending: true });
  return ((data ?? []) as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name }));
}

/** Expense transactions that could be premium payments: since the earliest start, near a premium amount. */
async function loadPremiumCandidates(db: SupabaseClient, userId: string, policies: PolicyRecord[]): Promise<PremiumTxn[]> {
  const usable = policies.filter((p) => Number(p.premium_amount) > 0 && (p.premium_category_id || p.premium_vendor));
  if (usable.length === 0) return [];
  const amounts = usable.map((p) => Number(p.premium_amount));
  const low = Math.max(0, Math.min(...amounts) * 0.98 - 1);
  const high = Math.max(...amounts) * 1.02 + 1;
  const starts = usable.map((p) => p.start_date).filter((d): d is string => !!d).sort();
  const since = starts.length === usable.length ? addDaysTo(starts[0], -30) : null;
  const rows: PremiumTxn[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let q = db
      .from('financial_transactions')
      .select('id, type, amount, transaction_date, category_id, vendor, description')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('amount', low)
      .lte('amount', high);
    if (since) q = q.gte('transaction_date', since);
    const res = await q.order('transaction_date', { ascending: true }).order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (res.error) return rows;
    const page = (res.data ?? []) as PremiumTxn[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function loadInsuranceOverview(db: SupabaseClient, userId: string, today: string): Promise<InsuranceOverview> {
  const home = await loadHomeCurrency(db, userId);
  const [polRes, categories] = await Promise.all([
    db.from('insurance_policies').select(POLICY_SELECT).eq('user_id', userId).order('created_at', { ascending: true }),
    loadCategories(db, userId),
  ]);
  if (polRes.error && notReady(polRes.error)) {
    return { ready: false, today, home_currency: home, policies: [], totals: policyTotals([]), categories };
  }
  if (polRes.error) fail(polRes.error, 'Could not load insurance policies.');
  const records = (polRes.data ?? []) as unknown as PolicyRecord[];
  const txns = await loadPremiumCandidates(db, userId, records);
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const policies: PolicyView[] = records.map((p) => ({
    ...p,
    premium: premiumStatus(p, txns, today),
    term: termStatus(p, today),
    permanent: isPermanent(p.kind),
    category_name: p.premium_category_id ? (catName.get(p.premium_category_id) ?? null) : null,
  }));
  // Totals in the home currency: policies in another currency are listed but not added up.
  return { ready: true, today, home_currency: home, policies, totals: policyTotals(records.filter((p) => p.currency === home)), categories };
}

// ── Input ────────────────────────────────────────────────────────────────────

type Body = Record<string, unknown>;

function money(body: Body, key: string): number | null | undefined {
  if (!(key in body)) return undefined;
  const v = body[key];
  if (v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 999_999_999_999) throw new RetirementError(`${key} must be an amount of 0 or more.`);
  return Math.round(n * 100) / 100;
}

function text(body: Body, key: string, max: number): string | null | undefined {
  if (!(key in body)) return undefined;
  const v = body[key];
  if (v === null || v === '') return null;
  if (typeof v !== 'string') throw new RetirementError(`${key} must be text.`);
  if (v.trim().length > max) throw new RetirementError(`${key} is too long (at most ${max} characters).`);
  return v.trim() || null;
}

function date(body: Body, key: string): string | null | undefined {
  if (!(key in body)) return undefined;
  const v = body[key];
  if (v === null || v === '') return null;
  if (!isDateString(v)) throw new RetirementError(`${key} must be a date (YYYY-MM-DD).`);
  return v;
}

export function parsePolicyInput(raw: unknown, partial: boolean): Body {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new RetirementError('The request body must be a JSON object.');
  const body = raw as Body;
  const out: Body = {};
  const put = (key: string, value: unknown) => {
    if (value !== undefined) out[key] = value;
  };
  if ('kind' in body) {
    if (!(POLICY_KINDS as readonly string[]).includes(String(body.kind))) throw new RetirementError(`kind must be one of: ${POLICY_KINDS.join(', ')}.`);
    out.kind = body.kind as PolicyKind;
  }
  if ('premium_frequency' in body) {
    if (!(PREMIUM_FREQUENCIES as readonly string[]).includes(String(body.premium_frequency))) {
      throw new RetirementError(`premium_frequency must be one of: ${PREMIUM_FREQUENCIES.join(', ')}.`);
    }
    out.premium_frequency = body.premium_frequency;
  }
  put('insurer', text(body, 'insurer', 120));
  const four = text(body, 'policy_last_four', 4);
  if (four && !/^[0-9A-Za-z]{1,4}$/.test(four)) throw new RetirementError('policy_last_four must be up to 4 letters or digits.');
  put('policy_last_four', four);
  put('coverage_amount', money(body, 'coverage_amount'));
  put('premium_amount', money(body, 'premium_amount'));
  put('start_date', date(body, 'start_date'));
  put('term_end_date', date(body, 'term_end_date'));
  put('cash_value', money(body, 'cash_value'));
  put('cash_value_as_of', date(body, 'cash_value_as_of'));
  put('beneficiaries', text(body, 'beneficiaries', 1000));
  put('premium_vendor', text(body, 'premium_vendor', 120));
  put('notes', text(body, 'notes', 2000));
  if ('premium_category_id' in body) {
    const v = body.premium_category_id;
    if (v !== null && v !== '' && typeof v !== 'string') throw new RetirementError('premium_category_id must be a category id.');
    out.premium_category_id = v || null;
  }
  if (typeof body.premium_tasks === 'boolean') out.premium_tasks = body.premium_tasks;
  if (typeof body.is_active === 'boolean') out.is_active = body.is_active;
  if ('currency' in body && body.currency) {
    const c = normalizeCurrency(body.currency);
    if (!c) throw new RetirementError('Currency must be a three-letter code, like USD.');
    out.currency = c;
  }
  if (!partial && !out.insurer) throw new RetirementError('Enter the insurer.');
  if ('insurer' in out && !out.insurer) throw new RetirementError('The insurer cannot be empty.');
  if (typeof out.start_date === 'string' && typeof out.term_end_date === 'string' && out.term_end_date < out.start_date) {
    throw new RetirementError('The term end date must be after the start date.');
  }
  return out;
}

/** A linked category must be one of the user's own. */
async function checkCategory(db: SupabaseClient, userId: string, input: Body) {
  const id = input.premium_category_id;
  if (typeof id !== 'string') return;
  const { data, error } = await db.from('budget_categories').select('id').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error || !data) throw new RetirementError('That category was not found.', 404);
}

export async function createPolicy(db: SupabaseClient, userId: string, input: Body) {
  await checkCategory(db, userId, input);
  const currency = (input.currency as string | undefined) ?? (await loadHomeCurrency(db, userId));
  const { data, error } = await db
    .from('insurance_policies')
    .insert({ ...input, currency, user_id: userId })
    .select(POLICY_SELECT)
    .maybeSingle();
  if (error || !data) fail(error, 'Could not save the policy.');
  return data;
}

export async function updatePolicy(db: SupabaseClient, userId: string, id: string, input: Body) {
  if (Object.keys(input).length === 0) throw new RetirementError('Nothing to change.');
  await checkCategory(db, userId, input);
  const { data, error } = await db
    .from('insurance_policies')
    .update(input)
    .eq('id', id)
    .eq('user_id', userId)
    .select(POLICY_SELECT)
    .maybeSingle();
  if (error) fail(error, 'Could not save the policy.');
  if (!data) throw new RetirementError('Policy not found.', 404);
  return data;
}

export async function deletePolicy(db: SupabaseClient, userId: string, id: string) {
  const { data, error } = await db.from('insurance_policies').delete().eq('id', id).eq('user_id', userId).select('id');
  if (error) fail(error, 'Could not delete the policy.');
  if (!data || data.length === 0) throw new RetirementError('Policy not found.', 404);
}

// ── Premium due-date tasks ──────────────────────────────────────────────────

export interface PremiumTaskResult {
  ready: boolean;
  created: number;
  completed: number;
  errors: number;
}

/** Bring the user's premium due-date tasks up to date. `db` is the service-role client. */
export async function syncPremiumTasks(db: SupabaseClient, userId: string, today: string): Promise<PremiumTaskResult> {
  const result: PremiumTaskResult = { ready: true, created: 0, completed: 0, errors: 0 };
  const overview = await loadInsuranceOverview(db, userId, today);
  if (!overview.ready) return { ...result, ready: false };
  let milestoneId: string | null | undefined;
  for (const p of overview.policies) {
    if (!p.is_active || !p.premium_tasks || !p.premium.next_due) continue;
    const due = p.premium.next_due;
    try {
      const { data: existing, error } = await db
        .from('tasks')
        .select('id, completed')
        .eq('source_type', PREMIUM_SOURCE_TYPE)
        .eq('source_id', p.id)
        .eq('date', due)
        .limit(1);
      if (error) throw new Error(error.message);
      const task = (existing ?? [])[0] as { id: string; completed: boolean | null } | undefined;
      if (task) {
        if (p.premium.next_due_paid && !task.completed) {
          const now = new Date().toISOString();
          await db.from('tasks').update({ completed: true, completed_at: now, updated_at: now }).eq('id', task.id);
          result.completed += 1;
        }
        continue;
      }
      if (p.premium.next_due_paid) continue; // Already paid before we ever saw it.
      if (milestoneId === undefined) milestoneId = await resolveBillsMilestone(db, userId);
      if (!milestoneId) throw new Error('no Bills milestone');
      const amount = Number(p.premium_amount) || 0;
      const label = POLICY_KIND_LABEL[p.kind as PolicyKind] ?? 'Life insurance';
      const { error: insErr } = await db.from('tasks').insert({
        milestone_id: milestoneId,
        date: due,
        time: TASK_TIME,
        activity: `Pay ${p.insurer} ${label.toLowerCase()} premium: ${amount.toLocaleString('en-US', { style: 'currency', currency: p.currency || 'USD' })}`,
        description: 'Premium due date from Finance > Insurance. Marked done when a matching payment is found.',
        tag: 'finance',
        priority: 2,
        completed: false,
        estimated_cost: amount,
        revenue: 0,
        source_type: PREMIUM_SOURCE_TYPE,
        source_id: p.id,
      });
      if (insErr) throw new Error(insErr.message);
      result.created += 1;
    } catch (err) {
      result.errors += 1;
      console.error('[insurance-premium-tasks] one policy failed:', err instanceof Error ? err.message : 'unknown');
    }
  }
  return result;
}
