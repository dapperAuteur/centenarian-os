'use client';

// components/nav/DesktopNav.tsx
// Desktop grouped-dropdown navigation header + mobile compact header (logo + bell).
// The mobile bottom tab bar handles the main mobile nav; this component owns the top bar.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  Lock,
  Bell,
  Zap,
  Shield,
  Presentation,
  UserCircle,
  CreditCard,
  MessageCircle,
  LogOut,
  Menu,
  Settings,
} from 'lucide-react';
import { getVisibleGroups, isGroupActive, isItemActive } from './NavConfig';
import MobileDrawer from './MobileDrawer';

export interface DesktopNavProps {
  hasAccess: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  username: string | null;
  unreadMessages: number;
  onLogout: () => void;
  subLoading: boolean;
}

export default function DesktopNav({
  hasAccess,
  isAdmin,
  isTeacher,
  username,
  unreadMessages,
  onLogout,
  subLoading,
}: DesktopNavProps) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const visibleGroups = getVisibleGroups(isAdmin);

  // Close all dropdowns on route change
  useEffect(() => {
    setOpenGroup(null);
    setUserMenuOpen(false);
  }, [pathname]);

  // Close on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  return (
    <nav
      ref={navRef}
      className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50"
      aria-label="Main navigation"
    >
      {/* Skip to content — visually hidden, accessible on focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-3 focus:py-2 focus:bg-fuchsia-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Desktop header (lg+) ─────────────────────────────────────── */}
        <div className="hidden lg:flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold text-gray-900 shrink-0 mr-4">
            CentenarianOS
          </Link>

          {/* Group dropdown buttons */}
          <div className="flex items-center gap-0.5">
            {visibleGroups.map((group) => {
              const active = isGroupActive(group, pathname);
              const isOpen = openGroup === group.id;
              return (
                <div key={group.id} className="relative">
                  <button
                    onClick={() => setOpenGroup(isOpen ? null : group.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      active
                        ? 'text-fuchsia-700 bg-fuchsia-50'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                  >
                    {group.label}
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isOpen && (
                    <div
                      className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50"
                      role="menu"
                    >
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const active = isItemActive(item.href, pathname);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-2.5 px-3 py-2 text-sm transition ${
                              active
                                ? 'bg-fuchsia-50 text-fuchsia-700'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                            role="menuitem"
                            aria-current={active ? 'page' : undefined}
                            onClick={() => setOpenGroup(null)}
                          >
                            <ItemIcon className="w-4 h-4 shrink-0" />
                            {item.label}
                            {item.paid && !hasAccess && (
                              <Lock className="w-3 h-3 ml-auto shrink-0 text-amber-500" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 pl-4 border-l border-gray-200 ml-auto">
            {/* Teach — teacher/admin only */}
            {isTeacher && (
              <Link
                href="/dashboard/teaching"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  pathname.startsWith('/dashboard/teaching')
                    ? 'text-purple-700 bg-purple-50'
                    : 'text-purple-700 hover:bg-purple-50'
                }`}
                aria-current={pathname.startsWith('/dashboard/teaching') ? 'page' : undefined}
              >
                <Presentation className="w-4 h-4" />
                Teach
              </Link>
            )}

            {/* Admin badge */}
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-fuchsia-400 rounded-lg text-xs font-bold hover:bg-gray-800 transition"
              >
                <Shield className="w-3 h-3" />
                Admin
              </Link>
            )}

            {/* Upgrade CTA */}
            {!subLoading && !hasAccess && (
              <Link
                href="/pricing"
                className="flex items-center gap-1 px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs font-bold hover:bg-fuchsia-700 transition"
              >
                <Zap className="w-3 h-3" />
                Upgrade
              </Link>
            )}

            {/* Messages bell */}
            <Link
              href="/dashboard/messages"
              className="relative flex items-center p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition"
              aria-label={`Messages${unreadMessages > 0 ? `, ${unreadMessages} unread` : ''}`}
            >
              <Bell className="w-5 h-5" />
              {unreadMessages > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-fuchsia-600 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </Link>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                aria-label="User menu"
              >
                <UserCircle className="w-4 h-4" />
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div
                  className="absolute top-full right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50"
                  role="menu"
                >
                  {username && (
                    <Link
                      href={`/profiles/${username}`}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <UserCircle className="w-4 h-4 shrink-0" />
                      My Profile
                    </Link>
                  )}
                  <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4 shrink-0" />
                    Settings
                  </Link>
                  <Link
                    href="/dashboard/billing"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <CreditCard className="w-4 h-4 shrink-0" />
                    Billing
                  </Link>
                  <Link
                    href="/dashboard/feedback"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    Feedback
                  </Link>
                  <div className="my-1 border-t border-gray-100" />
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                    role="menuitem"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Mobile compact header (< lg) ─────────────────────────────── */}
        <div className="flex lg:hidden items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/" className="text-xl font-bold text-gray-900">
              CentenarianOS
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {!subLoading && !hasAccess && (
              <Link
                href="/pricing"
                className="flex items-center gap-1 px-2 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs font-bold hover:bg-fuchsia-700 transition"
              >
                <Zap className="w-3 h-3" />
                Upgrade
              </Link>
            )}
            <Link
              href="/dashboard/messages"
              className="relative p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              aria-label={`Messages${unreadMessages > 0 ? `, ${unreadMessages} unread` : ''}`}
            >
              <Bell className="w-5 h-5" />
              {unreadMessages > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-fuchsia-600 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        hasAccess={hasAccess}
        isAdmin={isAdmin}
        isTeacher={isTeacher}
        username={username}
        unreadMessages={unreadMessages}
        onLogout={onLogout}
      />
    </nav>
  );
}
