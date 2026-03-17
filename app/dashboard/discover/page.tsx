'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Heart, Share2, Search, Loader2 } from 'lucide-react';

const TYPE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'book', label: '\u{1F4D6} Books' },
  { value: 'tv_show', label: '\u{1F4FA} TV' },
  { value: 'movie', label: '\u{1F3AC} Movies' },
  { value: 'video', label: '\u{1F4F9} Video' },
  { value: 'song', label: '\u{1F3B5} Songs' },
  { value: 'album', label: '\u{1F4BF} Albums' },
  { value: 'podcast', label: '\u{1F399} Pods' },
  { value: 'art', label: '\u{1F3A8} Art' },
  { value: 'article', label: '\u{1F4F0} Articles' },
];

interface PublicItem {
  id: string;
  title?: string;
  name?: string;
  creator?: string | null;
  brand?: string | null;
  model?: string | null;
  media_type?: string;
  cover_image_url?: string | null;
  image_url?: string | null;
  like_count: number;
  share_count: number;
  equipment_categories?: { name: string; color?: string | null } | null;
}

export default function DiscoverPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'media' | 'equipment'>('media');
  const [items, setItems] = useState<PublicItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: tab,
        limit: String(limit),
        offset: String(page * limit),
      });
      if (search.trim()) params.set('search', search.trim());
      if (tab === 'media' && mediaType) params.set('media_type', mediaType);

      const res = await fetch(`/api/social/public?${params}`);
      if (res.ok) {
        const d = await res.json();
        setItems(d.items || []);
        setTotal(d.total || 0);
      }
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [tab, page, search, mediaType]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  const handleLike = async (entityType: string, entityId: string) => {
    const res = await fetch('/api/social/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId }),
    });
    if (res.ok) {
      const d = await res.json();
      setItems((prev) =>
        prev.map((i) => (i.id === entityId ? { ...i, like_count: d.like_count } : i)),
      );
    } else if (res.status === 401) {
      router.push('/login');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sparkles className="w-6 h-6 text-fuchsia-600" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Discover</h1>
          <p className="text-sm text-gray-500 mt-0.5">Explore public media and equipment shared by the community</p>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['media', 'equipment'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(0); setSearch(''); setMediaType(''); }}
            className={`px-4 min-h-11 rounded-lg text-sm font-medium transition capitalize ${
              tab === t ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        {tab === 'media' && (
          <div className="flex flex-wrap gap-1.5">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => { setMediaType(f.value); setPage(0); }}
                className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition ${
                  mediaType === f.value
                    ? 'bg-fuchsia-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder={tab === 'media' ? 'Search titles...' : 'Search equipment...'}
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-16 flex items-center justify-center">
          <Loader2 className="animate-spin h-6 w-6 text-fuchsia-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-400 text-sm">No public items found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => {
            const title = item.title || item.name || 'Untitled';
            const subtitle = item.creator || [item.brand, item.model].filter(Boolean).join(' ') || null;
            const imgUrl = item.cover_image_url || item.image_url;
            const detailHref = tab === 'media'
              ? `/dashboard/discover/media/${item.id}`
              : `/dashboard/discover/equipment/${item.id}`;
            const entityType = tab === 'media' ? 'media_item' : 'equipment';
            const typeBadge = tab === 'media' && item.media_type
              ? item.media_type.replace('_', ' ')
              : item.equipment_categories?.name || null;

            return (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition group">
                <Link href={detailHref} className="block">
                  <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
                    {imgUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    ) : (
                      <span className="text-4xl text-gray-300">{tab === 'media' ? '\u{1F3AC}' : '\u{1F4E6}'}</span>
                    )}
                  </div>
                </Link>
                <div className="p-3 space-y-2">
                  <div>
                    <Link href={detailHref} className="text-sm font-semibold text-gray-900 hover:text-fuchsia-600 transition line-clamp-1">
                      {title}
                    </Link>
                    {subtitle && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{subtitle}</p>}
                  </div>
                  <div className="flex items-center justify-between">
                    {typeBadge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
                        {typeBadge}
                      </span>
                    )}
                    <div className="flex items-center gap-3 ml-auto">
                      <button
                        onClick={() => handleLike(entityType, item.id)}
                        aria-label="Like"
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition min-h-11 min-w-11 justify-center"
                      >
                        <Heart className="w-3.5 h-3.5" /> {item.like_count || 0}
                      </button>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Share2 className="w-3.5 h-3.5" aria-hidden="true" /> {item.share_count || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 min-h-11 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page + 1} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 min-h-11 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
