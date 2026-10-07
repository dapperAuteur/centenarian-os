'use client';

// app/dashboard/finance/import/history/[id]/page.tsx
// One past statement import: its rows, 100 at a time, in statement order.
//   - Per row: vendor, type and category (Save changes), link it as one side
//     of a transfer or unlink it, delete it (rows the import added only).
//   - Ticked rows: set a category, a type or a vendor on all of them, or delete them.
//   - Re-run transfer matching for this import (after importing the other
//     account's statement, say): clear pairs are linked, the rest go to the
//     Review page.
//   - Undo the whole import, as on the Import page.
// Writes: PATCH/DELETE /api/finance/import/batches/[id]/rows, POST .../rematch,
// POST /api/finance/transfers/link and /unlink, POST .../undo. Each checks the
// rows are this person's and (for the batch routes) part of this import.
// A row changed here is kept by a later Undo, as any edited imported row is.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, History, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import BatchRowItem, { NO_CATEGORY } from '@/components/finance/import/BatchRowItem';
import UndoImportDialog from '@/components/finance/import/UndoImportDialog';
import UndoSummary from '@/components/finance/import/UndoSummary';
import { undoImportBatch } from '@/components/finance/import/api';
import {
  deleteRows,
  editRows,
  linkTransfer,
  loadBatchRows,
  rematch,
  unlinkTransfer,
  type TransferCandidateView,
} from '@/components/finance/import/history-api';
import {
  ErrorNotice,
  StatusChip,
  StatusNotice,
  dangerButton,
  fieldLabel,
  primaryButton,
  secondaryButton,
  selectInput,
  textLink,
} from '@/components/finance/import/shared';
import { useOnline } from '@/components/finance/import/useOnline';
import { failureText, plural } from '@/components/finance/review/api';
import type { ApiResult } from '@/components/finance/review/http';
import type { BatchEdit, BatchInfo, BatchRow } from '@/lib/finance/import-history/batch-rows';
import type { UndoResult } from '@/lib/finance/csv-import/types';
import { OFFLINE_TEXT, accountLabel } from '@/lib/finance/csv-import/ui-helpers';
import { formatTime, useClockFormat } from '@/lib/hooks/useClockFormat';
import { useTrackPageView } from '@/lib/hooks/useTrackPageView';

const PAGE_SIZE = 100;

function formatDay(timestamp: string | null | undefined): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ImportBatchPage() {
  useTrackPageView('finance', '/dashboard/finance/import/history/[id]');
  const params = useParams<{ id: string }>();
  const batchId = typeof params?.id === 'string' ? params.id : '';
  const online = useOnline();
  const clockFormat = useClockFormat();

  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [reviewLink, setReviewLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkType, setBulkType] = useState('');
  const [bulkVendor, setBulkVendor] = useState('');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);
  const undoBusyRef = useRef(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoResult | null>(null);
  const rowsHeadingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(
    async (nextOffset: number) => {
      if (!batchId) return;
      setLoading(true);
      setLoadError(null);
      const response = await loadBatchRows(batchId, nextOffset, PAGE_SIZE);
      setLoading(false);
      if (!response.ok) {
        setLoadError(response.message);
        return;
      }
      setBatch(response.data.batch);
      setRows(response.data.rows);
      setTotal(response.data.total);
      // The last rows of a page were just deleted: show the page before.
      if (response.data.rows.length === 0 && nextOffset > 0 && response.data.total > 0) {
        setOffset(Math.max(0, Math.floor((response.data.total - 1) / PAGE_SIZE) * PAGE_SIZE));
      }
    },
    [batchId],
  );

  useEffect(() => {
    void load(offset);
  }, [load, offset]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/finance/categories', { cache: 'no-store' });
        if (!response.ok) return;
        const body = (await response.json().catch(() => null)) as { categories?: { id: string; name: string }[] } | null;
        if (Array.isArray(body?.categories)) {
          setCategories([...body.categories].sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch {
        // Without categories, rows can still be edited otherwise.
      }
    })();
  }, []);

  /** Runs a change, says how it went, reloads the rows and puts focus back on the list's heading. */
  async function run<T>(work: () => Promise<ApiResult<T>>, describe: (data: T) => { status?: string; error?: string; review?: boolean }) {
    if (busy) return;
    if (!navigator.onLine) {
      setError(OFFLINE_TEXT);
      return;
    }
    setBusy(true);
    setStatus(null);
    setError(null);
    setReviewLink(false);
    const response = await work();
    if (!response.ok) {
      setError(response.message);
    } else {
      const outcome = describe(response.data);
      setStatus(outcome.status ?? null);
      setError(outcome.error ?? null);
      setReviewLink(outcome.review === true);
    }
    await load(offset);
    setBusy(false);
    rowsHeadingRef.current?.focus();
  }

  const saveRow = (row: BatchRow, changes: BatchEdit) =>
    run(
      () => editRows(batchId, [row.id], changes),
      (data) => ({ status: data.updated > 0 ? 'Saved.' : undefined, error: data.skipped.length > 0 ? failureText(data.skipped) : undefined }),
    );

  const deleteOne = (row: BatchRow) =>
    run(
      () => deleteRows(batchId, [row.id]),
      (data) => ({
        status: data.deleted > 0 ? `Deleted.${data.counterEntriesRemoved > 0 ? ' The payment it had recorded on the other account was removed too.' : ''}` : undefined,
        error: data.skipped.length > 0 ? failureText(data.skipped) : undefined,
      }),
    );

  const linkOne = (row: BatchRow, candidate: TransferCandidateView) =>
    run(
      () => linkTransfer([row.id, candidate.transaction.id], candidate.kind),
      () => ({ status: `Linked with ${candidate.transaction.account_label}. The pair no longer counts as spending or income.` }),
    );

  // A payment the transfer feature recorded on the other account exists only for this link, so it
  // goes with it (as Undo does); a real transaction on the other side is just unlinked.
  const unlinkOne = (row: BatchRow) =>
    run(
      () => unlinkTransfer(row.transfer_group_id ?? '', row.transfer_partner?.source === 'transfer'),
      (data) => ({
        status:
          data.removed.length > 0
            ? `Unlinked, and the payment recorded on ${row.transfer_partner?.account_label ?? 'the other account'} was removed. This row counts as spending or income again.`
            : 'Unlinked. Both transactions count as spending and income again.',
      }),
    );

  const chosen = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected]);
  const chosenIds = chosen.map((row) => row.id);

  const applyBulk = (changes: BatchEdit, what: string) =>
    run(
      () => editRows(batchId, chosenIds, changes),
      (data) => ({
        status: data.updated > 0 ? `${plural(data.updated, 'row', 'rows')} updated: ${what}.` : undefined,
        error: data.skipped.length > 0 ? failureText(data.skipped) : undefined,
      }),
    );

  const deleteChosen = () =>
    run(
      () => deleteRows(batchId, chosenIds),
      (data) => {
        setSelected(new Set());
        return {
          status: data.deleted > 0 ? `${plural(data.deleted, 'row', 'rows')} deleted.` : undefined,
          error: data.skipped.length > 0 ? failureText(data.skipped) : undefined,
        };
      },
    );

  const rerunMatching = () =>
    run(
      () => rematch(batchId),
      (data) => {
        const parts = [
          data.linked > 0
            ? `Linked ${plural(data.linked, 'transfer', 'transfers')}.`
            : 'No new clear transfers were found.',
        ];
        if (data.toReview > 0) parts.push(`${plural(data.toReview, 'possible pair needs', 'possible pairs need')} a look on the Review page.`);
        return { status: parts.join(' '), error: data.failed.length > 0 ? failureText(data.failed) : undefined, review: data.toReview > 0 };
      },
    );

  async function confirmUndo() {
    if (undoBusyRef.current) return;
    if (!navigator.onLine) {
      setUndoError(OFFLINE_TEXT);
      return;
    }
    undoBusyRef.current = true;
    setUndoBusy(true);
    setUndoError(null);
    const response = await undoImportBatch(batchId);
    undoBusyRef.current = false;
    setUndoBusy(false);
    if (!response.ok) {
      setUndoError(response.message);
      return;
    }
    setUndo(response.data);
    setUndoOpen(false);
    setOffset(0);
    void load(0);
  }

  const cancelUndo = useCallback(() => {
    if (undoBusyRef.current) return;
    setUndoOpen(false);
    setUndoError(null);
  }, []);

  const title = batch?.file_name?.trim() || 'Pasted text';
  const undone = batch?.status === 'undone';
  const allOnPage = rows.length > 0 && rows.every((row) => selected.has(row.id));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:py-10">
      <header className="flex items-start gap-2">
        <Link
          href="/dashboard/finance/import/history"
          aria-label="Back to Import history"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg transition hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700" aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 break-all text-2xl font-bold text-gray-900">
            <History className="h-6 w-6 shrink-0 text-fuchsia-600" aria-hidden="true" />
            {batch ? title : 'Import'}
          </h1>
          {batch && (
            <div className="mt-1 space-y-1 text-sm text-gray-700">
              <p>
                {accountLabel(batch.financial_accounts)} · imported {formatDay(batch.created_at)} at{' '}
                {formatTime(batch.created_at, clockFormat)}
              </p>
              <p>
                {batch.inserted_count.toLocaleString('en-US')} added · {batch.linked_count.toLocaleString('en-US')} linked ·{' '}
                {batch.duplicate_count.toLocaleString('en-US')} duplicates · {batch.invalid_count.toLocaleString('en-US')} rejected,
                of {batch.row_count.toLocaleString('en-US')} rows
              </p>
              <StatusChip tone={undone ? 'neutral' : 'success'}>
                {undone ? `Undone${batch.undone_at ? ` on ${formatDay(batch.undone_at)}` : ''}` : 'Imported'}
              </StatusChip>
            </div>
          )}
        </div>
      </header>

      {loading && !batch && (
        <p role="status" className="flex items-center gap-2 text-sm text-gray-700">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading the import...
        </p>
      )}
      {loadError && (
        <ErrorNotice>
          <p>{loadError}</p>
        </ErrorNotice>
      )}
      {error && (
        <ErrorNotice>
          <p>{error}</p>
        </ErrorNotice>
      )}
      {status && (
        <StatusNotice tone="success">
          <p>{status}</p>
          {reviewLink && (
            <Link href="/dashboard/finance/review" className={textLink}>
              Open the Review page
            </Link>
          )}
        </StatusNotice>
      )}
      {undo && <UndoSummary undo={undo} />}

      {batch && !undone && (
        <section aria-label="Actions for this import" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={() => void rerunMatching()} disabled={busy || !online} className={primaryButton}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Re-run transfer matching
          </button>
          <Link href={`/dashboard/finance/transactions?batch=${encodeURIComponent(batchId)}`} className={secondaryButton}>
            View on the Transactions page
          </Link>
          <button
            type="button"
            onClick={() => {
              setUndoError(null);
              setUndoOpen(true);
            }}
            disabled={busy || !online}
            className={dangerButton}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Undo this import
          </button>
        </section>
      )}

      {batch && !undone && (
        <p className="text-sm text-gray-700">
          Re-run transfer matching after you import the other account&rsquo;s statement: this import&rsquo;s rows are
          checked again for transfers, clear ones are linked, and the rest wait on the Review page. A row you change
          here is kept if you undo this import later.
        </p>
      )}

      {batch && undone && (
        <StatusNotice tone="info">
          <p>This import was undone, so it has no rows left to edit. Rows that were edited before the undo stay in your transactions.</p>
        </StatusNotice>
      )}

      {batch && (rows.length > 0 || total > 0) && (
        <section aria-labelledby="batch-rows-heading" className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 id="batch-rows-heading" ref={rowsHeadingRef} tabIndex={-1} className="text-lg font-semibold text-gray-900">
            Rows of this import ({total.toLocaleString('en-US')})
          </h2>

          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={allOnPage}
                onChange={(event) => setSelected(event.target.checked ? new Set(rows.map((row) => row.id)) : new Set())}
                disabled={busy}
                className="h-5 w-5 rounded border-gray-400 text-sky-700"
              />
              Select all on this page
              {chosen.length > 0 && <span className="text-gray-600">({chosen.length.toLocaleString('en-US')} selected)</span>}
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <label htmlFor="bulk-category" className={fieldLabel}>
                  Category for the selected
                </label>
                <select id="bulk-category" value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)} disabled={busy} className={selectInput}>
                  <option value="">Choose...</option>
                  <option value={NO_CATEGORY}>No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    void applyBulk(
                      { category_id: bulkCategory === NO_CATEGORY ? null : bulkCategory },
                      bulkCategory === NO_CATEGORY ? 'no category' : (categories.find((c) => c.id === bulkCategory)?.name ?? 'category'),
                    )
                  }
                  disabled={busy || !online || chosen.length === 0 || !bulkCategory}
                  className={secondaryButton}
                >
                  Set category
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="bulk-type" className={fieldLabel}>
                  Type for the selected
                </label>
                <select id="bulk-type" value={bulkType} onChange={(event) => setBulkType(event.target.value)} disabled={busy} className={selectInput}>
                  <option value="">Choose...</option>
                  <option value="expense">Expense (money out)</option>
                  <option value="income">Income (money in)</option>
                </select>
                <button
                  type="button"
                  onClick={() => void applyBulk({ type: bulkType === 'income' ? 'income' : 'expense' }, bulkType === 'income' ? 'income' : 'expense')}
                  disabled={busy || !online || chosen.length === 0 || !bulkType}
                  className={secondaryButton}
                >
                  Set type
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="bulk-vendor" className={fieldLabel}>
                  Vendor for the selected
                </label>
                <input
                  id="bulk-vendor"
                  type="text"
                  value={bulkVendor}
                  maxLength={200}
                  onChange={(event) => setBulkVendor(event.target.value)}
                  disabled={busy}
                  className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900"
                />
                <button
                  type="button"
                  onClick={() => void applyBulk({ vendor: bulkVendor.trim() || null }, bulkVendor.trim() ? `vendor ${bulkVendor.trim()}` : 'vendor cleared')}
                  disabled={busy || !online || chosen.length === 0}
                  className={secondaryButton}
                >
                  Set vendor
                </button>
              </div>
            </div>
            {confirmBulkDelete ? (
              <div role="group" aria-label="Delete the selected rows?" className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <p className="text-sm text-gray-800">
                  Delete {plural(chosen.length, 'row', 'rows')}? Entries you made that the import only linked are kept.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmBulkDelete(false);
                    void deleteChosen();
                  }}
                  disabled={busy || !online}
                  className={dangerButton}
                >
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmBulkDelete(false)} className={secondaryButton}>
                  Keep them
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(true)}
                disabled={busy || !online || chosen.length === 0}
                className={`${dangerButton} sm:self-start`}
              >
                Delete selected{chosen.length > 0 ? ` (${chosen.length})` : ''}
              </button>
            )}
          </div>

          <ul role="list" className="divide-y divide-gray-100">
            {rows.map((row) => (
              <BatchRowItem
                key={`${row.id}:${row.vendor ?? ''}:${row.type}:${row.category_id ?? ''}:${row.transfer_group_id ?? ''}`}
                row={row}
                categories={categories}
                selected={selected.has(row.id)}
                onSelect={(on) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (on) next.add(row.id);
                    else next.delete(row.id);
                    return next;
                  })
                }
                busy={busy}
                online={online}
                onSave={(target, changes) => void saveRow(target, changes)}
                onDelete={(target) => void deleteOne(target)}
                onLink={(target, candidate) => void linkOne(target, candidate)}
                onUnlink={(target) => void unlinkOne(target)}
              />
            ))}
          </ul>

          {total > PAGE_SIZE && (
            <nav aria-label="Rows: pages" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-700">
                Showing {(offset + 1).toLocaleString('en-US')} to {Math.min(offset + PAGE_SIZE, total).toLocaleString('en-US')} of{' '}
                {total.toLocaleString('en-US')}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setSelected(new Set());
                    setOffset(Math.max(0, offset - PAGE_SIZE));
                  }}
                  disabled={busy || loading || offset === 0}
                  className={secondaryButton}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous {PAGE_SIZE}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(new Set());
                    setOffset(offset + PAGE_SIZE);
                  }}
                  disabled={busy || loading || offset + PAGE_SIZE >= total}
                  className={secondaryButton}
                >
                  Next {PAGE_SIZE}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </nav>
          )}
        </section>
      )}

      <UndoImportDialog
        target={undoOpen ? `${title}, imported into ${accountLabel(batch?.financial_accounts)}` : null}
        busy={undoBusy}
        error={undoError}
        online={online}
        onConfirm={confirmUndo}
        onCancel={cancelUndo}
      />
    </div>
  );
}
