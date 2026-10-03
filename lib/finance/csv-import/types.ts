// lib/finance/csv-import/types.ts
// Types for the bank-statement CSV parser in ./parse.ts. Types only: nothing
// in this file runs, so it is safe to import from client and server code.

/**
 * Which file column plays each role. Every value is a header key as returned
 * by parseStatementCsv (`transaction_date`, `amount_(usd)`, or `col_2` for a
 * file with no header row).
 *
 * The money columns depend on the sign convention: `amount` for a single
 * signed column, `debit` + `credit` for split columns, `amount` + `type` when
 * a type column says which way the money moved.
 */
export interface ColumnMapping {
  date: string;
  /** Used only when a row's date cell is blank. */
  postDate?: string;
  description: string;
  /** A clean merchant name, when the bank provides one (Apple Card does). */
  merchant?: string;
  /** Used as the description when a row's description cell is blank. */
  memo?: string;
  amount?: string;
  debit?: string;
  credit?: string;
  type?: string;
  category?: string;
  /** The bank's own transaction ID or reference number. */
  bankId?: string;
  /** A column that says Pending / Cleared / Completed. */
  status?: string;
}

export type ColumnRole = keyof ColumnMapping;

/**
 * How a file says whether money went out or came in.
 * - `negative_is_expense`: one signed column, purchases negative (Chase, most bank accounts).
 * - `positive_is_expense`: one signed column, purchases positive (Amex, Apple Card, Discover).
 * - `split_columns`: separate debit and credit columns (Capital One, Citi).
 * - `type_column`: an unsigned amount plus a column that says debit or credit.
 */
export type SignConvention =
  | 'negative_is_expense'
  | 'positive_is_expense'
  | 'split_columns'
  | 'type_column';

/** Component order of a numeric date: 1/31/2026 is MDY, 31/1/2026 is DMY, 2026/1/31 is YMD. */
export type DateOrder = 'MDY' | 'DMY' | 'YMD';

export type TransactionType = 'expense' | 'income';

/** What a description's wording suggests about a row. A hint, never a decision. */
export type TransferHint = 'transfer' | 'card_payment' | 'loan_payment' | 'insurance';

/** One data row of the file, before any mapping. */
export interface RawRow {
  /** Spreadsheet row number: the file's first line is row 1, blank lines count. */
  rowNumber: number;
  /** Cell text keyed by header key. Every header key is present; a missing cell is "". */
  cells: Record<string, string>;
}

/** The table found inside a statement file. */
export interface StatementCsv {
  /** Header keys, in file order. `col_1..col_n` when the file has no header row. */
  headers: string[];
  /** The header text as the bank wrote it, in the same order as `headers`, for display. */
  headerLabels: string[];
  /** False when the file has no header row and `headers` were made up from positions. */
  hasHeader: boolean;
  rows: RawRow[];
  /** Lines skipped above the table (a summary block, an account banner), for display. */
  preambleLines: string[];
  /** Plain-language notes about damage in the file that may have changed how rows were read. */
  warnings: string[];
}

/** A statement row turned into a transaction. */
export interface NormalizedRow {
  rowNumber: number;
  /** YYYY-MM-DD. */
  date: string;
  /** Always a positive whole number of cents; `type` carries the direction. */
  amountCents: number;
  type: TransactionType;
  description: string;
  vendor: string;
  bankId?: string;
  categoryName?: string;
  /** Present when a status column is mapped: true when the bank marks the row pending. */
  pending?: boolean;
  hints: TransferHint[];
  /**
   * Reasons the row can't be imported. Always empty on rows applyMapping
   * returns (a row with issues goes to `rejected` instead); later steps may
   * add their own.
   */
  issues: string[];
}

/** A row that was not turned into a transaction. `row` is the spreadsheet row number. */
export interface RejectedRow {
  row: number;
  reason: string;
}

export interface StatementParseResult {
  rows: NormalizedRow[];
  rejected: RejectedRow[];
  /**
   * Roles the mapping leaves out, or points at a column the file doesn't have
   * (`date`, `amount`, ...). Non-empty means nothing was parsed.
   */
  missingColumns: string[];
}

/** A normalized row with the key that makes re-importing the same statement idempotent. */
export interface IdentifiedRow extends NormalizedRow {
  externalId: string;
}

/** A known export layout. Only ever a starting guess: see BANK_PRESETS. */
export interface BankPreset {
  id: string;
  label: string;
  /** Header keys that must all be present for the preset to apply. */
  headers: string[];
  /** True for a layout with no header row: `headers` is then the full `col_1..col_n` list. */
  headerless?: boolean;
  /** Cell text every sampled row must have, for layouts headers can't identify. */
  cellEquals?: Record<string, string>;
  /** Roles whose column is absent from a given file are dropped from the guess. */
  mapping: ColumnMapping;
  sign: SignConvention;
}

export type MappingConfidence = 'high' | 'medium' | 'low';

/** detectMapping's guess. Every field is a default the caller may override. */
export interface MappingGuess {
  /** Partial: a role stays unset when no column could be found for it. */
  mapping: Partial<ColumnMapping>;
  sign: SignConvention;
  dateOrder: DateOrder;
  /** True when no sampled date settles day-first vs month-first: ask the user. */
  dateOrderAmbiguous: boolean;
  /** A BANK_PRESETS id, or 'generic' when the columns were found by name alone. */
  preset: string;
  /**
   * - `high`: the headers match a known bank layout.
   * - `medium`: no known layout, but date, description and amount columns were found by name.
   * - `low`: a required column is missing, or the file has no header and columns were guessed from their contents.
   */
  confidence: MappingConfidence;
}
