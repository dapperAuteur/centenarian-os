// File: app/layout.tsx
// Root layout with font, metadata, and CRITICAL mobile viewport

import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Analytics } from "@vercel/analytics/next"
import { Inter } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CentenarianOS',
  description: 'Multi-decade personal operating system for executing audacious goals through data-driven daily habits',
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
      </head>
      <body className={inter.className}>
        {children}
        <Analytics />
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script
            src={process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || 'https://cloud.umami.is/script.js'}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
          />
        )}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
