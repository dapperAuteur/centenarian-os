// components/finance/savings/format.ts
// Display helpers for the Savings page.

export const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const wholeMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** 'YYYY-MM-DD' -> "Jan 5, 2027" (no time-zone shift). */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '';
  const d = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
