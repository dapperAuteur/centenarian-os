/* eslint-disable @typescript-eslint/no-unused-vars */
// File: app/dashboard/layout.tsx
// Protected layout with mobile-first navigation

'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  LogOut, 
  Utensils, 
  Clock, 
  Map, 
  ChartNetwork, 
  Timer, 
  History, 
  BarChart2,
  Menu,
  Briefcase,
  CalendarClock,
  X
} from 'lucide-react';
import { useState } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      {/* Top Navigation - Mobile First */}
      <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">CentenarianOS</h1>
              </Link>
            </div>

            {/* Desktop Navigation - Hidden on mobile */}
            <div className="hidden lg:flex items-center space-x-4">
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
                <CalendarClock className="w-4 h-4 mr-2" />
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
                <Briefcase className="w-4 h-4 mr-2" />
                Engine
              </Link>
              <Link 
                href="/dashboard/engine/focus"
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <Timer className="w-4 h-4 mr-2" />
                Focus Timer
              </Link>
              <Link 
                href="/dashboard/engine/sessions"
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <History className="w-4 h-4 mr-2" />
                History
              </Link>
              <Link 
                href="/dashboard/analytics"
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <ChartNetwork className="w-4 h-4 mr-2" />
                Analytics
              </Link>

              <Link 
                href="/dashboard/engine/analytics"
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <BarChart2 className="w-4 h-4 mr-2" />
                Focus Analytics
              </Link>
              
              <div className="flex items-center space-x-2 pl-4 border-l border-gray-200">
                <span className="text-xs sm:text-sm text-gray-600 hidden xl:inline">{user?.email}</span>
                <button
                  onClick={handleLogout}
                  className="flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex lg:hidden items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-600 hover:text-gray-900"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="lg:hidden py-4 space-y-2">
              <Link 
                href="/dashboard/roadmap"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <Map className="w-4 h-4 mr-3" />
                  Roadmap
                </div>
              </Link>
              <Link 
                href="/dashboard/planner"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <CalendarClock className="w-4 h-4 mr-3" />
                  Daily Tasks
                </div>
              </Link>
              <Link 
                href="/dashboard/fuel"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <Utensils className="w-4 h-4 mr-3" />
                  Fuel
                </div>
              </Link>
              <Link 
                href="/dashboard/engine"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <Briefcase className="w-4 h-4 mr-3" />
                  Engine
                </div>
              </Link>
              <Link 
                href="/dashboard/engine/focus"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <Timer className="w-4 h-4 mr-3" />
                  Focus Timer
                </div>
              </Link>

              <Link 
                href="/dashboard/engine/sessions"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <History className="w-4 h-4 mr-3" />
                  History
                </div>
              </Link>
              <Link 
                href="/dashboard/analytics"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <ChartNetwork className="w-4 h-4 mr-3" />
                  Analytics
                </div>
              </Link>
              <Link 
                href="/dashboard/engine/analytics"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <BarChart2 className="w-4 h-4 mr-3" />
                  Focus Analytics
                </div>
              </Link>

              <div className="pt-4 border-t border-gray-200 mt-4">
                <div className="px-3 py-2 text-xs text-gray-600 truncate">
                  {user?.email}
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content - Mobile First Spacing */}
      <main className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}
