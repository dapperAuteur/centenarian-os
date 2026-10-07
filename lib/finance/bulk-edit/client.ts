// lib/finance/bulk-edit/client.ts
// Browser side of bulk edits: sends a selection of any size to
// POST /api/finance/transactions/bulk in batches of BULK_BATCH_SIZE with
// progress, as one undoable operation, and runs an undo to the end.
//
// Plain fetch on purpose, not offlineFetch: the batches of one edit share the
// operation id the first batch answers, so they can't be queued offline.

import { BULK_BATCH_SIZE, bodyFromSpec, type BulkEditSpec } from './logic.ts';

export interface BulkRunTotals {
  /** Batches that finished. */
  done: number;
  /** Rows whose stored values changed (both sides of an unlinked transfer count). */
  changed: number;
  notFound: number;
  typeSkipped: number;
  unlinked: number;
  remembered: string[];
  rememberFailed: number;
  operationId: string | null;
  /** Every batch recorded its undo rows. */
  undoRecorded: boolean;
  /** Set when the database has no undo table yet ("Run migration 220 first"). */
  notice: string | null;
}

export type BulkRunResult = { ok: true; totals: BulkRunTotals } | { ok: false; error: string; totals: BulkRunTotals };

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

/**
 * Applies `spec` to `ids` in batches. `onProgress(sent, total)` runs after
 * each batch. Stops at the first refused batch; the totals say how far it got.
 */
export async function runBulkEdit(
  ids: readonly string[],
  spec: BulkEditSpec,
  summary: string,
  onProgress?: (sent: number, total: number) => void,
): Promise<BulkRunResult> {
  const totals: BulkRunTotals = {
    done: 0, changed: 0, notFound: 0, typeSkipped: 0, unlinked: 0,
    remembered: [], rememberFailed: 0, operationId: null, undoRecorded: true, notice: null,
  };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, error: "You're offline. Bulk edits need a connection; nothing was changed.", totals };
  }
  const base = bodyFromSpec(spec);
  for (let i = 0; i < ids.length; i += BULK_BATCH_SIZE) {
    const batch = ids.slice(i, i + BULK_BATCH_SIZE);
    let response;
    try {
      response = await postJson('/api/finance/transactions/bulk', {
        ...base,
        ids: batch,
        operation: totals.operationId ? { id: totals.operationId } : { summary },
        ...(spec.remember ? { remember_skip: totals.remembered } : {}),
      });
    } catch {
      return { ok: false, error: 'The connection dropped.', totals };
    }
    const { data } = response;
    if (!response.ok) {
      return { ok: false, error: typeof data.error === 'string' ? data.error : `Error ${response.status}`, totals };
    }
    totals.done += batch.length;
    totals.changed += Number(data.changed ?? 0);
    totals.notFound += Number(data.not_found ?? 0);
    totals.typeSkipped += Number(data.type_skipped ?? 0);
    totals.unlinked += Number(data.unlinked ?? 0);
    totals.rememberFailed += Number(data.remember_failed ?? 0);
    if (Array.isArray(data.remembered)) totals.remembered.push(...(data.remembered as string[]));
    if (typeof data.operation_id === 'string') totals.operationId = data.operation_id;
    if (data.undo_recorded === false && Number(data.changed ?? 0) > 0) totals.undoRecorded = false;
    if (typeof data.notice === 'string') totals.notice = data.notice;
    onProgress?.(Math.min(i + batch.length, ids.length), ids.length);
  }
  return { ok: true, totals };
}

export interface UndoTotals {
  restored: number;
  changed: number;
  missing: number;
  pairChanged: number;
  failed: number;
}

/** Undoes an operation to the end, chunk by chunk. `onProgress(restoredSoFar)`. */
export async function runUndo(
  operationId: string,
  onProgress?: (restored: number) => void,
): Promise<{ ok: true; totals: UndoTotals } | { ok: false; error: string; totals: UndoTotals }> {
  const totals: UndoTotals = { restored: 0, changed: 0, missing: 0, pairChanged: 0, failed: 0 };
  // An operation has at most 10,000 selected rows plus transfer partners: 60 chunks is ample.
  for (let round = 0; round < 60; round++) {
    let response;
    try {
      response = await postJson('/api/finance/transactions/bulk/undo', { operation_id: operationId });
    } catch {
      return { ok: false, error: 'The connection dropped.', totals };
    }
    const { data } = response;
    if (!response.ok) return { ok: false, error: typeof data.error === 'string' ? data.error : `Error ${response.status}`, totals };
    const skipped = (data.skipped ?? {}) as Record<string, number>;
    totals.restored += Number(data.restored ?? 0);
    totals.changed += Number(skipped.changed ?? 0);
    totals.missing += Number(skipped.missing ?? 0);
    totals.pairChanged += Number(skipped.pair_changed ?? 0);
    totals.failed += Number(skipped.failed ?? 0);
    onProgress?.(totals.restored);
    if (data.done) return { ok: true, totals };
  }
  return { ok: false, error: 'The undo did not finish. Press Undo again to continue.', totals };
}
