'use client';

import { useEffect, useState, useCallback } from 'react';
import { Heart, Copy, CheckCircle2, Search, Loader2, Clock } from 'lucide-react';
import Link from 'next/link';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface PublicTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  estimated_duration_min: number | null;
  purpose: string[] | null;
  like_count: number;
  copy_count: number;
  done_count: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  strength: 'bg-red-50 text-red-700',
  cardio: 'bg-green-50 text-green-700',
  flexibility: 'bg-purple-50 text-purple-700',
  hiit: 'bg-orange-50 text-orange-700',
  other: 'bg-gray-100 text-gray-700',
};

export default function DiscoverWorkoutsPage() {
  const [templates, setTemplates] = useState<PublicTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('like_count');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit), sort, dir: 'desc' });
    if (search) params.set('search', search);
    if (category) params.set('category', category);

    const res = await offlineFetch(`/api/workouts/discover?${params}`);
    const data = await res.json();
    setTemplates(data.templates ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, search, category, sort]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Discover Workouts</h1>
        <p className="text-sm text-gray-500 mt-1">Browse public workout templates shared by the community</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search workouts..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500"
          />
        </div>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Categories</option>
          <option value="strength">Strength</option>
          <option value="cardio">Cardio</option>
          <option value="flexibility">Flexibility</option>
          <option value="hiit">HIIT</option>
          <option value="other">Other</option>
        </select>
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="like_count">Most Liked</option>
          <option value="done_count">Most Done</option>
          <option value="copy_count">Most Copied</option>
          <option value="name">Name A-Z</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-fuchsia-600" />
        </div>
      ) : templates.length === 0 ? (
        <p className="text-center text-gray-400 py-12">No public workouts found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition space-y-3">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{t.name}</h3>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {t.category && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[t.category] || CATEGORY_COLORS.other}`}>
                      {t.category}
                    </span>
                  )}
                  {t.estimated_duration_min && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" /> {t.estimated_duration_min}m
                    </span>
                  )}
                </div>
              </div>
              {t.description && (
                <p className="text-xs text-gray-500 line-clamp-2">{t.description}</p>
              )}
              {t.purpose && t.purpose.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {t.purpose.map((p) => (
                    <span key={p} className="text-xs px-1.5 py-0.5 bg-fuchsia-50 text-fuchsia-700 rounded">{p}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {t.like_count}</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {t.done_count}</span>
                  <span className="flex items-center gap-1"><Copy className="w-3 h-3" /> {t.copy_count}</span>
                </div>
                <Link href={`/dashboard/workouts/templates/${t.id}`}
                  className="text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium">
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
