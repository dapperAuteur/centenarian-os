// File: app/layout.tsx
// Root layout with font, metadata, and CRITICAL mobile viewport

import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Analytics } from "@vercel/analytics/next"
import { Inter } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import SocialReferralTracker from '@/components/SocialReferralTracker';
import { organizationSchema } from '@/lib/seo/json-ld';

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
};

// Viewport must be a separate export in Next.js 15+
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5, // Allow zoom for accessibility
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0d9488" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema()) }}
        />
      </head>
      <body className={inter.className}>
        {children}
        <SocialReferralTracker />
        <Analytics />
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script
            src={process.env.UMAMI_HOST_URL ? '/a/script.js' : (process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || 'https://cloud.umami.is/script.js')}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            {...(process.env.UMAMI_HOST_URL ? { 'data-host-url': '/a' } : {})}
            strategy="afterInteractive"
          />
        )}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
