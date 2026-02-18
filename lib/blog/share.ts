import { BlogPost } from '@/lib/types';

interface ShareUrls {
  postUrl: string;
  email: string;
  linkedin: string;
}

/**
 * Builds share URLs for a blog post.
 * Requires NEXT_PUBLIC_APP_URL to be set in environment variables.
 */
export function buildShareUrls(post: Pick<BlogPost, 'title' | 'slug'>, username: string): ShareUrls {
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  const postUrl = `${base}/blog/${username}/${post.slug}`;

  return {
    postUrl,
    email: `mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(postUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`,
  };
}
