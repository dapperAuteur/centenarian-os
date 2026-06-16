// app/academy/layout.tsx
// Wraps all academy pages with shared site header and subtle dark background.

import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

// Section default for /academy (the catalog index is a client page, so its metadata lives
// here). Child pages override with their own metadata / generateMetadata.
export const metadata: Metadata = buildPageMetadata({
  title: 'Academy',
  description: 'Expert-led courses on longevity, health, finance, and personal optimization. Learn from instructors on CentenarianOS.',
  path: '/academy',
  eyebrow: 'CentenarianOS Academy',
  ogTitle: 'CentenarianOS Academy',
  ogSubtitle: 'Expert-led courses on longevity, health, finance, and personal optimization.',
});

import FloatingActionsMenu from '@/components/ui/FloatingActionsMenu';
import SiteFooter from '@/components/ui/SiteFooter';
import RevokedAssetsPurger from '@/components/academy/offline/RevokedAssetsPurger';
import AcademySubnav from '@/components/academy/AcademySubnav';

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <SiteHeader />
      <AcademySubnav />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <FloatingActionsMenu />
      <RevokedAssetsPurger />
    </div>
  );
}
