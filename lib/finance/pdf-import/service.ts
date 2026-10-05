// lib/finance/pdf-import/service.ts
// What the /api/finance/import routes do with a PDF statement, minus HTTP.
// The PDF is sent as base64 in the same JSON body the CSV import uses, at
// preview and again at commit: the server reads it itself both times and
// never accepts rows worked out in the browser.
//
// PRIVACY: the statement is read in this process (extract.ts) and never sent
// to any other service. Only the transactions the person confirms and the
// statement's summary numbers are saved.
//
// Relative imports end in `.ts` so tests/unit/pdf-import.test.ts can load this
// file under `node --test --experimental-strip-types`. pdfjs itself is only
// loaded when a PDF is actually read.

import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_IMPORT_ROWS, commitImport, resolveActions, tooManyRowsMessage } from '../csv-import/commit.ts';
import { ImportError, dbFailure } from '../csv-import/errors.ts';
import { planImport } from '../csv-import/plan.ts';
import { isUuid, loadOwnedAccount, readActions, type OwnedAccount, type PreviewResponse } from '../csv-import/service.ts';
import type { CommitResult, RowAction } from '../csv-import/types.ts';
import { MAX_PDF_BYTES, extractPdfLines } from './extract.ts';
import { parseStatementLines } from './issuers/index.ts';
import { needsReconciliationConfirmation, reconcileStatement } from './reconcile.ts';
import { STATEMENTS_MIGRATION_MESSAGE, isStatementsTableMissing } from './statements.ts';
import type { ParsedStatement, Reconciliation, StatementFacts } from './types.ts';

export const RECONCILIATION_UNCONFIRMED_MESSAGE =
  "This statement doesn't add up, so it wasn't imported. Check the differences shown, then tick \"Import anyway\" if you still want to import it.";

/** The statement as the review step shows it. Amounts in cents. */
export interface StatementPreview {
  issuer: string;
  issuerLabel: string;
  /** 'activity' for a transaction list printed from a card website (nothing to reconcile). */
  documentKind: 'statement' | 'activity';
  confidence: ParsedStatement['confidence'];
  accountLastFour: string | null;
  period: ParsedStatement['period'];
  facts: StatementFacts;
  reconciliation: Reconciliation;
  warnings: string[];
  /** Information that needs no action. */
  notes: string[];
  pageCount: number;
  rowCount: number;
}

export interface PdfRequest {
  accountId: string | null;
  bytes: Uint8Array;
  fileName: string | null;
  actions: RowAction[];
  confirmUnreconciled: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const bad = (code: string, message: string): ImportError => new ImportError(400, code, message);

/** True when a request body carries a PDF statement rather than CSV text. */
export function isPdfBody(body: unknown): boolean {
  return isRecord(body) && (body.pdf_base64 !== undefined || body.pdfBase64 !== undefined);
}

/** Decodes the base64 PDF. Throws ImportError on anything that can't be a PDF of an allowed size. */
export function decodePdfBase64(value: unknown): Uint8Array {
  if (typeof value !== 'string' || value.trim() === '') {
    throw bad('file_required', 'No statement was sent. Choose a PDF or CSV file.');
  }
  const text = value.replace(/^data:application\/pdf;base64,/, '').replace(/\s+/g, '');
  if (text.length > Math.ceil((MAX_PDF_BYTES * 4) / 3) + 4) {
    throw new ImportError(413, 'file_too_large', 'This PDF is larger than 10 MB. Statements are usually far smaller: check you chose the right file.');
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw bad('not_pdf', "The PDF didn't arrive intact. Choose the file again.");
  return new Uint8Array(Buffer.from(text, 'base64'));
}

/** Checks a PDF preview, inspect or commit body: `{ account_id?, pdf_base64, file_name?, actions?, confirm_unreconciled? }`. */
export function parsePdfRequest(body: unknown, options: { requireAccount: boolean }): PdfRequest {
  if (!isRecord(body)) throw bad('bad_request', 'The request was not valid JSON.');
  const accountValue = body.account_id ?? body.accountId;
  let accountId: string | null = null;
  if (accountValue !== undefined && accountValue !== null && accountValue !== '') {
    if (!isUuid(accountValue)) throw bad('account_required', 'That account is not valid.');
    accountId = accountValue;
  }
  if (options.requireAccount && !accountId) throw bad('account_required', 'Choose the account this statement belongs to.');

  const fileName = body.file_name ?? body.fileName;
  return {
    accountId,
    bytes: decodePdfBase64(body.pdf_base64 ?? body.pdfBase64),
    fileName: typeof fileName === 'string' && fileName.trim() ? fileName.trim() : null,
    actions: readActions(body.actions),
    confirmUnreconciled: (body.confirm_unreconciled ?? body.confirmUnreconciled) === true,
  };
}

export interface ReadPdfStatement {
  parsed: ParsedStatement;
  reconciliation: Reconciliation;
  pageCount: number;
}

/** Extracts, parses and reconciles a statement PDF. Throws ImportError when nothing can be imported from it. */
export async function readPdfStatement(bytes: Uint8Array): Promise<ReadPdfStatement> {
  const extracted = await extractPdfLines(bytes);
  const parsed = parseStatementLines(extracted.lines);
  if (parsed.rows.length > MAX_IMPORT_ROWS) throw bad('too_many_rows', tooManyRowsMessage(parsed.rows.length));
  return { parsed, reconciliation: reconcileStatement(parsed), pageCount: extracted.pageCount };
}

export function toStatementPreview(read: ReadPdfStatement): StatementPreview {
  const { parsed, reconciliation, pageCount } = read;
  return {
    issuer: parsed.issuer,
    issuerLabel: parsed.issuerLabel,
    documentKind: parsed.documentKind ?? 'statement',
    confidence: parsed.confidence,
    accountLastFour: parsed.accountLastFour,
    period: parsed.period,
    facts: parsed.statement,
    reconciliation,
    warnings: parsed.warnings,
    notes: parsed.notes ?? [],
    pageCount,
    rowCount: parsed.rows.length,
  };
}

// ── Inspect: what is this PDF, and whose account is it? ────────────────────

export interface InspectResponse {
  statement: StatementPreview;
  /** The user's accounts whose last four digits match the statement's. */
  matchingAccountIds: string[];
}

/** POST /api/finance/import/pdf: reads the PDF and finds the account by its last four. Writes nothing. */
export async function inspectPdf(db: SupabaseClient, userId: string, body: unknown): Promise<InspectResponse> {
  const request = parsePdfRequest(body, { requireAccount: false });
  const read = await readPdfStatement(request.bytes);
  let matchingAccountIds: string[] = [];
  const lastFour = read.parsed.accountLastFour;
  if (lastFour) {
    const { data, error } = await db
      .from('financial_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('last_four', lastFour);
    if (error) throw dbFailure(error, 'read your accounts');
    matchingAccountIds = ((data ?? []) as { id: string }[]).map((row) => row.id);
  }
  return { statement: toStatementPreview(read), matchingAccountIds };
}

// ── Preview and commit ────────────────────────────────────────────────────

export interface PdfPreviewResponse extends PreviewResponse {
  statement: StatementPreview;
  /** False when the account's last four digits differ from the statement's. Null when either is unknown. */
  accountMatchesStatement: boolean | null;
}

const PDF_SIGN = 'positive_is_expense' as const;

function accountMatches(account: OwnedAccount, parsed: ParsedStatement): boolean | null {
  if (!account.last_four || !parsed.accountLastFour) return null;
  return account.last_four.trim() === parsed.accountLastFour;
}

/** POST /api/finance/import/preview with a PDF. Writes nothing. */
export async function previewPdfImport(db: SupabaseClient, userId: string, body: unknown): Promise<PdfPreviewResponse> {
  const request = parsePdfRequest(body, { requireAccount: true });
  const account = await loadOwnedAccount(db, userId, request.accountId as string);
  const read = await readPdfStatement(request.bytes);
  const plan = await planImport(db, userId, account.id, read.parsed.rows);
  const statement = toStatementPreview(read);
  return {
    account,
    file: {
      headers: [],
      headerLabels: [],
      hasHeader: false,
      preambleLines: [],
      warnings: read.parsed.warnings,
      rowCount: read.parsed.rows.length,
    },
    mapping: {},
    sign: PDF_SIGN,
    dateOrder: 'MDY',
    includePending: false,
    detected: {
      mapping: {},
      sign: PDF_SIGN,
      dateOrder: 'MDY',
      dateOrderAmbiguous: false,
      preset: `pdf:${read.parsed.issuer}`,
      confidence: read.parsed.confidence === 'high' ? 'high' : 'low',
    },
    rows: plan.rows,
    rejected: [],
    totals: { ...plan.totals, rejected: 0 },
    statement,
    accountMatchesStatement: accountMatches(account, read.parsed),
  };
}

export { STATEMENTS_MIGRATION_MESSAGE };

export interface PdfCommitResult extends CommitResult {
  /** True when the statement's summary was saved to account_statements. */
  statementSaved: boolean;
  /** Why it wasn't, when it wasn't. */
  statementError?: string;
  /** True for a transaction list (not a statement): there was no summary to save. */
  statementSkipped?: boolean;
}

/** Throws ImportError 503 "Run migration 209 first" when account_statements doesn't exist yet. */
export async function assertStatementsTable(db: SupabaseClient): Promise<void> {
  const { error } = await db.from('account_statements').select('id').limit(1);
  if (!error) return;
  if (isStatementsTableMissing(error)) throw new ImportError(503, 'migration_required', STATEMENTS_MIGRATION_MESSAGE);
  throw dbFailure(error, 'check the statements table');
}

const dollars = (cents: number | null | undefined): number | null =>
  cents === null || cents === undefined ? null : Math.round(cents) / 100;

/** The account_statements row for a parsed statement (money in dollars). */
export function toStatementRow(
  parsed: ParsedStatement,
  reconciliation: Reconciliation,
  ids: { userId: string; accountId: string; batchId: string | null },
): Record<string, unknown> {
  const facts = parsed.statement;
  return {
    user_id: ids.userId,
    account_id: ids.accountId,
    import_batch_id: ids.batchId,
    issuer: parsed.issuer,
    period_start: parsed.period.start,
    period_end: parsed.period.end,
    previous_balance: dollars(facts.previousBalance),
    payments: dollars(facts.payments),
    credits: dollars(facts.credits),
    purchases: dollars(facts.purchases),
    cash_advances: dollars(facts.cashAdvances),
    fees: dollars(facts.fees),
    interest_charged: dollars(facts.interestCharged),
    new_balance: dollars(facts.newBalance),
    minimum_payment: dollars(facts.minimumPayment),
    due_date: facts.dueDate,
    credit_limit: dollars(facts.creditLimit),
    aprs: facts.aprs.map((apr) => ({
      balance_type: apr.balanceType,
      apr: apr.apr,
      ...(apr.balanceCents !== undefined ? { balance: dollars(apr.balanceCents) } : {}),
      ...(apr.interestCents !== undefined ? { interest: dollars(apr.interestCents) } : {}),
    })),
    promos: facts.promos.map((promo) => ({
      description: promo.description,
      balance: dollars(promo.balance),
      expires_on: promo.expiresOn,
      ...(promo.deferredInterest !== undefined ? { deferred_interest: dollars(promo.deferredInterest) } : {}),
      ...(promo.originalAmount !== undefined ? { original_amount: dollars(promo.originalAmount) } : {}),
      ...(promo.minimumPayment !== undefined ? { minimum_payment: dollars(promo.minimumPayment) } : {}),
      ...(promo.startedOn ? { started_on: promo.startedOn } : {}),
    })),
    reconciled: reconciliation.ok,
  };
}

/**
 * POST /api/finance/import with a PDF. Re-reads the PDF, refuses a statement
 * that doesn't reconcile unless the person confirmed it, checks the
 * statements table exists (before writing anything), then commits the rows
 * exactly as a CSV import would and saves the statement's summary.
 */
export async function runPdfImport(db: SupabaseClient, userId: string, body: unknown): Promise<PdfCommitResult> {
  const request = parsePdfRequest(body, { requireAccount: true });
  const account = await loadOwnedAccount(db, userId, request.accountId as string);
  const read = await readPdfStatement(request.bytes);
  if (needsReconciliationConfirmation(read.reconciliation) && !request.confirmUnreconciled) {
    throw new ImportError(409, 'reconciliation_unconfirmed', RECONCILIATION_UNCONFIRMED_MESSAGE);
  }
  const isStatement = read.parsed.documentKind !== 'activity';
  if (isStatement && read.parsed.period.end) await assertStatementsTable(db);

  const plan = await planImport(db, userId, account.id, read.parsed.rows);
  const result = await commitImport(db, userId, {
    accountId: account.id,
    fileName: request.fileName,
    preset: `pdf:${read.parsed.issuer}`,
    source: 'pdf_import',
    mapping: { format: 'pdf', issuer: read.parsed.issuer, reconciled: read.reconciliation.ok },
    rows: resolveActions(plan.rows, request.actions),
  });

  // A transaction list printed from a website has no statement summary to keep.
  if (!isStatement) return { ...result, statementSaved: false, statementSkipped: true };
  if (!read.parsed.period.end) {
    return { ...result, statementSaved: false, statementError: "The statement's closing date wasn't found, so its summary wasn't saved." };
  }
  // Importing the same statement again refreshes its facts but leaves them with the import that
  // first saved them (the one holding its transactions), so undoing that import still removes them.
  const existing = await db
    .from('account_statements')
    .select('import_batch_id')
    .eq('user_id', userId)
    .eq('account_id', account.id)
    .eq('period_end', read.parsed.period.end)
    .maybeSingle();
  const keptBatchId = (existing.data as { import_batch_id: string | null } | null)?.import_batch_id ?? null;
  const { error } = await db
    .from('account_statements')
    .upsert(
      toStatementRow(read.parsed, read.reconciliation, {
        userId,
        accountId: account.id,
        batchId: keptBatchId ?? result.batchId,
      }),
      { onConflict: 'user_id,account_id,period_end' },
    );
  if (error) {
    return {
      ...result,
      statementSaved: false,
      statementError: isStatementsTableMissing(error)
        ? STATEMENTS_MIGRATION_MESSAGE
        : `The transactions were imported, but the statement summary couldn't be saved: ${error.message}`,
    };
  }
  return { ...result, statementSaved: true };
}
