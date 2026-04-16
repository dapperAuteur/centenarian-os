'use client';

// components/academy/media-library/MediaPickerModal.tsx
// Reusable modal that shows the caller's media library and fires onPick
// when an asset is selected. Used by the lesson editor to let teachers
// reuse an existing upload instead of uploading the same file twice.
//
// The filter set (kind) is optional — the lesson editor passes e.g.
// ['panorama_video'] when editing a 360° video lesson so the picker only
// shows matching assets. Defaults to showing everything.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Loader2, Library } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { useToast } from '@/components/ui/ToastProvider';
import { logError } from '@/lib/error-logging';
import type { MediaAsset, AssetKind } from '@/lib/academy/media-types';
import { filterAssets, uniqueTags } from '@/lib/academy/media-search';
import MediaGrid from './MediaGrid';
import MediaFilterBar from './MediaFilterBar';

interface MediaPickerModalProps {
  /** Fires when the teacher picks an asset. Caller is responsible for closing the modal. */
  onPick: (asset: MediaAsset) => void;
  onCancel: () => void;
  /** Restrict the picker to specific asset kinds (e.g. ['panorama_video']). Optional. */
  allowedKinds?: AssetKind[];
  /** Optional heading override — e.g. "Pick a 360° video". */
  title?: string;
}

export default function MediaPickerModal({
  onPick,
  onCancel,
  allowedKinds,
  title = 'Pick from library',
}: MediaPickerModalProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const toast = useToast();

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }, []);

  // Close on Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await offlineFetch('/api/academy/media');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as { assets: MediaAsset[] };
        if (!cancelled) setAssets(data.assets ?? []);
      } catch (err) {
        if (!cancelled) {
          logError(err, { module: 'MediaPickerModal', context: { op: 'list' } });
          setLoadError('Could not load your library. Try again.');
          toast.error('Could not load your library.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const kindFiltered = useMemo(() => {
    if (!allowedKinds || allowedKinds.length === 0) return assets;
    return assets.filter((a) => allowedKinds.includes(a.asset_kind));
  }, [assets, allowedKinds]);

  const availableTags = useMemo(() => uniqueTags(kindFiltered), [kindFiltered]);
  const filtered = useMemo(
    () => filterAssets(kindFiltered, query, selectedTags),
    [kindFiltered, query, selectedTags],
  );

  function handleConfirm() {
    const asset = filtered.find((a) => a.id === selectedId);
    if (!asset) return;
    onPick(asset);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 dark-input"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Library className="w-4 h-4 text-fuchsia-400" aria-hidden="true" />
            <h2 id="media-picker-title" className="text-base font-semibold text-white">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 min-w-11 -m-2 flex items-center justify-center text-gray-400 hover:text-white transition"
            aria-label="Close picker"
            title="Close"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div role="status" className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" />
              Loading…
            </div>
          )}
          {!loading && loadError && (
            <div role="alert" className="text-red-300 text-sm py-12 text-center">{loadError}</div>
          )}
          {!loading && !loadError && kindFiltered.length === 0 && (
            <div className="text-center py-16 px-4">
              <p className="text-sm text-gray-400">
                No {allowedKinds && allowedKinds.length > 0 ? 'matching' : ''} assets in your library yet. Upload one from this lesson to populate it.
              </p>
            </div>
          )}
          {!loading && !loadError && kindFiltered.length > 0 && (
            <>
              <MediaFilterBar
                query={query}
                onQueryChange={setQuery}
                availableTags={availableTags}
                selectedTags={selectedTags}
                onToggleTag={toggleTag}
                resultCount={filtered.length}
                totalCount={kindFiltered.length}
              />
              {filtered.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-gray-800 rounded-xl">
                  <p className="text-sm text-gray-400">No assets match the current filters.</p>
                </div>
              ) : (
                <MediaGrid
                  assets={filtered}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )}
            </>
          )}
        </div>

        <footer className="flex flex-col sm:flex-row justify-end gap-2 px-5 py-4 border-t border-gray-800">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 px-4 py-2 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded-lg text-sm transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedId}
            className="min-h-11 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
          >
            Use this asset
          </button>
        </footer>
      </div>
    </div>
  );
}
