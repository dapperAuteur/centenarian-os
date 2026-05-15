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
import { GraduationCap, Radio, LogIn, BookOpen, ChefHat, Zap, Dumbbell, Activity, Globe, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import DesktopNav from '@/components/nav/DesktopNav';
import MobileBottomBar from '@/components/nav/MobileBottomBar';
import LanguageToggle from '@/components/i18n/LanguageToggle';
import { useLocale } from '@/lib/i18n/client';
import { DEFAULT_LOCALE } from '@/lib/i18n/config';

// Nav items shared between the desktop row and mobile drawer so the two
// stay in sync. 11 items + language toggle don't fit on viewports narrower
// than ~1280px, so below xl we collapse to a hamburger.
const PUBLIC_NAV_ITEMS: Array<{ href: string; label: string; Icon: typeof GraduationCap }> = [
  { href: '/academy', label: 'Academy', Icon: GraduationCap },
  { href: '/academy/explore', label: 'Explore', Icon: Globe },
  { href: '/blog', label: 'Blog', Icon: BookOpen },
  { href: '/recipes', label: 'Recipes', Icon: ChefHat },
  { href: '/live', label: 'Live', Icon: Radio },
  { href: '/exercises', label: 'Exercises', Icon: Dumbbell },
  { href: '/workouts', label: 'Workouts', Icon: Activity },
];

function PublicHeader() {
  const locale = useLocale() ?? DEFAULT_LOCALE;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-gray-900" onClick={() => setMobileOpen(false)}>
          CentenarianOS
        </Link>

        {/* Desktop nav: visible at xl+ where all 11 items fit comfortably */}
        <div className="hidden xl:flex items-center gap-1">
          {PUBLIC_NAV_ITEMS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
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
          <LanguageToggle currentLocale={locale} />
        </div>

        {/* Mobile/tablet: hamburger + Get Started shortcut + language toggle.
            Keep Get Started visible so the top-of-funnel CTA isn't hidden
            behind an extra tap on the marketing pages. */}
        <div className="flex xl:hidden items-center gap-1">
          <Link
            href="/pricing"
            className="flex items-center gap-1.5 px-3 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 transition min-h-11"
            onClick={() => setMobileOpen(false)}
          >
            <Zap className="w-4 h-4" aria-hidden="true" />
            Get Started
          </Link>
          <LanguageToggle currentLocale={locale} />
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 transition"
          >
            {mobileOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer panel — vertical list of all nav items. */}
      {mobileOpen && (
        <div className="xl:hidden border-t border-gray-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-col">
            {PUBLIC_NAV_ITEMS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-3 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition min-h-11"
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                {label}
              </Link>
            ))}
            <div className="h-px bg-gray-200 my-2" />
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-3 py-3 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition min-h-11"
            >
              <LogIn className="w-5 h-5" aria-hidden="true" />
              Login
            </Link>
          </div>
        </div>
      )}
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
    offlineFetch('/api/auth/me')
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
