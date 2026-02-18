// app/blog/authors/page.tsx
// Directory of all users who have at least one public blog post.

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, FileText } from 'lucide-react';
import type { Profile } from '@/lib/types';

export const revalidate = 60;

export default async function AuthorsPage() {
  const supabase = await createClient();

  // Get user_ids that have at least one public (or live-scheduled) post,
  // along with a post count per author.
  const { data: postRows } = await supabase
    .from('blog_posts')
    .select('user_id')
    .or('visibility.eq.public,and(visibility.eq.scheduled,scheduled_at.lte.now())');

  if (!postRows?.length) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Authors</h1>
        <p className="text-gray-400">No authors have published yet.</p>
        <Link
          href="/dashboard/blog"
          className="mt-4 inline-block text-sm text-sky-600 hover:underline"
        >
          Start writing →
        </Link>
      </main>
    );
  }

  // Count posts per author and collect unique IDs
  const countMap: Record<string, number> = {};
  for (const row of postRows) {
    countMap[row.user_id] = (countMap[row.user_id] || 0) + 1;
  }
  const authorIds = Object.keys(countMap);

  // Fetch profiles for those authors
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url')
    .in('id', authorIds)
    .order('username', { ascending: true });

  // Sort by post count descending so most active authors show first
  const sorted = (profiles || []).sort(
    (a, b) => (countMap[b.id] || 0) - (countMap[a.id] || 0)
  );

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Authors</h1>
        <p className="mt-1 text-gray-500">
          {sorted.length} {sorted.length === 1 ? 'writer' : 'writers'} sharing on CentenarianOS.{' '}
          <Link href="/blog" className="text-sky-600 hover:underline">
            ← All posts
          </Link>
        </p>
      </div>

      {/* Author grid */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sorted.map((author) => {
          const p = author as Profile;
          const postCount = countMap[p.id] || 0;

          return (
            <li key={p.id}>
              <Link
                href={`/blog/${p.username}`}
                className="group flex items-start gap-4 p-5 bg-white border border-gray-200 rounded-2xl hover:border-sky-200 hover:shadow-md transition"
              >
                {/* Avatar */}
                <div className="shrink-0">
                  {p.avatar_url ? (
                    <Image
                      src={p.avatar_url}
                      alt={p.display_name || p.username}
                      width={52}
                      height={52}
                      className="w-13 h-13 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-13 h-13 rounded-full bg-sky-100 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-sky-500" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 group-hover:text-sky-700 transition truncate">
                    {p.display_name || p.username}
                  </p>
                  <p className="text-xs text-gray-400 mb-1">@{p.username}</p>
                  {p.bio && (
                    <p className="text-sm text-gray-600 line-clamp-2">{p.bio}</p>
                  )}
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                    <FileText className="w-3.5 h-3.5" />
                    {postCount} {postCount === 1 ? 'post' : 'posts'}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
