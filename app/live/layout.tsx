// app/live/layout.tsx
// Wraps the live page with shared site header.

import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Live Sessions',
  description: 'Join live sessions, workshops, and events on CentenarianOS. Learn from teachers and connect with the community in real time.',
  path: '/live',
  eyebrow: 'CentenarianOS',
  ogTitle: 'Live Sessions · CentenarianOS',
  ogSubtitle: 'Workshops and events. Learn from teachers and connect with the community.',
});

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">
      <SiteHeader />
      {children}
    </div>
  );
}
