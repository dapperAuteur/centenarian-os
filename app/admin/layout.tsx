// app/admin/layout.tsx
// Admin-only layout — middleware enforces ADMIN_EMAIL check before this renders

import Link from 'next/link';
import { LayoutDashboard, Users, MessageSquare, FileText, Heart, ArrowLeft } from 'lucide-react';

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/messages', label: 'Messages', icon: MessageSquare },
  { href: '/admin/content', label: 'Content', icon: FileText },
  { href: '/admin/engagement', label: 'Engagement', icon: Heart },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-gray-800 flex flex-col">
        <div className="p-5 border-b border-gray-800">
          <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-400 mb-1">Admin</p>
          <p className="text-lg font-bold text-white">CentenarianOS</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <Link
            href="/dashboard/planner"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-300 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
