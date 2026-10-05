// lib/finance/pdf-import/types.ts
// Types for reading a card or bank statement PDF. Types only: nothing in this
// file runs, so it is safe to import from client and server code.
//
// The pipeline: extract.ts turns PDF bytes into positioned text (PdfLine[]),
// an issuer parser in ./issuers turns the lines into a ParsedStatement, and
// reconcile.ts checks the statement's own arithmetic. The rows then go through
// the same plan / commit / undo steps as a CSV statement.

import type { NormalizedRow } from '../csv-import/types.ts';

/** One piece of text on a page, in PDF points from the bottom-left corner. */
export interface TextItem {
  /** Left edge. */
  x: number;
  /** Baseline. Larger is higher on the page. */
  y: number;
  /** Width, or 0 when unknown. */
  w: number;
  str: string;
}

/** Text items that share a baseline, left to right. */
export interface PdfLine {
  /** 1-based page number. */
  page: number;
  y: number;
  items: TextItem[];
  /** The items' text joined with single spaces. */
  text: string;
}

/** A page's worth of extracted text. */
export interface PdfPageText {
  page: number;
  items: TextItem[];
}

/** How sure a parser is that it read the statement correctly. */
export type StatementConfidence = 'high' | 'low';

/**
 * What a statement row is, in card terms. Purchases, cash advances, fees and
 * interest add to what is owed (expense); payments and credits reduce it
 * (income).
 */
export type StatementRowKind = 'purchase' | 'cash_advance' | 'fee' | 'interest' | 'payment' | 'credit';

/** A statement row: the import's NormalizedRow plus what kind of row the statement says it is. */
export interface StatementRow extends NormalizedRow {
  kind: StatementRowKind;
}

/** One APR from the interest charge table. */
export interface StatementApr {
  /** For example "Purchases - Regular" or "Cash advances - Regular". */
  balanceType: string;
  /** Percent, as printed: 28.74 means 28.74%. */
  apr: number;
  /** Balance subject to interest rate, in cents, when printed. */
  balanceCents?: number;
  /** Interest charged on this balance this period, in cents, when printed. */
  interestCents?: number;
}

/** One promotional (often deferred-interest) balance. */
export interface StatementPromo {
  description: string;
  /** The promotional balance at the end of the period, in cents. */
  balance: number;
  /** YYYY-MM-DD, when printed. */
  expiresOn: string | null;
  /** Deferred interest accrued so far, in cents, when printed: what is charged if the balance isn't paid by expiry. */
  deferredInterest?: number;
  /** The original purchase amount, in cents, when printed. */
  originalAmount?: number;
  /** The promotion's own minimum payment due, in cents, when printed. */
  minimumPayment?: number;
  /** YYYY-MM-DD of the promotional purchase, when printed. */
  startedOn?: string | null;
}

/**
 * The statement's own summary. Every amount is in integer cents and positive:
 * payments and credits are amounts paid or credited, not negative numbers.
 * A field is null when the statement didn't print it (or the parser couldn't find it).
 */
export interface StatementFacts {
  previousBalance: number | null;
  payments: number | null;
  credits: number | null;
  purchases: number | null;
  cashAdvances: number | null;
  fees: number | null;
  interestCharged: number | null;
  newBalance: number | null;
  minimumPayment: number | null;
  /** YYYY-MM-DD. */
  dueDate: string | null;
  creditLimit: number | null;
  aprs: StatementApr[];
  promos: StatementPromo[];
}

/** What an issuer parser makes of a statement. */
export interface ParsedStatement {
  /** The issuer parser's id: `citi-best-buy`, `generic`. */
  issuer: string;
  /** A name a person recognizes. */
  issuerLabel: string;
  confidence: StatementConfidence;
  accountLastFour: string | null;
  /** YYYY-MM-DD dates; either is null when the statement didn't say. */
  period: { start: string | null; end: string | null };
  rows: StatementRow[];
  statement: StatementFacts;
  /** Plain-language notes about anything the parser was unsure of. */
  warnings: string[];
}

/** An issuer's statement layout. */
export interface IssuerParser {
  id: string;
  label: string;
  /** True when the lines look like this issuer's statement. */
  detect(lines: readonly PdfLine[]): boolean;
  parse(lines: readonly PdfLine[]): ParsedStatement;
}

/** One way the statement doesn't add up. Amounts in cents. */
export interface ReconciliationDifference {
  /** A stable key: `balance`, `payments`, `credits`, `purchases`, `fees`, `interest`. */
  check: string;
  /** A sentence that says what was compared. */
  label: string;
  expected: number;
  actual: number;
  /** actual - expected. */
  difference: number;
}

export interface Reconciliation {
  ok: boolean;
  /** False when the statement lacked the numbers to check its balance at all. */
  checked: boolean;
  differences: ReconciliationDifference[];
}
