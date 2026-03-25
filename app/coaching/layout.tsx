// app/coaching/layout.tsx
// Coaching page layout with metadata.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Longevity Coaching',
  description: 'Personalized 1-on-1 longevity coaching for executives, founders, and creative professionals. Expert guidance for health, performance, and multi-decade goals.',
  openGraph: {
    title: 'Longevity Coaching — CentenarianOS',
    description: 'Personalized 1-on-1 longevity coaching. Expert guidance for health, performance, and multi-decade goals.',
  },
};

export default function CoachingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
