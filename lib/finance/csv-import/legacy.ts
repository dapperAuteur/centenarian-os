// lib/finance/csv-import/legacy.ts
// The older import contract: the Import page parses a CSV shaped like the
// app's own template in the browser and posts `{ rows }` to
// /api/finance/import. Kept working until the page is rewritten around the
// statement import (./service.ts). No account, no dedupe, no batch.
//
// Pure, and tested in tests/unit/csv-import-plan.test.ts. Relative imports end
// in `.ts` for `node --test --experimental-strip-types`.

import { lookupLearnedCategory } from '../transaction-matching.ts';
import type { LearnedCategoryIndex } from '../transaction-matching.ts';
import { normalizeType, parseAmount, parseDate } from './parse.ts';
import { MAX_AMOUNT_CENTS } from './plan.ts';
import type { TransactionType } from './types.ts';

/** The most rows the `{ rows }` contract takes in one request. */
export const LEGACY_MAX_ROWS = 1000;

/** One row as the Import page sends it. Nothing here is trusted. */
export interface LegacyImportRow {
  transaction_date?: unknown;
  amount?: unknown;
  type?: unknown;
  description?: unknown;
  vendor?: unknown;
  category_name?: unknown;
}

export interface LegacyPayload {
  transaction_date: string;
  amount: number;
  type: TransactionType;
  description: string | null;
  vendor: string | null;
  category_id: string | null;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Money direction for a legacy row.
 * - A type column wins, read without regard to case ("Income", "CREDIT",
 *   "Deposit" are money in; "Expense", "debit", "Purchase" money out). The old
 *   code compared against the exact string 'income', so "Income" became an expense.
 * - A type that names neither direction is an expense, as before.
 * - No type: a negative amount is an expense, a positive one income.
 */
export function legacyType(typeText: unknown, signedCents: number): TransactionType {
  const value = text(typeText);
  if (value) return normalizeType(value) ?? 'expense';
  return signedCents < 0 ? 'expense' : 'income';
}

/**
 * Validates legacy rows and turns the good ones into insert payloads (without
 * user_id and source: the route adds those). Every bad row gets one message,
 * numbered from 1 in the order the rows were sent.
 *
 * - The date must be a real calendar date: YYYY-MM-DD, M/D/YYYY, or a month
 *   name. "2026-02-30" and "2026-13-01" are refused; the old pattern check
 *   let them through to the database.
 * - The amount may carry `$`, commas, or accounting parentheses; zero is refused.
 * - The category is the row's category name matched against the person's
 *   budget categories, else the vendor's learned category.
 */
export function readLegacyRows(
  rows: readonly LegacyImportRow[],
  lookup: { categoryIdByName: ReadonlyMap<string, string>; learned: LearnedCategoryIndex },
): { payloads: LegacyPayload[]; errors: string[] } {
  const payloads: LegacyPayload[] = [];
  const errors: string[] = [];

  rows.forEach((row, i) => {
    const label = `Row ${i + 1}`;
    if (typeof row !== 'object' || row === null) {
      errors.push(`${label}: not a row`);
      return;
    }

    const dateText = text(row.transaction_date);
    const date = parseDate(dateText, 'MDY');
    if (!date) {
      errors.push(dateText ? `${label}: "${dateText}" is not a real date` : `${label}: no date`);
      return;
    }

    const cents =
      typeof row.amount === 'number'
        ? Number.isFinite(row.amount) ? Math.round(row.amount * 100) : null
        : parseAmount(text(row.amount));
    if (cents === null) {
      errors.push(`${label}: the amount is not a number`);
      return;
    }
    if (cents === 0) {
      errors.push(`${label}: the amount is zero`);
      return;
    }
    if (Math.abs(cents) > MAX_AMOUNT_CENTS) {
      errors.push(`${label}: the amount is larger than the app can store`);
      return;
    }

    const type = legacyType(row.type, cents);
    const vendor = text(row.vendor) || null;
    const categoryName = text(row.category_name).toLowerCase();
    const categoryId =
      (categoryName ? lookup.categoryIdByName.get(categoryName) : undefined) ??
      lookupLearnedCategory(lookup.learned, vendor, type);

    payloads.push({
      transaction_date: date,
      amount: Math.abs(cents) / 100,
      type,
      description: text(row.description) || null,
      vendor,
      category_id: categoryId ?? null,
    });
  });

  return { payloads, errors };
}
