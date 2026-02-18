import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import TiptapRenderer from '@/components/blog/TiptapRenderer';
import PostMeta from '@/components/blog/PostMeta';
import ShareBar from '@/components/blog/ShareBar';
import ReadDepthTracker from '@/components/blog/ReadDepthTracker';
import { buildShareUrls } from '@/lib/blog/share';
import { Lock } from 'lucide-react';
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

  const p = profile as Profile;

  // Fetch the post — RLS handles visibility based on whether the user is authenticated
  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('user_id', p.id)
    .eq('slug', slug)
    .or('visibility.eq.public,and(visibility.eq.scheduled,scheduled_at.lte.now()),and(visibility.eq.authenticated_only,auth.uid().is.not.null)')
    .maybeSingle();

  // ── Post is accessible — render it normally ──────────────────────────────
  if (post) {
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

  // ── Post not accessible — check if it exists at all (bypasses RLS) ───────
  const { data: postId } = await supabase.rpc('get_post_id_by_slug', {
    p_user_id: p.id,
    p_slug: slug,
  });

  // Post truly doesn't exist → 404
  if (!postId) notFound();

  // Post exists but is restricted → log a blocked_visit event, then show the
  // unavailable page with the author's other public posts.
  const reqHeaders = await headers();
  const referrer =
    reqHeaders.get('referer') || reqHeaders.get('referrer') || null;
  const country =
    reqHeaders.get('cf-ipcountry') || reqHeaders.get('x-vercel-ip-country') || null;

  // Fire-and-forget — don't let a failed event log break the page render
  await supabase
    .rpc('log_blog_event', {
      p_post_id: postId as string,
      p_event_type: 'blocked_visit',
      p_referrer: referrer,
      p_country: country,
    })
    .then(({ error }) => {
      if (error) console.warn('[blog] blocked_visit log failed:', error.message);
    });

  // Fetch the author's other available posts for the "you might like" section
  const { data: otherPosts } = await supabase
    .from('blog_posts')
    .select('slug, title, published_at, excerpt')
    .eq('user_id', p.id)
    .or('visibility.eq.public,and(visibility.eq.scheduled,scheduled_at.lte.now())')
    .order('published_at', { ascending: false })
    .limit(5);

  return (
    <main className="max-w-3xl mx-auto px-4 py-16">
      {/* Unavailable notice */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 mb-4">
          <Lock className="w-6 h-6 text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          This post is unavailable
        </h1>
        <p className="text-gray-500 max-w-sm mx-auto">
          This post may be private, a draft, or restricted to logged-in members.
          If you think this is a mistake, try{' '}
          <Link href="/login" className="text-sky-600 hover:underline">
            signing in
          </Link>
          .
        </p>
      </div>

      {/* Other posts by this author */}
      <div className="border-t border-gray-100 pt-10">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5">
          More posts by {p.display_name || p.username}
        </h2>

        {otherPosts && otherPosts.length > 0 ? (
          <ul className="space-y-4">
            {otherPosts.map((op) => (
              <li key={op.slug}>
                <Link
                  href={`/blog/${p.username}/${op.slug}`}
                  className="group block p-4 rounded-xl border border-gray-100 hover:border-sky-200 hover:bg-sky-50 transition"
                >
                  <p className="font-medium text-gray-900 group-hover:text-sky-700">
                    {op.title}
                  </p>
                  {op.excerpt && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{op.excerpt}</p>
                  )}
                  {op.published_at && (
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(op.published_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">No public posts yet.</p>
        )}

        <div className="mt-6">
          <Link
            href={`/blog/${p.username}`}
            className="text-sm text-sky-600 hover:underline"
          >
            ← View all posts by {p.display_name || p.username}
          </Link>
        </div>
      </div>
    </main>
  );
}
