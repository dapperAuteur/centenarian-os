// lib/finance/fx/providers.ts
// The two free exchange-rate APIs, read server-side only (never from the browser).
//
// 1. Frankfurter (https://frankfurter.dev): European Central Bank reference rates, ~30 currencies,
//    no API key, latest and historical. Shapes (checked 2026-10-05):
//      GET /v1/latest?base=USD&symbols=EUR,JPY      -> { amount, base, date, rates: { EUR: 0.86 } }
//      GET /v1/2026-09-05?base=USD&symbols=EUR       -> same; `date` is the last ECB business day
//                                                      on or before the one asked for (2026-09-04)
//      GET /v1/2026-09-01..2026-09-08?base=USD&...   -> { start_date, end_date, rates: { "2026-09-01": {...} } }
//      GET /v1/currencies                            -> { AUD: "Australian Dollar", ... }
//    Unsupported symbols are left out of `rates` silently; an unsupported base answers 404.
// 2. ExchangeRate-API open access (https://www.exchangerate-api.com/docs/free): ~166 currencies,
//    no key, latest only, refreshed once a day.
//      GET https://open.er-api.com/v6/latest/USD     -> { result: "success", time_last_update_utc, rates }
//    Its terms require the attribution link "Rates By Exchange Rate API"
//    (https://www.exchangerate-api.com) on pages that show its rates, allow caching for end use,
//    forbid redistribution, and ask for at most ~1 request per hour (daily is plenty). See
//    components/finance/FxAttribution.tsx.
//
// Every result is "1 USD = rate X" (PIVOT). `fetchImpl` is injectable for tests.

import { PIVOT } from './math.ts';
import type { RateSource } from './math.ts';

export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface FetchedRates {
  source: Exclude<RateSource, 'manual'>;
  /** The day the rates are for (YYYY-MM-DD). */
  rate_date: string;
  /** 1 USD = rates[code] code. */
  rates: Record<string, number>;
}

export const FRANKFURTER_BASE = 'https://api.frankfurter.dev/v1';
export const OPEN_ER_API_URL = `https://open.er-api.com/v6/latest/${PIVOT}`;
const TIMEOUT_MS = 8000;

function defaultFetch(): FetchLike {
  return (url, init) => fetch(url, init as RequestInit) as unknown as ReturnType<FetchLike>;
}

async function getJson(fetchImpl: FetchLike, url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function cleanRates(raw: unknown, wanted?: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[A-Z]{3}$/.test(code) || code === PIVOT) continue;
    if (wanted && !wanted.includes(code)) continue;
    const rate = Number(value);
    if (Number.isFinite(rate) && rate > 0) out[code] = rate;
  }
  return out;
}

/** Frankfurter, one day ("latest" or YYYY-MM-DD). Null when the request fails. */
export async function fetchFrankfurter(
  day: 'latest' | string,
  symbols: readonly string[],
  fetchImpl: FetchLike = defaultFetch(),
): Promise<FetchedRates | null> {
  const wanted = symbols.filter((c) => c !== PIVOT);
  if (wanted.length === 0) return null;
  const url = `${FRANKFURTER_BASE}/${day}?base=${PIVOT}&symbols=${wanted.join(',')}`;
  const body = (await getJson(fetchImpl, url)) as { date?: unknown; rates?: unknown } | null;
  if (!body || typeof body.date !== 'string') return null;
  return { source: 'frankfurter', rate_date: body.date, rates: cleanRates(body.rates, wanted) };
}

/** Frankfurter, every business day in [from, to]. Empty when the request fails. */
export async function fetchFrankfurterRange(
  from: string,
  to: string,
  symbols: readonly string[],
  fetchImpl: FetchLike = defaultFetch(),
): Promise<FetchedRates[]> {
  const wanted = symbols.filter((c) => c !== PIVOT);
  if (wanted.length === 0) return [];
  const url = `${FRANKFURTER_BASE}/${from}..${to}?base=${PIVOT}&symbols=${wanted.join(',')}`;
  const body = (await getJson(fetchImpl, url)) as { rates?: unknown } | null;
  if (!body || !body.rates || typeof body.rates !== 'object') return [];
  return Object.entries(body.rates as Record<string, unknown>)
    .filter(([day]) => /^\d{4}-\d{2}-\d{2}$/.test(day))
    .map(([day, rates]) => ({ source: 'frankfurter' as const, rate_date: day, rates: cleanRates(rates, wanted) }));
}

/** Codes Frankfurter supports. Empty when the request fails. */
export async function fetchFrankfurterCurrencies(fetchImpl: FetchLike = defaultFetch()): Promise<Record<string, string>> {
  const body = await getJson(fetchImpl, `${FRANKFURTER_BASE}/currencies`);
  if (!body || typeof body !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [code, name] of Object.entries(body as Record<string, unknown>)) {
    if (/^[A-Z]{3}$/.test(code) && typeof name === 'string') out[code] = name;
  }
  return out;
}

/** ExchangeRate-API open access, latest (all ~166 codes, USD base). Null when the request fails. */
export async function fetchOpenErApi(fetchImpl: FetchLike = defaultFetch()): Promise<FetchedRates | null> {
  const body = (await getJson(fetchImpl, OPEN_ER_API_URL)) as {
    result?: unknown;
    time_last_update_utc?: unknown;
    time_last_update_unix?: unknown;
    rates?: unknown;
  } | null;
  if (!body || body.result !== 'success') return null;
  let day: string | null = null;
  if (typeof body.time_last_update_unix === 'number') {
    day = new Date(body.time_last_update_unix * 1000).toISOString().slice(0, 10);
  } else if (typeof body.time_last_update_utc === 'string') {
    const parsed = Date.parse(body.time_last_update_utc);
    if (Number.isFinite(parsed)) day = new Date(parsed).toISOString().slice(0, 10);
  }
  if (!day) return null;
  return { source: 'open_er_api', rate_date: day, rates: cleanRates(body.rates) };
}
