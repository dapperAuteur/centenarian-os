// lib/finance/import-drafts/drafts.ts
// Saved statement imports (import_drafts, migration 219): a review the person
// started and can finish later.
//
// What a draft keeps: the rows as THIS SERVER's CSV or PDF reader normalized
// them, the rows it could not read, the column settings, the person's choices
// per row, and for a PDF the statement summary. Never the file itself: the
// CSV text and the PDF bytes are read, used and dropped, as before.
//
// The rules:
//   - A draft is saved from the preview (savePreviewDraft), so its rows are
//     always the server's own reading of the file. The browser later sends
//     only its choices (updateDraftChoices), never rows.
//   - Resuming (resumeDraft) plans the saved rows again against the
//     transactions as they are NOW, so a row imported elsewhere since then
//     shows as a duplicate, and an entry linked since then is no longer offered.
//   - Finishing (commitDraft) plans again, commits exactly as the file import
//     does (lib/finance/csv-import/commit.ts), saves a PDF's summary, then
//     deletes the draft. Discarding deletes it too.
//   - A draft expires DRAFT_TTL_DAYS after its last save. An expired draft is
//     treated as gone and deleted the next time the person's drafts are read.
//   - Every query is scoped to the user (and RLS is owner-only besides).
//
// Relative imports end in `.ts` so tests/unit/finance-review.test.ts can load
// this file under `node --test --experimental-strip-types`.

import type { SupabaseClient } from '@supabase/supabase-js';
import { CARD_ROW_KINDS, type CardRowKind } from '../csv-import/card-terms.ts';
import { MAX_IMPORT_ROWS, commitImport, resolveActions } from '../csv-import/commit.ts';
import { ImportError } from '../csv-import/errors.ts';
import type { DbError } from '../csv-import/errors.ts';
import { planImport } from '../csv-import/plan.ts';
import {
  MAX_CSV_CHARS,
  isUuid,
  loadOwnedAccount,
  readActions,
  suggestCashAccount,
  suggestPaidFrom,
  type OwnedAccount,
  type PreviewResponse,
} from '../csv-import/service.ts';
import type {
  CommitResult,
  MappingGuess,
  NormalizedRow,
  PlanStatus,
  RejectedRow,
  RowActionKind,
  TransactionType,
} from '../csv-import/types.ts';
import { needsReconciliationConfirmation, reconcileStatement } from '../pdf-import/reconcile.ts';
import {
  RECONCILIATION_UNCONFIRMED_MESSAGE,
  assertStatementsTable,
  saveStatementSummary,
  type PdfCommitResult,
  type PdfPreviewResponse,
  type StatementPreview,
} from '../pdf-import/service.ts';
import type { StatementRow } from '../pdf-import/types.ts';
import { REVIEW_MIGRATION_CODE, REVIEW_MIGRATION_MESSAGE, isReviewSchemaMissing } from '../review/schema.ts';

/** A draft is kept this many days after its last save. */
export const DRAFT_TTL_DAYS = 30;

/**
 * The most characters of saved rows one draft takes: the importer's own file
 * ceiling (MAX_CSV_CHARS), so a draft is never larger than the file the import
 * would accept. The database refuses anything past 8,000,000 bytes besides.
 */
export const MAX_DRAFT_CHARS = MAX_CSV_CHARS;

/** The most choices one draft keeps: one per row of the largest import. */
export const MAX_DRAFT_DECISIONS = MAX_IMPORT_ROWS;

export const DRAFT_NOT_FOUND_MESSAGE =
  'This saved import was not found. It may have been imported, discarded, or kept for more than 30 days.';

export const DRAFT_TOO_LARGE_MESSAGE =
  'This statement is too large to save for later. Finish the review now, or split the file into shorter date ranges.';

export type DraftSource = 'csv' | 'pdf';

/** The person's choice for one row, as the review step holds it (lib/finance/csv-import/ui-helpers.ts RowDecision). */
export interface DraftDecision {
  action?: RowActionKind;
  type?: TransactionType;
  categoryId?: string | null;
  cardKind?: CardRowKind;
  transferAccountId?: string | null;
}

export type DraftDecisions = Record<number, DraftDecision>;

/** Choices that apply to the whole review. */
export interface DraftOptions {
  /** "Record the payment on the other account if it isn't there yet". */
  recordMissing: boolean;
  /** "Import anyway: I've checked the differences" on a PDF that doesn't add up. */
  confirmUnreconciled: boolean;
}

/** How the rows were read: CSV settings, or the PDF's issuer. */
export interface DraftMapping {
  mapping?: Record<string, string>;
  sign?: PreviewResponse['sign'];
  dateOrder?: PreviewResponse['dateOrder'];
  includePending?: boolean;
  preset?: string | null;
  /** "Remember these settings for this account" was ticked (CSV). */
  remember?: boolean;
  detected?: MappingGuess;
}

/** A draft as the lists show it: no rows. */
export interface DraftSummary {
  id: string;
  account_id: string;
  source: DraftSource;
  file_name: string | null;
  row_count: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
  financial_accounts: { id: string; name: string; institution_name: string | null; last_four: string | null } | null;
}

/** A whole draft, as stored. */
export interface DraftRecord extends Omit<DraftSummary, 'financial_accounts'> {
  user_id: string;
  mapping: DraftMapping | null;
  rows: unknown;
  rejected: unknown;
  skipped: unknown;
  decisions: unknown;
  options: unknown;
  file_summary: unknown;
  statement: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const SUMMARY_COLUMNS =
  'id, account_id, source, file_name, row_count, created_at, updated_at, expires_at, financial_accounts(id, name, institution_name, last_four)';
const RECORD_COLUMNS =
  'id, user_id, account_id, source, file_name, row_count, created_at, updated_at, expires_at, mapping, rows, rejected, skipped, decisions, options, file_summary, statement';

/** The error to throw for a failed draft read or write: "Run migration 219 first" when that is the cause. */
export function draftFailure(error: DbError | null | undefined, doing: string): ImportError {
  if (isReviewSchemaMissing(error)) return new ImportError(503, REVIEW_MIGRATION_CODE, REVIEW_MIGRATION_MESSAGE);
  const detail = error?.message?.trim();
  return new ImportError(500, 'database_error', detail ? `Could not ${doing}: ${detail}` : `Could not ${doing}.`);
}

const notFound = (): ImportError => new ImportError(404, 'draft_not_found', DRAFT_NOT_FOUND_MESSAGE);

/** When a draft saved at `now` expires. */
export function expiryFrom(now: Date): string {
  return new Date(now.getTime() + DRAFT_TTL_DAYS * 86_400_000).toISOString();
}

/** True when a draft's expires_at has passed (an unreadable date counts as expired). */
export function isExpired(expiresAt: string | null | undefined, now: Date): boolean {
  const at = Date.parse(expiresAt ?? '');
  return !Number.isFinite(at) || at <= now.getTime();
}

// ── Checking what the browser sends ───────────────────────────────────────

const ACTIONS: readonly RowActionKind[] = ['insert', 'link', 'skip'];

/**
 * The review step's choices, checked. Keys must be spreadsheet row numbers;
 * unknown fields are dropped; a malformed id is dropped (the row then uses its
 * suggestion). Throws ImportError 400 on anything that isn't a choices object,
 * or holds more choices than an import has rows.
 */
export function readDecisions(value: unknown): DraftDecisions {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) throw new ImportError(400, 'bad_decisions', 'The choices must be an object keyed by row number.');
  const keys = Object.keys(value);
  if (keys.length > MAX_DRAFT_DECISIONS) {
    throw new ImportError(400, 'bad_decisions', `A saved import keeps choices for up to ${MAX_DRAFT_DECISIONS.toLocaleString('en-US')} rows.`);
  }
  const decisions: DraftDecisions = {};
  for (const key of keys) {
    if (!/^\d{1,7}$/.test(key)) continue;
    const item = value[key];
    if (!isRecord(item)) continue;
    const decision: DraftDecision = {};
    if (ACTIONS.includes(item.action as RowActionKind)) decision.action = item.action as RowActionKind;
    if (item.type === 'expense' || item.type === 'income') decision.type = item.type;
    if (item.categoryId === null || isUuid(item.categoryId)) decision.categoryId = item.categoryId as string | null;
    if (CARD_ROW_KINDS.includes(item.cardKind as CardRowKind)) decision.cardKind = item.cardKind as CardRowKind;
    if (item.transferAccountId === null || isUuid(item.transferAccountId)) {
      decision.transferAccountId = item.transferAccountId as string | null;
    }
    if (Object.keys(decision).length > 0) decisions[Number(key)] = decision;
  }
  return decisions;
}

/** The whole-review choices, with their defaults. */
export function readOptions(value: unknown): DraftOptions {
  const record = isRecord(value) ? value : {};
  return {
    recordMissing: record.recordMissing !== false,
    confirmUnreconciled: record.confirmUnreconciled === true,
  };
}

const KINDS = new Set(['purchase', 'cash_advance', 'fee', 'interest', 'payment', 'credit']);
const HINTS = new Set(['transfer', 'card_payment', 'loan_payment', 'insurance', 'cash_withdrawal']);
const BROKEN_ROW = 'This saved row could not be read. Import the statement again to bring it in.';

/**
 * Saved rows, read back defensively: a stored row is the owner's own data, but
 * it is checked like a request before it reaches the plan. A row that doesn't
 * have the NormalizedRow shape keeps its row number with an issue, so the plan
 * reports it as "can't import" instead of saving something malformed.
 */
export function readDraftRows(value: unknown): NormalizedRow[] {
  if (!Array.isArray(value)) return [];
  const rows: NormalizedRow[] = [];
  value.slice(0, MAX_IMPORT_ROWS).forEach((item, index) => {
    const record = isRecord(item) ? item : {};
    const rowNumber = Number.isInteger(record.rowNumber) ? (record.rowNumber as number) : index + 2;
    const date = typeof record.date === 'string' ? record.date.slice(0, 10) : '';
    const amountCents = Number.isSafeInteger(record.amountCents) ? (record.amountCents as number) : Number.NaN;
    const type = record.type === 'income' ? 'income' : 'expense';
    const description = typeof record.description === 'string' ? record.description.slice(0, 1000) : '';
    const vendor = typeof record.vendor === 'string' ? record.vendor.slice(0, 500) : '';
    const shapeOk =
      isRecord(item) && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isSafeInteger(amountCents) &&
      (record.type === 'income' || record.type === 'expense');
    const row: NormalizedRow = {
      rowNumber,
      date,
      amountCents,
      type,
      description,
      vendor,
      hints: Array.isArray(record.hints)
        ? (record.hints.filter((hint) => typeof hint === 'string' && HINTS.has(hint)) as NormalizedRow['hints'])
        : [],
      issues: Array.isArray(record.issues)
        ? record.issues.filter((issue): issue is string => typeof issue === 'string').slice(0, 10)
        : [],
    };
    if (!shapeOk) row.issues = [...row.issues, BROKEN_ROW];
    if (typeof record.bankId === 'string' && record.bankId) row.bankId = record.bankId.slice(0, 200);
    if (typeof record.categoryName === 'string' && record.categoryName) row.categoryName = record.categoryName.slice(0, 200);
    if (typeof record.pending === 'boolean') row.pending = record.pending;
    if (typeof record.kind === 'string' && KINDS.has(record.kind)) row.kind = record.kind;
    rows.push(row);
  });
  return rows;
}

function readRejected(value: unknown): RejectedRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .filter((item) => Number.isInteger(item.row))
    .slice(0, MAX_IMPORT_ROWS)
    .map((item) => ({ row: item.row as number, reason: typeof item.reason === 'string' ? item.reason.slice(0, 500) : 'The row could not be read' }));
}

/** The saved PDF summary, or null when it isn't one. Its reconciliation is worked out again from the rows. */
function readStatement(value: unknown, rows: readonly NormalizedRow[]): StatementPreview | null {
  if (!isRecord(value) || !isRecord(value.facts) || !isRecord(value.period)) return null;
  const preview = value as unknown as StatementPreview;
  const reconciliation = reconcileStatement({
    rows: rows as StatementRow[],
    statement: preview.facts,
    documentKind: preview.documentKind === 'activity' ? 'activity' : 'statement',
  });
  return { ...preview, reconciliation };
}

// ── Saving ────────────────────────────────────────────────────────────────

/** What a preview gives a draft. */
export interface DraftContent {
  accountId: string;
  source: DraftSource;
  fileName: string | null;
  mapping: DraftMapping;
  rows: readonly NormalizedRow[];
  rejected: readonly RejectedRow[];
  skipped: readonly RejectedRow[];
  file: PreviewResponse['file'];
  /** Each row's status when the draft was saved, to say on resume what changed since. */
  statuses: Record<number, PlanStatus>;
  statement: StatementPreview | null;
}

export interface SavedDraft {
  id: string;
  updated_at: string;
  expires_at: string;
}

/** Throws ImportError 413 when the rows are past the importer's limits. Pure. */
export function assertDraftFits(rows: readonly unknown[]): void {
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ImportError(413, 'draft_too_large', DRAFT_TOO_LARGE_MESSAGE);
  }
  if (JSON.stringify(rows).length > MAX_DRAFT_CHARS) {
    throw new ImportError(413, 'draft_too_large', DRAFT_TOO_LARGE_MESSAGE);
  }
}

/** Deletes the person's drafts whose 30 days are up. Returns how many went. Quiet: never throws. */
export async function deleteExpiredDrafts(db: SupabaseClient, userId: string, now: Date = new Date()): Promise<number> {
  try {
    const { data, error } = await db
      .from('import_drafts')
      .delete()
      .eq('user_id', userId)
      .lte('expires_at', now.toISOString())
      .select('id');
    return error ? 0 : (data ?? []).length;
  } catch {
    return 0;
  }
}

/**
 * Saves the rows a preview read as a draft, and returns its id. With
 * `draftId` (the draft this page already has), that draft is replaced; an
 * older draft of the same file for the same account is replaced too, so one
 * statement never has two saved reviews. The choices start empty unless given.
 *
 * Throws ImportError 503 "Run migration 219 first" before the table exists,
 * 413 when the rows are past the importer's limits.
 */
export async function savePreviewDraft(
  db: SupabaseClient,
  userId: string,
  content: DraftContent,
  options: { draftId?: string | null; decisions?: DraftDecisions; choices?: Partial<DraftOptions>; now?: Date } = {},
): Promise<SavedDraft> {
  assertDraftFits(content.rows);
  const now = options.now ?? new Date();
  await deleteExpiredDrafts(db, userId, now);

  const values = {
    user_id: userId,
    account_id: content.accountId,
    source: content.source,
    file_name: content.fileName ? content.fileName.slice(0, 255) : null,
    mapping: content.mapping,
    rows: content.rows,
    rejected: content.rejected,
    skipped: content.skipped,
    decisions: options.decisions ?? {},
    options: { ...readOptions(undefined), ...(options.choices ?? {}) },
    file_summary: { file: content.file, statuses: content.statuses },
    statement: content.statement,
    row_count: content.rows.length + content.rejected.length,
    updated_at: now.toISOString(),
    expires_at: expiryFrom(now),
  };

  if (options.draftId && isUuid(options.draftId)) {
    const { data, error } = await db
      .from('import_drafts')
      .update(values)
      .eq('id', options.draftId)
      .eq('user_id', userId)
      .select('id, updated_at, expires_at');
    if (error) throw draftFailure(error, 'save this import for later');
    const updated = (data as SavedDraft[] | null)?.[0];
    if (updated) return updated;
    // Gone (imported, discarded or expired elsewhere): save it as a new draft.
  }

  // One saved review per file per account: a fresh preview of the same file replaces the older one.
  if (content.fileName) {
    const { error } = await db
      .from('import_drafts')
      .delete()
      .eq('user_id', userId)
      .eq('account_id', content.accountId)
      .eq('source', content.source)
      .eq('file_name', values.file_name);
    if (error) throw draftFailure(error, 'replace the earlier saved import');
  }

  const { data, error } = await db
    .from('import_drafts')
    .insert({ ...values, created_at: now.toISOString() })
    .select('id, updated_at, expires_at');
  if (error) throw draftFailure(error, 'save this import for later');
  const saved = (data as SavedDraft[] | null)?.[0];
  if (!saved) throw new ImportError(500, 'database_error', 'Could not save this import for later.');
  return saved;
}

/**
 * Saves the person's choices on a draft (the review step autosaves these) and
 * moves its expiry 30 days on. Throws ImportError 404 when the draft isn't the
 * user's, or is gone or expired.
 */
export async function updateDraftChoices(
  db: SupabaseClient,
  userId: string,
  draftId: string,
  body: unknown,
  now: Date = new Date(),
): Promise<SavedDraft> {
  if (!isUuid(draftId)) throw notFound();
  const fields = isRecord(body) ? body : {};
  const decisions = readDecisions(fields.decisions);
  const choices = readOptions(fields.options);
  const { data, error } = await db
    .from('import_drafts')
    .update({ decisions, options: choices, updated_at: now.toISOString(), expires_at: expiryFrom(now) })
    .eq('id', draftId)
    .eq('user_id', userId)
    .gt('expires_at', now.toISOString())
    .select('id, updated_at, expires_at');
  if (error) throw draftFailure(error, 'save your choices');
  const saved = (data as SavedDraft[] | null)?.[0];
  if (!saved) throw notFound();
  return saved;
}

// ── Reading ───────────────────────────────────────────────────────────────

/** The person's unexpired drafts, newest first. Expired ones are deleted on the way. */
export async function listDrafts(db: SupabaseClient, userId: string, now: Date = new Date()): Promise<DraftSummary[]> {
  await deleteExpiredDrafts(db, userId, now);
  const { data, error } = await db
    .from('import_drafts')
    .select(SUMMARY_COLUMNS)
    .eq('user_id', userId)
    .gt('expires_at', now.toISOString())
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw draftFailure(error, 'read your saved imports');
  return ((data ?? []) as unknown as DraftSummary[]).map((draft) => ({
    ...draft,
    financial_accounts: Array.isArray(draft.financial_accounts)
      ? (draft.financial_accounts[0] ?? null)
      : (draft.financial_accounts ?? null),
  }));
}

/** One whole draft. Throws ImportError 404 when it isn't the user's, or is gone or expired (an expired one is deleted). */
export async function loadDraft(
  db: SupabaseClient,
  userId: string,
  draftId: string,
  now: Date = new Date(),
): Promise<DraftRecord> {
  if (!isUuid(draftId)) throw notFound();
  const { data, error } = await db
    .from('import_drafts')
    .select(RECORD_COLUMNS)
    .eq('id', draftId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw draftFailure(error, 'read the saved import');
  const draft = data as DraftRecord | null;
  if (!draft || draft.user_id !== userId) throw notFound();
  if (isExpired(draft.expires_at, now)) {
    await deleteDraft(db, userId, draftId);
    throw notFound();
  }
  return draft;
}

/** Deletes one draft. Returns true when there was one to delete. */
export async function deleteDraft(db: SupabaseClient, userId: string, draftId: string): Promise<boolean> {
  if (!isUuid(draftId)) return false;
  const { data, error } = await db
    .from('import_drafts')
    .delete()
    .eq('id', draftId)
    .eq('user_id', userId)
    .select('id');
  if (error) throw draftFailure(error, 'discard the saved import');
  return (data ?? []).length > 0;
}

// ── Resuming ──────────────────────────────────────────────────────────────

/** What resuming a draft answers: a fresh preview plus the saved choices. */
export interface DraftResume {
  preview: PreviewResponse & Partial<Pick<PdfPreviewResponse, 'statement' | 'accountMatchesStatement'>>;
  draft: {
    id: string;
    source: DraftSource;
    file_name: string | null;
    created_at: string;
    updated_at: string;
    expires_at: string;
    decisions: DraftDecisions;
    options: DraftOptions;
    mapping: DraftMapping;
  };
  /** Rows whose status is different now than when the draft was saved (imported elsewhere since, say). */
  changedSinceSave: number;
}

/** Counts rows whose status differs from the saved one. Rows with no saved status don't count. Pure. */
export function countChangedStatuses(
  saved: unknown,
  now: readonly { rowNumber: number; status: PlanStatus }[],
): number {
  if (!isRecord(saved)) return 0;
  let changed = 0;
  for (const row of now) {
    const before = saved[String(row.rowNumber)];
    if (typeof before === 'string' && before !== row.status) changed += 1;
  }
  return changed;
}

function readMapping(value: unknown): DraftMapping {
  return isRecord(value) ? (value as DraftMapping) : {};
}

const PDF_SIGN = 'positive_is_expense' as const;

/**
 * Resumes a draft: plans its saved rows again against the transactions as
 * they are now (so duplicates are checked against current data), and hands
 * back the preview with the saved choices. Writes nothing.
 */
export async function resumeDraft(db: SupabaseClient, userId: string, draftId: string): Promise<DraftResume> {
  const draft = await loadDraft(db, userId, draftId);
  const account = await loadOwnedAccount(db, userId, draft.account_id);
  const rows = readDraftRows(draft.rows);
  const mapping = readMapping(draft.mapping);
  const pdf = draft.source === 'pdf';
  const includePending = !pdf && mapping.includePending === true;

  const [plan, paidFromAccountId, cashAccountId] = await Promise.all([
    planImport(db, userId, account.id, rows, { includePending }),
    suggestPaidFrom(db, userId, account),
    suggestCashAccount(db, userId, account),
  ]);
  const rejected = pdf ? [] : readRejected(draft.rejected);
  const skipped = pdf ? [] : readRejected(draft.skipped);
  const summary = isRecord(draft.file_summary) ? draft.file_summary : {};
  const savedFile = isRecord(summary.file) ? (summary.file as PreviewResponse['file']) : null;
  const statement = pdf ? readStatement(draft.statement, rows) : null;
  const preset = mapping.preset ?? null;

  const detected: MappingGuess = mapping.detected ?? {
    mapping: mapping.mapping ?? {},
    sign: mapping.sign ?? PDF_SIGN,
    dateOrder: mapping.dateOrder ?? 'MDY',
    dateOrderAmbiguous: false,
    preset: preset ?? 'generic',
    confidence: 'low',
  };

  const preview: DraftResume['preview'] = {
    account,
    file: savedFile ?? {
      headers: [],
      headerLabels: [],
      hasHeader: false,
      preambleLines: [],
      warnings: [],
      rowCount: rows.length,
    },
    mapping: mapping.mapping ?? {},
    sign: mapping.sign ?? PDF_SIGN,
    dateOrder: mapping.dateOrder ?? 'MDY',
    includePending,
    detected,
    rows: plan.rows,
    rejected,
    skipped,
    totals: { ...plan.totals, rejected: rejected.length },
    paidFromAccountId,
    cashAccountId,
  };
  if (statement) {
    preview.statement = statement;
    preview.accountMatchesStatement = accountMatches(account, statement.accountLastFour);
  }

  return {
    preview,
    draft: {
      id: draft.id,
      source: pdf ? 'pdf' : 'csv',
      file_name: draft.file_name,
      created_at: draft.created_at,
      updated_at: draft.updated_at,
      expires_at: draft.expires_at,
      decisions: readDecisions(draft.decisions),
      options: readOptions(draft.options),
      mapping,
    },
    changedSinceSave: countChangedStatuses(summary.statuses, plan.rows),
  };
}

function accountMatches(account: OwnedAccount, lastFour: string | null | undefined): boolean | null {
  if (!account.last_four || !lastFour) return null;
  return account.last_four.trim() === lastFour;
}

// ── Finishing ─────────────────────────────────────────────────────────────

/** What finishing a draft answers: the import's result, plus whether the draft was deleted. */
export type DraftCommitResult = (CommitResult | PdfCommitResult) & { draftDeleted: boolean };

/**
 * Finishes a draft: plans the saved rows again against current data, applies
 * the person's actions (`{ actions, confirm_unreconciled }`, the same shape the
 * file import takes), commits, saves a PDF's summary, and deletes the draft.
 * Throws ImportError 409 for a PDF that doesn't add up unless confirmed, and
 * 404 when the draft isn't the user's.
 */
export async function commitDraft(
  db: SupabaseClient,
  userId: string,
  draftId: string,
  body: unknown,
): Promise<DraftCommitResult> {
  const fields = isRecord(body) ? body : {};
  const actions = readActions(fields.actions);
  const confirmUnreconciled = (fields.confirm_unreconciled ?? fields.confirmUnreconciled) === true;

  const draft = await loadDraft(db, userId, draftId);
  const account = await loadOwnedAccount(db, userId, draft.account_id);
  const rows = readDraftRows(draft.rows);
  const mapping = readMapping(draft.mapping);
  const pdf = draft.source === 'pdf';

  const statement = pdf ? readStatement(draft.statement, rows) : null;
  if (statement) {
    if (needsReconciliationConfirmation(statement.reconciliation) && !confirmUnreconciled) {
      throw new ImportError(409, 'reconciliation_unconfirmed', RECONCILIATION_UNCONFIRMED_MESSAGE);
    }
    if (statement.documentKind !== 'activity' && statement.period.end) await assertStatementsTable(db);
  }

  const includePending = !pdf && mapping.includePending === true;
  const plan = await planImport(db, userId, account.id, rows, { includePending });
  const result = await commitImport(db, userId, {
    accountId: account.id,
    account,
    fileName: draft.file_name,
    preset: mapping.preset ?? null,
    source: pdf ? 'pdf_import' : 'csv_import',
    mapping: pdf
      ? { format: 'pdf', issuer: statement?.issuer ?? null, reconciled: statement?.reconciliation.ok ?? false }
      : { mapping: mapping.mapping ?? {}, sign: mapping.sign, dateOrder: mapping.dateOrder, includePending },
    rows: resolveActions(plan.rows, actions),
    rejected: pdf ? undefined : readRejected(draft.rejected),
  });

  const finished: CommitResult | PdfCommitResult = statement
    ? await saveStatementSummary(
        db,
        userId,
        account.id,
        { issuer: statement.issuer, period: statement.period, statement: statement.facts, documentKind: statement.documentKind },
        statement.reconciliation,
        result,
      )
    : result;

  // The rows are in. A draft that can't be deleted now is harmless: resuming it would show every
  // row as already imported, and it expires on its own.
  let draftDeleted = false;
  try {
    draftDeleted = await deleteDraft(db, userId, draftId);
  } catch {
    draftDeleted = false;
  }
  return { ...finished, draftDeleted };
}

/** Deletes a draft after its file was imported the usual way. Never throws: the import already succeeded. */
export async function discardDraftQuietly(db: SupabaseClient, userId: string, draftId: unknown): Promise<boolean> {
  if (!isUuid(draftId)) return false;
  try {
    return await deleteDraft(db, userId, draftId);
  } catch {
    return false;
  }
}
