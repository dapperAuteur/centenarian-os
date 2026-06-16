// app/coaching/layout.tsx
// Coaching page layout with metadata.

import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Longevity Coaching',
  description: 'Personalized 1-on-1 longevity coaching for executives, founders, and creative professionals. Expert guidance for health, performance, and multi-decade goals.',
  path: '/coaching',
  eyebrow: 'CentenarianOS',
  ogTitle: 'Longevity Coaching · CentenarianOS',
  ogSubtitle: 'Personalized 1-on-1 coaching for health, performance, and multi-decade goals.',
});

export default function CoachingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
