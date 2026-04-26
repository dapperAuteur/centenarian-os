// app/pricing/layout.tsx
// Pricing page is 'use client' so metadata must come from this layout.

import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `https://${process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '')}`
  : 'https://centenarianos.com';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, transparent pricing. Monthly or lifetime access to your personal operating system. All modules included.',
  openGraph: {
    title: 'CentenarianOS Pricing',
    description: 'Monthly or lifetime access. All modules included.',
    images: [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630 }],
    url: `${SITE_URL}/pricing`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CentenarianOS Pricing',
    images: [`${SITE_URL}/og-default.png`],
  },
  alternates: { canonical: `${SITE_URL}/pricing` },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
