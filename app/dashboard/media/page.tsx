'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Star, BookOpen, Tv, Film, Music, Settings } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import MediaCard, { type MediaItem } from '@/components/media/MediaCard';
import MovedToStreamBanner from '@/components/media/MovedToStreamBanner';
import Link from 'next/link';

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

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'want_to_consume', label: 'Want' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Done' },
  { value: 'dropped', label: 'Dropped' },
];

interface Summary {
  totalItems: number;
  inProgress: number;
  completed: number;
  favorites: number;
  avgRating: number | null;
}

export default function MediaHubPage() {
  const router = useRouter();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limit = 50;

  // Debounce search input (300ms)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
      if (typeFilter) params.set('media_type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());

      const [itemsRes, summaryRes] = await Promise.all([
        offlineFetch(`/api/media?${params}`),
        offlineFetch('/api/media/summary'),
      ]);

      if (itemsRes.ok) {
        const d = await itemsRes.json();
        setItems(d.items || []);
        setTotal(d.total || 0);
      }
      if (summaryRes.ok) {
        const d = await summaryRes.json();
        setSummary(d);
      }
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [page, typeFilter, statusFilter, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  const statCards = [
    { label: 'Total', value: summary?.totalItems ?? 0, icon: BookOpen, color: 'text-fuchsia-600' },
    { label: 'In Progress', value: summary?.inProgress ?? 0, icon: Tv, color: 'text-amber-600' },
    { label: 'Completed', value: summary?.completed ?? 0, icon: Film, color: 'text-green-600' },
    { label: 'Favorites', value: summary?.favorites ?? 0, icon: Star, color: 'text-red-500' },
    ...(summary?.avgRating ? [{ label: 'Avg Rating', value: summary.avgRating, icon: Music, color: 'text-amber-500' }] : []),
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Media Tracker</h1>
          <p className="text-sm text-gray-500 mt-0.5">Read-only while Media moves to Stream.WitUS</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/dashboard/media/podcasts"
            className="px-3 py-2 text-sm font-medium border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition min-h-11 flex items-center gap-1.5">
            {'\u{1F399}'} Episodes
          </Link>
          <Link href="/dashboard/media/settings"
            className="px-3 py-2 text-sm font-medium border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition min-h-11 flex items-center gap-1.5">
            <Settings className="w-4 h-4" aria-hidden="true" /> Settings
          </Link>
        </div>
      </div>

      <MovedToStreamBanner />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {statCards.map((c) => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <c.icon className={`w-4 h-4 ${c.color}`} />
              <span className="text-xs text-gray-500">{c.label}</span>
            </div>
            <span className="text-xl font-bold text-gray-900">
              {typeof c.value === 'number' && c.label === 'Avg Rating' ? c.value.toFixed(1) : c.value}
            </span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setTypeFilter(f.value); setPage(0); }}
              className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition ${
                typeFilter === f.value
                  ? 'bg-fuchsia-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(0); }}
              className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition ${
                statusFilter === f.value
                  ? 'bg-sky-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search titles, creators, genres..."
            className="ml-auto border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-48 sm:w-64 min-h-11"
            aria-label="Search media"
          />
        </div>
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="py-16 flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-4 border-fuchsia-600 border-t-transparent rounded-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-400 text-sm">No media items found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onClick={() => router.push(`/dashboard/media/${item.id}`)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
