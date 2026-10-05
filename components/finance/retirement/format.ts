// components/finance/retirement/format.ts
// Display helpers for the Retirement and Insurance pages.

export function moneyIn(n: number | null | undefined, currency = 'USD', whole = false): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  try {
    return n.toLocaleString('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    });
  } catch {
    return `${currency} ${n.toFixed(whole ? 0 : 2)}`;
  }
}

export function compactMoney(n: number, currency = 'USD'): string {
  try {
    return n.toLocaleString('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });
  } catch {
    return `${currency} ${Math.round(n)}`;
  }
}

/** 'YYYY-MM-DD' -> "Jan 5, 2027" (no time-zone shift). */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '';
  const d = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export const pct = (n: number) => `${Math.round(n * 100) / 100}%`;

/** '' -> null, otherwise a number (NaN -> null). */
export function numOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
