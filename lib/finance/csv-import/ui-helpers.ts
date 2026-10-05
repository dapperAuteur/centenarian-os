// lib/finance/csv-import/ui-helpers.ts
// The decisions the statement import page makes that are worth testing on
// their own: which settings a file starts with, whether a column mapping is
// usable, how the sample rows read, what each reviewed row will do, and how a
// failed request is worded. Pure functions: no React, no network.
//
// Used by app/dashboard/finance/import/page.tsx and components/finance/import/*,
// tested in tests/unit/csv-import-ui.test.ts. Relative imports end in `.ts`
// for `node --test --experimental-strip-types`.

import {
  accountNamedIn,
  cardKindFor,
  isDebtAccountType,
  transferPickerAccounts,
  transferRoleFor,
  typeForCardKind,
  type CardRowKind,
  type TransferRole,
} from './card-terms.ts';
import { applyMapping, parseAmount } from './parse.ts';
import { BANK_PRESETS, GENERIC_PRESET_ID } from './presets.ts';
import type {
  ColumnMapping,
  ColumnRole,
  DateOrder,
  MappingGuess,
  MatchSummary,
  NormalizedRow,
  PlanStatus,
  PlannedRow,
  RawRow,
  RowActionKind,
  SavedCsvMapping,
  SignConvention,
  StatementCsv,
  TransactionType,
} from './types.ts';

// ── Limits and fixed wording ──────────────────────────────────────────────

/**
 * The server's own ceilings, repeated here so the page can refuse a file
 * before sending it without pulling the server code into the browser bundle.
 * tests/unit/csv-import-ui.test.ts fails if either drifts from
 * MAX_CSV_CHARS (./service.ts) or MAX_IMPORT_ROWS (./commit.ts).
 */
export const MAX_STATEMENT_CHARS = 4_000_000;
export const MAX_STATEMENT_ROWS = 5000;

/** Rows shown per page in the review step. */
export const REVIEW_PAGE_SIZE = 200;

/** Rows shown in the "how rows will be read" sample. */
export const SAMPLE_ROW_COUNT = 5;

export const MIGRATION_REQUIRED_TEXT =
  'The database needs an update before statement import works. Ask the administrator to apply migration 203.';

export const OFFLINE_TEXT =
  'Statement import needs a connection. You are offline right now: reconnect to preview, import or undo.';

export const NETWORK_ERROR_TEXT = "Couldn't reach the server. Check your connection and try again.";

export const TOO_LARGE_TEXT =
  'This file is too large to import in one go. Split it into shorter date ranges.';

const count = (n: number): string => n.toLocaleString('en-US');

const plural = (n: number, one: string, many: string): string => `${count(n)} ${n === 1 ? one : many}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// ── The file ──────────────────────────────────────────────────────────────

/** Why a statement of this many characters can't be sent, or null when it can. */
export function fileSizeProblem(charCount: number): string | null {
  if (charCount <= MAX_STATEMENT_CHARS) return null;
  return `This file is too large to import in one go: it has ${count(charCount)} characters and the limit is ${count(MAX_STATEMENT_CHARS)}. Split it into shorter date ranges.`;
}

/**
 * True when a file of this many bytes must be over the character limit,
 * whatever its encoding, so it isn't worth reading into memory. A character
 * never takes more than three bytes per UTF-16 unit in UTF-8.
 */
export function certainlyTooLarge(byteCount: number): boolean {
  return byteCount > MAX_STATEMENT_CHARS * 3;
}

/** Why a file with this many transaction rows can't be imported, or null when it can. */
export function rowCountProblem(rowCount: number): string | null {
  if (rowCount === 0) return 'No transactions were found in this file.';
  if (rowCount > MAX_STATEMENT_ROWS) {
    return `This file has ${count(rowCount)} rows. One import takes up to ${count(MAX_STATEMENT_ROWS)}: split the file into shorter date ranges.`;
  }
  return null;
}

// ── Accounts ──────────────────────────────────────────────────────────────

/** An account as GET /api/finance/accounts returns it (only the fields the import uses). */
export interface ImportAccount {
  id: string;
  name: string;
  account_type: string;
  institution_name?: string | null;
  last_four?: string | null;
  is_active?: boolean | null;
  /** financial_accounts.currency (migration 210). Missing means USD. */
  currency?: string | null;
  /** financial_accounts.csv_import_mapping. Absent until migration 203 is applied. */
  csv_import_mapping?: unknown;
}

/**
 * Institution, name and last four: "Navy Federal EveryDay Checking ••1234".
 * Several accounts can share a name, so the name alone is never shown. The
 * institution is left out when the name already starts with it. Same wording
 * as accountLabel in the transfer tracking code, so pickers read alike.
 */
export function accountLabel(
  account: Pick<ImportAccount, 'name' | 'institution_name' | 'last_four'> | null | undefined,
): string {
  if (!account) return 'An account that was removed';
  const name = (account.name ?? '').trim() || 'Account';
  const institution = (account.institution_name ?? '').trim();
  const lastFour = (account.last_four ?? '').trim();
  const showInstitution = institution !== '' && !name.toLowerCase().startsWith(institution.toLowerCase());
  return [showInstitution ? institution : '', name, lastFour ? `••${lastFour}` : ''].filter(Boolean).join(' ');
}

/** Active accounts first, then by label. Returns a new array. */
export function sortAccountsForPicker<T extends ImportAccount>(accounts: readonly T[]): T[] {
  return [...accounts].sort((a, b) => {
    const inactiveA = a.is_active === false ? 1 : 0;
    const inactiveB = b.is_active === false ? 1 : 0;
    if (inactiveA !== inactiveB) return inactiveA - inactiveB;
    return accountLabel(a).localeCompare(accountLabel(b));
  });
}

// ── Column mapping ────────────────────────────────────────────────────────

export const ALL_ROLES: readonly ColumnRole[] = [
  'date', 'postDate', 'description', 'merchant', 'memo', 'detail', 'amount',
  'debit', 'credit', 'type', 'category', 'bankId', 'status',
];

export const ROLE_LABELS: Record<ColumnRole, string> = {
  date: 'Date',
  postDate: 'Posted date',
  description: 'Description',
  merchant: 'Merchant',
  memo: 'Memo',
  detail: 'Details',
  amount: 'Amount',
  debit: 'Debit (money out)',
  credit: 'Credit (money in)',
  type: 'Type (debit or credit)',
  category: 'Category',
  bankId: 'Bank ID',
  status: 'Status',
};

const SIGNS: readonly SignConvention[] = [
  'negative_is_expense', 'positive_is_expense', 'split_columns', 'type_column',
];
const DATE_ORDERS: readonly DateOrder[] = ['MDY', 'DMY', 'YMD'];
const MONEY_ROLES: readonly ColumnRole[] = ['amount', 'debit', 'credit', 'type'];

/** The money columns a sign convention reads. */
export function moneyRoles(sign: SignConvention): ColumnRole[] {
  if (sign === 'split_columns') return ['debit', 'credit'];
  if (sign === 'type_column') return ['amount', 'type'];
  return ['amount'];
}

/** The columns that must be chosen before a file can be read. */
export function requiredRoles(sign: SignConvention): ColumnRole[] {
  return ['date', 'description', ...moneyRoles(sign)];
}

/**
 * The mapping as it is sent and saved: blank choices dropped, and money
 * columns the sign convention doesn't read dropped too, so a debit column
 * picked earlier doesn't linger after switching to a single amount column.
 */
export function cleanMapping(mapping: Partial<ColumnMapping>, sign: SignConvention): Partial<ColumnMapping> {
  const used = moneyRoles(sign);
  const cleaned: Partial<ColumnMapping> = {};
  for (const role of ALL_ROLES) {
    const header = mapping[role];
    if (typeof header !== 'string' || header === '') continue;
    if (MONEY_ROLES.includes(role) && !used.includes(role)) continue;
    cleaned[role] = header;
  }
  return cleaned;
}

/** What stops a mapping from being used on a file with these header keys. Empty means it is usable. */
export function mappingProblems(
  mapping: Partial<ColumnMapping>,
  sign: SignConvention,
  headers: readonly string[],
): string[] {
  const cleaned = cleanMapping(mapping, sign);
  const problems: string[] = [];
  for (const role of requiredRoles(sign)) {
    if (!cleaned[role]) problems.push(`Choose a column for "${ROLE_LABELS[role]}".`);
  }
  for (const role of ALL_ROLES) {
    const header = cleaned[role];
    if (header && !headers.includes(header)) {
      problems.push(`The column chosen for "${ROLE_LABELS[role]}" is not in this file.`);
    }
  }
  if (sign === 'split_columns' && cleaned.debit && cleaned.debit === cleaned.credit) {
    problems.push('Debit and credit must be two different columns.');
  }
  return problems;
}

/**
 * Reads an account's saved statement settings without trusting their shape.
 * Returns null for anything that isn't a usable { mapping, sign, dateOrder }.
 */
export function readSavedMapping(value: unknown): SavedCsvMapping | null {
  if (!isRecord(value) || !isRecord(value.mapping)) return null;
  if (!SIGNS.includes(value.sign as SignConvention)) return null;
  if (!DATE_ORDERS.includes(value.dateOrder as DateOrder)) return null;
  const mapping: Partial<ColumnMapping> = {};
  for (const role of ALL_ROLES) {
    const header = value.mapping[role];
    if (typeof header === 'string' && header !== '') mapping[role] = header;
  }
  const saved: SavedCsvMapping = {
    mapping,
    sign: value.sign as SignConvention,
    dateOrder: value.dateOrder as DateOrder,
  };
  if (typeof value.includePending === 'boolean') saved.includePending = value.includePending;
  if (typeof value.preset === 'string' && value.preset.trim()) saved.preset = value.preset.trim();
  return saved;
}

/** True when saved settings can read a file with these header keys as they are. */
export function savedMappingFits(saved: SavedCsvMapping, headers: readonly string[]): boolean {
  return mappingProblems(saved.mapping, saved.sign, headers).length === 0;
}

// ── Starting settings ─────────────────────────────────────────────────────

/** A credit card statement usually lists purchases as positive numbers; other accounts as negative. */
export function signFromAccountType(accountType: string | null | undefined): SignConvention {
  return accountType === 'credit_card' ? 'positive_is_expense' : 'negative_is_expense';
}

/** How many amounts in a column are below and above zero. Unreadable and zero cells are not counted. */
export function countAmountSigns(
  rows: readonly RawRow[],
  amountHeader: string | undefined,
): { negative: number; positive: number } {
  let negative = 0;
  let positive = 0;
  if (!amountHeader) return { negative, positive };
  for (const row of rows) {
    const cents = parseAmount(row.cells[amountHeader]);
    if (cents === null || cents === 0) continue;
    if (cents < 0) negative += 1;
    else positive += 1;
  }
  return { negative, positive };
}

/**
 * Whether detectMapping's sign convention rests on something in the file: a
 * known bank layout, debit and credit columns, a type column, or more amounts
 * of one sign than the other. With none of those its answer is only a
 * fallback, and the account type is the better default.
 */
export function detectionHasSignEvidence(detected: MappingGuess, rows: readonly RawRow[]): boolean {
  if (detected.preset !== GENERIC_PRESET_ID) return true;
  if (detected.sign === 'split_columns' || detected.sign === 'type_column') return true;
  const signs = countAmountSigns(rows, detected.mapping.amount);
  return signs.negative !== signs.positive;
}

/** What the columns step holds. */
export interface ImportSettings {
  mapping: Partial<ColumnMapping>;
  sign: SignConvention;
  /** Null until the person picks one, when every date in the file reads both ways. */
  dateOrder: DateOrder | null;
  includePending: boolean;
  /** Save these settings on the account after a successful import. */
  remember: boolean;
}

export type SettingsSource = 'saved' | 'detected' | 'account_type';

export interface InitialSettings {
  settings: ImportSettings;
  /** Where the column choices came from. */
  mappingSource: 'saved' | 'detected';
  /** Where the sign convention came from. */
  signSource: SettingsSource;
  /** True when the account has saved settings that don't fit this file's columns. */
  savedIgnored: boolean;
}

/**
 * The settings the columns step starts with, in order of preference:
 * the account's saved settings when they fit this file's columns; else what
 * detectMapping found; and for the sign convention, the account type when the
 * file gives no evidence either way (credit card: purchases positive).
 * The date order is left unset when detection calls it ambiguous, so the
 * person has to choose.
 */
export function initialSettings(input: {
  saved: SavedCsvMapping | null;
  detected: MappingGuess;
  table: Pick<StatementCsv, 'headers' | 'rows'>;
  accountType: string | null | undefined;
}): InitialSettings {
  const { saved, detected, table, accountType } = input;
  if (saved && savedMappingFits(saved, table.headers)) {
    return {
      settings: {
        mapping: { ...saved.mapping },
        sign: saved.sign,
        dateOrder: saved.dateOrder,
        includePending: saved.includePending === true,
        remember: true,
      },
      mappingSource: 'saved',
      signSource: 'saved',
      savedIgnored: false,
    };
  }

  const hasEvidence = detectionHasSignEvidence(detected, table.rows);
  return {
    settings: {
      mapping: { ...detected.mapping },
      sign: hasEvidence ? detected.sign : signFromAccountType(accountType),
      dateOrder: detected.dateOrderAmbiguous ? null : detected.dateOrder,
      includePending: false,
      remember: true,
    },
    mappingSource: 'detected',
    signSource: hasEvidence ? 'detected' : 'account_type',
    savedIgnored: saved !== null,
  };
}

// ── What was detected ─────────────────────────────────────────────────────

/** The bank layout's name, or null for the generic guess. */
export function presetLabel(presetId: string | null | undefined): string | null {
  return BANK_PRESETS.find((preset) => preset.id === presetId)?.label ?? null;
}

/**
 * What to tell the person about a file that was just read: a headline about
 * the layout, then where the header is, how many rows were found and what was
 * skipped above the table.
 */
export function describeDetection(
  detected: Pick<MappingGuess, 'preset' | 'confidence'>,
  table: Pick<StatementCsv, 'hasHeader' | 'headerRowNumber' | 'rows' | 'preambleLines'>,
): { headline: string; details: string[] } {
  const label = presetLabel(detected.preset);
  let headline: string;
  if (label) {
    headline = `Looks like ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label} export.`;
  } else if (detected.confidence === 'medium') {
    headline = 'No known bank layout matched, but the date, description and amount columns were found by name.';
  } else if (!table.hasHeader) {
    headline = 'This file has no header row, so the columns were guessed from what they hold. Check them in the next step.';
  } else {
    headline = "The columns couldn't be worked out from their names. You'll choose them in the next step.";
  }

  const details: string[] = [];
  details.push(
    table.hasHeader && table.headerRowNumber !== null
      ? `Header row found on line ${count(table.headerRowNumber)}.`
      : 'No header row found: columns are numbered in file order.',
  );
  if (table.rows.length > 0) {
    const first = table.rows[0].rowNumber;
    const last = table.rows[table.rows.length - 1].rowNumber;
    details.push(
      table.rows.length === 1
        ? `1 transaction row found (row ${count(first)}).`
        : `${count(table.rows.length)} transaction rows found (rows ${count(first)} to ${count(last)}).`,
    );
  }
  if (table.preambleLines.length > 0) {
    details.push(
      `${plural(table.preambleLines.length, 'line', 'lines')} above the table ${table.preambleLines.length === 1 ? 'was' : 'were'} skipped (a summary or account banner).`,
    );
  }
  return { headline, details };
}

// ── The sample ────────────────────────────────────────────────────────────

/** One of the first rows of the file, as it would be read with the current settings. */
export interface SampleRow {
  rowNumber: number;
  ok: boolean;
  date?: string;
  amountCents?: number;
  type?: TransactionType;
  description?: string;
  /** Why the row can't be read, when `ok` is false. */
  reason?: string;
  /** True when the layout leaves the row out on purpose (it moves no money): not an error. */
  skipped?: boolean;
}

export interface MappingPreview {
  /** Roles the mapping still needs; non-empty means nothing was read. */
  missingColumns: string[];
  sample: SampleRow[];
  /** Rows of the whole file that can and can't be read with these settings. */
  readable: number;
  unreadable: number;
  /** Rows the layout leaves out because they move no money (PayPal holds, item lines). */
  skipped: number;
  /** How the readable rows split, so a flipped sign shows at a glance. */
  expenses: number;
  income: number;
  /** Every readable row, for the card-terms count (charges vs payments). */
  rows: NormalizedRow[];
}

/**
 * Reads the whole file with the current settings and returns the first few
 * rows, in file order, as they would be imported (or why they can't be).
 */
export function previewMapping(
  rows: readonly RawRow[],
  mapping: Partial<ColumnMapping>,
  sign: SignConvention,
  dateOrder: DateOrder,
  limit: number = SAMPLE_ROW_COUNT,
  preset: string | null = null,
): MappingPreview {
  const result = applyMapping(rows, cleanMapping(mapping, sign), sign, dateOrder, { preset });
  if (result.missingColumns.length > 0) {
    return {
      missingColumns: result.missingColumns,
      sample: [],
      readable: 0,
      unreadable: 0,
      skipped: 0,
      expenses: 0,
      income: 0,
      rows: [],
    };
  }

  const readByRow = new Map(result.rows.map((row) => [row.rowNumber, row]));
  const reasonByRow = new Map(result.rejected.map((row) => [row.row, row.reason]));
  const skippedByRow = new Map(result.skipped.map((row) => [row.row, row.reason]));
  const sample: SampleRow[] = rows.slice(0, limit).map((raw) => {
    const read = readByRow.get(raw.rowNumber);
    const skippedReason = skippedByRow.get(raw.rowNumber);
    if (skippedReason) return { rowNumber: raw.rowNumber, ok: false, skipped: true, reason: skippedReason };
    if (read) {
      return {
        rowNumber: raw.rowNumber,
        ok: true,
        date: read.date,
        amountCents: read.amountCents,
        type: read.type,
        description: read.description,
      };
    }
    return { rowNumber: raw.rowNumber, ok: false, reason: reasonByRow.get(raw.rowNumber) ?? 'The row could not be read' };
  });

  const expenses = result.rows.filter((row) => row.type === 'expense').length;
  return {
    missingColumns: [],
    sample,
    readable: result.rows.length,
    unreadable: result.rejected.length,
    skipped: result.skipped.length,
    expenses,
    income: result.rows.length - expenses,
    rows: result.rows,
  };
}

// ── Review ────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<PlanStatus, string> = {
  new: 'New',
  duplicate: 'Already imported',
  duplicate_in_file: 'Repeated in this file',
  matches: 'Matches an entry you made',
  invalid: "Can't import",
};

export type StatusFilter = 'all' | PlanStatus;

export const STATUS_FILTERS: readonly StatusFilter[] = [
  'all', 'new', 'matches', 'duplicate', 'duplicate_in_file', 'invalid',
];

/** How many rows each filter tab holds. */
export function statusCounts(rows: readonly Pick<PlannedRow, 'status'>[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    all: rows.length, new: 0, matches: 0, duplicate: 0, duplicate_in_file: 0, invalid: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

export function filterRows<T extends Pick<PlannedRow, 'status'>>(rows: readonly T[], filter: StatusFilter): T[] {
  return filter === 'all' ? [...rows] : rows.filter((row) => row.status === filter);
}

/** What the person changed on one row. A missing field means "as the import suggested". */
export interface RowDecision {
  action?: RowActionKind;
  type?: TransactionType;
  /** A budget category id, or null for "no category". */
  categoryId?: string | null;
  /** On a card or loan: what the row is, in card terms (sets `type` too). */
  cardKind?: CardRowKind;
  /**
   * The other account of a payment ("Paid from" / "This paid"): an account
   * id, or null for "not linked". Missing means the suggested account.
   */
  transferAccountId?: string | null;
}

/** Decisions by spreadsheet row number. */
export type Decisions = Readonly<Record<number, RowDecision>>;

type DecidableRow = Pick<
  PlannedRow,
  'rowNumber' | 'type' | 'defaultAction' | 'allowedActions' | 'suggestedCategoryId'
>;

/** True when the import accepts this action for this row. */
export function isActionAllowed(row: Pick<PlannedRow, 'allowedActions'>, action: RowActionKind): boolean {
  return Array.isArray(row.allowedActions) && row.allowedActions.includes(action);
}

/**
 * What will happen to a row: the person's choice where it is allowed, the
 * import's default otherwise. The same rule the server applies at commit.
 */
export function effectiveDecision(
  row: DecidableRow,
  decision: RowDecision | undefined,
): { action: RowActionKind; type: TransactionType; categoryId: string | null } {
  const requested = decision?.action;
  return {
    action: requested && isActionAllowed(row, requested) ? requested : row.defaultAction,
    type: decision?.type ?? row.type,
    categoryId: decision && decision.categoryId !== undefined ? decision.categoryId : row.suggestedCategoryId,
  };
}

/**
 * Records a change to some rows. An action a row doesn't allow is ignored for
 * that row; the rest of the change still applies. Returns a new object, or
 * the same one when nothing changed.
 */
export function applyDecision(
  decisions: Decisions,
  rows: readonly DecidableRow[],
  patch: RowDecision,
): Decisions {
  let next: Record<number, RowDecision> | null = null;
  for (const row of rows) {
    const current = decisions[row.rowNumber] ?? {};
    const updated: RowDecision = { ...current };
    if (patch.action !== undefined && isActionAllowed(row, patch.action)) updated.action = patch.action;
    if (patch.type !== undefined) updated.type = patch.type;
    if (patch.categoryId !== undefined) updated.categoryId = patch.categoryId;
    if (patch.cardKind !== undefined) {
      updated.cardKind = patch.cardKind;
      updated.type = typeForCardKind(patch.cardKind);
    } else if (patch.type !== undefined && current.cardKind && typeForCardKind(current.cardKind) !== patch.type) {
      // A flipped direction no longer fits the kind picked before.
      delete updated.cardKind;
    }
    if (patch.transferAccountId !== undefined) updated.transferAccountId = patch.transferAccountId;
    if (
      updated.action === current.action &&
      updated.type === current.type &&
      updated.categoryId === current.categoryId &&
      updated.cardKind === current.cardKind &&
      updated.transferAccountId === current.transferAccountId
    ) {
      continue;
    }
    next ??= { ...decisions };
    next[row.rowNumber] = updated;
  }
  return next ?? decisions;
}

export interface ActionCounts {
  add: number;
  link: number;
  skip: number;
}

/** How many rows will be added, linked and skipped, given what the person chose. */
export function summarizeDecisions(rows: readonly DecidableRow[], decisions: Decisions): ActionCounts {
  const counts: ActionCounts = { add: 0, link: 0, skip: 0 };
  for (const row of rows) {
    const { action } = effectiveDecision(row, decisions[row.rowNumber]);
    if (action === 'insert') counts.add += 1;
    else if (action === 'link') counts.link += 1;
    else counts.skip += 1;
  }
  return counts;
}

/** "Will add 42, link 3, skip 7" */
export function summaryLine(counts: ActionCounts): string {
  return `Will add ${count(counts.add)}, link ${count(counts.link)}, skip ${count(counts.skip)}`;
}

/** One row of the `actions` list POST /api/finance/import takes. */
export interface WireRowAction {
  row: number;
  action?: RowActionKind;
  type?: TransactionType;
  category_id?: string | null;
  /** The other account of a payment, linked as a transfer at commit. */
  transfer_account_id?: string;
  /** False: when that account has no matching row, leave the payment unlinked instead of recording it there. */
  record_missing?: boolean;
}

// ── Payments as transfers ─────────────────────────────────────────────────

/** What the review step knows about the account, for card words and "Paid from". */
export interface TransferContext {
  accountId: string;
  accountType: string | null | undefined;
  /** The person's accounts, for the pickers. */
  accounts: readonly ImportAccount[];
  /** The account payments to this card or loan were last paid from (from the preview), or null. */
  paidFromDefault: string | null;
  /**
   * The cash account a cash withdrawal goes into by default: the last used
   * cash account (from the preview), or null. Used only when it is in this
   * account's currency.
   */
  cashDefault?: string | null;
  /** Record the other side when the other account has no matching row. */
  recordMissing: boolean;
}

type TransferRow = DecidableRow & Pick<PlannedRow, 'description' | 'hints' | 'kind' | 'match'>;

/** What a row is in card terms, with the person's changes applied. */
export function effectiveCardKind(row: TransferRow, decision: RowDecision | undefined): CardRowKind {
  if (decision?.cardKind) return decision.cardKind;
  return cardKindFor(row, decision?.type ?? row.type);
}

/**
 * Whether a row can be linked to another account as a payment, given what
 * the person chose: only rows that will be saved (added, or linked to an
 * entry the person made), never one linked to a payment another import
 * already recorded (that one is already a transfer).
 */
export function rowTransferRole(
  row: TransferRow,
  decision: RowDecision | undefined,
  accountType: string | null | undefined,
): TransferRole {
  const { action, type } = effectiveDecision(row, decision);
  if (action === 'skip') return null;
  if (action === 'link' && row.match?.source === 'transfer') return null;
  if (isDebtAccountType(accountType)) {
    return type === 'income' && effectiveCardKind(row, decision) === 'payment' ? 'paid_from' : null;
  }
  return transferRoleFor(row, accountType, type);
}

/** The accounts a row's picker offers, for its role. */
export function pickerAccountsFor(role: Exclude<TransferRole, null>, context: TransferContext): ImportAccount[] {
  return transferPickerAccounts(role, context.accounts, context.accountId);
}

/**
 * The account a payment row will be linked to: the person's choice, else the
 * suggestion (for a card or loan, the account its payments came from last
 * time; for a bank row, the one card or loan its wording names). Null when
 * the row is not a payment, or nothing is chosen or suggested.
 */
export function effectiveTransferAccount(
  row: TransferRow,
  decision: RowDecision | undefined,
  context: TransferContext,
): string | null {
  const role = rowTransferRole(row, decision, context.accountType);
  if (!role) return null;
  const options = pickerAccountsFor(role, context);
  if (decision && decision.transferAccountId !== undefined) {
    return decision.transferAccountId && options.some((account) => account.id === decision.transferAccountId)
      ? decision.transferAccountId
      : null;
  }
  if (role === 'paid_from') {
    return context.paidFromDefault && options.some((account) => account.id === context.paidFromDefault)
      ? context.paidFromDefault
      : null;
  }
  if (role === 'cash_withdrawal') {
    // The last used cash account, else the only cash account in this currency.
    if (context.cashDefault && options.some((account) => account.id === context.cashDefault)) return context.cashDefault;
    return options.length === 1 ? options[0].id : null;
  }
  return accountNamedIn(row.description, options)?.id ?? null;
}

function countLinks(
  rows: readonly TransferRow[],
  decisions: Decisions,
  context: TransferContext,
  wanted: (role: Exclude<TransferRole, null>) => boolean,
): { linked: number; unassigned: number } {
  let linked = 0;
  let unassigned = 0;
  for (const row of rows) {
    const role = rowTransferRole(row, decisions[row.rowNumber], context.accountType);
    if (!role || !wanted(role)) continue;
    if (effectiveTransferAccount(row, decisions[row.rowNumber], context)) linked += 1;
    else unassigned += 1;
  }
  return { linked, unassigned };
}

/** How many payment rows will be linked to another account, and how many could be but have no account yet. */
export function transferCounts(
  rows: readonly TransferRow[],
  decisions: Decisions,
  context: TransferContext,
): { linked: number; unassigned: number } {
  return countLinks(rows, decisions, context, (role) => role !== 'cash_withdrawal');
}

/** How many cash withdrawals will go into a cash account, and how many have no cash account chosen. */
export function cashWithdrawalCounts(
  rows: readonly TransferRow[],
  decisions: Decisions,
  context: TransferContext,
): { linked: number; unassigned: number } {
  return countLinks(rows, decisions, context, (role) => role === 'cash_withdrawal');
}

/**
 * The `actions` to send at commit: only rows where the person's choice
 * differs from what the server would do on its own, to keep the request small.
 *
 * A row whose direction was flipped always carries its category, even when it
 * is the suggested one: the server suggests a category for the direction it
 * saves, which may differ from the one shown.
 */
export function buildRowActions(
  rows: readonly (DecidableRow & Partial<Pick<PlannedRow, 'description' | 'hints' | 'kind' | 'match'>>)[],
  decisions: Decisions,
  transfer?: TransferContext,
): WireRowAction[] {
  const actions: WireRowAction[] = [];
  for (const row of rows) {
    const decision = decisions[row.rowNumber];
    // A payment carries its other account even when the person changed nothing:
    // the suggestion is worked out here, not on the server.
    const transferRow = { description: '', hints: [], ...row } as TransferRow;
    const transferAccount = transfer ? effectiveTransferAccount(transferRow, decision, transfer) : null;
    if (!decision && !transferAccount) continue;
    const effective = effectiveDecision(row, decision);
    const wire: WireRowAction = { row: row.rowNumber };
    let changed = false;
    if (transferAccount && transfer) {
      wire.transfer_account_id = transferAccount;
      if (!transfer.recordMissing) wire.record_missing = false;
      changed = true;
    }
    if (effective.action !== row.defaultAction) {
      wire.action = effective.action;
      changed = true;
    }
    // Direction and category only matter for a row that is inserted.
    if (effective.action === 'insert') {
      if (effective.type !== row.type) {
        wire.type = effective.type;
        wire.category_id = effective.categoryId;
        changed = true;
      } else if (effective.categoryId !== row.suggestedCategoryId) {
        wire.category_id = effective.categoryId;
        changed = true;
      }
    }
    if (changed) actions.push(wire);
  }
  return actions;
}

/** The words for an action on a given row: importing a duplicate is "Import anyway". */
export function actionLabel(row: Pick<PlannedRow, 'status'> & Partial<Pick<PlannedRow, 'match'>>, action: RowActionKind): string {
  if (action === 'link') return row.match?.source === 'transfer' ? 'Link to the recorded payment' : 'Link to my entry';
  if (action === 'skip') return 'Skip';
  if (row.status === 'duplicate') return 'Import anyway';
  if (row.status === 'matches') return 'Import as a new transaction';
  return 'Import';
}

/** Where a row's category came from, while it still shows the suggested one. Null otherwise. */
export function categorySuggestionNote(
  row: Pick<PlannedRow, 'suggestedCategoryId' | 'suggestedCategorySource'>,
  currentCategoryId: string | null,
): string | null {
  if (!row.suggestedCategoryId || currentCategoryId !== row.suggestedCategoryId) return null;
  if (row.suggestedCategorySource === 'learned') return 'Learned from this vendor';
  if (row.suggestedCategorySource === 'category_name') return "From the file's category column";
  return null;
}

export function pageCount(total: number, pageSize: number = REVIEW_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** The rows of a 1-based page. A page past the end returns the last page. */
export function pageOf<T>(rows: readonly T[], page: number, pageSize: number = REVIEW_PAGE_SIZE): T[] {
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount(rows.length, pageSize));
  return rows.slice((safePage - 1) * pageSize, safePage * pageSize);
}

/** The earliest and latest dates among rows that will be added or linked, or null when there are none. */
export function importedDateRange(
  rows: readonly (DecidableRow & Pick<PlannedRow, 'date'>)[],
  decisions: Decisions,
): { from: string; to: string } | null {
  let from: string | null = null;
  let to: string | null = null;
  for (const row of rows) {
    if (effectiveDecision(row, decisions[row.rowNumber]).action === 'skip') continue;
    if (from === null || row.date < from) from = row.date;
    if (to === null || row.date > to) to = row.date;
  }
  return from !== null && to !== null ? { from, to } : null;
}

// ── After the import ──────────────────────────────────────────────────────

/**
 * How many transfer suggestions GET /api/finance/transfers/suggestions?from=&to=
 * returned. That route belongs to the transfer tracking feature and answers
 * `{ pairs, one_sided, ... }`; anything else counts as zero, so an unexpected
 * body shows nothing rather than a wrong number.
 */
export function countTransferSuggestions(body: unknown): number {
  if (!isRecord(body)) return 0;
  const size = (value: unknown): number => (Array.isArray(value) ? value.length : 0);
  return size(body.pairs) + size(body.one_sided);
}

/**
 * The sentence to show for a failed request, from its HTTP status and
 * (possibly missing or non-JSON) body. Never returns raw JSON.
 */
export function importErrorText(status: number, body: unknown): string {
  const code = isRecord(body) && typeof body.code === 'string' ? body.code : '';
  const error = isRecord(body) && typeof body.error === 'string' ? body.error.trim() : '';
  if (code === 'migration_required') return MIGRATION_REQUIRED_TEXT;
  if (error) return error;
  // A host can refuse a large request before the app sees it, with no JSON body.
  if (status === 413) return TOO_LARGE_TEXT;
  if (status === 401) return 'You are signed out. Sign in and try again.';
  return `The server could not finish the request (error ${status}). Try again in a moment.`;
}

// ── Formatting ────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-01-13" -> "Jan 13, 2026". Anything else is returned as it came. */
export function formatIsoDate(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!match) return iso ?? '';
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${Number(match[3])}, ${match[1]}` : (iso ?? '');
}

/** 123456 -> "$1,234.56" */
export function formatCents(cents: number): string {
  const whole = Math.trunc(Math.abs(cents) / 100);
  const fraction = String(Math.abs(cents) % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}$${count(whole)}.${fraction}`;
}

/** "Jan 12, 2026 · $4.75 · Blue Heron Cafe": the entry a statement row matched. */
export function matchSummaryText(match: MatchSummary): string {
  const name = match.vendor?.trim() || match.description?.trim() || 'No name';
  return [formatIsoDate(match.transaction_date), formatCents(Math.round(match.amount * 100)), name].join(' · ');
}
