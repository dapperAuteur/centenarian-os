'use client';

// lib/offline/storage-usage.ts
// Aggregates the two sources of truth for offline-cached media:
//   1. IndexedDB blob-store — the actual bytes on this device
//   2. /api/offline/assets    — the server ledger of what's been saved
// and presents a merged view so the storage manager can show totals,
// per-course breakdowns, and reconcile drift between the two.
//
// Drift shows up as:
//   - ledger row with no local blob (user cleared site data on another
//     browser, or ledger was never cleaned up after a blob deletion)
//   - local blob with no ledger row (the POST to register failed — rare,
//     but a fire-and-forget fetch can drop). We call these "orphans"
//     and let the UI offer to purge them.

import { deleteBlob, listBlobs } from './blob-store';

export interface LedgerAsset {
  id: string;
  user_id: string;
  course_id: string | null;
  lesson_id: string | null;
  asset_url: string;
  asset_kind: string;
  size_bytes: number | null;
  downloaded_at: string;
  expires_at: string | null;
}

export interface MergedAsset {
  asset_url: string;
  size_bytes: number;
  course_id: string | null;
  lesson_id: string | null;
  asset_kind: string | null;
  cached_at: number | null;
  downloaded_at: string | null;
  /** true when a local blob exists in IndexedDB for this URL. */
  has_blob: boolean;
  /** true when a server ledger row exists for this URL. */
  has_ledger: boolean;
}

export interface CourseGroup {
  course_id: string | null;
  assets: MergedAsset[];
  total_bytes: number;
}

export interface StorageSummary {
  groups: CourseGroup[];
  total_bytes: number;
  total_assets: number;
  orphan_blob_count: number;
  orphan_ledger_count: number;
  quota_bytes: number | null;
  usage_bytes: number | null;
}

async function fetchLedger(): Promise<LedgerAsset[]> {
  try {
    const res = await fetch('/api/offline/assets', { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.assets) ? json.assets : [];
  } catch {
    return [];
  }
}

async function fetchQuota(): Promise<{ quota: number | null; usage: number | null }> {
  if (typeof navigator === 'undefined' || !('storage' in navigator) || !navigator.storage.estimate) {
    return { quota: null, usage: null };
  }
  try {
    const est = await navigator.storage.estimate();
    return {
      quota: typeof est.quota === 'number' ? est.quota : null,
      usage: typeof est.usage === 'number' ? est.usage : null,
    };
  } catch {
    return { quota: null, usage: null };
  }
}

/**
 * Build the merged summary. Always returns a usable object — missing
 * data (SSR, IndexedDB blocked, fetch failed) collapses to empty
 * arrays/zeros rather than throwing.
 */
export async function getStorageSummary(): Promise<StorageSummary> {
  const [blobs, ledger, quota] = await Promise.all([listBlobs(), fetchLedger(), fetchQuota()]);

  const blobByUrl = new Map(blobs.map((b) => [b.url, b]));
  const ledgerByUrl = new Map(ledger.map((l) => [l.asset_url, l]));
  const allUrls = new Set<string>([...blobByUrl.keys(), ...ledgerByUrl.keys()]);

  const merged: MergedAsset[] = [];
  let orphanBlobs = 0;
  let orphanLedger = 0;

  for (const url of allUrls) {
    const blob = blobByUrl.get(url);
    const led = ledgerByUrl.get(url);
    if (blob && !led) orphanBlobs++;
    if (!blob && led) orphanLedger++;
    // Prefer the blob's true size when present; the ledger's size_bytes
    // is just what the client reported at save time.
    const size = blob?.size ?? led?.size_bytes ?? 0;
    merged.push({
      asset_url: url,
      size_bytes: size,
      course_id: led?.course_id ?? null,
      lesson_id: led?.lesson_id ?? null,
      asset_kind: led?.asset_kind ?? null,
      cached_at: blob?.cached_at ?? null,
      downloaded_at: led?.downloaded_at ?? null,
      has_blob: !!blob,
      has_ledger: !!led,
    });
  }

  // Group by course_id; null course_id becomes its own bucket ("Other").
  const groupMap = new Map<string | null, MergedAsset[]>();
  for (const asset of merged) {
    const key = asset.course_id;
    const arr = groupMap.get(key) ?? [];
    arr.push(asset);
    groupMap.set(key, arr);
  }

  const groups: CourseGroup[] = Array.from(groupMap.entries())
    .map(([course_id, assets]) => ({
      course_id,
      assets: assets.sort((a, b) => (b.downloaded_at ?? '').localeCompare(a.downloaded_at ?? '')),
      total_bytes: assets.reduce((sum, a) => sum + a.size_bytes, 0),
    }))
    .sort((a, b) => b.total_bytes - a.total_bytes);

  return {
    groups,
    total_bytes: merged.reduce((sum, a) => sum + a.size_bytes, 0),
    total_assets: merged.length,
    orphan_blob_count: orphanBlobs,
    orphan_ledger_count: orphanLedger,
    quota_bytes: quota.quota,
    usage_bytes: quota.usage,
  };
}

/**
 * Remove a single cached asset from both client and server. Errors on
 * either side don't abort the other — we'd rather half-cleanup than leave
 * the user stuck on a broken row.
 */
export async function purgeAsset(assetUrl: string): Promise<void> {
  await Promise.allSettled([
    deleteBlob(assetUrl),
    fetch('/api/offline/assets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_url: assetUrl }),
    }),
  ]);
}

/** Purge every asset in a given course group (null = "Other" bucket). */
export async function purgeCourseGroup(assets: MergedAsset[]): Promise<void> {
  await Promise.all(assets.map((a) => purgeAsset(a.asset_url)));
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${v >= 10 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}
