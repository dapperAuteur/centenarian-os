// app/blog/page.tsx
// Public listing of all blog posts from all authors, sorted by publish date.

import { createClient } from '@/lib/supabase/server';
import PostCard from '@/components/blog/PostCard';
import Link from 'next/link';
import type { BlogPost, Profile } from '@/lib/types';

export const revalidate = 60; // ISR: revalidate every 60 s

export default async function BlogIndexPage() {
  const supabase = await createClient();

  // Fetch public (and live-scheduled) posts
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('id, slug, title, excerpt, cover_image_url, published_at, tags, reading_time_minutes, user_id')
    .or('visibility.eq.public,and(visibility.eq.scheduled,scheduled_at.lte.now())')
    .order('published_at', { ascending: false })
    .limit(30);

  // Fetch profiles for the authors in this batch
  const authorIds = [...new Set((posts || []).map((p) => p.user_id))];
  const { data: profiles } = authorIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', authorIds)
    : { data: [] };

  const profileMap = Object.fromEntries(
    (profiles || []).map((p) => [p.id, p])
  );

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Blog</h1>
        <p className="mt-1 text-gray-500">
          Latest posts from the CentenarianOS community.{' '}
          <Link href="/blog/authors" className="text-sky-600 hover:underline">
            Browse authors →
          </Link>
        </p>
      </div>

      {/* Post grid */}
      {!posts?.length ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No posts published yet.</p>
          <Link
            href="/dashboard/blog"
            className="mt-4 inline-block text-sm text-sky-600 hover:underline"
          >
            Be the first to write one →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => {
            const author = profileMap[post.user_id];
            if (!author) return null;
            return (
              <PostCard
                key={post.id}
                post={post as Partial<BlogPost> as BlogPost}
                author={author as Profile}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
