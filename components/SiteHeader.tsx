'use client';

// components/SiteHeader.tsx
// Shared nav bar used on public pages (Academy, Live, Blog, Recipes).
// Logged-in users see the full grouped nav (same as dashboard).
// Logged-out users see a minimal public header.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useSubscription } from '@/lib/hooks/useSubscription';
import { useUnreadCount } from '@/lib/hooks/useUnreadCount';
import { createClient } from '@/lib/supabase/client';
import { GraduationCap, Radio, LogIn, BookOpen, ChefHat, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import DesktopNav from '@/components/nav/DesktopNav';
import MobileBottomBar from '@/components/nav/MobileBottomBar';

function PublicHeader() {
  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-gray-900">
          CentenarianOS
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/academy"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
          >
            <GraduationCap className="w-4 h-4" />
            Academy
          </Link>
          <Link
            href="/blog"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
          >
            <BookOpen className="w-4 h-4" />
            Blog
          </Link>
          <Link
            href="/recipes"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
          >
            <ChefHat className="w-4 h-4" />
            Recipes
          </Link>
          <Link
            href="/live"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
          >
            <Radio className="w-4 h-4" />
            Live
          </Link>
          <div className="w-px h-5 bg-gray-200 mx-2" />
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
          >
            <LogIn className="w-4 h-4" />
            Login
          </Link>
          <Link
            href="/pricing"
            className="flex items-center gap-1.5 px-3 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 transition"
          >
            <Zap className="w-4 h-4" />
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}

function AuthenticatedHeader() {
  const { status: subStatus, loading: subLoading } = useSubscription();
  const router = useRouter();
  const supabase = createClient();
  const unreadMessages = useUnreadCount();

  const isPaid = subStatus === 'monthly' || subStatus === 'lifetime';
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const hasAccess = isPaid || isAdmin;

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        setIsAdmin(d.isAdmin ?? false);
        setIsTeacher(d.isTeacher ?? false);
        setUsername(d.username ?? null);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const navProps = {
    hasAccess,
    isAdmin,
    isTeacher,
    username,
    unreadMessages,
    onLogout: handleLogout,
    subLoading,
  };

  return (
    <>
      <DesktopNav {...navProps} />
      <MobileBottomBar {...navProps} />
    </>
  );
}

export default function SiteHeader() {
  const { user, loading } = useAuth();

  if (loading) {
    // Render the public header skeleton while auth loads — avoids layout shift
    return <PublicHeader />;
  }

  if (user) {
    return <AuthenticatedHeader />;
  }

  return <PublicHeader />;
}
