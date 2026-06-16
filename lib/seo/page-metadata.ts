// lib/seo/page-metadata.ts
// Build a complete, page-specific Metadata object (title, description, canonical, and a
// page-specific Open Graph + Twitter card via /api/og/page). Use this on every public page so
// shared links preview the page, not the home card. Client pages get it via a co-located
// server layout.tsx.

import type { Metadata } from 'next';

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `https://${process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '')}`
  : 'https://centenarianos.com';

interface PageMetaInput {
  title: string;            // page <title> (template adds " · CentenarianOS")
  description: string;
  path: string;             // e.g. "/academy/explore" — used for canonical + og:url
  eyebrow?: string;         // small label on the OG card (e.g. "Academy")
  ogTitle?: string;         // defaults to title
  ogSubtitle?: string;      // defaults to description (kept short on the card)
}

export function buildPageMetadata({ title, description, path, eyebrow, ogTitle, ogSubtitle }: PageMetaInput): Metadata {
  const cardTitle = ogTitle || title;
  const cardSubtitle = ogSubtitle || description;
  const q = new URLSearchParams();
  if (eyebrow) q.set('eyebrow', eyebrow);
  q.set('title', cardTitle);
  if (cardSubtitle) q.set('subtitle', cardSubtitle);
  const ogImage = `${SITE_URL}/api/og/page?${q.toString()}`;
  const canonical = `${SITE_URL}${path}`;

  return {
    title,
    description,
    openGraph: {
      title: cardTitle,
      description,
      url: canonical,
      siteName: 'CentenarianOS',
      images: [{ url: ogImage, width: 1200, height: 630, alt: cardTitle }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: cardTitle,
      description,
      images: [ogImage],
    },
    alternates: { canonical },
  };
}
