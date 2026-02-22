// app/academy/layout.tsx
// Wraps all academy pages with shared site header and subtle dark background.

import SiteHeader from '@/components/SiteHeader';
import FloatingActionsMenu from '@/components/ui/FloatingActionsMenu';
import SiteFooter from '@/components/ui/SiteFooter';

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <FloatingActionsMenu />
    </div>
  );
}
