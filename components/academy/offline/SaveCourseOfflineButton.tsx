'use client';

// components/academy/offline/SaveCourseOfflineButton.tsx
// Course-level "Save for offline" button. Walks the course's lessons,
// picks out the 360° ones (video + photo), and downloads each asset's
// main media URL plus poster (when present) into the IndexedDB blob
// store. Each download also registers a server-ledger row so the
// storage manager and enrollment-revocation purge (plan 25c) can find
// them.
//
// Works sequentially — parallel downloads of 100+ MB videos would
// thrash the network and the browser's disk cache eviction. A
// progress indicator and a cancel button give the learner control.
//
// Pre-flight: checks the browser's storage estimate and refuses when
// there is obviously not enough headroom (< 250 MB, or < 1.25× the
// optimistic size guess). Real download may still fail mid-way if
// the browser was lying about quota; in that case we stop and surface
// whatever succeeded.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2, XCircle, CheckCircle2, HardDrive } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/ToastProvider';
import { logError } from '@/lib/error-logging';
import { getBlob, putBlob } from '@/lib/offline/blob-store';
import { formatBytes } from '@/lib/offline/storage-usage';

export type OfflineLessonAsset = {
  lessonId: string;
  assetUrl: string;
  assetKind: 'panorama_video' | 'panorama_image' | 'poster';
};

interface SaveCourseOfflineButtonProps {
  courseId: string;
  /** Full list of offline-eligible assets for this course. */
  assets: OfflineLessonAsset[];
}

type Phase = 'checking' | 'idle' | 'all-cached' | 'downloading' | 'cancelling';

// Optimistic size guesses used only for the pre-flight quota check.
// Actual sizes are whatever the server returns.
const GUESS_BYTES: Record<OfflineLessonAsset['assetKind'], number> = {
  panorama_video: 150 * 1024 * 1024,
  panorama_image: 20 * 1024 * 1024,
  poster: 1 * 1024 * 1024,
};

async function storageHeadroomBytes(): Promise<number | null> {
  if (typeof navigator === 'undefined' || !('storage' in navigator) || !navigator.storage.estimate) {
    return null;
  }
  try {
    const est = await navigator.storage.estimate();
    if (typeof est.quota === 'number' && typeof est.usage === 'number') {
      return est.quota - est.usage;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export default function SaveCourseOfflineButton({ courseId, assets }: SaveCourseOfflineButtonProps) {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('checking');
  const [cachedCount, setCachedCount] = useState(0);
  const [current, setCurrent] = useState(0);
  const [bytesDone, setBytesDone] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const total = assets.length;

  const refreshCacheState = useCallback(async () => {
    if (total === 0) {
      setPhase('idle');
      setCachedCount(0);
      return;
    }
    const checks = await Promise.all(
      assets.map((a) =>
        getBlob(a.assetUrl)
          .then((b) => !!b)
          .catch(() => false),
      ),
    );
    const cached = checks.filter(Boolean).length;
    setCachedCount(cached);
    setPhase(cached === total ? 'all-cached' : 'idle');
  }, [assets, total]);

  useEffect(() => {
    refreshCacheState();
  }, [refreshCacheState]);

  const handleSaveAll = useCallback(async () => {
    cancelledRef.current = false;

    // Only download what isn't already cached. Re-check at click time so
    // a partial prior run is resumable.
    const toFetch: OfflineLessonAsset[] = [];
    for (const asset of assets) {
      const existing = await getBlob(asset.assetUrl).catch(() => null);
      if (!existing) toFetch.push(asset);
    }

    if (toFetch.length === 0) {
      setPhase('all-cached');
      return;
    }

    // Pre-flight quota check.
    const headroom = await storageHeadroomBytes();
    if (headroom !== null) {
      const guess = toFetch.reduce((n, a) => n + GUESS_BYTES[a.assetKind], 0);
      const MIN_ABSOLUTE = 250 * 1024 * 1024;
      if (headroom < Math.max(MIN_ABSOLUTE, Math.ceil(guess * 1.25))) {
        toast.error(
          `Not enough storage on this device to save the whole course. Free ~${formatBytes(
            Math.max(MIN_ABSOLUTE, Math.ceil(guess * 1.25)) - headroom,
          )} and try again.`,
        );
        return;
      }
    }

    setPhase('downloading');
    setCurrent(0);
    setBytesDone(0);

    const controller = new AbortController();
    abortRef.current = controller;

    let succeeded = 0;
    let bytesTotal = 0;

    for (let i = 0; i < toFetch.length; i++) {
      if (cancelledRef.current) break;
      const asset = toFetch[i];
      setCurrent(i);
      try {
        const res = await fetch(asset.assetUrl, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        await putBlob(asset.assetUrl, blob);
        // Register in the server ledger. Fire-and-forget — the blob is
        // already safely local, and the storage manager reconciles drift.
        fetch('/api/offline/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset_url: asset.assetUrl,
            asset_kind: asset.assetKind,
            course_id: courseId,
            lesson_id: asset.lessonId,
            size_bytes: blob.size,
          }),
        }).catch((err) => {
          logError(err, { module: 'SaveCourseOfflineButton', context: { op: 'register' } });
        });
        succeeded++;
        bytesTotal += blob.size;
        setBytesDone(bytesTotal);
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError' || cancelledRef.current) break;
        logError(err, {
          module: 'SaveCourseOfflineButton',
          context: { op: 'download', assetUrl: asset.assetUrl },
        });
        toast.error(
          `Couldn&rsquo;t save one lesson — stopped after ${succeeded}. Try again when you&rsquo;re on a stable connection.`,
        );
        break;
      }
    }

    abortRef.current = null;
    await refreshCacheState();

    if (cancelledRef.current) {
      toast.info(`Cancelled after saving ${succeeded} ${succeeded === 1 ? 'lesson' : 'lessons'}.`);
    } else if (succeeded === toFetch.length) {
      toast.success(`Saved ${succeeded} ${succeeded === 1 ? 'lesson' : 'lessons'} for offline viewing.`);
    }
    setPhase(succeeded === toFetch.length ? 'all-cached' : 'idle');
  }, [assets, courseId, refreshCacheState, toast]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setPhase('cancelling');
  }, []);

  if (total === 0 || phase === 'checking') return null;

  if (phase === 'all-cached') {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <span className="min-h-11 inline-flex items-center gap-2 px-3 py-2 text-xs bg-green-900/40 border border-green-800 rounded-lg text-green-300">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          All {total} {total === 1 ? 'asset' : 'assets'} saved offline
        </span>
        <Link
          href="/academy/offline"
          className="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 text-xs text-gray-300 hover:text-white border border-gray-700 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
        >
          <HardDrive className="w-3.5 h-3.5" aria-hidden="true" />
          Manage offline storage
        </Link>
      </div>
    );
  }

  if (phase === 'downloading' || phase === 'cancelling') {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm text-gray-200">
            <Loader2 className="w-4 h-4 animate-spin text-sky-400" aria-hidden="true" />
            Saving lesson {Math.min(current + 1, total)} of {total}
            <span className="text-gray-500">— {formatBytes(bytesDone)}</span>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={phase === 'cancelling'}
            className="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 text-xs text-red-300 hover:text-red-200 border border-red-900/60 bg-red-900/20 hover:bg-red-900/40 rounded-lg transition disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
            {phase === 'cancelling' ? 'Cancelling…' : 'Cancel'}
          </button>
        </div>
        <div
          className="h-1.5 bg-gray-800 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Download progress"
        >
          <div className="h-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  const remaining = total - cachedCount;
  return (
    <button
      type="button"
      onClick={handleSaveAll}
      className="min-h-11 inline-flex items-center gap-2 px-4 py-2 text-sm bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition"
    >
      <Download className="w-4 h-4" aria-hidden="true" />
      {cachedCount > 0
        ? `Save remaining ${remaining} ${remaining === 1 ? 'lesson' : 'lessons'} offline`
        : `Save all ${total} ${total === 1 ? 'lesson' : 'lessons'} for offline`}
    </button>
  );
}
