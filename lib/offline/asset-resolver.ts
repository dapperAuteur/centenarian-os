'use client';

// lib/offline/asset-resolver.ts
// Resolve a content URL to something the <img>/PSV can actually render.
// Checks the IndexedDB blob store first; if a cached blob exists, returns
// an object URL pointing at it (served locally, works offline). Otherwise
// returns the original URL unchanged so the network path still works.
//
// Callers should release the object URL when the element unmounts via
// URL.revokeObjectURL() — exposed here as releaseResolvedUrl() so the
// component doesn't have to remember to check whether the URL was cached.

import { getBlob } from './blob-store';

const BLOB_URL_PREFIX = 'blob:';

/**
 * Returns a URL safe to pass to <img src> / PSV panorama. If the original
 * URL has a cached blob locally, the returned URL is a blob:... handle
 * that works offline. Otherwise the original is returned unchanged.
 */
export async function resolveAssetUrl(originalUrl: string): Promise<string> {
  if (!originalUrl) return originalUrl;
  try {
    const cached = await getBlob(originalUrl);
    if (cached) return URL.createObjectURL(cached);
  } catch {
    // IndexedDB unavailable or errored — fall through to the original URL.
  }
  return originalUrl;
}

/**
 * Release an object URL returned by resolveAssetUrl. No-op if the URL
 * wasn't a blob handle. Call on component unmount to avoid leaking
 * memory across page transitions.
 */
export function releaseResolvedUrl(resolved: string | null | undefined): void {
  if (!resolved) return;
  if (resolved.startsWith(BLOB_URL_PREFIX)) {
    URL.revokeObjectURL(resolved);
  }
}
