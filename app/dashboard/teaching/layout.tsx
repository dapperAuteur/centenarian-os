'use client';

// app/dashboard/teaching/layout.tsx
// Sidebar layout for all teaching dashboard pages.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Users, Video, Tag, CreditCard, LayoutDashboard } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard/teaching',              label: 'Overview',     icon: LayoutDashboard, exact: true },
  { href: '/dashboard/teaching/courses',      label: 'Courses',      icon: BookOpen,        exact: false },
  { href: '/dashboard/teaching/students',     label: 'Students',     icon: Users,           exact: false },
  { href: '/dashboard/teaching/live',         label: 'Live Sessions',icon: Video,           exact: false },
  { href: '/dashboard/teaching/promo-codes',  label: 'Promo Codes',  icon: Tag,             exact: false },
  { href: '/dashboard/teaching/payouts',      label: 'Payouts',      icon: CreditCard,      exact: false },
];

export default function TeachingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't apply sidebar layout to course editor pages (they have their own full-page UI)
  const isCoursePage =
    pathname.startsWith('/dashboard/teaching/courses/') &&
    pathname !== '/dashboard/teaching/courses';

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-gray-950">
      {/* Sidebar — hidden on individual course editor pages */}
      {!isCoursePage && (
        <aside className="w-52 shrink-0 border-r border-gray-800 bg-gray-950 py-6">
          <div className="px-4 mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Teaching</p>
          </div>
          <nav className="space-y-0.5 px-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    active
                      ? 'bg-fuchsia-900/40 text-fuchsia-300'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
