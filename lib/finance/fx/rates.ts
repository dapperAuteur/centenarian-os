// lib/finance/fx/rates.ts
// The exchange-rate service: reads the exchange_rates cache, fetches what is missing from the free
// APIs (Frankfurter first, ExchangeRate-API for currencies Frankfurter lacks), stores what it
// fetched, and saves manual rates. Server only; callers pass a service-role client and the id of
// an authenticated user. Precedence rules: ./resolve.ts.
//
// Fetched rows are stored as USD -> X with user_id NULL (shared by every user, migration 210).

import type { SupabaseClient } from '@supabase/supabase-js';
import { PIVOT } from './math.ts';
import type { RateSource } from './math.ts';
import {
  fetchFrankfurter,
  fetchFrankfurterRange,
  fetchOpenErApi,
} from './providers.ts';
import type { FetchLike, FetchedRates } from './providers.ts';
import { resolveRate } from './resolve.ts';
import type { RateRow, ResolvedRate } from './resolve.ts';

export interface FxDeps {
  fetchImpl?: FetchLike;
  /** Today as YYYY-MM-DD (UTC); injectable for tests. */
  today?: string;
  /** false = never call the APIs, use the cache only. Default true. */
  allowFetch?: boolean;
}

export interface DbErr {
  code?: string | null;
  message?: string | null;
}

export class FxNotReadyError extends Error {
  constructor() {
    super('Currencies are not set up in this database yet. Run migration 210 first.');
  }
}

/** True when an error says a table or column from migration 210 is missing. */
export function isFxSchemaMissing(error: DbErr | null | undefined): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return /exchange_rates|user_currencies/.test(msg);
  }
  if (error.code === '42703' || error.code === 'PGRST204') {
    return /currency|fx_rate|amount_home|home_currency/.test(msg);
  }
  return false;
}

const RATE_SELECT = 'base, quote, rate, rate_date, source, user_id';
const LOOKBACK_ROWS = 400;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Rows that can price `codes` on or before `date`: shared fetched rows plus the user's manual rows. */
export async function loadRateRows(
  db: SupabaseClient,
  userId: string,
  codes: readonly string[],
  date: string,
  options: { after?: boolean } = {},
): Promise<{ rows: RateRow[]; error: DbErr | null }> {
  const set = [...new Set([PIVOT, ...codes])];
  const build = (shared: boolean) => {
    let q = db.from('exchange_rates').select(RATE_SELECT).in('base', set).in('quote', set);
    q = shared ? q.is('user_id', null) : q.eq('user_id', userId);
    q = options.after ? q.gt('rate_date', date).order('rate_date', { ascending: true })
      : q.lte('rate_date', date).order('rate_date', { ascending: false });
    return q.limit(LOOKBACK_ROWS);
  };
  const [shared, manual] = await Promise.all([build(true), build(false)]);
  const error = shared.error ?? manual.error;
  if (error) return { rows: [], error };
  return { rows: [...((shared.data ?? []) as RateRow[]), ...((manual.data ?? []) as RateRow[])], error: null };
}

/** Inserts fetched rates that are not cached yet. Returns how many rows were added. */
export async function storeFetched(db: SupabaseClient, batches: readonly FetchedRates[]): Promise<{ stored: number; error: DbErr | null }> {
  let stored = 0;
  for (const batch of batches) {
    const codes = Object.keys(batch.rates);
    if (codes.length === 0) continue;
    const { data: existing, error: readError } = await db
      .from('exchange_rates')
      .select('quote')
      .is('user_id', null)
      .eq('base', PIVOT)
      .eq('source', batch.source)
      .eq('rate_date', batch.rate_date)
      .in('quote', codes);
    if (readError) return { stored, error: readError };
    const have = new Set(((existing ?? []) as { quote: string }[]).map((r) => r.quote));
    const rows = codes
      .filter((code) => !have.has(code))
      .map((code) => ({
        user_id: null,
        base: PIVOT,
        quote: code,
        rate: batch.rates[code],
        rate_date: batch.rate_date,
        source: batch.source,
      }));
    if (rows.length === 0) continue;
    const { error } = await db.from('exchange_rates').insert(rows);
    // 23505: a concurrent refresh stored the same day first. Nothing to do.
    if (error && error.code !== '23505') return { stored, error };
    if (!error) stored += rows.length;
  }
  return { stored, error: null };
}

/** Throttle: one attempt per (kind, day, codes) per server instance every 10 minutes. */
const recentAttempts = new Map<string, number>();
const ATTEMPT_TTL_MS = 10 * 60 * 1000;
function shouldAttempt(key: string): boolean {
  const now = Date.now();
  const last = recentAttempts.get(key);
  if (last && now - last < ATTEMPT_TTL_MS) return false;
  recentAttempts.set(key, now);
  return true;
}
/** Tests reset the throttle between cases. */
export function resetFetchThrottle(): void {
  recentAttempts.clear();
}

/**
 * Fetches rates for `codes` on `day` ('latest' or a date): Frankfurter first, then
 * ExchangeRate-API (latest only) for codes Frankfurter didn't return. Stores what came back.
 */
export async function fetchAndStore(
  db: SupabaseClient,
  codes: readonly string[],
  day: 'latest' | string,
  deps: FxDeps = {},
): Promise<{ stored: number; covered: string[]; sources: RateSource[]; error: DbErr | null }> {
  const wanted = [...new Set(codes.filter((c) => c !== PIVOT))].sort();
  if (wanted.length === 0) return { stored: 0, covered: [], sources: [], error: null };
  const batches: FetchedRates[] = [];
  const frank = await fetchFrankfurter(day, wanted, deps.fetchImpl);
  if (frank && Object.keys(frank.rates).length > 0) batches.push(frank);
  const left = wanted.filter((c) => !((frank?.rates[c] ?? 0) > 0));
  if (left.length > 0) {
    const open = await fetchOpenErApi(deps.fetchImpl);
    if (open) {
      const subset = Object.fromEntries(left.filter((c) => (open.rates[c] ?? 0) > 0).map((c) => [c, open.rates[c]]));
      if (Object.keys(subset).length > 0) batches.push({ ...open, rates: subset });
    }
  }
  const { stored, error } = await storeFetched(db, batches);
  const covered = [...new Set(batches.flatMap((b) => Object.keys(b.rates)))];
  return { stored, covered, sources: batches.map((b) => b.source), error };
}

/**
 * The rate for 1 `from` in `to` on `date`, by the precedence in ./resolve.ts. Fetches (and caches)
 * a missing USD leg unless deps.allowFetch is false. Null when no source has a rate at all (a
 * currency only the user knows: they must enter a manual rate).
 */
export async function getRate(
  db: SupabaseClient,
  userId: string,
  from: string,
  to: string,
  date: string,
  deps: FxDeps = {},
): Promise<{ rate: ResolvedRate | null; error: DbErr | null }> {
  if (from === to) return { rate: resolveRate([], from, to, date).resolved, error: null };

  const loaded = await loadRateRows(db, userId, [from, to], date);
  if (loaded.error) return { rate: null, error: loaded.error };
  const first = resolveRate(loaded.rows, from, to, date);
  if (first.resolved) return { rate: first.resolved, error: null };

  let rows = loaded.rows;
  if (deps.allowFetch !== false) {
    const today = deps.today ?? todayUtc();
    const day = date >= today ? 'latest' : date;
    if (shouldAttempt(`${day}:${first.missing.join(',')}`)) {
      const fetched = await fetchAndStore(db, first.missing, day, deps);
      if (fetched.error) return { rate: null, error: fetched.error };
      if (fetched.stored > 0 || fetched.covered.length > 0) {
        const again = await loadRateRows(db, userId, [from, to], date);
        if (again.error) return { rate: null, error: again.error };
        rows = again.rows;
        const second = resolveRate(rows, from, to, date);
        if (second.resolved) return { rate: second.resolved, error: null };
      }
    }
  }

  // Last resort: an older cached rate, or the nearest later one (ExchangeRate-API has no history).
  const later = await loadRateRows(db, userId, [from, to], date, { after: true });
  if (later.error) return { rate: null, error: later.error };
  const stale = resolveRate([...rows, ...later.rows], from, to, date, { allowStale: true });
  return { rate: stale.resolved, error: null };
}

/**
 * Caches Frankfurter's business days in [fromDate, toDate] for `codes` (one request), for
 * converting many dated rows at once. ExchangeRate-API has no history, so it is not used here.
 */
export async function prefetchRange(
  db: SupabaseClient,
  codes: readonly string[],
  fromDate: string,
  toDate: string,
  deps: FxDeps = {},
): Promise<{ stored: number; error: DbErr | null }> {
  if (deps.allowFetch === false) return { stored: 0, error: null };
  const wanted = [...new Set(codes.filter((c) => c !== PIVOT))].sort();
  if (wanted.length === 0 || fromDate > toDate) return { stored: 0, error: null };
  if (!shouldAttempt(`range:${fromDate}:${toDate}:${wanted.join(',')}`)) return { stored: 0, error: null };
  const batches = await fetchFrankfurterRange(fromDate, toDate, wanted, deps.fetchImpl);
  return storeFetched(db, batches);
}

export interface ManualRateInput {
  base: string;
  quote: string;
  rate: number;
  rate_date: string;
}

/** Saves (or replaces) the user's manual rate for one pair on one day. */
export async function saveManualRate(
  db: SupabaseClient,
  userId: string,
  input: ManualRateInput,
): Promise<{ error: DbErr | null }> {
  const { data: existing, error: readError } = await db
    .from('exchange_rates')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'manual')
    .eq('base', input.base)
    .eq('quote', input.quote)
    .eq('rate_date', input.rate_date)
    .maybeSingle();
  if (readError) return { error: readError };
  if (existing) {
    const { error } = await db
      .from('exchange_rates')
      .update({ rate: input.rate })
      .eq('id', (existing as { id: string }).id)
      .eq('user_id', userId);
    return { error };
  }
  const { error } = await db.from('exchange_rates').insert({
    user_id: userId,
    base: input.base,
    quote: input.quote,
    rate: input.rate,
    rate_date: input.rate_date,
    source: 'manual',
  });
  return { error };
}
