'use client';

// Read-only since Media moved to Stream.WitUS: lists saved creators and platforms.
// Add, rename, and delete are gone because those writes return 410.

import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import MovedToStreamBanner from '@/components/media/MovedToStreamBanner';

interface SavedItem {
  id: string;
  name: string;
  use_count: number;
}

function SavedItemList({
  title,
  items,
  loading,
}: {
  title: string;
  items: SavedItem[];
  loading: boolean;
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-4 py-6 justify-center text-sm text-gray-400" role="status">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Loading...
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="px-4 py-6 text-center text-xs text-gray-400">
          No saved {title.toLowerCase()}.
        </p>
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-gray-50" role="list">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-4 py-2 min-h-11" role="listitem">
              <span className="flex-1 text-sm text-gray-700 truncate">{item.name}</span>
              <span className="text-[10px] text-gray-400 tabular-nums shrink-0">{item.use_count}x</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function MediaSettingsPage() {
  const [creators, setCreators] = useState<SavedItem[]>([]);
  const [platforms, setPlatforms] = useState<SavedItem[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [loadingPlatforms, setLoadingPlatforms] = useState(true);

  const loadCreators = useCallback(async () => {
    setLoadingCreators(true);
    try {
      const res = await offlineFetch('/api/media/creators');
      if (res.ok) setCreators(await res.json());
    } catch { /* offline */ }
    setLoadingCreators(false);
  }, []);

  const loadPlatforms = useCallback(async () => {
    setLoadingPlatforms(true);
    try {
      const res = await offlineFetch('/api/media/platforms');
      if (res.ok) setPlatforms(await res.json());
    } catch { /* offline */ }
    setLoadingPlatforms(false);
  }, []);

  useEffect(() => { loadCreators(); loadPlatforms(); }, [loadCreators, loadPlatforms]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/media"
          className="flex items-center justify-center min-h-11 min-w-11 text-gray-500 hover:text-gray-700 transition"
          aria-label="Back to media"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900">Media Settings</h1>
      </div>

      <MovedToStreamBanner />

      <p className="text-sm text-gray-500">
        The creators and platforms you saved while adding media.
      </p>

      <div className="grid grid-cols-1 gap-6">
        <SavedItemList title="Creators" items={creators} loading={loadingCreators} />
        <SavedItemList title="Platforms" items={platforms} loading={loadingPlatforms} />
      </div>
    </div>
  );
}
