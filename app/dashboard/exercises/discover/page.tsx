'use client';

import { useEffect, useState, useCallback } from 'react';
import { Heart, Copy, CheckCircle2, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface PublicExercise {
  id: string;
  name: string;
  difficulty: string | null;
  primary_muscles: string[] | null;
  video_url: string | null;
  media_url: string | null;
  like_count: number;
  copy_count: number;
  done_count: number;
  exercise_categories: { id: string; name: string; icon: string | null; color: string | null } | null;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-50 text-green-700',
  intermediate: 'bg-amber-50 text-amber-700',
  advanced: 'bg-red-50 text-red-700',
};

export default function DiscoverExercisesPage() {
  const [exercises, setExercises] = useState<PublicExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [sort, setSort] = useState('like_count');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit), sort, dir: 'desc' });
    if (search) params.set('search', search);
    if (difficulty) params.set('difficulty', difficulty);

    const res = await offlineFetch(`/api/exercises/discover?${params}`);
    const data = await res.json();
    setExercises(data.exercises ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, search, difficulty, sort]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Discover Exercises</h1>
        <p className="text-sm text-gray-500 mt-1">Browse public exercises shared by the community</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500"
          />
        </div>
        <select
          value={difficulty}
          onChange={(e) => { setDifficulty(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Difficulties</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
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
      ) : exercises.length === 0 ? (
        <p className="text-center text-gray-400 py-12">No public exercises found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exercises.map((ex) => (
            <Link key={ex.id} href={`/dashboard/exercises/${ex.id}`}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition space-y-3">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{ex.name}</h3>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {ex.exercise_categories && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-700">
                      {ex.exercise_categories.name}
                    </span>
                  )}
                  {ex.difficulty && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[ex.difficulty] || 'bg-gray-100 text-gray-600'}`}>
                      {ex.difficulty}
                    </span>
                  )}
                </div>
              </div>
              {ex.primary_muscles && ex.primary_muscles.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {ex.primary_muscles.slice(0, 3).map((m) => (
                    <span key={m} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{m}</span>
                  ))}
                  {ex.primary_muscles.length > 3 && (
                    <span className="text-xs text-gray-400">+{ex.primary_muscles.length - 3}</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {ex.like_count}</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {ex.done_count}</span>
                <span className="flex items-center gap-1"><Copy className="w-3 h-3" /> {ex.copy_count}</span>
              </div>
            </Link>
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
