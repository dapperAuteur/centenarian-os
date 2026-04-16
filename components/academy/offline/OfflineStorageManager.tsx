'use client';

// components/academy/offline/OfflineStorageManager.tsx
// Learner-facing storage manager. Lists every asset this browser has
// cached for offline viewing, grouped by course, with the ability to
// purge individual assets, a whole course group, or everything. Also
// surfaces browser-reported quota vs. usage so learners can see whether
// they're close to the device's limit before trying to save more.
//
// Reconciles two sources: the IndexedDB blob-store (bytes on device)
// and the /api/offline/assets ledger (server record). See
// lib/offline/storage-usage.ts for the merge/grouping logic.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { HardDrive, Trash2, AlertTriangle, Loader2, RefreshCw, Film, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { logError } from '@/lib/error-logging';
import {
  formatBytes,
  getStorageSummary,
  purgeAsset,
  purgeCourseGroup,
  type CourseGroup,
  type MergedAsset,
  type StorageSummary,
} from '@/lib/offline/storage-usage';

interface CourseMeta {
  id: string;
  title: string;
}

export default function OfflineStorageManager() {
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [courseMeta, setCourseMeta] = useState<Record<string, CourseMeta>>({});
  const [loading, setLoading] = useState(true);
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const [busyCourseId, setBusyCourseId] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, coursesRes] = await Promise.all([
        getStorageSummary(),
        fetch('/api/academy/my-courses', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);
      setSummary(s);
      const meta: Record<string, CourseMeta> = {};
      for (const c of coursesRes as Array<{ id: string; title: string }>) {
        meta[c.id] = { id: c.id, title: c.title };
      }
      setCourseMeta(meta);
    } catch (err) {
      logError(err, { module: 'OfflineStorageManager', context: { op: 'load' } });
      toast.error('Could not load offline storage details. Try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePurgeAsset = useCallback(
    async (asset: MergedAsset) => {
      setBusyUrl(asset.asset_url);
      try {
        await purgeAsset(asset.asset_url);
        toast.info('Removed from offline storage');
        await load();
      } catch (err) {
        logError(err, { module: 'OfflineStorageManager', context: { op: 'purge-asset' } });
        toast.error('Could not remove that asset. Try again.');
      } finally {
        setBusyUrl(null);
      }
    },
    [toast, load],
  );

  const handlePurgeCourse = useCallback(
    async (group: CourseGroup) => {
      setBusyCourseId(group.course_id ?? '__other__');
      try {
        await purgeCourseGroup(group.assets);
        toast.info(`Freed ${formatBytes(group.total_bytes)} from offline storage`);
        await load();
      } catch (err) {
        logError(err, { module: 'OfflineStorageManager', context: { op: 'purge-course' } });
        toast.error('Could not remove all assets. Some may remain cached.');
      } finally {
        setBusyCourseId(null);
      }
    },
    [toast, load],
  );

  const quotaPct = useMemo(() => {
    if (!summary?.quota_bytes || !summary?.usage_bytes) return null;
    return Math.min(100, Math.round((summary.usage_bytes / summary.quota_bytes) * 100));
  }, [summary]);

  if (loading && !summary) {
    return (
      <div role="status" className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" />
        Loading offline storage…
      </div>
    );
  }

  if (!summary || summary.total_assets === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
        <HardDrive className="w-10 h-10 text-gray-600 mx-auto mb-3" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-white mb-2">Nothing saved for offline yet</h2>
        <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
          Open a 360° video or photo lesson and tap <span className="text-gray-200">&ldquo;Save for offline&rdquo;</span> to
          cache it on this device. Saved lessons play without an internet connection.
        </p>
        <Link
          href="/academy"
          className="min-h-11 inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-medium rounded-lg transition"
        >
          Browse Academy
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-sky-400" aria-hidden="true" />
              Offline storage on this device
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {summary.total_assets} saved {summary.total_assets === 1 ? 'asset' : 'assets'} —
              {' '}{formatBytes(summary.total_bytes)} cached
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="min-h-11 min-w-11 flex items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 transition disabled:opacity-50"
            aria-label="Refresh storage details"
            title="Refresh"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {summary.quota_bytes !== null && summary.usage_bytes !== null && (
          <div>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
              <span>Device storage used by this site</span>
              <span className="text-gray-300">
                {formatBytes(summary.usage_bytes)} / {formatBytes(summary.quota_bytes)}
              </span>
            </div>
            <div
              className="h-2 bg-gray-800 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={quotaPct ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Browser storage quota used"
            >
              <div
                className={`h-full transition-all ${
                  (quotaPct ?? 0) > 85 ? 'bg-red-500' : (quotaPct ?? 0) > 65 ? 'bg-amber-500' : 'bg-sky-500'
                }`}
                style={{ width: `${quotaPct ?? 0}%` }}
              />
            </div>
            {(quotaPct ?? 0) > 85 && (
              <p className="text-xs text-red-300 mt-2 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                You&rsquo;re close to your browser&rsquo;s storage limit. Remove some lessons below to make room.
              </p>
            )}
          </div>
        )}

        {(summary.orphan_blob_count > 0 || summary.orphan_ledger_count > 0) && (
          <div className="mt-4 flex items-start gap-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-900/60 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              {summary.orphan_blob_count > 0 && (
                <p>{summary.orphan_blob_count} cached {summary.orphan_blob_count === 1 ? 'asset isn&rsquo;t' : 'assets aren&rsquo;t'} registered with your account.</p>
              )}
              {summary.orphan_ledger_count > 0 && (
                <p>{summary.orphan_ledger_count} registered {summary.orphan_ledger_count === 1 ? 'asset is' : 'assets are'} missing from this device (possibly cleared).</p>
              )}
              <p className="text-amber-300/80 mt-1">Use the remove buttons to clean up.</p>
            </div>
          </div>
        )}
      </div>

      {/* Per-course groups */}
      <div className="space-y-4">
        {summary.groups.map((group) => {
          const courseId = group.course_id;
          const meta = courseId ? courseMeta[courseId] : null;
          const title = meta?.title ?? (courseId ? 'Course no longer available' : 'Not linked to a course');
          const groupKey = courseId ?? '__other__';
          const isPurging = busyCourseId === groupKey;
          return (
            <section
              key={groupKey}
              className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
              aria-label={`Offline assets for ${title}`}
            >
              <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-800">
                <div className="min-w-0">
                  {courseId && meta ? (
                    <Link
                      href={`/academy/${courseId}`}
                      className="text-sm sm:text-base font-semibold text-white hover:text-fuchsia-300 transition truncate block"
                    >
                      {title}
                    </Link>
                  ) : (
                    <p className="text-sm sm:text-base font-semibold text-gray-200 truncate">{title}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">
                    {group.assets.length} {group.assets.length === 1 ? 'asset' : 'assets'} — {formatBytes(group.total_bytes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePurgeCourse(group)}
                  disabled={isPurging}
                  className="min-h-11 inline-flex items-center gap-2 px-3 py-2 text-xs bg-red-900/40 border border-red-800/70 rounded-lg text-red-200 hover:bg-red-900/60 transition disabled:opacity-50"
                >
                  {isPurging ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  {isPurging ? 'Removing…' : 'Remove all'}
                </button>
              </header>
              <ul className="divide-y divide-gray-800" role="list">
                {group.assets.map((asset) => (
                  <AssetRow
                    key={asset.asset_url}
                    asset={asset}
                    onPurge={handlePurgeAsset}
                    busy={busyUrl === asset.asset_url}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

interface AssetRowProps {
  asset: MergedAsset;
  onPurge: (asset: MergedAsset) => void;
  busy: boolean;
}

function AssetRow({ asset, onPurge, busy }: AssetRowProps) {
  const kindLabel = kindToLabel(asset.asset_kind);
  const Icon = kindToIcon(asset.asset_kind);
  const missingBlob = !asset.has_blob;
  const missingLedger = !asset.has_ledger;
  const filename = asset.asset_url.split('/').pop()?.split('?')[0] ?? asset.asset_url;

  return (
    <li className="flex items-center gap-3 px-4 sm:px-5 py-3">
      <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400 shrink-0">
        <Icon className="w-4 h-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-100 truncate" title={asset.asset_url}>
          {filename}
        </p>
        <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
          <span>{kindLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{formatBytes(asset.size_bytes)}</span>
          {missingBlob && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400">not on device</span>
            </>
          )}
          {missingLedger && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400">not registered</span>
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onPurge(asset)}
        disabled={busy}
        className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-300 hover:bg-red-900/30 transition disabled:opacity-50"
        aria-label={`Remove ${filename} from offline storage`}
        title="Remove"
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
    </li>
  );
}

function kindToLabel(kind: string | null): string {
  switch (kind) {
    case 'panorama_video': return '360° video';
    case 'panorama_image': return '360° photo';
    case 'poster': return 'Poster image';
    case 'audio': return 'Audio';
    case 'video': return 'Video';
    case 'image': return 'Image';
    default: return 'Media';
  }
}

function kindToIcon(kind: string | null) {
  if (kind === 'panorama_video' || kind === 'video') return Film;
  return ImageIcon;
}
