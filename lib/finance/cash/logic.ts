// lib/finance/cash/logic.ts
// Rules for cash on hand: counting cash against the recorded balance, how
// fresh a count is, which cash account a form starts on, and reading a count
// request. Pure: no React, no network. The database side is ./server.ts.
//
// A count compares what the person actually has with the account's recorded
// balance (the one balance rule, lib/finance/balance/logic.ts: opening balance
// + income - expenses after the starting-balance date).
// The difference is recorded as ONE adjustment on the cash account, so the
// balance matches what was counted:
//   counted < recorded -> an expense "Unrecorded cash spending"
//   counted > recorded -> an income  "Cash found"
//   equal              -> no adjustment, the count is still kept
// The adjustment carries the tag 'cash-count' and the category the person
// chose (none = Uncategorized).
//
// Relative imports end in `.ts` for `node --test --experimental-strip-types`
// (tests/unit/cash.test.ts).

import { isDateString, toCents } from '../savings/logic.ts';
import { cleanDenominationCounts, denominationTotalCents } from './denominations.ts';
import type { DenominationCounts } from './denominations.ts';

export const CASH_COUNT_TAG = 'cash-count';
export const UNRECORDED_SPENDING = 'Unrecorded cash spending';
export const CASH_FOUND = 'Cash found';

/** A count older than this many days is shown in amber ("count again"). */
export const STALE_COUNT_DAYS = 30;

/** numeric(12,2) */
const MAX_CENTS = 999_999_999_999;

export class CashRuleError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface CashAdjustment {
  type: 'expense' | 'income';
  /** Always positive. */
  amountCents: number;
  description: string;
}

/** What a count changes: counted - recorded, and the one adjustment that closes the gap (none when equal). */
export function planAdjustment(
  recordedCents: number,
  countedCents: number,
): { differenceCents: number; adjustment: CashAdjustment | null } {
  const differenceCents = countedCents - recordedCents;
  if (differenceCents === 0) return { differenceCents, adjustment: null };
  return {
    differenceCents,
    adjustment:
      differenceCents < 0
        ? { type: 'expense', amountCents: -differenceCents, description: UNRECORDED_SPENDING }
        : { type: 'income', amountCents: differenceCents, description: CASH_FOUND },
  };
}

export type CountFreshness = 'never' | 'stale' | 'fresh';

/** Whole days from a YYYY-MM-DD (or ISO timestamp) date to today, never negative. */
export function daysSince(date: string, today: string): number {
  const a = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * How recent the last count is: 'never' (no count), 'stale' (more than
 * STALE_COUNT_DAYS days ago) or 'fresh'. `lastCountedOn` is the count's
 * date (YYYY-MM-DD) or timestamp.
 */
export function countFreshness(
  lastCountedOn: string | null | undefined,
  today: string,
): { status: CountFreshness; days: number | null } {
  if (!lastCountedOn) return { status: 'never', days: null };
  const days = daysSince(lastCountedOn, today);
  return { status: days > STALE_COUNT_DAYS ? 'stale' : 'fresh', days };
}

export interface CashAccountChoice {
  id: string;
  currency?: string | null;
  is_active?: boolean | null;
}

/**
 * The cash account a form starts on: the one remembered on this device, else
 * the last used one (from the server), else the first; only active accounts,
 * and only in `currency` when given. Null when there is none.
 */
export function defaultCashAccount<T extends CashAccountChoice>(
  accounts: readonly T[],
  options: { remembered?: string | null; lastUsed?: string | null; currency?: string | null } = {},
): T | null {
  const usable = accounts.filter(
    (account) =>
      account.is_active !== false &&
      (!options.currency || (account.currency ?? 'USD') === options.currency),
  );
  for (const id of [options.remembered, options.lastUsed]) {
    const found = id ? usable.find((account) => account.id === id) : undefined;
    if (found) return found;
  }
  return usable[0] ?? null;
}

// ── Reading a count request ───────────────────────────────────────────────

export interface CashCountInput {
  accountId: string;
  countedCents: number;
  denominations: DenominationCounts | null;
  categoryId: string | null;
  /** The day the count is dated (the adjustment's transaction date). */
  countedOn: string;
  note: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads POST /api/finance/cash/counts. The total is `counted_amount`; when
 * `denominations` are sent for a currency that has a list, their total must
 * match it to the cent (or stands in for it when the amount is left out).
 * `today` is the date used when `counted_on` is missing or not a date.
 */
export function parseCountInput(body: unknown, currency: string | null, today: string): CashCountInput {
  if (!isRecord(body)) throw new CashRuleError('The request body must be a JSON object.');
  const accountId = typeof body.account_id === 'string' ? body.account_id.trim() : '';
  if (!accountId) throw new CashRuleError('Choose the cash account you counted.');

  const denominations = cleanDenominationCounts(body.denominations, currency);
  const raw = body.counted_amount;
  const hasAmount = raw !== undefined && raw !== null && raw !== '';
  let countedCents: number;
  if (hasAmount) {
    const amount = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
    if (!Number.isFinite(amount)) throw new CashRuleError('Enter the amount you counted, like 84.50.');
    countedCents = toCents(amount);
    if (denominations && denominationTotalCents(denominations) !== countedCents) {
      throw new CashRuleError('The bills and coins add up to a different amount than the total. Check the count.');
    }
  } else if (denominations) {
    countedCents = denominationTotalCents(denominations);
  } else {
    throw new CashRuleError('Enter the amount you counted, like 84.50.');
  }
  if (countedCents < 0) throw new CashRuleError("A count can't be below zero.");
  if (countedCents > MAX_CENTS) throw new CashRuleError('That amount is too large.');

  const category = body.category_id;
  const categoryId = typeof category === 'string' && category.trim() ? category.trim() : null;
  const countedOn = isDateString(body.counted_on) ? body.counted_on : today;
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  return { accountId, countedCents, denominations, categoryId, countedOn, note };
}
