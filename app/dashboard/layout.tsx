// File: app/dashboard/layout.tsx
// Protected layout with grouped navigation and subscription gating.

'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useSubscription } from '@/lib/hooks/useSubscription';
import { useUnreadCount } from '@/lib/hooks/useUnreadCount';
import { useAppMode } from '@/lib/hooks/useAppMode';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import DesktopNav from '@/components/nav/DesktopNav';
import MobileBottomBar from '@/components/nav/MobileBottomBar';
import ContractorLayout from '@/components/nav/ContractorLayout';
import ListerLayout from '@/components/nav/ListerLayout';
import FloatingActionsMenu from '@/components/ui/FloatingActionsMenu';
import OfflineIndicator from '@/components/ui/OfflineIndicator';
import MfaBanner from '@/components/ui/MfaBanner';
import SiteFooter from '@/components/ui/SiteFooter';
import { SyncProvider } from '@/lib/contexts/SyncContext';
import { offlineFetch } from '@/lib/offline/offline-fetch';

// Routes freely accessible without a paid subscription
const FREE_ROUTE_PREFIXES = [
  '/dashboard/blog',
  '/dashboard/recipes',
  '/dashboard/billing',
  '/dashboard/messages',
  '/dashboard/feedback',
  '/dashboard/teaching',
  '/dashboard/settings',
];

function isFreeRoute(pathname: string) {
  return FREE_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading } = useAuth();
  const { status: subStatus, loading: subLoading } = useSubscription();
  const appMode = useAppMode();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const isPaid = subStatus === 'monthly' || subStatus === 'lifetime';
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminUnread, setAdminUnread] = useState(0);
  const [isInvited, setIsInvited] = useState(false);
  const [inviteModules, setInviteModules] = useState<string[] | null>(null);
  const [untoured, setUntoured] = useState<Set<string>>(new Set());
  const hasAccess = isPaid || isAdmin || isInvited;
  // Only apply module restrictions to invited users who aren't paying subscribers or admins
  const allowedModules = isInvited && !isPaid && !isAdmin ? inviteModules : null;
  const unreadMessages = useUnreadCount();

  useEffect(() => {
    offlineFetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        setIsAdmin(d.isAdmin ?? false);
        setIsTeacher(d.isTeacher ?? false);
        setUsername(d.username ?? null);
        setIsInvited(d.isInvited ?? false);
        setInviteModules(d.inviteModules ?? null);
        setAdminLoading(false);
        if (d.isAdmin) {
          offlineFetch('/api/admin/notifications?unread=true')
            .then((r) => r.json())
            .then((nd) => setAdminUnread(nd.unread ?? 0))
            .catch(() => {});
        }
      })
      .catch(() => setAdminLoading(false));
  }, []);

  // Fetch tour status for sparkle badges (auto-seed if no rows exist)
  const refreshTours = useCallback(() => {
    if (appMode !== 'contractor' && appMode !== 'lister') return;
    offlineFetch('/api/onboarding/status')
      .then((r) => r.json())
      .then((d) => {
        const appTours = (d.tours ?? []).filter((t: { app: string }) => t.app === appMode);
        // Auto-seed tour rows if none exist for this app
        if (appTours.length === 0) {
          offlineFetch('/api/onboarding/tours/seed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app: appMode }),
          })
            .then(() => {
              // Re-fetch after seeding
              offlineFetch('/api/onboarding/status')
                .then((r2) => r2.json())
                .then((d2) => {
                  const slugs = new Set<string>();
                  for (const t of d2.tours ?? []) {
                    if (t.status === 'available' && t.app === appMode) slugs.add(t.module_slug);
                  }
                  setUntoured(slugs);
                })
                .catch(() => {});
            })
            .catch(() => {});
          return;
        }
        const slugs = new Set<string>();
        for (const t of appTours) {
          if (t.status === 'available') slugs.add(t.module_slug);
        }
        setUntoured(slugs);
      })
      .catch(() => {});
  }, [appMode]);

  useEffect(() => { refreshTours(); }, [refreshTours]);

  // Listen for tour reset events (fired by TourRestartButton)
  useEffect(() => {
    const handler = () => refreshTours();
    window.addEventListener('tours-reset', handler);
    return () => window.removeEventListener('tours-reset', handler);
  }, [refreshTours]);

  // Redirect free users who land directly on a paid route
  useEffect(() => {
    if (subLoading || loading || adminLoading) return;
    if (!hasAccess && !isFreeRoute(pathname)) {
      router.push('/pricing');
      return;
    }
    // Redirect invited users away from modules they don't have access to
    if (isInvited && !isPaid && !isAdmin && allowedModules && !isFreeRoute(pathname)) {
      const allowed = allowedModules.some(
        (m) => pathname === m || pathname.startsWith(m + '/'),
      );
      if (!allowed) router.push('/dashboard/planner');
    }
  }, [hasAccess, isInvited, isPaid, isAdmin, allowedModules, pathname, subLoading, loading, adminLoading, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    const isDark = appMode === 'contractor' || appMode === 'lister';
    const accent = appMode === 'lister' ? 'border-indigo-500' : appMode === 'contractor' ? 'border-amber-500' : 'border-sky-600';
    return (
      <div className={`min-h-screen ${isDark ? 'bg-neutral-950' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className={`animate-spin h-8 w-8 border-4 ${accent} border-t-transparent rounded-full`} />
      </div>
    );
  }

  // Contractor subdomain — render stripped-down dark layout
  if (appMode === 'contractor') {
    return (
      <SyncProvider>
        <ContractorLayout
          username={username}
          unreadMessages={unreadMessages}
          onLogout={handleLogout}
          untoured={untoured}
          onToursChanged={refreshTours}
        >
          {children}
        </ContractorLayout>
      </SyncProvider>
    );
  }

  // Lister subdomain — render lister dark layout
  if (appMode === 'lister') {
    return (
      <SyncProvider>
        <ListerLayout
          username={username}
          unreadMessages={unreadMessages}
          onLogout={handleLogout}
          untoured={untoured}
          onToursChanged={refreshTours}
        >
          {children}
        </ListerLayout>
      </SyncProvider>
    );
  }

  const navProps = {
    hasAccess,
    isAdmin,
    isTeacher,
    username,
    unreadMessages,
    adminUnread,
    onLogout: handleLogout,
    subLoading,
    allowedModules,
  };

  return (
    <SyncProvider>
      <div className="min-h-screen bg-gray-50">
        <DesktopNav {...navProps} />
        <MfaBanner />
        <OfflineIndicator />

        {/* Teaching routes get zero padding so their dark layout fills edge-to-edge */}
        <main
          id="main-content"
          className={`${
            pathname.startsWith('/dashboard/teaching') ? '' : 'px-4 sm:px-6 lg:px-8 py-4 sm:py-6'
          } pb-16 lg:pb-0`}
        >
          {children}
        </main>

        {/* Footer — pb-16 clears fixed MobileBottomBar on mobile */}
        <div className="pb-16 lg:pb-0">
          <SiteFooter theme="light" />
        </div>

        {/* Mobile bottom tab bar — fixed, sits above safe area */}
        <MobileBottomBar {...navProps} />

        <FloatingActionsMenu />
      </div>
    </SyncProvider>
  );
}
