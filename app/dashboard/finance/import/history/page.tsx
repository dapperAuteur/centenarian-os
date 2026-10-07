'use client';

// app/dashboard/finance/import/history/page.tsx
// Import history: every statement import, newest first (up to 200), with the
// date, account, file, counts and status. Open one to see its rows and edit
// them (./[id]/page.tsx); View lists them on the Transactions page; Undo works
// as on the Import page.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, History } from 'lucide-react';
import ImportHistory, { batchTitle } from '@/components/finance/import/ImportHistory';
import UndoImportDialog from '@/components/finance/import/UndoImportDialog';
import { undoImportBatch } from '@/components/finance/import/api';
import { listAllBatches } from '@/components/finance/import/history-api';
import { textLink } from '@/components/finance/import/shared';
import { useOnline } from '@/components/finance/import/useOnline';
import type { ImportBatchSummary } from '@/lib/finance/csv-import/service';
import type { UndoResult } from '@/lib/finance/csv-import/types';
import { OFFLINE_TEXT, accountLabel } from '@/lib/finance/csv-import/ui-helpers';
import { useTrackPageView } from '@/lib/hooks/useTrackPageView';

export default function ImportHistoryPage() {
  useTrackPageView('finance', '/dashboard/finance/import/history');
  const online = useOnline();
  const [batches, setBatches] = useState<ImportBatchSummary[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [undoTarget, setUndoTarget] = useState<{ id: string; label: string } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const undoBusyRef = useRef(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoResult | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setState('loading');
    setError(null);
    const response = await listAllBatches();
    if (!response.ok) {
      setError(response.message);
      setState('error');
      return;
    }
    setBatches(Array.isArray(response.data?.batches) ? response.data.batches : []);
    setState('ready');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cancelUndo = useCallback(() => {
    if (undoBusyRef.current) return;
    setUndoTarget(null);
    setUndoError(null);
  }, []);

  async function confirmUndo() {
    if (!undoTarget || undoBusyRef.current) return;
    if (!navigator.onLine) {
      setUndoError(OFFLINE_TEXT);
      return;
    }
    undoBusyRef.current = true;
    setUndoBusy(true);
    setUndoError(null);
    const response = await undoImportBatch(undoTarget.id);
    undoBusyRef.current = false;
    setUndoBusy(false);
    if (!response.ok) {
      setUndoError(response.message);
      return;
    }
    setUndo(response.data);
    setUndoTarget(null);
    void load(true);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:py-10">
      <header className="flex items-start gap-2">
        <Link
          href="/dashboard/finance/import"
          aria-label="Back to Import bank statement"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg transition hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700" aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <History className="h-6 w-6 shrink-0 text-fuchsia-600" aria-hidden="true" />
            Import history
          </h1>
          <p className="mt-0.5 text-sm text-gray-600">
            Every statement you imported. Open one to change its rows: category, type, vendor, transfer links, or
            delete a row. You can also check it for transfers again, or undo the whole import.
          </p>
          <nav aria-label="Related" className="mt-1 flex flex-col gap-x-5 sm:flex-row">
            <Link href="/dashboard/finance/import" className={textLink}>
              Import a statement
            </Link>
            <Link href="/dashboard/finance/review" className={textLink}>
              Review page (unfinished imports)
            </Link>
          </nav>
        </div>
      </header>

      <ImportHistory
        title="Your imports"
        showAllLink={false}
        batches={batches}
        state={state}
        error={error}
        onRetry={() => void load()}
        onUndo={(batch) => {
          setUndoError(null);
          setUndoTarget({ id: batch.id, label: `${batchTitle(batch)}, imported into ${accountLabel(batch.financial_accounts)}` });
        }}
        undo={undo}
        online={online}
      />

      <UndoImportDialog
        target={undoTarget?.label ?? null}
        busy={undoBusy}
        error={undoError}
        online={online}
        onConfirm={confirmUndo}
        onCancel={cancelUndo}
      />
    </div>
  );
}
