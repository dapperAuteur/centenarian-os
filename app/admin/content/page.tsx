'use client';

// app/admin/content/page.tsx
// Admin content moderation: view and unpublish recipes/blog posts

import { useEffect, useState } from 'react';
import { Eye, ThumbsUp, Bookmark, EyeOff } from 'lucide-react';
import PaginationBar from '@/components/ui/PaginationBar';

const PAGE_SIZE = 20;

type ContentType = 'recipe' | 'blog';

interface ContentItem {
  id: string;
  title: string;
  slug: string;
  visibility: string;
  view_count: number;
  like_count?: number;
  save_count?: number;
  published_at: string | null;
  profiles: { username: string } | null;
}

const VIS_BADGE: Record<string, string> = {
  public: 'bg-green-900/50 text-green-300',
  draft: 'bg-gray-700 text-gray-400',
  private: 'bg-gray-700 text-gray-400',
  scheduled: 'bg-amber-900/50 text-amber-300',
  authenticated_only: 'bg-sky-900/50 text-sky-300',
};

export default function AdminContentPage() {
  const [tab, setTab] = useState<ContentType>('recipe');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unpublishing, setUnpublishing] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  function load(type: ContentType) {
    setLoading(true);
    fetch(`/api/admin/content?type=${type}`)
      .then((r) => r.json())
      .then((d) => { setItems(d.items ?? []); setLoading(false); });
  }

  useEffect(() => { load(tab); setPage(1); }, [tab]);

  async function unpublish(id: string) {
    setUnpublishing(id);
    await fetch('/api/admin/content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: tab, id, visibility: 'draft' }),
    });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, visibility: 'draft' } : i));
    setUnpublishing(null);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Content</h1>
      <p className="text-gray-400 text-sm mb-6">Moderate public-facing recipes and blog posts.</p>

      <div className="flex gap-2 mb-6">
        {(['recipe', 'blog'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === t ? 'bg-fuchsia-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {t === 'recipe' ? 'Recipes' : 'Blog Posts'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3">Title</th>
                <th className="text-left px-5 py-3">Author</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Stats</th>
                <th className="text-left px-5 py-3">Published</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-600">No content found</td></tr>
              )}
              {items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item) => (
                <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                  <td className="px-5 py-3">
                    <p className="text-white font-medium truncate max-w-xs">{item.title}</p>
                    <p className="text-gray-600 text-xs">/{item.slug}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    @{item.profiles?.username ?? '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${VIS_BADGE[item.visibility] ?? 'bg-gray-700 text-gray-400'}`}>
                      {item.visibility}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3 text-gray-400 text-xs">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{item.view_count}</span>
                      {item.like_count !== undefined && <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{item.like_count}</span>}
                      {item.save_count !== undefined && <span className="flex items-center gap-1"><Bookmark className="w-3 h-3" />{item.save_count}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {item.published_at ? new Date(item.published_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {item.visibility === 'public' && (
                      <button
                        onClick={() => unpublish(item.id)}
                        disabled={unpublishing === item.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50 transition disabled:opacity-50"
                      >
                        <EyeOff className="w-3 h-3" />
                        {unpublishing === item.id ? 'Unpublishing…' : 'Unpublish'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar
            page={page}
            totalPages={Math.max(1, Math.ceil(items.length / PAGE_SIZE))}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
