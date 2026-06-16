// app/academy/teach/layout.tsx
// The teach page is a client component, so its share metadata lives here.

import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Teach on CentenarianOS',
  description: 'Create and sell courses to a community focused on longevity and health. Keep most of every sale, with built-in quizzes, assignments, and payouts.',
  path: '/academy/teach',
  eyebrow: 'CentenarianOS Academy',
  ogTitle: 'Teach on CentenarianOS',
  ogSubtitle: 'Create and sell courses on longevity, health, and personal optimization.',
});

export default function TeachLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
