// lib/finance/wallet/server.ts
// Database reads for the Wallet (GET /api/finance/wallet). Loads everything once: active accounts
// with every page of their transactions (the one balance rule, plus the transfer columns that mark
// a loan's linked payments), card and loan statements (limit, APR, minimum), the latest cash count
// of each cash pocket, what savings goals hold, today's rate for each currency, equipment, vehicles
// and insurance policies. The formulas are in ./logic.ts;
// retirement (lib/finance/retirement/server.ts) and book values (lib/equipment/book-values.ts) are
// loaded by the route and passed in.
//
// Callers pass a service-role client and the signed-in user's id; every query is scoped with
// .eq('user_id', userId). Tables that arrive with a migration are optional: before 209 there are
// no statements, before 212 no goals, before 213 no counts, before 215 no policies; the Wallet
// still works without them.
//
// Imports only sibling files with .ts extensions (and types), so the tests run it against the
// in-memory fake (tests/unit/wallet.test.ts).

import type { SupabaseClient } from '@supabase/supabase-js';
import { BALANCE_TX_SELECT, loadBalanceRows, signedBalancesCents } from '../balance/server.ts';
import type { BalanceTxRow } from '../balance/server.ts';
import { isDebtAccount } from '../balance/logic.ts';
import { buildDebtSummary, latestLinkedPayment } from '../debt/overview.ts';
import type { DebtAccountRow, StatementRow, TxnRow } from '../debt/overview.ts';
import { STATEMENT_SELECT, isMissingTable } from '../debt/server.ts';
import { isCurrencyCode } from '../fx/math.ts';
import { isMissingColumn } from '../transfers/schema.ts';
import { getRate } from '../fx/rates.ts';
import type { FxDeps } from '../fx/rates.ts';
import { firstCharge } from './logic.ts';
import type { EquipmentIn, PolicyIn, VehicleIn, WalletAccountIn, WalletInput } from './logic.ts';

const PAGE_SIZE = 1000;

export interface DbErr {
  code?: string | null;
  message?: string | null;
}

/** 1 `currency` in `home`, or null when no rate is known. */
export type RateFor = (currency: string) => Promise<number | null>;

export interface WalletLoadDeps {
  /** Overrides the rate lookup (tests). Default: getRate, cache first, fetched when missing. */
  rateFor?: RateFor;
  fx?: FxDeps;
}

type AccountRow = Record<string, unknown> & { id: string; account_type: string };

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

type WalletTxRow = BalanceTxRow & { transfer_group_id?: string | null; transfer_kind?: string | null };

/**
 * Every transaction on the accounts (all pages), with the transfer columns that mark a linked loan
 * payment. Before migration 203 there is no transfer_kind and before 202 no transfer_group_id: the
 * read drops what is missing, so balances still load (with no linked payments).
 */
async function loadAccountRows(db: SupabaseClient, userId: string, ids: readonly string[]) {
  const selects = [
    `${BALANCE_TX_SELECT}, transfer_group_id, transfer_kind`,
    `${BALANCE_TX_SELECT}, transfer_group_id`,
    BALANCE_TX_SELECT,
  ];
  let res = await loadBalanceRows<WalletTxRow>(db, userId, ids, selects[0]);
  for (const select of selects.slice(1)) {
    if (!isMissingColumn(res.error, 'transfer_kind') && !isMissingColumn(res.error, 'transfer_group_id')) break;
    res = await loadBalanceRows<WalletTxRow>(db, userId, ids, select);
  }
  return res;
}

/** Latest count date of each cash account; ready = false before migration 213. */
async function loadLastCounts(db: SupabaseClient, userId: string, ids: readonly string[]) {
  const latest = new Map<string, string>();
  if (ids.length === 0) return { latest, ready: true, error: null as DbErr | null };
  const res = await db
    .from('cash_counts')
    .select('account_id, counted_on, counted_at')
    .eq('user_id', userId)
    .in('account_id', [...ids])
    .order('counted_at', { ascending: false })
    .range(0, PAGE_SIZE - 1);
  if (isMissingTable(res.error, 'cash_counts')) return { latest, ready: false, error: null };
  if (res.error) return { latest, ready: true, error: res.error as DbErr };
  for (const row of (res.data ?? []) as { account_id: string; counted_on?: string | null; counted_at?: string | null }[]) {
    if (latest.has(row.account_id)) continue;
    const when = row.counted_on || row.counted_at;
    if (when) latest.set(row.account_id, when);
  }
  return { latest, ready: true, error: null };
}

/** account id -> what its savings goals hold (starting amount + allocations), in cents. Empty before migration 212. */
async function loadGoalsHeld(db: SupabaseClient, userId: string): Promise<{ held: Map<string, number>; error: DbErr | null }> {
  const held = new Map<string, number>();
  const goals = await db.from('savings_goals').select('id, funding_account_id, starting_amount').eq('user_id', userId);
  if (isMissingTable(goals.error, 'savings_goals')) return { held, error: null };
  if (goals.error) return { held, error: goals.error };
  const goalAccount = new Map<string, string>();
  for (const g of (goals.data ?? []) as { id: string; funding_account_id: string | null; starting_amount: number | string | null }[]) {
    if (!g.funding_account_id) continue;
    goalAccount.set(g.id, g.funding_account_id);
    held.set(g.funding_account_id, (held.get(g.funding_account_id) ?? 0) + Math.round(Number(g.starting_amount ?? 0) * 100));
  }
  if (goalAccount.size === 0) return { held, error: null };
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await db
      .from('savings_allocations')
      .select('goal_id, amount')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (isMissingTable(res.error, 'savings_allocations')) return { held: new Map(), error: null };
    if (res.error) return { held, error: res.error };
    const page = (res.data ?? []) as { goal_id: string; amount: number | string }[];
    for (const a of page) {
      const account = goalAccount.get(a.goal_id);
      if (!account) continue;
      held.set(account, (held.get(account) ?? 0) + Math.round(Number(a.amount) * 100));
    }
    if (page.length < PAGE_SIZE) break;
  }
  return { held, error: null };
}

/** Latest statements of the cards and loans; [] before migration 209. */
async function loadStatements(db: SupabaseClient, userId: string, ids: readonly string[]): Promise<{ rows: StatementRow[]; error: DbErr | null }> {
  if (ids.length === 0) return { rows: [], error: null };
  const res = await db
    .from('account_statements')
    .select(STATEMENT_SELECT)
    .eq('user_id', userId)
    .in('account_id', [...ids])
    .order('period_end', { ascending: false })
    .range(0, PAGE_SIZE - 1);
  if (isMissingTable(res.error, 'account_statements')) return { rows: [], error: null };
  if (res.error) return { rows: [], error: res.error };
  return { rows: (res.data ?? []) as unknown as StatementRow[], error: null };
}

/** Active policies; null before migration 215. */
async function loadPolicies(db: SupabaseClient, userId: string): Promise<{ policies: PolicyIn[] | null; error: DbErr | null }> {
  const res = await db
    .from('insurance_policies')
    .select('kind, coverage_amount, currency, is_active')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (isMissingTable(res.error, 'insurance_policies')) return { policies: null, error: null };
  if (res.error) return { policies: null, error: res.error };
  return { policies: (res.data ?? []) as PolicyIn[], error: null };
}

/** Everything the Wallet needs except retirement and book values (the route adds those). */
export async function loadWalletInput(
  db: SupabaseClient,
  userId: string,
  today: string,
  home: string,
  deps: WalletLoadDeps = {},
): Promise<{ input: Omit<WalletInput, 'retirement' | 'bookValues'> | null; error: DbErr | null }> {
  const acctRes = await db
    .from('financial_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (acctRes.error) return { input: null, error: acctRes.error };
  const accounts = (acctRes.data ?? []) as unknown as AccountRow[];
  const ids = accounts.map((a) => a.id);
  const debtIds = accounts.filter((a) => isDebtAccount(a.account_type)).map((a) => a.id);
  const cashIds = accounts.filter((a) => a.account_type === 'cash').map((a) => a.id);

  const [balanceRes, statementRes, countRes, goalRes, policyRes, equipmentRes, vehicleRes] = await Promise.all([
    loadAccountRows(db, userId, ids),
    loadStatements(db, userId, debtIds),
    loadLastCounts(db, userId, cashIds),
    loadGoalsHeld(db, userId),
    loadPolicies(db, userId),
    db
      .from('equipment')
      .select('id, name, purchase_price, current_value, is_active, ownership_type')
      .eq('user_id', userId)
      .eq('is_active', true),
    db
      .from('vehicles')
      .select('id, nickname, active, ownership_type, is_system')
      .eq('user_id', userId)
      .eq('active', true),
  ]);
  const error =
    balanceRes.error ?? statementRes.error ?? countRes.error ?? goalRes.error ?? policyRes.error ?? equipmentRes.error ?? vehicleRes.error;
  if (error) return { input: null, error };

  const balances = signedBalancesCents(
    accounts.map((a) => ({
      id: a.id,
      account_type: a.account_type,
      opening_balance: a.opening_balance as number | string | null,
      opening_balance_date: str(a.opening_balance_date),
    })),
    balanceRes.rows,
  );
  const lastActivity = new Map<string, string>();
  for (const row of balanceRes.rows) {
    if (!row.account_id || !row.transaction_date) continue;
    const day = row.transaction_date.slice(0, 10);
    if (day > today) continue;
    if (!lastActivity.has(row.account_id) || day > lastActivity.get(row.account_id)!) lastActivity.set(row.account_id, day);
  }

  // Before migration 210 there is no currency column: every account is in USD.
  const currencyOf = (a: AccountRow): string => (isCurrencyCode(a.currency) ? a.currency : 'USD');
  const rateFor: RateFor =
    deps.rateFor ??
    (async (currency) => {
      const { rate } = await getRate(db, userId, currency, home, today, deps.fx);
      return rate ? rate.rate : null;
    });
  const rates = new Map<string, number | null>();
  for (const currency of new Set(accounts.map(currencyOf))) {
    if (currency === home) continue;
    rates.set(currency, await rateFor(currency));
  }

  const walletAccounts = accounts.map((a): WalletAccountIn => {
    const base: WalletAccountIn = {
      id: a.id,
      name: String(a.name ?? ''),
      account_type: a.account_type,
      institution_name: str(a.institution_name),
      last_four: str(a.last_four),
      currency: currencyOf(a),
      balance: (balances.get(a.id) ?? 0) / 100,
      opening_balance: a.opening_balance as number | string | null,
      opening_balance_date: str(a.opening_balance_date),
      created_at: str(a.created_at),
      last_activity: lastActivity.get(a.id) ?? null,
    };
    if (!isDebtAccount(a.account_type)) return base;
    const txns = balanceRes.rows as unknown as TxnRow[];
    const debt = buildDebtSummary(a as unknown as DebtAccountRow, statementRes.rows, txns, today);
    // A loan with no statement minimum pays what it last paid, not the card formula (logic.ts loanPayment).
    const lastPayment = a.account_type === 'loan' ? latestLinkedPayment(a.id, txns, today) : null;
    // A loan whose starting balance is 0 starts at its first charge (logic.ts loanStarting).
    const first = a.account_type === 'loan' ? firstCharge({ id: a.id, opening_balance_date: str(a.opening_balance_date) }, balanceRes.rows, today) : null;
    return {
      ...base,
      credit_limit: debt.creditLimit,
      credit_limit_source: debt.creditLimitSource,
      apr: debt.apr,
      apr_source: debt.aprSource,
      minimum_payment: debt.minimumPayment,
      minimum_estimated: debt.minimumEstimated,
      last_payment: lastPayment?.amount ?? null,
      last_payment_date: lastPayment?.date ?? null,
      first_charge: first?.amount ?? null,
      first_charge_date: first?.date ?? null,
    };
  });

  const goalsHeld = new Map([...goalRes.held].map(([id, c]) => [id, c / 100]));
  return {
    input: {
      today,
      home,
      rates,
      accounts: walletAccounts,
      lastCounts: countRes.latest,
      countsReady: countRes.ready,
      goalsHeld,
      equipment: ((equipmentRes.data ?? []) as Record<string, unknown>[]).map((e): EquipmentIn => ({
        id: String(e.id),
        name: String(e.name ?? ''),
        purchase_price: numOrNull(e.purchase_price),
        current_value: numOrNull(e.current_value),
        ownership_type: str(e.ownership_type),
        is_active: e.is_active !== false,
      })),
      vehicles: ((vehicleRes.data ?? []) as Record<string, unknown>[]).map((v): VehicleIn => ({
        id: String(v.id),
        nickname: String(v.nickname ?? ''),
        ownership_type: str(v.ownership_type),
        is_system: v.is_system === true,
        active: v.active !== false,
      })),
      policies: policyRes.policies,
    },
    error: null,
  };
}
