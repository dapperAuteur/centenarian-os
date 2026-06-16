// app/academy/paths/layout.tsx
// The paths page is a client component, so its share metadata lives here.

import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Learning Paths',
  description: 'Guided sequences of courses that build on each other, with recommendations tailored to your goals on CentenarianOS Academy.',
  path: '/academy/paths',
  eyebrow: 'CentenarianOS Academy',
  ogTitle: 'Learning Paths',
  ogSubtitle: 'Guided course sequences that build toward a goal.',
});

export default function PathsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
