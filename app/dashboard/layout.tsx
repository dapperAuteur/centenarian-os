// File: app/dashboard/layout.tsx
// Protected layout with navigation

'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Utensils, Clock, Map, ChartNetwork } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link
                href="/"
                className="flex items-center space-x-2"
              >
                <h1 className="text-xl font-bold text-gray-900">CentenarianOS</h1>
              </Link>
              <div className="flex space-x-4">
                <Link 
                  href="/dashboard/roadmap"
                  className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                >
                  <Map className="w-4 h-4 mr-2" />
                  Roadmap
                </Link>
                <Link 
                  href="/dashboard/planner"
                  className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Daily Tasks
                </Link>
                <Link 
                  href="/dashboard/fuel"
                  className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                >
                  <Utensils className="w-4 h-4 mr-2" />
                  Fuel
                </Link>
                <Link 
                  href="/dashboard/engine"
                  className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Engine
                </Link>
                <Link 
                  href="/dashboard/analytics"
                  className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                >
                  <ChartNetwork className="w-4 h-4 mr-2" />
                  Analytics
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-6">
        {children}
      </main>
    </div>
  );
}