'use client';

// app/admin/engagement/page.tsx
// Admin engagement analytics: activity timeline, top liked/saved content, recent activity feed

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Heart, Bookmark, ChefHat, BookOpen, ExternalLink } from 'lucide-react';

interface TopPost {
  id: string; title: string; slug: string; username: string;
  like_count: number; save_count: number;
}

interface TopRecipe {
  id: string; name: string; slug: string; username: string;
  like_count: number; save_count: number;
}

interface ActivityEntry {
  type: 'blog_like' | 'blog_save' | 'recipe_like' | 'recipe_save';
  created_at: string;
  actor_username: string;
  content_title: string;
  content_url: string;
}

interface DayEntry {
  date: string;
  blog_likes: number;
  blog_saves: number;
  recipe_likes: number;
  recipe_saves: number;
}

interface EngagementData {
  topLikedPosts: TopPost[];
  topSavedPosts: TopPost[];
  topLikedRecipes: TopRecipe[];
  topSavedRecipes: TopRecipe[];
  recentActivity: ActivityEntry[];
  activityByDay: DayEntry[];
}

const TYPE_LABEL: Record<string, string> = {
  blog_like:    'Blog Like',
  blog_save:    'Blog Save',
  recipe_like:  'Recipe Like',
  recipe_save:  'Recipe Save',
};

const TYPE_COLOR: Record<string, string> = {
  blog_like:   'bg-fuchsia-900/40 text-fuchsia-300',
  blog_save:   'bg-sky-900/40 text-sky-300',
  recipe_like: 'bg-lime-900/40 text-lime-300',
  recipe_save: 'bg-amber-900/40 text-amber-300',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function TopContentTable({
  title,
  posts,
  icon: Icon,
  countKey,
  urlBase,
}: {
  title: string;
  posts: (TopPost | TopRecipe)[];
  icon: React.ElementType;
  countKey: 'like_count' | 'save_count';
  urlBase: (item: TopPost | TopRecipe) => string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800">
        <Icon className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
      </div>
      {posts.length === 0 ? (
        <p className="px-5 py-8 text-center text-gray-600 text-sm">No data yet</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {posts.map((item, i) => {
              const name = 'name' in item ? item.name : item.title;
              return (
                <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                  <td className="px-4 py-2.5 text-gray-500 text-xs w-7">{i + 1}</td>
                  <td className="px-2 py-2.5 min-w-0">
                    <p className="text-white text-sm truncate max-w-xs">{name}</p>
                    <p className="text-gray-500 text-xs">@{item.username}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-fuchsia-400 font-semibold text-sm">{item[countKey]}</span>
                  </td>
                  <td className="px-3 py-2.5 w-8">
                    <a
                      href={urlBase(item)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-white transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AdminEngagementPage() {
  const [data, setData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/engagement')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-8 text-red-400">Failed to load engagement data.</div>;
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="p-8 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Engagement</h1>
        <p className="text-gray-400 text-sm">Likes, saves, and activity across all content — last 30 days.</p>
      </div>

      {/* ── Activity Timeline ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Activity Timeline</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          {data.activityByDay.every((d) => d.blog_likes + d.blog_saves + d.recipe_likes + d.recipe_saves === 0) ? (
            <p className="text-center text-gray-600 py-10 text-sm">No activity in the last 30 days.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.activityByDay} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={(v: string) => v.slice(5)} // MM-DD
                  interval={4}
                />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#9ca3af', fontSize: 12 }}
                  itemStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                <Line type="monotone" dataKey="blog_likes"   name="Blog Likes"    stroke="#d946ef" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="blog_saves"   name="Blog Saves"    stroke="#38bdf8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="recipe_likes" name="Recipe Likes"  stroke="#84cc16" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="recipe_saves" name="Recipe Saves"  stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ── Top Liked Content ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Most Liked</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TopContentTable
            title="Blog Posts"
            posts={data.topLikedPosts}
            icon={BookOpen}
            countKey="like_count"
            urlBase={(item) => `${appUrl}/blog/${(item as TopPost).username}/${item.slug}`}
          />
          <TopContentTable
            title="Recipes"
            posts={data.topLikedRecipes}
            icon={ChefHat}
            countKey="like_count"
            urlBase={(item) => `${appUrl}/recipes/cooks/${(item as TopRecipe).username}/${item.slug}`}
          />
        </div>
      </section>

      {/* ── Top Saved Content ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Most Saved</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TopContentTable
            title="Blog Posts"
            posts={data.topSavedPosts}
            icon={BookOpen}
            countKey="save_count"
            urlBase={(item) => `${appUrl}/blog/${(item as TopPost).username}/${item.slug}`}
          />
          <TopContentTable
            title="Recipes"
            posts={data.topSavedRecipes}
            icon={ChefHat}
            countKey="save_count"
            urlBase={(item) => `${appUrl}/recipes/cooks/${(item as TopRecipe).username}/${item.slug}`}
          />
        </div>
      </section>

      {/* ── Recent Activity Feed ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Recent Activity</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {data.recentActivity.length === 0 ? (
            <p className="px-5 py-10 text-center text-gray-600 text-sm">No activity yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Type</th>
                  <th className="text-left px-5 py-3">User</th>
                  <th className="text-left px-5 py-3">Content</th>
                  <th className="text-right px-5 py-3">When</th>
                </tr>
              </thead>
              <tbody>
                {data.recentActivity.map((entry, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TYPE_COLOR[entry.type]}`}>
                        {entry.type === 'blog_like' || entry.type === 'blog_save'
                          ? <Heart className="w-3 h-3 inline mr-1" />
                          : <Bookmark className="w-3 h-3 inline mr-1" />
                        }
                        {TYPE_LABEL[entry.type]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-300">
                      <Link href={`/admin/users`} className="hover:text-white transition">
                        @{entry.actor_username}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <a
                        href={entry.content_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-300 hover:text-white flex items-center gap-1.5 transition"
                      >
                        <span className="truncate max-w-xs">{entry.content_title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 text-gray-600" />
                      </a>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500 text-xs whitespace-nowrap">
                      {timeAgo(entry.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
