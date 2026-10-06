'use client';

// components/finance/import/ImportHistory.tsx
// Every statement import the person has run, newest first, each with its
// counts and an Undo. Shown under step 1 (to undo an earlier import without
// running a new one) and under step 4.

import Link from 'next/link';
import { Loader2, RotateCcw } from 'lucide-react';
import { formatTime, useClockFormat } from '@/lib/hooks/useClockFormat';
import type { ImportBatchSummary } from '@/lib/finance/csv-import/service';
import type { UndoResult } from '@/lib/finance/csv-import/types';
import { accountLabel } from '@/lib/finance/csv-import/ui-helpers';
import UndoSummary from './UndoSummary';
import { ErrorNotice, StatusChip, dangerButton, secondaryButton } from './shared';

interface ImportHistoryProps {
  batches: ImportBatchSummary[];
  state: 'loading' | 'ready' | 'error';
  error: string | null;
  onRetry: () => void;
  onUndo: (batch: ImportBatchSummary) => void;
  /** The outcome of the last undo started from this list, shown above it. */
  undo: UndoResult | null;
  online: boolean;
}

const formatCount = (n: number): string => (Number(n) || 0).toLocaleString('en-US');

/** The day a timestamp falls on where the person is: "Oct 4, 2026". */
function formatDay(timestamp: string | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** How an import is named in the list and in the undo dialog. */
export function batchTitle(batch: Pick<ImportBatchSummary, 'file_name'>): string {
  return batch.file_name?.trim() || 'Pasted text';
}

export default function ImportHistory({ batches, state, error, onRetry, onUndo, undo, online }: ImportHistoryProps) {
  const clockFormat = useClockFormat();

  return (
    <section aria-labelledby="import-history-heading" className="space-y-3">
      <h2 id="import-history-heading" className="text-lg font-semibold text-gray-900">
        Import history
      </h2>

      {undo && <UndoSummary undo={undo} />}

      {state === 'loading' && (
        <p role="status" className="flex items-center gap-2 text-sm text-gray-700">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading your imports...
        </p>
      )}

      {state === 'error' && (
        <div className="space-y-3">
          <ErrorNotice>
            <p>{error ?? 'Your imports could not be loaded.'}</p>
          </ErrorNotice>
          <button type="button" onClick={onRetry} disabled={!online} className={secondaryButton}>
            Try again
          </button>
        </div>
      )}

      {state === 'ready' && batches.length === 0 && (
        <p className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-700">
          No statement imports yet. Each import you run is listed here, and can be undone.
        </p>
      )}

      {state === 'ready' && batches.length > 0 && (
        <ul role="list" className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {batches.map((batch) => {
            const undone = batch.status === 'undone';
            const title = batchTitle(batch);
            const day = formatDay(batch.created_at);
            return (
              <li key={batch.id} className="px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-all font-medium text-gray-900">{title}</p>
                      <StatusChip tone={undone ? 'neutral' : 'success'}>
                        {undone ? `Undone${batch.undone_at ? ` on ${formatDay(batch.undone_at)}` : ''}` : 'Imported'}
                      </StatusChip>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-700">{accountLabel(batch.financial_accounts)}</p>
                    <p className="text-xs text-gray-600">
                      {day}
                      {day ? ` at ${formatTime(batch.created_at, clockFormat)}` : ''}
                    </p>
                    <p className="mt-1 text-sm text-gray-800">
                      {formatCount(batch.inserted_count)} added · {formatCount(batch.linked_count)} linked ·{' '}
                      {formatCount(batch.duplicate_count)} duplicates · {formatCount(batch.invalid_count)} rejected, of{' '}
                      {formatCount(batch.row_count)} {Number(batch.row_count) === 1 ? 'row' : 'rows'}
                    </p>
                  </div>

                  {!undone && (
                    <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
                      <Link
                        href={`/dashboard/finance/transactions?batch=${encodeURIComponent(batch.id)}`}
                        className={secondaryButton}
                        aria-label={`View the transactions from ${title}, imported ${day}`}
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => onUndo(batch)}
                        disabled={!online}
                        aria-label={`Undo the import of ${title} from ${day}`}
                        className={dangerButton}
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        Undo
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
