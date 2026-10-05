// lib/finance/cash/denominations.ts
// Bills and coins for "Count my cash" by denomination. Each value is in cents
// (hundredths of the currency's unit), so sums never go through floating point.
// A currency missing here is counted by its total only.
//
// The lists are the notes and coins in everyday circulation. A note that is
// still legal tender but rarely seen (the US $2 bill, the euro 500 note) is
// listed so a person who has one can count it.
//
// Pure: no React, no network (tests/unit/cash.test.ts).

export interface Denomination {
  /** Value in cents, e.g. 2000 for a 20 note. Also the key in a count. */
  cents: number;
  kind: 'bill' | 'coin';
}

const bills = (...values: number[]): Denomination[] => values.map((v) => ({ cents: Math.round(v * 100), kind: 'bill' }));
const coins = (...values: number[]): Denomination[] => values.map((v) => ({ cents: Math.round(v * 100), kind: 'coin' }));

const DENOMINATIONS: Record<string, Denomination[]> = {
  USD: [...bills(100, 50, 20, 10, 5, 2, 1), ...coins(1, 0.5, 0.25, 0.1, 0.05, 0.01)],
  MXN: [...bills(1000, 500, 200, 100, 50, 20), ...coins(20, 10, 5, 2, 1, 0.5)],
  EUR: [...bills(500, 200, 100, 50, 20, 10, 5), ...coins(2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01)],
  GBP: [...bills(50, 20, 10, 5), ...coins(2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01)],
  CAD: [...bills(100, 50, 20, 10, 5), ...coins(2, 1, 0.25, 0.1, 0.05)],
  JPY: [...bills(10000, 5000, 2000, 1000), ...coins(500, 100, 50, 10, 5, 1)],
};

/** The bills and coins of a currency, largest first, or null when it is counted by total only. */
export function denominationsFor(currency: string | null | undefined): Denomination[] | null {
  return DENOMINATIONS[(currency ?? '').toUpperCase()] ?? null;
}

/** Most pieces of one denomination a count accepts. */
export const MAX_PIECES = 100_000;

/** How many of each denomination: key = value in cents (as a string), value = how many. */
export type DenominationCounts = Record<string, number>;

/**
 * The counts a person entered, cleaned: only this currency's denominations,
 * whole numbers from 1 to MAX_PIECES (zero and blank are left out). Null
 * when nothing usable is left, or the currency has no list.
 */
export function cleanDenominationCounts(raw: unknown, currency: string | null | undefined): DenominationCounts | null {
  const list = denominationsFor(currency);
  if (!list || typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const known = new Set(list.map((d) => String(d.cents)));
  const out: DenominationCounts = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.has(key)) continue;
    const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
    if (!Number.isInteger(n) || n <= 0 || n > MAX_PIECES) continue;
    out[key] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** The total of a count, in cents. */
export function denominationTotalCents(counts: DenominationCounts | null | undefined): number {
  if (!counts) return 0;
  let total = 0;
  for (const [key, n] of Object.entries(counts)) total += Number(key) * n;
  return total;
}

/** "20" for 2000 cents, "0.25" for 25: the face value as it is printed. */
export function denominationLabel(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
