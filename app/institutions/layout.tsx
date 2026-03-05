// app/institutions/layout.tsx
// Public institution directory layout — matches blog pattern.

import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/ui/SiteFooter';

export default function InstitutionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SiteHeader />

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-10 text-sm">
            <Link
              href="/institutions"
              className="text-gray-600 hover:text-gray-900 transition px-2 py-1 rounded hover:bg-gray-100"
            >
              All Institutions
            </Link>
            <Link
              href="/dashboard/finance"
              className="ml-auto px-3 py-1 bg-fuchsia-600 text-white rounded-lg font-medium hover:bg-fuchsia-700 transition text-xs"
            >
              My Finance
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 text-gray-900 flex-1 pb-16 lg:pb-0">
        {children}
      </div>
      <SiteFooter theme="light" />
    </div>
  );
}
