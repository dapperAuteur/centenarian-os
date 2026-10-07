// components/finance/import/drafts-api.ts
// The requests for saved statement imports (import_drafts, migration 219):
// the preview that saves a draft, autosaving the choices, resuming, finishing
// and discarding. See app/api/finance/import/drafts/**.

import type { DraftCommitResult, DraftResume, DraftSummary, SavedDraft } from '@/lib/finance/import-drafts/drafts';
import type { DraftPreviewResponse } from '@/lib/finance/import-drafts/preview';
import type { WireRowAction } from '@/lib/finance/csv-import/ui-helpers';
import { apiRequest, sendJson, type ApiResult } from '@/components/finance/review/http';
import type { PdfStatementPayload, StatementPayload } from './api';

const base = '/api/finance/import/drafts';
const one = (id: string) => `${base}/${encodeURIComponent(id)}`;

/** The import preview, saved as a draft on the way (or replacing `draft_id`). */
export function previewAndSaveDraft(
  payload: (StatementPayload | PdfStatementPayload) & { draft_id?: string | null; remember?: boolean },
): Promise<ApiResult<DraftPreviewResponse>> {
  return sendJson(base, 'POST', payload);
}

/** The choices the review step holds, as the server stores them. */
export interface DraftChoices {
  decisions: Record<number, unknown>;
  options: { recordMissing: boolean; confirmUnreconciled: boolean };
}

export function saveDraftChoices(id: string, choices: DraftChoices): Promise<ApiResult<SavedDraft>> {
  return sendJson(one(id), 'PATCH', choices);
}

/**
 * The same save, for when the page is being left: keepalive lets it finish
 * after the tab closes. Browsers cap a keepalive body at 64 KB, so a bigger
 * one is sent normally (the debounced save has almost always run by then).
 */
export function saveDraftChoicesOnLeave(id: string, choices: DraftChoices): void {
  const body = JSON.stringify(choices);
  try {
    void fetch(one(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: body.length < 60_000,
    }).catch(() => undefined);
  } catch {
    // Leaving the page: nothing to tell anyone.
  }
}

export function listDrafts(): Promise<ApiResult<{ drafts: DraftSummary[] }>> {
  return apiRequest(base);
}

export function resumeDraft(id: string): Promise<ApiResult<DraftResume>> {
  return sendJson(`${one(id)}/resume`, 'POST');
}

export function commitDraft(
  id: string,
  payload: { actions: WireRowAction[]; confirm_unreconciled: boolean },
): Promise<ApiResult<DraftCommitResult & { imported: number }>> {
  return sendJson(`${one(id)}/commit`, 'POST', payload);
}

export function discardDraft(id: string): Promise<ApiResult<{ deleted: boolean }>> {
  return sendJson(one(id), 'DELETE');
}
