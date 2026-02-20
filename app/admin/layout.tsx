// app/admin/layout.tsx
// Admin-only layout — middleware enforces ADMIN_EMAIL check before this renders

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-800 flex flex-col">
        <div className="p-5 border-b border-gray-800">
          <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-400 mb-1">Admin</p>
          <p className="text-lg font-bold text-white">CentenarianOS</p>
        </div>
        <AdminSidebar />
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
