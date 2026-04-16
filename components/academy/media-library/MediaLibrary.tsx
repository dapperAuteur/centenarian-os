'use client';

// components/academy/media-library/MediaLibrary.tsx
// Top-level container for the teacher's media library. Renders the grid,
// handles selection, and drives the detail panel on the right. v1 (plan 27a)
// supports: list, view details, rename, edit description/tags, delete with
// reference check, and see which lessons reference an asset. Plan 27b will
// add fuzzy search, tag filter, and the "pick from library" flow in the
// lesson editor.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { useToast } from '@/components/ui/ToastProvider';
import { logError } from '@/lib/error-logging';
import type { MediaAsset, MediaAssetReference } from '@/lib/academy/media-types';
import MediaGrid from './MediaGrid';
import MediaDetailPanel from './MediaDetailPanel';
import { Loader2, Library } from 'lucide-react';

export default function MediaLibrary() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const toast = useToast();

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await offlineFetch('/api/academy/media');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as { assets: MediaAsset[] };
      setAssets(data.assets ?? []);
    } catch (err) {
      logError(err, { module: 'media-library', context: { op: 'list' } });
      setLoadError('Could not load the media library. Refresh to try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedId) ?? null,
    [assets, selectedId],
  );

  async function handleSave(assetId: string, updates: Partial<Pick<MediaAsset, 'name' | 'description' | 'tags'>>) {
    try {
      const r = await offlineFetch(`/api/academy/media/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { asset } = (await r.json()) as { asset: MediaAsset };
      setAssets((prev) => prev.map((a) => (a.id === assetId ? asset : a)));
      toast.success('Media updated');
    } catch (err) {
      logError(err, { module: 'media-library', context: { op: 'update', assetId } });
      toast.error('Could not save changes. Try again.');
    }
  }

  async function handleDelete(assetId: string) {
    try {
      const r = await offlineFetch(`/api/academy/media/${assetId}`, { method: 'DELETE' });
      if (r.status === 409) {
        const body = await r.json().catch(() => ({}));
        toast.error(
          `Can't delete — this asset is referenced by ${body.reference_count ?? 'some'} lesson${body.reference_count === 1 ? '' : 's'}. Unwire those lessons first.`,
        );
        return false;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      if (selectedId === assetId) setSelectedId(null);
      toast.success('Media deleted');
      return true;
    } catch (err) {
      logError(err, { module: 'media-library', context: { op: 'delete', assetId } });
      toast.error('Could not delete. Try again.');
      return false;
    }
  }

  async function fetchReferences(assetId: string): Promise<MediaAssetReference[]> {
    try {
      const r = await offlineFetch(`/api/academy/media/${assetId}/references`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { references } = (await r.json()) as { references: MediaAssetReference[] };
      return references;
    } catch (err) {
      logError(err, { module: 'media-library', context: { op: 'references', assetId } });
      toast.error('Could not load references.');
      return [];
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center gap-3">
        <Library className="w-5 h-5 text-fuchsia-400" aria-hidden="true" />
        <h1 className="text-base sm:text-lg font-semibold flex-1">Media library</h1>
        <span className="text-xs text-gray-500">{assets.length} asset{assets.length === 1 ? '' : 's'}</span>
      </header>

      <div className="flex flex-col lg:flex-row">
        <section className="flex-1 p-4 sm:p-6 min-w-0">
          {loading && (
            <div role="status" className="flex items-center justify-center py-24 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" />
              Loading library…
            </div>
          )}
          {!loading && loadError && (
            <div role="alert" className="text-red-300 text-sm py-12 text-center">{loadError}</div>
          )}
          {!loading && !loadError && assets.length === 0 && (
            <div className="text-center py-24 px-4">
              <p className="text-sm text-gray-400">
                Your media library is empty. Every upload you make through the course editor will show up here, named after the original filename.
              </p>
            </div>
          )}
          {!loading && !loadError && assets.length > 0 && (
            <MediaGrid
              assets={assets}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </section>

        {selectedAsset && (
          <aside className="lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-800 p-4 sm:p-6 dark-input">
            <MediaDetailPanel
              asset={selectedAsset}
              onSave={handleSave}
              onDelete={handleDelete}
              onClose={() => setSelectedId(null)}
              fetchReferences={fetchReferences}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
