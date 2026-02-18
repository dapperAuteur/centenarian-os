import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import TiptapRenderer from '@/components/blog/TiptapRenderer';
import PostMeta from '@/components/blog/PostMeta';
import ShareBar from '@/components/blog/ShareBar';
import ReadDepthTracker from '@/components/blog/ReadDepthTracker';
import { buildShareUrls } from '@/lib/blog/share';
import type { BlogPost, Profile } from '@/lib/types';

type Props = { params: Promise<{ username: string; slug: string }> };

export default async function PublicPostPage({ params }: Props) {
  const { username, slug } = await params;
  const supabase = await createClient();

  // Look up profile by username
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (!profile) notFound();

  // Fetch the post — RLS handles visibility based on whether the user is authenticated
  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('user_id', (profile as Profile).id)
    .eq('slug', slug)
    .or('visibility.eq.public,and(visibility.eq.scheduled,scheduled_at.lte.now()),and(visibility.eq.authenticated_only,auth.uid().is.not.null)')
    .maybeSingle();

  if (!post) notFound();

  const p = profile as Profile;
  const bp = post as BlogPost;
  const { postUrl, email, linkedin } = buildShareUrls(bp, p.username);

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <ReadDepthTracker postId={bp.id} />

      {/* Cover image */}
      {bp.cover_image_url && (
        <div className="mb-8 rounded-2xl overflow-hidden aspect-video">
          <Image
            src={bp.cover_image_url}
            alt={bp.title}
            width={1200}
            height={630}
            className="w-full h-full object-cover"
            priority
          />
        </div>
      )}

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">{bp.title}</h1>
        <PostMeta
          publishedAt={bp.published_at}
          readingTimeMinutes={bp.reading_time_minutes}
          tags={bp.tags}
          authorDisplayName={p.display_name}
          authorUsername={p.username}
        />
      </header>

      {/* Sentinel markers for read-depth tracking (invisible) */}
      <div className="relative">
        <div data-read-depth="25" className="absolute" style={{ top: '25%' }} aria-hidden />
        <div data-read-depth="50" className="absolute" style={{ top: '50%' }} aria-hidden />
        <div data-read-depth="75" className="absolute" style={{ top: '75%' }} aria-hidden />
      </div>

      {/* Content */}
      <article>
        <TiptapRenderer content={bp.content} />
      </article>

      {/* Read 100% sentinel */}
      <div data-read-depth="100" aria-hidden />

      {/* Share bar */}
      <div className="mt-12 pt-6 border-t border-gray-200">
        <ShareBar
          postUrl={postUrl}
          postTitle={bp.title}
          postId={bp.id}
          emailUrl={email}
          linkedinUrl={linkedin}
        />
      </div>

      {/* Back to author's blog */}
      <div className="mt-8">
        <a
          href={`/blog/${p.username}`}
          className="text-sm text-sky-600 hover:underline"
        >
          ← More posts by {p.display_name || p.username}
        </a>
      </div>
    </main>
  );
}
