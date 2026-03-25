// app/live/layout.tsx
// Wraps the live page with shared site header.

import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Live Sessions',
  description: 'Join live sessions, workshops, and events on CentenarianOS. Learn from teachers and connect with the community in real time.',
  openGraph: {
    title: 'Live Sessions — CentenarianOS',
    description: 'Join live sessions, workshops, and events. Learn from teachers and connect with the community.',
  },
};

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">
      <SiteHeader />
      {children}
    </div>
  );
}
