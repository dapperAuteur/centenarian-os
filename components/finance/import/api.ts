// components/finance/import/api.ts
// The statement import's requests. Every call resolves (never throws) to
// either the data or a sentence that is safe to show, so no step ever renders
// a raw response.
//
// These use plain fetch, not offlineFetch: an import must not be queued while
// offline and replayed later with a multi-megabyte body.

import type { ImportBatchSummary, PreviewResponse } from '@/lib/finance/csv-import/service';
import type {
  ColumnMapping,
  CommitResult,
  DateOrder,
  SavedCsvMapping,
  SignConvention,
  UndoResult,
} from '@/lib/finance/csv-import/types';
import {
  NETWORK_ERROR_TEXT,
  countTransferSuggestions,
  importErrorText,
  type WireRowAction,
} from '@/lib/finance/csv-import/ui-helpers';

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code: string; status: number };

/** The settings a preview and its commit are both read with. */
export interface StatementPayload {
  account_id: string;
  csv_text: string;
  mapping: Partial<ColumnMapping>;
  sign: SignConvention;
  dateOrder: DateOrder;
  include_pending: boolean;
  file_name: string | null;
  preset: string | null;
}

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: 'no-store' });
  } catch {
    return { ok: false, message: NETWORK_ERROR_TEXT, code: 'network', status: 0 };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON (a host error page, an empty body): importErrorText words it from the status.
  }

  if (!response.ok) {
    const code =
      typeof body === 'object' && body !== null && typeof (body as { code?: unknown }).code === 'string'
        ? (body as { code: string }).code
        : '';
    return { ok: false, message: importErrorText(response.status, body), code, status: response.status };
  }
  return { ok: true, data: body as T };
}

const postJson = <T,>(url: string, payload: unknown): Promise<ApiResult<T>> =>
  request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

/** What importing the statement would do. Writes nothing. */
export function previewStatement(payload: StatementPayload): Promise<ApiResult<PreviewResponse>> {
  return postJson('/api/finance/import/preview', payload);
}

/** Imports the statement with the person's row choices. */
export function commitStatement(
  payload: StatementPayload & { actions: WireRowAction[] },
): Promise<ApiResult<CommitResult>> {
  return postJson('/api/finance/import', payload);
}

export function listImportBatches(): Promise<ApiResult<{ batches: ImportBatchSummary[] }>> {
  return request('/api/finance/import/batches');
}

export function undoImportBatch(batchId: string): Promise<ApiResult<UndoResult>> {
  return request(`/api/finance/import/batches/${encodeURIComponent(batchId)}/undo`, { method: 'POST' });
}

/** Remembers the statement settings on the account. */
export function saveAccountMapping(accountId: string, saved: SavedCsvMapping): Promise<ApiResult<unknown>> {
  return request(`/api/finance/accounts/${encodeURIComponent(accountId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv_import_mapping: saved }),
  });
}

/**
 * How many possible transfers the transfer tracking feature sees between two
 * dates. That route ships on its own branch: where it doesn't exist yet (404),
 * or fails for any reason, the answer is 0 and the page shows nothing.
 */
export async function fetchTransferSuggestionCount(from: string, to: string): Promise<number> {
  try {
    const query = new URLSearchParams({ from, to });
    const response = await fetch(`/api/finance/transfers/suggestions?${query.toString()}`, { cache: 'no-store' });
    if (!response.ok) return 0;
    return countTransferSuggestions(await response.json());
  } catch {
    return 0;
  }
}
