// lib/finance/pdf-import/rows.ts
// Builds the import's rows from what a statement parser found, using card
// conventions: purchases, cash advances, fees and interest add to what is
// owed and are expenses; payments and credits reduce it and are income.
//
// Relative imports end in `.ts` so tests/unit/pdf-import.test.ts can load this
// file under `node --test --experimental-strip-types`.

import { transferHints } from '../csv-import/parse.ts';
import { normalizeMerchant } from '../transaction-matching.ts';
import { displayVendor } from './lines.ts';
import type { StatementFacts, StatementRow, StatementRowKind } from './types.ts';

const INCOME_KINDS: ReadonlySet<StatementRowKind> = new Set(['payment', 'credit']);

/** expense or income for a kind of statement row. */
export function typeForKind(kind: StatementRowKind): 'expense' | 'income' {
  return INCOME_KINDS.has(kind) ? 'income' : 'expense';
}

/** A readable vendor name: the merchant with store numbers and processor tags removed, in Title Case. */
export function vendorFor(description: string): string {
  const normalized = normalizeMerchant(description);
  return normalized ? displayVendor(normalized.toUpperCase()) : displayVendor(description);
}

export interface RowInput {
  date: string;
  /** Positive cents. */
  amountCents: number;
  kind: StatementRowKind;
  description: string;
  /** The issuer's reference number for the row, when printed. */
  reference?: string | null;
}

/** Numbers the rows in statement order, from 1. */
export function buildRows(inputs: readonly RowInput[]): StatementRow[] {
  return inputs.map((input, index) => {
    const description = input.description.replace(/\s+/g, ' ').trim();
    const row: StatementRow = {
      rowNumber: index + 1,
      date: input.date,
      amountCents: Math.abs(input.amountCents),
      type: typeForKind(input.kind),
      kind: input.kind,
      description,
      vendor: vendorFor(description),
      hints: transferHints(description),
      issues: [],
    };
    if (input.reference) row.bankId = input.reference;
    return row;
  });
}

/** Facts with nothing found yet. */
export function emptyFacts(): StatementFacts {
  return {
    previousBalance: null,
    payments: null,
    credits: null,
    purchases: null,
    cashAdvances: null,
    fees: null,
    interestCharged: null,
    newBalance: null,
    minimumPayment: null,
    dueDate: null,
    creditLimit: null,
    aprs: [],
    promos: [],
  };
}
