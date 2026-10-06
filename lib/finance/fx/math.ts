// lib/finance/fx/math.ts
// Pure currency helpers: code checks, conversion, cross rates through USD, nearest-date lookup,
// cent rounding, and the arithmetic of a currency exchange.
//
// Rates are "1 base = rate quote" (USD->EUR 0.86 means 1 USD buys 0.86 EUR). Rates keep full
// precision; only a converted money amount is rounded, to cents, once.
//
// No imports on purpose: runs in API routes, client components and under
// `node --test --experimental-strip-types` (tests/unit/fx.test.ts).

/** The pivot every fetched rate is stored against. */
export const PIVOT = 'USD';

/** What code reads a missing profiles.home_currency as. */
export const DEFAULT_HOME_CURRENCY = 'USD';

export type RateSource = 'frankfurter' | 'open_er_api' | 'manual';

export const RATE_SOURCE_LABEL: Record<RateSource, string> = {
  frankfurter: 'ECB via Frankfurter',
  open_er_api: 'ExchangeRate-API',
  manual: 'your rate',
};

/** Fetched rates older than this (before the date asked for) are not used without trying a fetch. */
export const FETCHED_MAX_AGE_DAYS = 7;

/** "eur " -> "EUR"; anything that is not three letters -> null. */
export function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

export function isCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
}

/** Round a money amount to cents (half away from zero), avoiding 1.005 -> 1.00 float drift. */
export function roundCents(value: number): number {
  if (!Number.isFinite(value)) return NaN;
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * 100 + 1e-7)) / 100;
}

/** amount in `from` -> amount in `to` at `rate` (1 from = rate to), rounded to cents. */
export function convert(amount: number, rate: number): number {
  return roundCents(amount * rate);
}

/**
 * from -> to from two USD legs: usdToFrom = how many `from` 1 USD buys, usdToTo the same for `to`.
 * 1 from = (usdToTo / usdToFrom) to.
 */
export function crossRate(usdToFrom: number, usdToTo: number): number {
  if (!(usdToFrom > 0) || !(usdToTo > 0)) throw new Error('Rates must be positive.');
  return usdToTo / usdToFrom;
}

export function invertRate(rate: number): number {
  if (!(rate > 0)) throw new Error('Rates must be positive.');
  return 1 / rate;
}

/** Whole days from a to b (YYYY-MM-DD), b - a. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export interface DatedRate {
  rate: number;
  rate_date: string;
}

/**
 * The rate on `date`, else the nearest one before it. `maxAgeDays` limits how far back to look
 * (undefined = no limit). Rates after `date` are never used.
 */
export function pickNearestEarlier<T extends DatedRate>(rows: readonly T[], date: string, maxAgeDays?: number): T | null {
  let best: T | null = null;
  for (const row of rows) {
    if (row.rate_date > date) continue;
    if (maxAgeDays !== undefined && daysBetween(row.rate_date, date) > maxAgeDays) continue;
    if (!best || row.rate_date > best.rate_date) best = row;
  }
  return best;
}

export interface ExchangeInput {
  /** Amount that left the source account, in its currency (fee not included). */
  sent: number;
  /** Amount that reached the destination account, in its currency. */
  received: number;
  /** Optional fee, in the source account's currency, charged on top of `sent`. */
  fee?: number | null;
}

export interface ExchangeMath {
  sent: number;
  received: number;
  fee: number;
  /** 1 source currency = rate destination currency (received / sent, full precision). */
  rate: number;
  /** The same rate the other way round. */
  inverse: number;
  /** What the exchange cost in total in the source currency (sent + fee). */
  total_cost: number;
  /** Rate including the fee: received / (sent + fee). */
  effective_rate: number;
}

/** Validates an exchange and derives its rate. Throws a readable Error on bad input. */
export function exchangeMath(input: ExchangeInput): ExchangeMath {
  const sent = roundCents(Number(input.sent));
  const received = roundCents(Number(input.received));
  const fee = input.fee == null || (input.fee as unknown) === '' ? 0 : roundCents(Number(input.fee));
  if (!(sent > 0)) throw new Error('Enter the amount you handed over (more than 0).');
  if (!(received > 0)) throw new Error('Enter the amount you received (more than 0).');
  if (!Number.isFinite(fee) || fee < 0) throw new Error('The fee can’t be negative.');
  const rate = Number(input.received) / Number(input.sent);
  const totalCost = roundCents(sent + fee);
  return {
    sent,
    received,
    fee,
    rate,
    inverse: Number(input.sent) / Number(input.received),
    total_cost: totalCost,
    effective_rate: received / totalCost,
  };
}

/** Formats a money amount in a currency for display; falls back to "CODE 1,234.50" for unknown codes. */
export function formatMoney(amount: number, currency: string, locale = 'en-US'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

/** A rate for display: enough significant digits for both 0.0000623 and 18.1498. */
export function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return '';
  return rate >= 1 ? rate.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') : rate.toPrecision(4);
}

/** English name of a currency code from Intl, or null when the runtime doesn't know it. */
export function currencyName(code: string): string | null {
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'currency' }).of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

/** Narrow symbol of a currency code from Intl ("€", "¥", "$"), or null. */
export function currencySymbol(code: string): string | null {
  try {
    const part = new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value ?? null;
  } catch {
    return null;
  }
}
