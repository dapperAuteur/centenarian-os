// components/finance/import/history-api.ts
// Requests for Import history and editing a past import
// (app/api/finance/import/batches/**, plus the transfer routes for one row).

import type { BatchEdit, BatchInfo, BatchRow, DeleteResult, EditResult, RematchResult } from '@/lib/finance/import-history/batch-rows';
import type { ImportBatchSummary } from '@/lib/finance/csv-import/service';
import { apiRequest, sendJson, type ApiResult } from '@/components/finance/review/http';

const one = (id: string) => `/api/finance/import/batches/${encodeURIComponent(id)}`;

export function listAllBatches(): Promise<ApiResult<{ batches: ImportBatchSummary[] }>> {
  return apiRequest('/api/finance/import/batches?limit=200');
}

export function loadBatchRows(
  id: string,
  offset: number,
  limit: number,
): Promise<ApiResult<{ batch: BatchInfo; rows: BatchRow[]; total: number; offset: number }>> {
  return apiRequest(`${one(id)}?offset=${offset}&limit=${limit}`);
}

export function editRows(id: string, ids: string[], changes: BatchEdit): Promise<ApiResult<EditResult>> {
  return sendJson(`${one(id)}/rows`, 'PATCH', { ids, changes });
}

export function deleteRows(id: string, ids: string[]): Promise<ApiResult<DeleteResult>> {
  return sendJson(`${one(id)}/rows`, 'DELETE', { ids });
}

export function rematch(id: string): Promise<ApiResult<RematchResult>> {
  return sendJson(`${one(id)}/rematch`, 'POST');
}

/** A row that could be the other side of a transfer (GET /api/finance/transfers/suggestions?transaction_id=). */
export interface TransferCandidateView {
  transaction: { id: string; date: string; amount: number; type: 'expense' | 'income'; description: string | null; vendor: string | null; account_label: string };
  kind: 'transfer' | 'card_payment' | 'loan_payment';
  days_apart: number;
  reasons: string[];
}

export function transferCandidates(transactionId: string): Promise<ApiResult<{ candidates: TransferCandidateView[] }>> {
  return apiRequest(`/api/finance/transfers/suggestions?transaction_id=${encodeURIComponent(transactionId)}`);
}

export function linkTransfer(ids: [string, string], kind: string): Promise<ApiResult<{ transfer_group_id: string }>> {
  return sendJson('/api/finance/transfers/link', 'POST', { transaction_ids: ids, kind });
}

/**
 * Unlinks a transfer. `removeCounterEntry`: also delete the other side when the transfer feature
 * recorded it (source 'transfer'), since it exists only for this link.
 */
export function unlinkTransfer(
  groupId: string,
  removeCounterEntry = false,
): Promise<ApiResult<{ unlinked: string[]; removed: string[] }>> {
  return sendJson('/api/finance/transfers/unlink', 'POST', { transfer_group_id: groupId, remove_counter_entry: removeCounterEntry });
}
