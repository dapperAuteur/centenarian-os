// lib/finance/fx/catalog.ts
// Which currencies the free sources cover, cached in server memory for a day (both lists change
// rarely). Server only.

import { currencyName } from './math.ts';
import { fetchFrankfurterCurrencies, fetchOpenErApi } from './providers.ts';
import type { FetchLike } from './providers.ts';

export interface SupportedCurrency {
  code: string;
  name: string;
  /** Which free sources have rates for it. */
  sources: ('frankfurter' | 'open_er_api')[];
}

const TTL_MS = 24 * 60 * 60 * 1000;
let cache: { at: number; list: SupportedCurrency[] } | null = null;

export async function listSupportedCurrencies(fetchImpl?: FetchLike): Promise<SupportedCurrency[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.list;
  const [frank, open] = await Promise.all([fetchFrankfurterCurrencies(fetchImpl), fetchOpenErApi(fetchImpl)]);
  const map = new Map<string, SupportedCurrency>();
  const add = (code: string, source: 'frankfurter' | 'open_er_api', name?: string) => {
    const entry = map.get(code) ?? { code, name: name ?? currencyName(code) ?? code, sources: [] };
    if (!entry.sources.includes(source)) entry.sources.push(source);
    map.set(code, entry);
  };
  for (const [code, name] of Object.entries(frank)) add(code, 'frankfurter', name);
  // USD is the pivot, so open.er-api's rates object omits it from cleanRates; it is always covered.
  if (Object.keys(frank).length > 0 || open) add('USD', 'frankfurter', 'US Dollar');
  for (const code of Object.keys(open?.rates ?? {})) add(code, 'open_er_api');
  const list = [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  // Don't cache a failed lookup for a day.
  if (list.length > 0) cache = { at: Date.now(), list };
  return list;
}
