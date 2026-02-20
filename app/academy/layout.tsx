// app/academy/layout.tsx
// Wraps all academy pages with shared site header and subtle dark background.

import SiteHeader from '@/components/SiteHeader';
import FloatingActionsMenu from '@/components/ui/FloatingActionsMenu';

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">
      <SiteHeader />
      {children}
      <FloatingActionsMenu />
    </div>
  );
}
