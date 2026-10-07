// lib/finance/import-drafts/preview.ts
// POST /api/finance/import/drafts: the import preview, saved as a draft on the
// way. The body is exactly what POST /api/finance/import/preview takes (a CSV's
// text and settings, or a PDF as base64), plus:
//   draft_id   the draft this page already has: it is replaced, not duplicated
//   remember   "Remember these settings for this account" (CSV), kept with the draft
//
// The preview is the same one the preview route gives. Saving the draft is
// best effort: when it can't be saved (migration 219 missing, a statement past
// the importer's limits), the preview still comes back, with `draft: null` and
// `draftError` saying why, so the review can go on and simply isn't kept.
//
// Relative imports end in `.ts` so the unit tests can load this file under
// `node --test --experimental-strip-types`.

import type { SupabaseClient } from '@supabase/supabase-js';
import { ImportError } from '../csv-import/errors.ts';
import { previewImportDetailed, type PreviewResponse } from '../csv-import/service.ts';
import type { NormalizedRow, PlanStatus } from '../csv-import/types.ts';
import { isPdfBody, previewPdfImportDetailed, type PdfPreviewResponse } from '../pdf-import/service.ts';
import { savePreviewDraft, type DraftContent, type DraftMapping, type SavedDraft } from './drafts.ts';

export type DraftPreviewResponse = (PreviewResponse & Partial<Pick<PdfPreviewResponse, 'statement' | 'accountMatchesStatement'>>) & {
  draft: SavedDraft | null;
  /** Why the review couldn't be saved for later, when it couldn't. */
  draftError?: { code: string; message: string };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Each row's status, by spreadsheet row number. Pure. */
export function statusesOf(rows: readonly { rowNumber: number; status: PlanStatus }[]): Record<number, PlanStatus> {
  const statuses: Record<number, PlanStatus> = {};
  for (const row of rows) statuses[row.rowNumber] = row.status;
  return statuses;
}

/** The normalized rows with nothing the plan added (pdf rows keep their statement kind). Pure. */
export function plainRows(rows: readonly NormalizedRow[]): NormalizedRow[] {
  return rows.map((row) => {
    const plain: NormalizedRow = {
      rowNumber: row.rowNumber,
      date: row.date,
      amountCents: row.amountCents,
      type: row.type,
      description: row.description,
      vendor: row.vendor,
      hints: [...row.hints],
      issues: [...row.issues],
    };
    if (row.bankId !== undefined) plain.bankId = row.bankId;
    if (row.categoryName !== undefined) plain.categoryName = row.categoryName;
    if (row.pending !== undefined) plain.pending = row.pending;
    if (row.kind !== undefined) plain.kind = row.kind;
    return plain;
  });
}

export async function previewAndSaveDraft(
  db: SupabaseClient,
  userId: string,
  body: unknown,
): Promise<DraftPreviewResponse> {
  const fields = isRecord(body) ? body : {};
  const draftId = typeof fields.draft_id === 'string' ? fields.draft_id : null;

  let content: DraftContent;
  let preview: PreviewResponse & Partial<Pick<PdfPreviewResponse, 'statement' | 'accountMatchesStatement'>>;
  if (isPdfBody(body)) {
    const detailed = await previewPdfImportDetailed(db, userId, body);
    preview = detailed.preview;
    const mapping: DraftMapping = { preset: detailed.preview.detected.preset, detected: detailed.preview.detected };
    content = {
      accountId: detailed.preview.account.id,
      source: 'pdf',
      fileName: detailed.request.fileName,
      mapping,
      rows: plainRows(detailed.rows),
      rejected: [],
      skipped: [],
      file: detailed.preview.file,
      statuses: statusesOf(detailed.preview.rows),
      statement: detailed.preview.statement,
    };
  } else {
    const detailed = await previewImportDetailed(db, userId, body);
    preview = detailed.preview;
    const mapping: DraftMapping = {
      mapping: detailed.preview.mapping as Record<string, string>,
      sign: detailed.preview.sign,
      dateOrder: detailed.preview.dateOrder,
      includePending: detailed.preview.includePending,
      preset: detailed.request.preset ?? detailed.preview.detected.preset,
      remember: fields.remember === true,
      detected: detailed.preview.detected,
    };
    content = {
      accountId: detailed.preview.account.id,
      source: 'csv',
      fileName: detailed.request.fileName,
      mapping,
      rows: plainRows(detailed.rows),
      rejected: detailed.preview.rejected,
      skipped: detailed.preview.skipped,
      file: detailed.preview.file,
      statuses: statusesOf(detailed.preview.rows),
      statement: null,
    };
  }

  try {
    const draft = await savePreviewDraft(db, userId, content, { draftId });
    return { ...preview, draft };
  } catch (error) {
    if (error instanceof ImportError) {
      return { ...preview, draft: null, draftError: { code: error.code, message: error.message } };
    }
    return {
      ...preview,
      draft: null,
      draftError: { code: 'unexpected', message: 'This review could not be saved for later. You can still finish it now.' },
    };
  }
}
