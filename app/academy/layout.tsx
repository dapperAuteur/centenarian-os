// app/academy/layout.tsx
// Wraps all academy pages with shared site header and subtle dark background.

import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `https://${process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '')}`
  : 'https://centenarianos.com';

export const metadata: Metadata = {
  title: 'Academy',
  description: 'Expert-led courses on longevity, health, finance, and personal optimization. Learn from instructors on CentenarianOS.',
  openGraph: {
    title: 'CentenarianOS Academy',
    description: 'Expert-led courses on longevity, health, finance, and personal optimization.',
    images: [{ url: `${SITE_URL}/api/og/default`, width: 1200, height: 630 }],
    url: `${SITE_URL}/academy`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CentenarianOS Academy',
    images: [`${SITE_URL}/api/og/default`],
  },
  alternates: { canonical: `${SITE_URL}/academy` },
};

import FloatingActionsMenu from '@/components/ui/FloatingActionsMenu';
import SiteFooter from '@/components/ui/SiteFooter';

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <FloatingActionsMenu />
    </div>
  );
}
