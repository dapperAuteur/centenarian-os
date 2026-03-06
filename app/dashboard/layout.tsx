// File: app/dashboard/layout.tsx
// Protected layout with grouped navigation and subscription gating.

'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useSubscription } from '@/lib/hooks/useSubscription';
import { useUnreadCount } from '@/lib/hooks/useUnreadCount';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import DesktopNav from '@/components/nav/DesktopNav';
import MobileBottomBar from '@/components/nav/MobileBottomBar';
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-sky-600 border-t-transparent rounded-full" />
      </div>
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
