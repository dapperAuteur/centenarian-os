// app/live/layout.tsx
// Wraps the live page with shared site header.

import SiteHeader from '@/components/SiteHeader';

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">
      <SiteHeader />
      {children}
    </div>
  );
}
