import { BlogPost } from '@/lib/types';

interface ShareUrls {
  postUrl: string;
  email: string;
  linkedin: string;
  facebook: string;
}

/**
 * Builds share URLs for a blog post.
 * Uses the Switchy short link when available, falling back to the full URL.
 */
export function buildShareUrls(
  post: Pick<BlogPost, 'title' | 'slug'> & { short_link_url?: string | null },
  username: string,
): ShareUrls {
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  const fullUrl = `${base}/blog/${username}/${post.slug}`;
  const postUrl = post.short_link_url ?? fullUrl;

  return {
    postUrl,
    email: `mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(postUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`,
  };
}
