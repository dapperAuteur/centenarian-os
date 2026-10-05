// lib/finance/csv-import/service.ts
// What the /api/finance/import routes do, minus HTTP: read and check the
// request body, parse the statement ON THE SERVER, then preview or commit.
// The browser never sends normalized rows: it sends the file text, the column
// mapping and (at commit) what to do with each spreadsheet row number, and the
// server works everything else out again from the file.
//
// Relative imports end in `.ts` so tests/unit/csv-import-plan.test.ts can load
// this file under `node --test --experimental-strip-types`.

import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_IMPORT_ROWS, commitImport, resolveActions, tooManyRowsMessage } from './commit.ts';
import { ImportError, dbFailure } from './errors.ts';
import { applyMapping, detectMapping, parseStatementCsv } from './parse.ts';
import { planImport } from './plan.ts';
import type {
  ColumnMapping,
  ColumnRole,
  CommitResult,
  DateOrder,
  MappingGuess,
  NormalizedRow,
  PlanTotals,
  PlannedRow,
  RejectedRow,
  RowAction,
  SavedCsvMapping,
  SignConvention,
  StatementCsv,
} from './types.ts';

/**
 * The largest statement text accepted, in characters. This is the app's own
 * ceiling, chosen so a 5,000-row statement fits many times over. The host may
 * refuse a request body before it gets here (its limit is the host's to
 * state, not this file's), so the page should also check the file size and
 * say so in its own words.
 */
export const MAX_CSV_CHARS = 4_000_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLES: readonly ColumnRole[] = [
  'date', 'postDate', 'description', 'merchant', 'memo', 'detail', 'amount',
  'debit', 'credit', 'type', 'category', 'bankId', 'status',
];
const SIGNS: readonly SignConvention[] = [
  'negative_is_expense', 'positive_is_expense', 'split_columns', 'type_column',
];
const DATE_ORDERS: readonly DateOrder[] = ['MDY', 'DMY', 'YMD'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

const bad = (code: string, message: string, details: Record<string, unknown> = {}): ImportError =>
  new ImportError(400, code, message, details);

/** Keeps the known roles of a column mapping whose value is a column key. Throws on anything else. */
function readMapping(value: unknown): Partial<ColumnMapping> {
  if (!isRecord(value)) throw bad('bad_mapping', 'The column mapping must be an object.');
  const mapping: Partial<ColumnMapping> = {};
  for (const role of ROLES) {
    const column = value[role];
    if (column === undefined || column === null || column === '') continue;
    if (typeof column !== 'string' || column.length > 200) {
      throw bad('bad_mapping', `The column chosen for "${role}" is not valid.`);
    }
    mapping[role] = column;
  }
  return mapping;
}

function readSign(value: unknown): SignConvention {
  if (!SIGNS.includes(value as SignConvention)) {
    throw bad('bad_sign', `The sign convention must be one of: ${SIGNS.join(', ')}.`);
  }
  return value as SignConvention;
}

function readDateOrder(value: unknown): DateOrder {
  if (!DATE_ORDERS.includes(value as DateOrder)) {
    throw bad('bad_date_order', `The date order must be one of: ${DATE_ORDERS.join(', ')}.`);
  }
  return value as DateOrder;
}

/**
 * Checks the settings saved on an account (financial_accounts.csv_import_mapping).
 * Returns null for null (clear the saved settings), a clean copy otherwise.
 * Throws ImportError 400 when the value is not a usable mapping.
 */
export function sanitizeSavedMapping(value: unknown): SavedCsvMapping | null {
  if (value === null) return null;
  if (!isRecord(value)) throw bad('bad_mapping', 'csv_import_mapping must be an object or null.');
  const saved: SavedCsvMapping = {
    mapping: readMapping(value.mapping),
    sign: readSign(value.sign),
    dateOrder: readDateOrder(value.dateOrder ?? value.date_order),
  };
  const includePending = value.includePending ?? value.include_pending;
  if (typeof includePending === 'boolean') saved.includePending = includePending;
  if (typeof value.preset === 'string' && value.preset.trim()) saved.preset = value.preset.trim().slice(0, 60);
  return saved;
}

/** A checked import request. Mapping, sign and date order are null when the request left them out. */
export interface ImportRequest {
  accountId: string;
  csvText: string;
  mapping: Partial<ColumnMapping> | null;
  sign: SignConvention | null;
  dateOrder: DateOrder | null;
  includePending: boolean;
  fileName: string | null;
  preset: string | null;
  actions: RowAction[];
}

/** Checks the `actions` list of a commit body. Shared with the PDF import. */
export function readActions(value: unknown): RowAction[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw bad('bad_actions', 'actions must be a list.');
  if (value.length > MAX_IMPORT_ROWS) throw bad('too_many_rows', tooManyRowsMessage(value.length));
  const actions: RowAction[] = [];
  for (const item of value) {
    if (!isRecord(item) || !Number.isInteger(item.row)) {
      throw bad('bad_actions', 'Every action needs the spreadsheet row number it applies to.');
    }
    const action: RowAction = { row: item.row as number };
    if (item.action !== undefined && item.action !== null) {
      if (item.action !== 'insert' && item.action !== 'link' && item.action !== 'skip') {
        throw bad('bad_actions', `Row ${action.row}: the action must be insert, link or skip.`);
      }
      action.action = item.action;
    }
    if (item.type !== undefined && item.type !== null) {
      if (item.type !== 'expense' && item.type !== 'income') {
        throw bad('bad_actions', `Row ${action.row}: the type must be expense or income.`);
      }
      action.type = item.type;
    }
    const category = item.category_id !== undefined ? item.category_id : item.categoryId;
    if (category !== undefined) {
      if (category !== null && !isUuid(category)) {
        throw bad('bad_actions', `Row ${action.row}: the category is not valid.`);
      }
      action.categoryId = category as string | null;
    }
    actions.push(action);
  }
  return actions;
}

/**
 * Checks a preview or commit body:
 * `{ account_id, csv_text, mapping?, sign?, dateOrder?, include_pending?, file_name?, preset?, actions? }`.
 * Preview may leave out mapping, sign and dateOrder (the server's own guess is
 * used); commit must send all three, because that is what the person confirmed.
 */
export function parseImportRequest(body: unknown, options: { requireMapping: boolean }): ImportRequest {
  if (!isRecord(body)) throw bad('bad_request', 'The request was not valid JSON.');

  const accountId = body.account_id ?? body.accountId;
  if (accountId === undefined || accountId === null || accountId === '') {
    throw bad('account_required', 'Choose the account this statement belongs to.');
  }
  if (!isUuid(accountId)) throw bad('account_required', 'That account is not valid.');

  const csvText = body.csv_text ?? body.csvText;
  if (typeof csvText !== 'string' || csvText.trim() === '') {
    throw bad('file_required', 'No statement was sent. Choose a CSV file or paste its text.');
  }
  if (csvText.length > MAX_CSV_CHARS) {
    throw new ImportError(413, 'file_too_large', 'This file is too large to import in one go. Split it into shorter date ranges.');
  }

  const has = (value: unknown): boolean => value !== undefined && value !== null;
  const dateOrderValue = body.dateOrder ?? body.date_order;
  const mapping = has(body.mapping) ? readMapping(body.mapping) : null;
  const sign = has(body.sign) ? readSign(body.sign) : null;
  const dateOrder = has(dateOrderValue) ? readDateOrder(dateOrderValue) : null;
  if (options.requireMapping && (!mapping || !sign || !dateOrder)) {
    throw bad('mapping_required', 'The column mapping, sign convention and date order are required. Preview the file first.');
  }

  const fileName = body.file_name ?? body.fileName;
  return {
    accountId,
    csvText,
    mapping,
    sign,
    dateOrder,
    includePending: (body.include_pending ?? body.includePending) === true,
    fileName: typeof fileName === 'string' && fileName.trim() ? fileName.trim() : null,
    preset: typeof body.preset === 'string' && body.preset.trim() ? body.preset.trim() : null,
    actions: readActions(body.actions),
  };
}

export interface ReadStatement {
  table: StatementCsv;
  /** The server's own guess for this file, whatever the request asked for. */
  detected: MappingGuess;
  mapping: Partial<ColumnMapping>;
  sign: SignConvention;
  dateOrder: DateOrder;
  rows: NormalizedRow[];
  rejected: RejectedRow[];
  /** Rows the layout leaves out because they move no money. */
  skipped: RejectedRow[];
}

const fileSummary = (table: StatementCsv) => ({
  headers: table.headers,
  headerLabels: table.headerLabels,
  hasHeader: table.hasHeader,
  preambleLines: table.preambleLines,
  warnings: table.warnings,
  rowCount: table.rows.length,
});

/**
 * Parses the statement text and applies the mapping (the request's, or the
 * detected one where the request has none). Pure. Throws ImportError 400 when
 * the file is empty, too long, or the mapping doesn't fit it; the last carries
 * `missingColumns`, `file` and `detected` so the page can ask for the mapping.
 */
export function readStatement(
  request: Pick<ImportRequest, 'csvText' | 'mapping' | 'sign' | 'dateOrder'> & { preset?: string | null },
): ReadStatement {
  const table = parseStatementCsv(request.csvText);
  if (table.rows.length === 0) {
    throw bad('empty_file', 'No transactions were found in this file.', { file: fileSummary(table) });
  }
  if (table.rows.length > MAX_IMPORT_ROWS) {
    throw bad('too_many_rows', tooManyRowsMessage(table.rows.length));
  }

  const detected = detectMapping(table.headers, table.rows);
  const mapping = request.mapping ?? detected.mapping;
  const sign = request.sign ?? detected.sign;
  const dateOrder = request.dateOrder ?? detected.dateOrder;

  // The layout's skip rules (rows that move no money) follow the preset the
  // file was read as: the one the page sent, else the server's own guess.
  const result = applyMapping(table.rows, mapping, sign, dateOrder, {
    preset: request.preset ?? detected.preset,
  });
  if (result.missingColumns.length > 0) {
    throw bad(
      'mapping_incomplete',
      `The column mapping doesn't fit this file. Choose a column for: ${result.missingColumns.join(', ')}.`,
      { missingColumns: result.missingColumns, file: fileSummary(table), detected },
    );
  }
  return {
    table,
    detected,
    mapping,
    sign,
    dateOrder,
    rows: result.rows,
    rejected: result.rejected,
    skipped: result.skipped,
  };
}

export interface OwnedAccount {
  id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  last_four: string | null;
}

/** The account, if it is the user's. Throws ImportError 404 otherwise. */
export async function loadOwnedAccount(
  db: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<OwnedAccount> {
  const { data, error } = await db
    .from('financial_accounts')
    .select('id, name, account_type, institution_name, last_four')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw dbFailure(error, 'read the account');
  if (!data) throw new ImportError(404, 'account_not_found', 'That account was not found.');
  return data as OwnedAccount;
}

export interface PreviewResponse {
  account: OwnedAccount;
  file: ReturnType<typeof fileSummary>;
  /** The mapping, sign convention and date order the rows below were read with. */
  mapping: Partial<ColumnMapping>;
  sign: SignConvention;
  dateOrder: DateOrder;
  includePending: boolean;
  detected: MappingGuess;
  rows: PlannedRow[];
  /** Rows the parser could not read, with the spreadsheet row number and why. */
  rejected: RejectedRow[];
  totals: PlanTotals & { rejected: number };
}

/** POST /api/finance/import/preview. Writes nothing. */
export async function previewImport(db: SupabaseClient, userId: string, body: unknown): Promise<PreviewResponse> {
  const request = parseImportRequest(body, { requireMapping: false });
  const account = await loadOwnedAccount(db, userId, request.accountId);
  const statement = readStatement(request);
  const plan = await planImport(db, userId, account.id, statement.rows, {
    includePending: request.includePending,
  });
  return {
    account,
    file: fileSummary(statement.table),
    mapping: statement.mapping,
    sign: statement.sign,
    dateOrder: statement.dateOrder,
    includePending: request.includePending,
    detected: statement.detected,
    rows: plan.rows,
    rejected: statement.rejected,
    totals: { ...plan.totals, rejected: statement.rejected.length },
  };
}

/**
 * POST /api/finance/import (the statement form of it). Re-parses the file,
 * re-plans against the database as it is now, applies the person's actions by
 * spreadsheet row number, and commits.
 */
export async function runImport(db: SupabaseClient, userId: string, body: unknown): Promise<CommitResult> {
  const request = parseImportRequest(body, { requireMapping: true });
  const account = await loadOwnedAccount(db, userId, request.accountId);
  const statement = readStatement(request);
  const plan = await planImport(db, userId, account.id, statement.rows, {
    includePending: request.includePending,
  });
  return commitImport(db, userId, {
    accountId: account.id,
    fileName: request.fileName,
    preset: request.preset ?? statement.detected.preset,
    mapping: {
      mapping: statement.mapping,
      sign: statement.sign,
      dateOrder: statement.dateOrder,
      includePending: request.includePending,
    },
    rows: resolveActions(plan.rows, request.actions),
    rejected: statement.rejected,
  });
}

export interface ImportBatchSummary {
  id: string;
  account_id: string | null;
  source: string;
  file_name: string | null;
  preset: string | null;
  row_count: number;
  inserted_count: number;
  linked_count: number;
  duplicate_count: number;
  invalid_count: number;
  status: 'committed' | 'undone';
  undone_at: string | null;
  created_at: string;
  financial_accounts: { id: string; name: string; institution_name: string | null; last_four: string | null } | null;
}

// The account is embedded through its named foreign key (migration 203), so the
// embed stays unambiguous whatever other paths link the two tables.
const BATCH_LIST_COLUMNS =
  'id, account_id, source, file_name, preset, row_count, inserted_count, linked_count, duplicate_count, invalid_count, status, undone_at, created_at, financial_accounts!import_batches_account_id_fkey(id, name, institution_name, last_four)';

/** GET /api/finance/import/batches: the user's imports, newest first. */
export async function listBatches(
  db: SupabaseClient,
  userId: string,
  options: { limit?: number; accountId?: string | null } = {},
): Promise<ImportBatchSummary[]> {
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 50) || 50, 1), 200);
  let query = db
    .from('import_batches')
    .select(BATCH_LIST_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (options.accountId) {
    if (!isUuid(options.accountId)) throw bad('account_required', 'That account is not valid.');
    query = query.eq('account_id', options.accountId);
  }
  const { data, error } = await query;
  if (error) throw dbFailure(error, 'read your imports');
  return (data ?? []) as unknown as ImportBatchSummary[];
}
