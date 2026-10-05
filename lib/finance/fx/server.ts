// lib/finance/fx/server.ts
// Server helpers that tie rates to the finance tables: the user's home currency, an account's
// currency, the FX fields of a transaction at save, filling missing home amounts, and the list of
// currencies a user holds. Callers pass a service-role client and an authenticated user's id.
// Every helper works before migration 210 (everything then reads as USD, nothing is converted).

import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_HOME_CURRENCY, convert, isCurrencyCode, PIVOT } from './math.ts';
import { getRate, isFxSchemaMissing, prefetchRange } from './rates.ts';
import type { DbErr, FxDeps } from './rates.ts';
import type { ResolvedRate } from './resolve.ts';

/** profiles.home_currency, or USD when unset or before migration 210. */
export async function loadHomeCurrency(db: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await db.from('profiles').select('home_currency').eq('id', userId).maybeSingle();
  if (error) return DEFAULT_HOME_CURRENCY;
  const code = (data as { home_currency?: string | null } | null)?.home_currency;
  return isCurrencyCode(code) ? code : DEFAULT_HOME_CURRENCY;
}

/** An account's currency (the user's own account only), or null when not found. */
export async function loadAccountCurrency(
  db: SupabaseClient,
  userId: string,
  accountId: string,
  homeCurrency: string,
): Promise<string | null> {
  const { data, error } = await db
    .from('financial_accounts')
    .select('id, currency')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    // Before migration 210 every account is in USD.
    return isFxSchemaMissing(error) ? homeCurrency : null;
  }
  if (!data) return null;
  const code = (data as { currency?: string | null }).currency;
  return isCurrencyCode(code) ? code : homeCurrency;
}

export interface FxFields {
  currency: string | null;
  fx_rate: number | null;
  amount_home: number | null;
}

/**
 * The FX columns to save with a transaction of `amount` in `currency` on `date`.
 * Home-currency rows get all nulls (the amount already is the home amount). A foreign row whose
 * rate can't be found keeps its currency and leaves fx_rate / amount_home null: totals then leave
 * it out until a rate exists (see backfillHomeAmounts and lib/finance/fx/totals.ts).
 */
export async function fxFieldsFor(
  db: SupabaseClient,
  userId: string,
  currency: string,
  homeCurrency: string,
  amount: number,
  date: string,
  deps: FxDeps = {},
): Promise<{ fields: FxFields; rate: ResolvedRate | null }> {
  if (currency === homeCurrency) return { fields: { currency: null, fx_rate: null, amount_home: null }, rate: null };
  const { rate } = await getRate(db, userId, currency, homeCurrency, date, deps);
  if (!rate) return { fields: { currency, fx_rate: null, amount_home: null }, rate: null };
  return {
    fields: { currency, fx_rate: storableRate(rate.rate), amount_home: convert(Math.abs(amount), rate.rate) },
    rate,
  };
}

/** Rounds a rate to the column's 8 decimals for storage (numeric(18,8)). */
export function storableRate(rate: number): number {
  return Math.round(rate * 1e8) / 1e8;
}

/** Codes the user holds: account currencies and user_currencies. */
export async function loadUserCurrencyCodes(db: SupabaseClient, userId: string): Promise<{ codes: string[]; error: DbErr | null }> {
  const [accts, added] = await Promise.all([
    db.from('financial_accounts').select('currency').eq('user_id', userId),
    db.from('user_currencies').select('code').eq('user_id', userId),
  ]);
  const error = accts.error ?? added.error;
  if (error) return { codes: [], error };
  const codes = new Set<string>();
  for (const r of (accts.data ?? []) as { currency?: string | null }[]) if (isCurrencyCode(r.currency)) codes.add(r.currency);
  for (const r of (added.data ?? []) as { code?: string | null }[]) if (isCurrencyCode(r.code)) codes.add(r.code);
  return { codes: [...codes].sort(), error: null };
}

const BACKFILL_PAGE = 500;

/**
 * Fills fx_rate / amount_home for the user's rows that are not in the home currency and have no
 * home amount yet: rows on foreign-currency accounts (including statement imports, which store
 * amounts in the account's currency) and rows saved while no rate existed. Bounded by `limit`.
 * Writes only fx_rate, amount_home and currency; never touches updated_at on purpose (the table's
 * trigger moves it).
 */
export async function backfillHomeAmounts(
  db: SupabaseClient,
  userId: string,
  options: { limit?: number; deps?: FxDeps } = {},
): Promise<{ updated: number; unconverted: number; error: DbErr | null }> {
  // Small enough to finish inside one request; later runs continue where this one stopped.
  const limit = options.limit ?? BACKFILL_PAGE;
  const home = await loadHomeCurrency(db, userId);

  const { data: accounts, error: acctError } = await db
    .from('financial_accounts')
    .select('id, currency')
    .eq('user_id', userId);
  if (acctError) return { updated: 0, unconverted: 0, error: isFxSchemaMissing(acctError) ? null : acctError };
  const foreign = ((accounts ?? []) as { id: string; currency: string }[]).filter(
    (a) => isCurrencyCode(a.currency) && a.currency !== home,
  );
  if (foreign.length === 0) return { updated: 0, unconverted: 0, error: null };
  const currencyOf = new Map(foreign.map((a) => [a.id, a.currency]));

  const { data: rows, error: rowError } = await db
    .from('financial_transactions')
    .select('id, account_id, amount, currency, transaction_date')
    .eq('user_id', userId)
    .in('account_id', foreign.map((a) => a.id))
    .is('amount_home', null)
    .order('transaction_date', { ascending: true })
    .limit(Math.min(limit, BACKFILL_PAGE * 4));
  if (rowError) return { updated: 0, unconverted: 0, error: rowError };
  const pending = (rows ?? []) as { id: string; account_id: string; amount: number | string; currency: string | null; transaction_date: string }[];
  if (pending.length === 0) return { updated: 0, unconverted: 0, error: null };

  // One history request per run instead of one per date.
  const codes = [...new Set([home, ...pending.map((r) => r.currency || currencyOf.get(r.account_id) || home)])].filter((c) => c !== PIVOT);
  const dates = pending.map((r) => r.transaction_date).sort();
  const start = new Date(Date.parse(`${dates[0]}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
  if (pending.length > 3) await prefetchRange(db, codes, start, dates[dates.length - 1], options.deps);

  const memo = new Map<string, ResolvedRate | null>();
  let updated = 0;
  let unconverted = 0;
  for (const row of pending) {
    const currency = row.currency || currencyOf.get(row.account_id) || home;
    if (currency === home) continue;
    const key = `${currency}:${row.transaction_date}`;
    if (!memo.has(key)) {
      const { rate, error } = await getRate(db, userId, currency, home, row.transaction_date, options.deps);
      if (error) return { updated, unconverted, error };
      memo.set(key, rate);
    }
    const rate = memo.get(key);
    if (!rate) {
      unconverted += 1;
      continue;
    }
    const { error } = await db
      .from('financial_transactions')
      .update({
        currency,
        fx_rate: storableRate(rate.rate),
        amount_home: convert(Math.abs(Number(row.amount)), rate.rate),
      })
      .eq('id', row.id)
      .eq('user_id', userId);
    if (error) return { updated, unconverted, error };
    updated += 1;
  }
  return { updated, unconverted, error: null };
}

/**
 * After the home currency changes, stored home amounts are in the old currency: clear them so
 * backfillHomeAmounts recomputes them against the new one.
 */
export async function clearHomeAmounts(db: SupabaseClient, userId: string): Promise<{ error: DbErr | null }> {
  const { error } = await db
    .from('financial_transactions')
    .update({ fx_rate: null, amount_home: null })
    .eq('user_id', userId)
    .not('amount_home', 'is', null);
  return { error };
}
