// app/recipes/layout.tsx
// Public recipes layout. Uses SiteHeader for unified nav (full nav when logged in,
// minimal public header when logged out). Recipes-specific links in a secondary strip.

import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/ui/SiteFooter';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Recipes',
  description: 'Discover and share healthy longevity recipes. Browse community-created meals, import recipes from any URL, and track nutrition.',
  path: '/recipes',
  eyebrow: 'CentenarianOS',
  ogTitle: 'Longevity Recipes',
  ogSubtitle: 'Community-created healthy meals you can browse, import, and track.',
});

export default function RecipesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      {/* Recipes-specific secondary nav strip */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/recipes"
              className="min-h-11 flex items-center text-gray-600 hover:text-gray-900 transition px-2 rounded hover:bg-gray-100"
            >
              All Recipes
            </Link>
            <Link
              href="/recipes/cooks"
              className="min-h-11 flex items-center text-gray-600 hover:text-gray-900 transition px-2 rounded hover:bg-gray-100"
            >
              Cooks
            </Link>
            <Link
              href="/dashboard/recipes/new"
              className="ml-auto min-h-11 flex items-center px-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition text-xs"
            >
              Create
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 text-gray-900 pb-16 lg:pb-0">
        {children}
      </div>

      <SiteFooter theme="light" />
    </div>
  );
}
