'use client';

import { WifiOff, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useSyncContext } from '@/lib/contexts/SyncContext';

/**
 * Enhanced offline / sync-status banner.
 *
 * States:
 * - Offline:     amber  — "You're offline" + pending count
 * - Syncing:     sky    — "Syncing N changes..."
 * - Just synced: lime   — "All changes synced" (auto-dismiss 3 s)
 * - Failed:      red    — "N changes failed" + Retry button
 * - Online+clean: null  — hidden
 */
export default function OfflineIndicator() {
  const { isOffline, pending, failed, isSyncing, justSynced, forceSync } =
    useSyncContext();

  const total = pending + failed;

  // ── Offline ────────────────────────────────────────────────────────
  if (isOffline) {
    return (
      <div className="bg-amber-500 text-white text-sm text-center px-4 py-2 flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span>You&apos;re offline</span>
        {total > 0 && (
          <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-white/25 text-xs font-semibold tabular-nums">
            {total} pending
          </span>
        )}
      </div>
    );
  }

  // ── Failed syncs ───────────────────────────────────────────────────
  if (failed > 0) {
    return (
      <div className="bg-red-500 text-white text-sm text-center px-4 py-2 flex items-center justify-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>
          {failed} change{failed !== 1 ? 's' : ''} failed to sync
        </span>
        <button
          onClick={forceSync}
          className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition text-xs font-medium"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  // ── Actively syncing ───────────────────────────────────────────────
  if (isSyncing && pending > 0) {
    return (
      <div className="bg-sky-500 text-white text-sm text-center px-4 py-2 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
        <span>
          Syncing {pending} change{pending !== 1 ? 's' : ''}&hellip;
        </span>
      </div>
    );
  }

  // ── Just synced (auto-dismisses after 3 s via context) ─────────────
  if (justSynced) {
    return (
      <div className="bg-lime-500 text-white text-sm text-center px-4 py-2 flex items-center justify-center gap-2">
        <CheckCircle className="w-4 h-4 shrink-0" />
        <span>All changes synced</span>
      </div>
    );
  }

  // ── Online & clean — hide ─────────────────────────────────────────
  return null;
}
