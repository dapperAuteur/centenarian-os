'use client';

// app/admin/shortlinks/page.tsx
// Admin page to view and backfill Switchy short links

import { useEffect, useState } from 'react';
import { Link2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface Counts {
  blog: { with: number; without: number };
  recipe: { with: number; without: number };
  course: { with: number; without: number };
}

export default function AdminShortlinksPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; failed: number } | null>(null);

  const loadCounts = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/shortlinks/sync');
    if (res.ok) setCounts(await res.json());
    setLoading(false);
  };

  useEffect(() => { loadCounts(); }, []);

  const sync = async (type: string) => {
    setSyncing(type);
    setResult(null);
    const res = await fetch(`/api/admin/shortlinks/sync?type=${type}`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setResult(data);
      loadCounts();
    }
    setSyncing(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-600" />
      </div>
    );
  }

  const sections = [
    { key: 'blog', label: 'Blog Posts', data: counts?.blog },
    { key: 'recipe', label: 'Recipes', data: counts?.recipe },
    { key: 'course', label: 'Courses', data: counts?.course },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Link2 className="w-7 h-7 text-fuchsia-600" />
          Short Links
        </h1>
        <p className="text-gray-600 text-sm mt-1">Manage Switchy.io short links for published content</p>
      </header>

      {result && (
        <div className="flex items-center gap-2 bg-lime-50 border border-lime-200 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-lime-600 shrink-0" />
          <p className="text-sm text-lime-800">
            Created {result.created} short links{result.failed > 0 ? `, ${result.failed} failed` : ''}
          </p>
        </div>
      )}

      <div className="grid gap-6">
        {sections.map(({ key, label, data }) => (
          <div key={key} className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{label}</h2>
              <button
                onClick={() => sync(key)}
                disabled={syncing !== null || (data?.without || 0) === 0}
                className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 transition disabled:opacity-50 min-h-10"
              >
                {syncing === key ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Syncing...</>
                ) : (
                  `Sync ${label}`
                )}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-lime-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-lime-700">{data?.with || 0}</div>
                <div className="text-xs text-lime-600">With short link</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-amber-700">{data?.without || 0}</div>
                <div className="text-xs text-amber-600">Missing short link</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sync All */}
      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <button
          onClick={() => sync('all')}
          disabled={syncing !== null}
          className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition disabled:opacity-50 mx-auto min-h-12"
        >
          {syncing === 'all' ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Syncing All...</>
          ) : (
            'Sync All Content'
          )}
        </button>
      </div>

      {!process.env.NEXT_PUBLIC_APP_URL && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            NEXT_PUBLIC_APP_URL is not set. Short links will use empty base URLs.
          </p>
        </div>
      )}
    </div>
  );
}
