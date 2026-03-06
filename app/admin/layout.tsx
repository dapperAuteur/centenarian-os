// app/admin/layout.tsx
// Admin-only layout — middleware enforces ADMIN_EMAIL check before this renders

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Menu, X } from 'lucide-react';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex dark-input">
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 bg-gray-950 border-b border-gray-800 px-4 py-3 lg:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open admin menu"
          className="p-2 rounded-lg hover:bg-gray-800 transition"
        >
          <Menu className="w-5 h-5" />
        </button>
        <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-400">Admin</p>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 shrink-0 border-r border-gray-800 bg-gray-950 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="navigation"
        aria-label="Admin navigation"
      >
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-400 mb-1">Admin</p>
            <p className="text-lg font-bold text-white">CentenarianOS</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close admin menu"
            className="p-1.5 rounded-lg hover:bg-gray-800 transition lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
        <div className="p-3 border-t border-gray-800">
          <Link
            href="/dashboard/planner"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
