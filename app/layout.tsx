// File: app/layout.tsx
// Root layout with font, metadata, and CRITICAL mobile viewport

import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Analytics } from "@vercel/analytics/next"
import { Inter } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import SocialReferralTracker from '@/components/SocialReferralTracker';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { organizationSchema, softwareApplicationSchema } from '@/lib/seo/json-ld';
import { getLocale, getDictionary } from '@/lib/i18n/server';
import { LocaleProvider } from '@/lib/i18n/client';
import type { LocaleBundle } from '@/lib/i18n/config';

const inter = Inter({ subsets: ['latin'] });

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `https://${process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '')}`
  : 'https://centenarianos.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'CentenarianOS',
    template: '%s — CentenarianOS',
  },
  description: 'Multi-decade personal operating system for executing audacious goals through data-driven daily habits',
  openGraph: {
    title: 'CentenarianOS',
    description: 'Multi-decade personal operating system for executing audacious goals through data-driven daily habits',
    url: SITE_URL,
    siteName: 'CentenarianOS',
    images: [{ url: `${SITE_URL}/api/og/default`, width: 1200, height: 630, alt: 'CentenarianOS' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CentenarianOS',
    description: 'Multi-decade personal operating system for executing audacious goals through data-driven daily habits',
    images: [`${SITE_URL}/api/og/default`],
  },
  alternates: {
    canonical: SITE_URL,
    // Plan 31 Phase 1 — hreflang for EN + ES. Phase 2 will expand to
    // per-page canonicals (blog posts, academy courses).
    languages: {
      en: SITE_URL,
      es: SITE_URL,
      'x-default': SITE_URL,
    },
  },
};

// Viewport must be a separate export in Next.js 15+
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5, // Allow zoom for accessibility
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  // Load the three Phase-1 namespaces server-side and pass them to the
  // client LocaleProvider. Future phases extend this list as more
  // surfaces migrate. Total payload is ~1-2 KB gzipped per locale.
  const [common, home, pricing, blog, academy] = await Promise.all([
    getDictionary('common'),
    getDictionary('home'),
    getDictionary('pricing'),
    getDictionary('blog'),
    getDictionary('academy'),
  ]);
  // Construct the bundle as a plain object — a helper from the
  // 'use client' module would cross the RSC boundary and fail at
  // runtime ("call client function from server").
  const bundle: LocaleBundle = {
    locale,
    dictionaries: { common, home, pricing, blog, academy },
  };
  return (
    <html lang={locale}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0d9488" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema()) }}
        />
      </head>
      <body className={inter.className}>
        <LocaleProvider value={bundle}>
          <ToastProvider>
            {children}
          <SocialReferralTracker />
          <Analytics />
          {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || process.env.UMAMI_HOST_URL) && (
            <Script
              src={process.env.UMAMI_HOST_URL ? '/a/script.js' : (process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || 'https://cloud.umami.is/script.js')}
              data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
              {...(process.env.UMAMI_HOST_URL ? { 'data-host-url': '/a' } : {})}
              strategy="afterInteractive"
            />
          )}
          <ServiceWorkerRegistration />
          </ToastProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
