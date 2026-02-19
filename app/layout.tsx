// File: app/layout.tsx
// Root layout with font, metadata, and CRITICAL mobile viewport

import type { Metadata, Viewport } from 'next';
import { Analytics } from "@vercel/analytics/next"
import { Inter } from 'next/font/google';
import './globals.css';

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
      <body className={inter.className}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
