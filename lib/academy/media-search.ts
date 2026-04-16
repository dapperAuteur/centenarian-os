// lib/academy/media-search.ts
// Fuzzy search + tag-filter helpers for the media library. Thin wrappers
// around Fuse.js so the library UI doesn't depend on the Fuse API shape
// directly — makes it easy to swap in PG full-text later if a teacher
// ever grows a library big enough for client-side search to hurt.

import Fuse from 'fuse.js';
import type { MediaAsset } from './media-types';

const FUSE_OPTIONS: Fuse.IFuseOptions<MediaAsset> = {
  keys: [
    { name: 'name', weight: 2 },
    { name: 'description', weight: 1 },
    { name: 'tags', weight: 1.5 },
  ],
  threshold: 0.4, // 0 = exact, 1 = match everything. 0.4 is a good fuzzy default.
  ignoreLocation: true,
  minMatchCharLength: 2,
};

/**
 * Apply fuzzy search + tag filter to a list of assets. Empty query returns
 * the input unchanged; empty tag filter matches everything.
 */
export function filterAssets(
  assets: MediaAsset[],
  query: string,
  selectedTags: string[],
): MediaAsset[] {
  let filtered = assets;

  // Tag filter first (AND semantics — asset must have every selected tag)
  if (selectedTags.length > 0) {
    filtered = filtered.filter((a) => selectedTags.every((t) => a.tags.includes(t)));
  }

  const trimmed = query.trim();
  if (!trimmed) return filtered;

  const fuse = new Fuse(filtered, FUSE_OPTIONS);
  return fuse.search(trimmed).map((r) => r.item);
}

/**
 * Collect every distinct tag across a list of assets, sorted alphabetically.
 * Used to build the filter-chips row in the library header.
 */
export function uniqueTags(assets: MediaAsset[]): string[] {
  const set = new Set<string>();
  for (const a of assets) {
    for (const t of a.tags) set.add(t);
  }
  return Array.from(set).sort();
}
