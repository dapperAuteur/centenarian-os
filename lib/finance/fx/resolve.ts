// lib/finance/fx/resolve.ts
// Picks the rate for one currency pair on one date from exchange_rates rows already in memory.
// Pure: lib/finance/fx/rates.ts loads the rows and fetches what is missing.
//
// PRECEDENCE (for user U, pair FROM -> TO, date D)
//   1. U's manual rate for FROM->TO (or TO->FROM, inverted) on D, else the nearest earlier one.
//      Manual rates always win: they are the rate U actually got at a booth or an ATM.
//   2. Otherwise through USD, one leg per non-USD currency (USD->FROM and USD->TO):
//        a. U's manual rate for that leg on D or the nearest earlier one;
//        b. a fetched rate on D or the nearest earlier one within FETCHED_MAX_AGE_DAYS
//           (ties on the same date: Frankfurter before ExchangeRate-API);
//        c. with `allowStale` (after a fetch failed): any earlier fetched rate, else the nearest
//           later one, flagged `stale`.
//      1 FROM = (USD->TO / USD->FROM) TO.
//   A leg with nothing usable is reported in `missing`, so the caller knows what to fetch.

import { FETCHED_MAX_AGE_DAYS, PIVOT, crossRate, pickNearestEarlier } from './math.ts';
import type { RateSource } from './math.ts';

export interface RateRow {
  base: string;
  quote: string;
  rate: number | string;
  rate_date: string;
  source: RateSource;
  user_id: string | null;
}

export interface ResolvedRate {
  /** 1 from = rate to. Full precision. */
  rate: number;
  /** Date of the oldest rate used. */
  rate_date: string;
  /** 'identity' when from === to. 'manual' when any manual rate was used. */
  source: RateSource | 'identity';
  /** True when the rate is older than the freshness window or from after the date asked for. */
  stale: boolean;
}

export interface ResolveResult {
  resolved: ResolvedRate | null;
  /** Non-USD codes with no usable USD leg. */
  missing: string[];
}

interface Leg {
  rate: number;
  rate_date: string;
  source: RateSource | 'identity';
  stale: boolean;
}

const SOURCE_ORDER: Record<RateSource, number> = { manual: 0, frankfurter: 1, open_er_api: 2 };

function oriented(row: RateRow, base: string, quote: string): { rate: number; rate_date: string } | null {
  const rate = Number(row.rate);
  if (!(rate > 0)) return null;
  if (row.base === base && row.quote === quote) return { rate, rate_date: row.rate_date };
  if (row.base === quote && row.quote === base) return { rate: 1 / rate, rate_date: row.rate_date };
  return null;
}

function candidates(rows: readonly RateRow[], base: string, quote: string, manual: boolean) {
  const out: { rate: number; rate_date: string; source: RateSource }[] = [];
  for (const row of rows) {
    if ((row.source === 'manual') !== manual) continue;
    const o = oriented(row, base, quote);
    if (o) out.push({ ...o, source: row.source });
  }
  // Same date: direct-source priority. pickNearestEarlier keeps the first of equal dates.
  return out.sort((a, b) => SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source]);
}

function nearestLater<T extends { rate_date: string }>(rows: readonly T[], date: string): T | null {
  let best: T | null = null;
  for (const row of rows) {
    if (row.rate_date <= date) continue;
    if (!best || row.rate_date < best.rate_date) best = row;
  }
  return best;
}

function leg(rows: readonly RateRow[], code: string, date: string, allowStale: boolean): Leg | null {
  if (code === PIVOT) return { rate: 1, rate_date: date, source: 'identity', stale: false };
  const manual = pickNearestEarlier(candidates(rows, PIVOT, code, true), date);
  if (manual) return { ...manual, stale: false };
  const fetched = candidates(rows, PIVOT, code, false);
  const fresh = pickNearestEarlier(fetched, date, FETCHED_MAX_AGE_DAYS);
  if (fresh) return { ...fresh, stale: false };
  if (!allowStale) return null;
  const old = pickNearestEarlier(fetched, date) ?? nearestLater(fetched, date);
  return old ? { ...old, stale: true } : null;
}

export function resolveRate(
  rows: readonly RateRow[],
  from: string,
  to: string,
  date: string,
  options: { allowStale?: boolean } = {},
): ResolveResult {
  if (from === to) {
    return { resolved: { rate: 1, rate_date: date, source: 'identity', stale: false }, missing: [] };
  }

  const direct = pickNearestEarlier(candidates(rows, from, to, true), date);
  if (direct) {
    return { resolved: { rate: direct.rate, rate_date: direct.rate_date, source: 'manual', stale: false }, missing: [] };
  }

  const allowStale = options.allowStale === true;
  const fromLeg = leg(rows, from, date, allowStale);
  const toLeg = leg(rows, to, date, allowStale);
  const missing = [
    ...(fromLeg ? [] : [from]),
    ...(toLeg ? [] : [to]),
  ];
  if (!fromLeg || !toLeg) return { resolved: null, missing };

  const legs = [fromLeg, toLeg].filter((l) => l.source !== 'identity');
  const sources = legs.map((l) => l.source as RateSource);
  const source: RateSource = sources.includes('manual')
    ? 'manual'
    : [...sources].sort((a, b) => SOURCE_ORDER[b] - SOURCE_ORDER[a])[0];
  const rateDate = legs.map((l) => l.rate_date).sort()[0];
  return {
    resolved: {
      rate: crossRate(fromLeg.rate, toLeg.rate),
      rate_date: rateDate,
      source,
      stale: legs.some((l) => l.stale),
    },
    missing: [],
  };
}
