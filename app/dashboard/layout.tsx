// File: app/dashboard/layout.tsx
// Protected layout with mobile-first navigation and subscription gating

'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useSubscription } from '@/lib/hooks/useSubscription';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LogOut,
  Utensils,
  Map,
  ChartNetwork,
  Timer,
  History,
  BarChart2,
  Menu,
  Briefcase,
  CalendarClock,
  X,
  BookOpen,
  ChefHat,
  Lock,
  CreditCard,
  Zap,
  Bell,
  Shield,
  MessageCircle,
  GraduationCap,
  Radio,
  Presentation,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import FloatingActionsMenu from '@/components/ui/FloatingActionsMenu';

function useUnreadCount() {
  const [unread, setUnread] = useState(0);
  const fetch_ = useCallback(() => {
    fetch('/api/messages?count=true')
      .then((r) => r.json())
      .then((d) => setUnread(d.unread ?? 0))
      .catch(() => {});
  }, []);
  useEffect(() => {
    fetch_();
    const interval = setInterval(fetch_, 60_000);
    return () => clearInterval(interval);
  }, [fetch_]);
  return unread;
}

// Routes freely accessible without a paid subscription
const FREE_ROUTE_PREFIXES = [
  '/dashboard/blog',
  '/dashboard/recipes',
  '/dashboard/billing',
  '/dashboard/messages',
  '/dashboard/feedback',
  '/dashboard/teaching',
];

function isFreeRoute(pathname: string) {
  return FREE_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const { status: subStatus, loading: subLoading } = useSubscription();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isPaid = subStatus === 'monthly' || subStatus === 'lifetime';
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const hasAccess = isPaid || isAdmin;
  const unreadMessages = useUnreadCount();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        setIsAdmin(d.isAdmin ?? false);
        setIsTeacher(d.isTeacher ?? false);
        setAdminLoading(false);
      })
      .catch(() => setAdminLoading(false));
  }, []);

  // Redirect free users who land directly on a paid route
  useEffect(() => {
    if (subLoading || loading || adminLoading) return;
    if (!hasAccess && !isFreeRoute(pathname)) {
      router.push('/pricing');
    }
  }, [hasAccess, pathname, subLoading, loading, adminLoading, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Helper: renders a lock badge for free users on paid links
  function LockBadge() {
    if (hasAccess) return null;
    return <Lock className="w-3 h-3 ml-1 text-amber-500 flex-shrink-0" />;
  }

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

            {/* Desktop Navigation - Hidden on mobile/tablet */}
            <div className="hidden xl:flex items-center space-x-1">
              <Link
                href="/dashboard/roadmap"
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <Map className="w-4 h-4 mr-2" />
                Roadmap
                <LockBadge />
              </Link>
              <Link
                href="/dashboard/planner"
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <CalendarClock className="w-4 h-4 mr-2" />
                Daily Tasks
                <LockBadge />
              </Link>
              <Link
                href="/dashboard/fuel"
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <Utensils className="w-4 h-4 mr-2" />
                Fuel
                <LockBadge />
              </Link>
              <Link
                href="/dashboard/engine"
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <Briefcase className="w-4 h-4 mr-2" />
                Engine
                <LockBadge />
              </Link>
              <Link
                href="/dashboard/analytics"
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <ChartNetwork className="w-4 h-4 mr-2" />
                Analytics
                <LockBadge />
              </Link>
              <Link
                href="/dashboard/blog"
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Blog
              </Link>
              <Link
                href="/dashboard/recipes"
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <ChefHat className="w-4 h-4 mr-2" />
                Recipes
              </Link>
              <Link
                href="/academy"
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                Academy
              </Link>
              <Link
                href="/live"
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <Radio className="w-4 h-4 mr-2" />
                Live
              </Link>
              {isTeacher && (
                <Link
                  href="/dashboard/teaching"
                  className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-50 transition"
                >
                  <Presentation className="w-4 h-4 mr-2" />
                  Teaching
                </Link>
              )}

              <div className="flex items-center space-x-2 pl-4 border-l border-gray-200">
                {/* Admin link */}
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-fuchsia-400 rounded-lg text-xs font-bold hover:bg-gray-800 transition"
                  >
                    <Shield className="w-3 h-3" />
                    Admin
                  </Link>
                )}
                {/* Upgrade CTA for free users */}
                {!subLoading && !hasAccess && (
                  <Link
                    href="/pricing"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs font-bold hover:bg-fuchsia-700 transition"
                  >
                    <Zap className="w-3 h-3" />
                    Upgrade
                  </Link>
                )}
                <Link
                  href="/dashboard/messages"
                  className="relative flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                  title="Messages"
                >
                  <Bell className="w-4 h-4" />
                  {unreadMessages > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-fuchsia-600 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </span>
                  )}
                </Link>
                <Link
                  href="/dashboard/feedback"
                  className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                  title="My Feedback"
                >
                  <MessageCircle className="w-4 h-4" />
                </Link>
                <Link
                  href="/dashboard/billing"
                  className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Billing
                </Link>
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

            {/* Mobile/Tablet Menu Button */}
            <div className="flex xl:hidden items-center gap-2">
              {!subLoading && !hasAccess && (
                <Link
                  href="/pricing"
                  className="flex items-center gap-1 px-2 py-1 bg-fuchsia-600 text-white rounded-lg text-xs font-bold hover:bg-fuchsia-700 transition"
                >
                  <Zap className="w-3 h-3" />
                  Upgrade
                </Link>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-600 hover:text-gray-900"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile/Tablet Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="xl:hidden py-4 space-y-2">
              <Link
                href="/dashboard/roadmap"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Map className="w-4 h-4 mr-3" />
                    Roadmap
                  </div>
                  {!hasAccess && <Lock className="w-3 h-3 text-amber-500" />}
                </div>
              </Link>
              <Link
                href="/dashboard/planner"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CalendarClock className="w-4 h-4 mr-3" />
                    Daily Tasks
                  </div>
                  {!hasAccess && <Lock className="w-3 h-3 text-amber-500" />}
                </div>
              </Link>
              <Link
                href="/dashboard/fuel"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Utensils className="w-4 h-4 mr-3" />
                    Fuel
                  </div>
                  {!hasAccess && <Lock className="w-3 h-3 text-amber-500" />}
                </div>
              </Link>
              <Link
                href="/dashboard/engine"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Briefcase className="w-4 h-4 mr-3" />
                    Engine
                  </div>
                  {!hasAccess && <Lock className="w-3 h-3 text-amber-500" />}
                </div>
              </Link>
              <Link
                href="/dashboard/engine/focus"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Timer className="w-4 h-4 mr-3" />
                    Focus Timer
                  </div>
                  {!hasAccess && <Lock className="w-3 h-3 text-amber-500" />}
                </div>
              </Link>
              <Link
                href="/dashboard/engine/sessions"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <History className="w-4 h-4 mr-3" />
                    History
                  </div>
                  {!hasAccess && <Lock className="w-3 h-3 text-amber-500" />}
                </div>
              </Link>
              <Link
                href="/dashboard/analytics"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <ChartNetwork className="w-4 h-4 mr-3" />
                    Analytics
                  </div>
                  {!hasAccess && <Lock className="w-3 h-3 text-amber-500" />}
                </div>
              </Link>
              <Link
                href="/dashboard/engine/analytics"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <BarChart2 className="w-4 h-4 mr-3" />
                    Focus Analytics
                  </div>
                  {!hasAccess && <Lock className="w-3 h-3 text-amber-500" />}
                </div>
              </Link>
              <Link
                href="/dashboard/blog"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <BookOpen className="w-4 h-4 mr-3" />
                  Blog
                </div>
              </Link>
              <Link
                href="/dashboard/recipes"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <ChefHat className="w-4 h-4 mr-3" />
                  Recipes
                </div>
              </Link>
              <Link
                href="/academy"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <GraduationCap className="w-4 h-4 mr-3" />
                  Academy
                </div>
              </Link>
              <Link
                href="/live"
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <Radio className="w-4 h-4 mr-3" />
                  Live
                </div>
              </Link>
              {isTeacher && (
                <Link
                  href="/dashboard/teaching"
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-50 transition"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center">
                    <Presentation className="w-4 h-4 mr-3" />
                    Teaching
                  </div>
                </Link>
              )}

              <div className="pt-4 border-t border-gray-200 mt-4 space-y-2">
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="block px-3 py-2 rounded-lg text-sm font-bold text-fuchsia-700 bg-gray-100 hover:bg-gray-200 transition"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="flex items-center">
                      <Shield className="w-4 h-4 mr-3" />
                      Admin Dashboard
                    </div>
                  </Link>
                )}
                <Link
                  href="/dashboard/messages"
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Bell className="w-4 h-4 mr-3" />
                      Messages
                    </div>
                    {unreadMessages > 0 && (
                      <span className="w-5 h-5 bg-fuchsia-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unreadMessages > 9 ? '9+' : unreadMessages}
                      </span>
                    )}
                  </div>
                </Link>
                <Link
                  href="/dashboard/feedback"
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center">
                    <MessageCircle className="w-4 h-4 mr-3" />
                    My Feedback
                  </div>
                </Link>
                <Link
                  href="/dashboard/billing"
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center">
                    <CreditCard className="w-4 h-4 mr-3" />
                    Billing
                  </div>
                </Link>
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
      {/* Teaching routes get zero padding so their dark layout fills edge-to-edge */}
      <main className={pathname.startsWith('/dashboard/teaching') ? '' : 'px-4 sm:px-6 lg:px-8 py-4 sm:py-6'}>
        {children}
      </main>

      <FloatingActionsMenu />
    </div>
  );
}
