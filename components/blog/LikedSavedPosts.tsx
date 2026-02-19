'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Heart, Bookmark, ExternalLink } from 'lucide-react';

interface PostItem {
  post_id: string;
  created_at: string;
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string | null;
  author_username: string;
  author_display_name: string | null;
}

interface Props {
  userId: string;
  mode: 'liked' | 'saved';
}

export default function LikedSavedPosts({ userId, mode }: Props) {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const table = mode === 'liked' ? 'blog_likes' : 'blog_saves';

    async function load() {
      // Step 1: get junction rows + post data
      // NOTE: blog_posts.user_id → auth.users (not profiles), so profiles cannot be auto-joined.
      // We fetch profiles separately in step 2.
      const { data: rows } = await supabase
        .from(table)
        .select('post_id, created_at, blog_posts(id, title, slug, excerpt, published_at, user_id)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!rows?.length) {
        setPosts([]);
        setLoading(false);
        return;
      }

      // Step 2: collect unique author user_ids from the posts
      const authorIds = [
        ...new Set(
          rows
            .map((r) => (r.blog_posts as { user_id?: string } | null)?.user_id)
            .filter(Boolean) as string[]
        ),
      ];

      // Step 3: batch-fetch profiles by those user_ids
      const { data: profiles } = authorIds.length
        ? await supabase.from('profiles').select('id, username, display_name').in('id', authorIds)
        : { data: [] };

      const profileMap: Record<string, { username: string; display_name: string | null }> = {};
      for (const p of profiles ?? []) {
        profileMap[p.id] = { username: p.username, display_name: p.display_name };
      }

      // Step 4: merge into a flat list
      const merged: PostItem[] = rows
        .map((r) => {
          const post = r.blog_posts as unknown as {
            id: string; title: string; slug: string;
            excerpt: string | null; published_at: string | null; user_id: string;
          } | null;
          if (!post) return null;
          const prof = profileMap[post.user_id];
          if (!prof) return null;
          return {
            post_id: r.post_id,
            created_at: r.created_at,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            published_at: post.published_at,
            author_username: prof.username,
            author_display_name: prof.display_name,
          };
        })
        .filter(Boolean) as PostItem[];

      setPosts(merged);
      setLoading(false);
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mode]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-6 w-6 border-4 border-sky-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const Icon = mode === 'liked' ? Heart : Bookmark;
  const emptyLabel = mode === 'liked' ? 'liked posts' : 'saved posts';

  if (posts.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400 space-y-2">
        <Icon className="w-10 h-10 mx-auto text-gray-300" />
        <p className="text-sm">No {emptyLabel} yet.</p>
        <p className="text-xs text-gray-400">
          Visit a blog post and click the{' '}
          {mode === 'liked' ? '♥ like' : '🔖 save'} button to add it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <div
          key={post.post_id}
          className="flex items-start justify-between gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-sky-200 hover:bg-sky-50 transition"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 truncate">{post.title}</p>
            {post.excerpt && (
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{post.excerpt}</p>
            )}
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
              <span>by {post.author_display_name || `@${post.author_username}`}</span>
              {post.published_at && (
                <>
                  <span>·</span>
                  <span>{new Date(post.published_at).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
          <Link
            href={`/blog/${post.author_username}/${post.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-gray-400 hover:text-sky-600 transition"
            title="Open post"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      ))}
    </div>
  );
}
