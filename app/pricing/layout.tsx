// app/pricing/layout.tsx
// Pricing page is 'use client' so metadata must come from this layout.

import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Pricing',
  description: 'Simple, transparent pricing. Monthly or lifetime access to your personal operating system. All modules included.',
  path: '/pricing',
  eyebrow: 'CentenarianOS',
  ogTitle: 'CentenarianOS Pricing',
  ogSubtitle: 'Monthly or lifetime access. All modules included.',
});

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
