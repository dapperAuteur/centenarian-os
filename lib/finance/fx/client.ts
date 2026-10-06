// lib/finance/fx/client.ts
// Browser-side helpers for the currency screens. They only call this app's own API routes; the
// rate APIs are never called from the browser.

import { offlineFetch } from '@/lib/offline/offline-fetch';
import { RATE_SOURCE_LABEL } from './math';
import type { RateSource } from './math';

export interface RateView {
  rate: number;
  rate_date: string;
  source: RateSource | 'identity';
  stale: boolean;
}

export interface SupportedCurrencyView {
  code: string;
  name: string;
  sources: ('frankfurter' | 'open_er_api')[];
}

export interface MyCurrencyView {
  code: string;
  name: string;
  symbol: string;
  added: boolean;
  in_accounts: boolean;
  is_home: boolean;
  covered: boolean | null;
  rate_to_home: RateView | null;
}

export interface CurrenciesResponse {
  home_currency: string;
  supported: SupportedCurrencyView[];
  mine: MyCurrencyView[];
  error?: string;
  code?: string;
}

export async function fetchCurrencies(): Promise<CurrenciesResponse | null> {
  try {
    const res = await offlineFetch('/api/finance/fx/currencies');
    const body = (await res.json()) as CurrenciesResponse;
    return body;
  } catch {
    return null;
  }
}

/** "rate as of Oct 5, 2026 (ECB via Frankfurter)". */
export function rateAsOf(rate: RateView): string {
  const day = new Date(`${rate.rate_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const source = rate.source === 'identity' ? '' : ` (${RATE_SOURCE_LABEL[rate.source]})`;
  return `rate as of ${day}${source}${rate.stale ? ', may be out of date' : ''}`;
}

/** Codes to offer in a currency picker: the user's, then every covered one, no duplicates. */
export function currencyOptions(data: CurrenciesResponse | null, fallbackHome = 'USD'): { code: string; label: string }[] {
  const seen = new Set<string>();
  const out: { code: string; label: string }[] = [];
  const push = (code: string, name: string) => {
    if (seen.has(code)) return;
    seen.add(code);
    out.push({ code, label: name && name !== code ? `${code} · ${name}` : code });
  };
  if (!data) {
    push(fallbackHome, '');
    return out;
  }
  for (const c of data.mine) push(c.code, c.name);
  for (const c of data.supported) push(c.code, c.name);
  return out;
}
