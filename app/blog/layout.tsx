// app/blog/layout.tsx
// Public blog layout. Uses SiteHeader for unified nav (full nav when logged in,
// minimal public header when logged out). Blog-specific links in a secondary strip.

import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `https://${process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '')}`
  : 'https://centenarianos.com';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Member posts on longevity, health, finance, travel, and personal development from the CentenarianOS community.',
  openGraph: {
    title: 'CentenarianOS Blog',
    description: 'Member posts on longevity, health, finance, and personal development.',
    images: [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630 }],
    url: `${SITE_URL}/blog`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CentenarianOS Blog',
    images: [`${SITE_URL}/og-default.png`],
  },
  alternates: { canonical: `${SITE_URL}/blog` },
};

import SiteFooter from '@/components/ui/SiteFooter';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SiteHeader />

      {/* Blog-specific secondary nav strip */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-10 text-sm">
            <Link
              href="/blog"
              className="text-gray-600 hover:text-gray-900 transition px-2 py-1 rounded hover:bg-gray-100"
            >
              All Posts
            </Link>
            <Link
              href="/blog/authors"
              className="text-gray-600 hover:text-gray-900 transition px-2 py-1 rounded hover:bg-gray-100"
            >
              Authors
            </Link>
            <Link
              href="/dashboard/blog"
              className="ml-auto px-3 py-1 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 transition text-xs"
            >
              Write
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 text-gray-900 flex-1 pb-16 lg:pb-0">
        {children}
      </div>
      <SiteFooter theme="light" />
    </div>
  );
}
