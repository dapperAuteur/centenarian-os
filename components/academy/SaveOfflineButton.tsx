'use client';

// components/academy/SaveOfflineButton.tsx
// Per-asset "save for offline" control. Downloads the asset URL, caches
// the blob in IndexedDB, and registers it in the server ledger so the
// storage manager (plan 25b) can show totals and purge on enrollment
// revocation. Already-cached assets show an "offline ready" state with
// a remove-from-offline action.
//
// Plan 25a scope: single asset (one 360° video or photo per lesson).
// Plan 25b will add a course-level button that batch-downloads every
// media asset under a course.

import { useCallback, useEffect, useState } from 'react';
import { Download, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { logError } from '@/lib/error-logging';
import { downloadAndCache, deleteBlob, getBlob } from '@/lib/offline/blob-store';

interface SaveOfflineButtonProps {
  assetUrl: string;
  assetKind: 'panorama_video' | 'panorama_image' | 'poster' | 'audio' | 'video' | 'image' | 'other';
  courseId?: string;
  lessonId?: string;
}

type State = 'checking' | 'uncached' | 'downloading' | 'cached' | 'removing';

// Rough Cloudinary quota sanity check — hard-refuse when the browser
// reports less than 200 MB free. The real upload can still fail later
// (browser may lie), but this catches the obvious case.
const MIN_FREE_BYTES = 200 * 1024 * 1024;

async function hasEnoughStorage(): Promise<boolean> {
  if (!('storage' in navigator) || !navigator.storage.estimate) return true;
  try {
    const est = await navigator.storage.estimate();
    if (typeof est.quota === 'number' && typeof est.usage === 'number') {
      return est.quota - est.usage > MIN_FREE_BYTES;
    }
  } catch {
    /* assume yes if the estimate API fails */
  }
  return true;
}

export default function SaveOfflineButton({
  assetUrl,
  assetKind,
  courseId,
  lessonId,
}: SaveOfflineButtonProps) {
  const [state, setState] = useState<State>('checking');
  const toast = useToast();

  const checkCached = useCallback(async () => {
    const blob = await getBlob(assetUrl).catch(() => null);
    setState(blob ? 'cached' : 'uncached');
  }, [assetUrl]);

  useEffect(() => {
    checkCached();
  }, [checkCached]);

  async function handleSave() {
    if (!(await hasEnoughStorage())) {
      toast.error('Not enough storage left on this device to save this asset offline.');
      return;
    }
    setState('downloading');
    try {
      const blob = await downloadAndCache(assetUrl);
      // Register in the server ledger — fire-and-forget is fine since the
      // blob is already safely in IndexedDB at this point.
      fetch('/api/offline/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_url: assetUrl,
          asset_kind: assetKind,
          course_id: courseId,
          lesson_id: lessonId,
          size_bytes: blob.size,
        }),
      }).catch((err) => {
        logError(err, { module: 'SaveOfflineButton', context: { op: 'register' } });
      });
      setState('cached');
      toast.success('Saved for offline viewing');
    } catch (err) {
      logError(err, { module: 'SaveOfflineButton', context: { op: 'download', assetUrl } });
      toast.error('Could not save for offline. Try again.');
      setState('uncached');
    }
  }

  async function handleRemove() {
    setState('removing');
    try {
      await deleteBlob(assetUrl);
      fetch('/api/offline/assets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_url: assetUrl }),
      }).catch((err) => {
        logError(err, { module: 'SaveOfflineButton', context: { op: 'unregister' } });
      });
      setState('uncached');
      toast.info('Removed from offline storage');
    } catch (err) {
      logError(err, { module: 'SaveOfflineButton', context: { op: 'remove' } });
      toast.error('Could not remove from offline. Try again.');
      setState('cached');
    }
  }

  if (state === 'checking') {
    // Don't render a button until we know the cache state — avoids a
    // flash of "Save" → "Remove" on page load for already-cached assets.
    return null;
  }

  if (state === 'cached' || state === 'removing') {
    return (
      <button
        type="button"
        onClick={handleRemove}
        disabled={state === 'removing'}
        className="min-h-11 inline-flex items-center gap-2 px-3 py-2 text-xs bg-green-900/40 border border-green-800 rounded-lg text-green-300 hover:bg-green-900/60 transition disabled:opacity-50"
        title="Remove from offline storage"
      >
        {state === 'removing' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{state === 'removing' ? 'Removing…' : 'Saved offline'}</span>
        <span className="sm:hidden">{state === 'removing' ? 'Removing' : 'Saved'}</span>
        <Trash2 className="w-3.5 h-3.5 opacity-60" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={state === 'downloading'}
      className="min-h-11 inline-flex items-center gap-2 px-3 py-2 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-200 hover:bg-gray-700 transition disabled:opacity-50"
      title="Download this asset so it plays without internet"
    >
      {state === 'downloading' ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
      )}
      {state === 'downloading' ? 'Saving…' : 'Save for offline'}
    </button>
  );
}
