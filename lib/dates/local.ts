// lib/dates/local.ts
// Calendar dates (YYYY-MM-DD) in the user's local time zone.
//
// `new Date().toISOString().split('T')[0]` is the UTC date. Every evening
// in US time zones (from 8pm EDT onward) that is already tomorrow. Use these
// helpers wherever a value means "the user's today" or a user-facing default
// date. Keep toISOString() where a UTC instant or UTC date is intended.

/** Format a Date as YYYY-MM-DD from its local calendar fields. */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's date (YYYY-MM-DD) in the user's local time zone. */
export function todayLocal(): string {
  return toLocalDateString(new Date());
}

/**
 * Parse a YYYY-MM-DD string as local midnight. `new Date('2026-09-20')`
 * parses as UTC midnight, which is the previous evening in US time zones,
 * so local getDate()/getDay() on it are off by one.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}
