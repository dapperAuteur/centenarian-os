'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DeletePostModal from './DeletePostModal';
import { PenLine, Trash2, Eye, EyeOff, Clock, Globe, Users, FileText, Search } from 'lucide-react';
import type { BlogPost, PostVisibility } from '@/lib/types';

interface BlogPostListProps {
  userId: string;
  username: string;
}

const VISIBILITY_META: Record<PostVisibility, { label: string; icon: React.ReactNode; color: string }> = {
  draft: { label: 'Draft', icon: <FileText className="w-3.5 h-3.5" />, color: 'text-gray-500 bg-gray-100' },
  private: { label: 'Private', icon: <EyeOff className="w-3.5 h-3.5" />, color: 'text-amber-700 bg-amber-50' },
  public: { label: 'Public', icon: <Globe className="w-3.5 h-3.5" />, color: 'text-green-700 bg-green-50' },
  authenticated_only: { label: 'Members', icon: <Users className="w-3.5 h-3.5" />, color: 'text-indigo-700 bg-indigo-50' },
  scheduled: { label: 'Scheduled', icon: <Clock className="w-3.5 h-3.5" />, color: 'text-sky-700 bg-sky-50' },
};

const VISIBILITY_FILTERS: { value: PostVisibility | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'authenticated_only', label: 'Members' },
  { value: 'scheduled', label: 'Scheduled' },
];

function formatDate(iso: string | null) {
  if (!iso) return 'Not published';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BlogPostList({ userId, username }: BlogPostListProps) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<PostVisibility | ''>('');
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'title'>('created_at');
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setPosts(data || []);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let result = posts;
    if (visibilityFilter) {
      result = result.filter((p) => p.visibility === visibilityFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        (p.excerpt && p.excerpt.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some((t: string) => t.toLowerCase().includes(q)))
      );
    }
    if (sortBy === 'updated_at') {
      result = [...result].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
    } else if (sortBy === 'title') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    }
    return result;
  }, [posts, visibilityFilter, search, sortBy]);

  const handleDeleted = (deletedId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
  };

  if (loading) {
    return <div className="py-10 text-center text-gray-400 text-sm">Loading posts…</div>;
  }

  if (!posts.length) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-gray-500">You haven&apos;t written any posts yet.</p>
        <Link
          href="/dashboard/blog/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition"
        >
          <PenLine className="w-4 h-4" />
          Write your first post
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, excerpt, or tag..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {VISIBILITY_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setVisibilityFilter(f.value)}
                className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition ${
                  visibilityFilter === f.value
                    ? 'bg-sky-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="ml-auto border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600"
          >
            <option value="created_at">Newest</option>
            <option value="updated_at">Recently edited</option>
            <option value="title">Title A–Z</option>
          </select>
          <span className="text-xs text-gray-400">{filtered.length} post{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm">
          No posts match your filters.
        </div>
      ) : filtered.map((post) => {
        const meta = VISIBILITY_META[post.visibility];
        return (
          <div
            key={post.id}
            className="flex items-start justify-between gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                  {meta.icon}
                  {meta.label}
                </span>
                {post.scheduled_at && post.visibility === 'scheduled' && (
                  <span className="text-xs text-gray-400">
                    {formatDate(post.scheduled_at)}
                  </span>
                )}
              </div>

              <h3 className="font-medium text-gray-900 truncate">{post.title}</h3>

              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                <span>{formatDate(post.published_at || post.created_at)}</span>
                {post.reading_time_minutes && <span>{post.reading_time_minutes} min read</span>}
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {post.view_count}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {post.visibility === 'public' && (
                <Link
                  href={`/blog/${username}/${post.slug}`}
                  target="_blank"
                  className="p-1.5 text-gray-400 hover:text-sky-600 transition"
                  title="View public post"
                >
                  <Eye className="w-4 h-4" />
                </Link>
              )}
              <Link
                href={`/dashboard/blog/${post.id}/edit`}
                className="p-1.5 text-gray-400 hover:text-gray-700 transition"
                title="Edit post"
              >
                <PenLine className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setDeleteTarget({ id: post.id, title: post.title })}
                className="p-1.5 text-gray-400 hover:text-red-500 transition"
                title="Delete post"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}

      <DeletePostModal
        isOpen={!!deleteTarget}
        postId={deleteTarget?.id || null}
        postTitle={deleteTarget?.title || ''}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
