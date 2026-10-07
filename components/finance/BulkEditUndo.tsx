'use client';

// components/finance/BulkEditUndo.tsx
// "Undo last bulk edit": shows the most recent bulk edit that can still be
// undone (GET /api/finance/transactions/bulk/undo) and undoes it to the end
// with progress. Rows changed since the edit are left as they are, and the
// result says how many. Before migration 220 it says to run the migration.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Undo2 } from 'lucide-react';
import { runUndo } from '@/lib/finance/bulk-edit/client';
import { formatTime, useClockFormat } from '@/lib/hooks/useClockFormat';

interface Operation {
  id: string;
  summary: string | null;
  row_count: number;
  created_at: string;
}

interface Status {
  available: boolean;
  message?: string;
  operation: Operation | null;
}

interface BulkEditUndoProps {
  /** Bump to look again (after an edit). */
  refreshKey?: number;
  /** Called after an undo changed something, so the page can reload. */
  onUndone?: () => void;
  /** Show the migration notice (the Find similar panel does; the plain list doesn't need to). */
  showNotMigrated?: boolean;
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}

export default function BulkEditUndo({ refreshKey = 0, onUndone, showNotMigrated = true }: BulkEditUndoProps) {
  const clockFormat = useClockFormat();
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/transactions/bulk/undo', { cache: 'no-store' });
      if (!res.ok) return;
      setStatus((await res.json()) as Status);
    } catch {
      /* offline: nothing to offer */
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleUndo = async () => {
    const op = status?.operation;
    if (!op) return;
    setRunning(true);
    setProgress(0);
    setError(null);
    setResult(null);
    const outcome = await runUndo(op.id, setProgress);
    const t = outcome.totals;
    const leftAlone = t.changed + t.missing + t.pairChanged + t.failed;
    const parts = [`Put back ${plural(t.restored, 'transaction')}.`];
    if (t.changed > 0) parts.push(`${plural(t.changed, 'transaction')} changed since the edit ${t.changed === 1 ? 'was' : 'were'} left as ${t.changed === 1 ? 'it is' : 'they are'}.`);
    if (t.missing > 0) parts.push(`${plural(t.missing, 'transaction')} no longer ${t.missing === 1 ? 'exists' : 'exist'}.`);
    if (t.pairChanged > 0) parts.push(`${plural(t.pairChanged, 'transfer side')} stayed unlinked because the other side changed.`);
    if (t.failed > 0) parts.push(`${plural(t.failed, 'transaction')} could not be put back (a category or brand may have been deleted).`);
    if (outcome.ok) setResult(parts.join(' '));
    else setError(`${outcome.error} ${t.restored > 0 ? parts[0] : ''}`.trim());
    setRunning(false);
    if (t.restored > 0 || leftAlone > 0) onUndone?.();
    load();
  };

  if (!status) return null;

  if (!status.available) {
    if (!showNotMigrated) return null;
    return (
      <p role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
        {status.message ?? 'Run migration 220 first. Bulk edits still work, but they cannot be undone.'}
      </p>
    );
  }

  const op = status.operation;
  if (!op && !result && !error) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700 space-y-2">
      {op && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <p className="flex-1 min-w-0">
            <span className="font-medium text-gray-900">Last bulk edit:</span>{' '}
            {op.summary || 'Bulk edit'} · {plural(op.row_count, 'transaction')} ·{' '}
            {new Date(op.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
            {formatTime(op.created_at, clockFormat)}
          </p>
          <button
            type="button"
            onClick={handleUndo}
            disabled={running}
            className="min-h-11 px-4 rounded-lg border border-sky-200 bg-white text-sky-800 text-sm font-medium hover:bg-sky-50 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Undo2 className="w-4 h-4" aria-hidden="true" />}
            Undo last bulk edit
          </button>
        </div>
      )}
      {running && (
        <p role="status" className="text-xs text-gray-600">Putting back… {progress.toLocaleString()} so far</p>
      )}
      {result && <p role="status" className="text-xs text-gray-700">{result}</p>}
      {error && (
        <p role="alert" className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</p>
      )}
    </div>
  );
}
