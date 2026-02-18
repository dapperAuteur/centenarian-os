import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import PostCard from '@/components/blog/PostCard';
import type { BlogPost, Profile } from '@/lib/types';

type Props = { params: Promise<{ username: string }> };

export default async function UserBlogPage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  // Look up the profile by username
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (!profile) notFound();

  // Fetch publicly visible posts for this user
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('id, slug, title, excerpt, cover_image_url, published_at, tags, reading_time_minutes')
    .eq('user_id', (profile as Profile).id)
    .or('visibility.eq.public,and(visibility.eq.scheduled,scheduled_at.lte.now())')
    .order('published_at', { ascending: false });

  const p = profile as Profile;

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      {/* Author header */}
      <header className="mb-10 pb-8 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900">
          {p.display_name || p.username}&apos;s blog
        </h1>
        {p.bio && (
          <p className="mt-2 text-gray-600 max-w-xl">{p.bio}</p>
        )}
      </header>

      {/* Post grid */}
      {!posts?.length ? (
        <p className="text-gray-400 text-center py-16">No posts published yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post as Partial<BlogPost> as BlogPost}
              author={p}
            />
          ))}
        </div>
      )}
    </main>
  );
}
