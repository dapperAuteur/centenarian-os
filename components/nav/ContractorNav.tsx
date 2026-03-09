'use client';

// components/nav/ContractorNav.tsx
// Contractor subdomain navigation with grouped dropdown menus on desktop.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  HardHat, CreditCard, FileText, DollarSign, Car,
  Package, ScanLine, Database, Settings, Bell, LogOut,
  UserCircle, ChevronDown, Menu, X, MessageCircle,
  BarChart3, ArrowUpDown, Users, Building2, MapPin, Scale, Inbox, IdCard, UserPlus,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: typeof HardHat;
}

interface NavGroup {
  label: string;
  icon: typeof HardHat;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Jobs',
    icon: HardHat,
    items: [
      { label: 'Jobs', href: '/dashboard/contractor/jobs', icon: HardHat },
      { label: 'Offers', href: '/dashboard/contractor/assignments', icon: Inbox },
      { label: 'Board', href: '/dashboard/contractor/board', icon: Users },
      { label: 'Rate Cards', href: '/dashboard/contractor/rate-cards', icon: CreditCard },
      { label: 'Compare', href: '/dashboard/contractor/compare', icon: ArrowUpDown },
      { label: 'Reports', href: '/dashboard/contractor/reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Places',
    icon: MapPin,
    items: [
      { label: 'Venues', href: '/dashboard/contractor/venues', icon: Building2 },
      { label: 'Cities', href: '/dashboard/contractor/cities', icon: MapPin },
    ],
  },
  {
    label: 'Union',
    icon: Scale,
    items: [
      { label: 'Union Docs', href: '/dashboard/contractor/union', icon: Scale },
      { label: 'Memberships', href: '/dashboard/contractor/union/memberships', icon: IdCard },
    ],
  },
  {
    label: 'Money',
    icon: DollarSign,
    items: [
      { label: 'Invoices', href: '/dashboard/finance/invoices', icon: FileText },
      { label: 'Finance', href: '/dashboard/finance/transactions', icon: DollarSign },
      { label: 'Travel', href: '/dashboard/travel', icon: Car },
      { label: 'Equipment', href: '/dashboard/equipment', icon: Package },
    ],
  },
  {
    label: 'Tools',
    icon: ScanLine,
    items: [
      { label: 'Scan', href: '/dashboard/scan', icon: ScanLine },
      { label: 'Data Hub', href: '/dashboard/data', icon: Database },
      { label: 'Invite', href: '/dashboard/contractor/invite', icon: UserPlus },
    ],
  },
];

// Flat list for mobile drawer (grouped with headers)
const ALL_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

function isActive(href: string, pathname: string): boolean {
  if (href === '/dashboard/contractor') return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) => isActive(item.href, pathname));
}

/* ─── Dropdown component ─── */
function NavDropdown({
  group,
  pathname,
  openGroup,
  setOpenGroup,
}: {
  group: NavGroup;
  pathname: string;
  openGroup: string | null;
  setOpenGroup: (g: string | null) => void;
}) {
  const isOpen = openGroup === group.label;
  const groupActive = isGroupActive(group, pathname);
  const Icon = group.icon;
  const menuRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpenGroup(null);
      (e.currentTarget as HTMLElement).closest('[data-dropdown]')?.querySelector('button')?.focus();
    }
  }

  return (
    <div className="relative" data-dropdown>
      <button
        onClick={() => setOpenGroup(isOpen ? null : group.label)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpenGroup(null);
        }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition min-h-11 ${
          groupActive
            ? 'text-amber-400 bg-amber-400/10'
            : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
        {group.label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute top-full left-0 mt-1 w-48 bg-neutral-900 rounded-xl shadow-lg border border-neutral-700 py-1 z-50"
          onKeyDown={handleKeyDown}
        >
          {group.items.map((item) => {
            const ItemIcon = item.icon;
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className={`flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition min-h-11 ${
                  active
                    ? 'text-amber-400 bg-amber-400/10'
                    : 'text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800'
                }`}
                onClick={() => setOpenGroup(null)}
              >
                <ItemIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Main nav ─── */
export interface ContractorNavProps {
  username: string | null;
  unreadMessages: number;
  onLogout: () => void;
}

export default function ContractorNav({ username, unreadMessages, onLogout }: ContractorNavProps) {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Close everything on navigation
  useEffect(() => {
    setUserMenuOpen(false);
    setDrawerOpen(false);
    setOpenGroup(null);
  }, [pathname]);

  // Click outside to close
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (navRef.current && !navRef.current.contains(e.target as Node)) {
      setUserMenuOpen(false);
      setOpenGroup(null);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <>
      <nav
        ref={navRef}
        className="bg-neutral-950 border-b border-neutral-800 sticky top-0 z-50"
        aria-label="Contractor navigation"
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100 focus:px-3 focus:py-2 focus:bg-amber-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
        >
          Skip to content
        </a>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop (lg+) */}
          <div className="hidden lg:flex items-center justify-between h-14">
            <Link href="/dashboard/contractor" className="flex items-center gap-2 text-lg font-bold text-amber-400 shrink-0 mr-4">
              <HardHat className="w-5 h-5" aria-hidden="true" />
              JobHub
            </Link>

            <div className="flex items-center gap-0.5" role="menubar">
              {NAV_GROUPS.map((group) => (
                <NavDropdown
                  key={group.label}
                  group={group}
                  pathname={pathname}
                  openGroup={openGroup}
                  setOpenGroup={setOpenGroup}
                />
              ))}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1 pl-4 border-l border-neutral-800 ml-auto">
              <Link
                href="/dashboard/messages"
                className="relative flex items-center justify-center min-h-11 min-w-11 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
                aria-label={`Messages${unreadMessages > 0 ? `, ${unreadMessages} unread` : ''}`}
              >
                <Bell className="w-5 h-5" aria-hidden="true" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-neutral-950 text-xs font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>

              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition min-h-11"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                  aria-label="User menu"
                >
                  <UserCircle className="w-4 h-4" aria-hidden="true" />
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${userMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>

                {userMenuOpen && (
                  <div className="absolute top-full right-0 mt-1 w-48 bg-neutral-900 rounded-xl shadow-lg border border-neutral-700 py-1 z-50" role="menu">
                    {username && (
                      <Link
                        href={`/profiles/${username}`}
                        className="flex items-center gap-2 px-3 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition min-h-11"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <UserCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                        My Profile
                      </Link>
                    )}
                    <Link
                      href="/dashboard/contractor/settings"
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition min-h-11"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
                      Contractor Settings
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition min-h-11"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
                      Account Settings
                    </Link>
                    <Link
                      href="/dashboard/billing"
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition min-h-11"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <CreditCard className="w-4 h-4 shrink-0" aria-hidden="true" />
                      Billing
                    </Link>
                    <Link
                      href="/dashboard/feedback"
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition min-h-11"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      Feedback
                    </Link>
                    <div className="my-1 border-t border-neutral-700" />
                    <button
                      onClick={() => { setUserMenuOpen(false); onLogout(); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition min-h-11"
                      role="menuitem"
                    >
                      <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile header (< lg) */}
          <div className="flex lg:hidden items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDrawerOpen(true)}
                className="flex items-center justify-center min-h-11 min-w-11 text-neutral-400 hover:bg-neutral-800 rounded-lg transition"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" aria-hidden="true" />
              </button>
              <Link href="/dashboard/contractor" className="flex items-center gap-2 text-lg font-bold text-amber-400">
                <HardHat className="w-5 h-5" aria-hidden="true" />
                JobHub
              </Link>
            </div>
            <Link
              href="/dashboard/messages"
              className="relative flex items-center justify-center min-h-11 min-w-11 text-neutral-400 hover:bg-neutral-800 rounded-lg transition"
              aria-label={`Messages${unreadMessages > 0 ? `, ${unreadMessages} unread` : ''}`}
            >
              <Bell className="w-5 h-5" aria-hidden="true" />
              {unreadMessages > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-neutral-950 text-xs font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 lg:hidden" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-y-0 left-0 z-50 w-72 bg-neutral-950 shadow-xl overflow-y-auto lg:hidden"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-neutral-800">
              <span className="text-lg font-bold text-amber-400 flex items-center gap-2">
                <HardHat className="w-5 h-5" aria-hidden="true" /> JobHub
              </span>
              <button onClick={() => setDrawerOpen(false)} className="flex items-center justify-center min-h-11 min-w-11 rounded-lg hover:bg-neutral-800 transition" aria-label="Close menu">
                <X className="w-5 h-5 text-neutral-500" aria-hidden="true" />
              </button>
            </div>

            {/* Home link */}
            <div className="py-1">
              <Link
                href="/dashboard/contractor"
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition ${
                  pathname === '/dashboard/contractor' ? 'text-amber-400 bg-amber-400/10' : 'text-neutral-300 hover:bg-neutral-800'
                }`}
                aria-current={pathname === '/dashboard/contractor' ? 'page' : undefined}
              >
                <HardHat className="w-5 h-5 shrink-0" aria-hidden="true" />
                Job Hub
              </Link>
            </div>

            {/* Grouped sections */}
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="px-4 pt-4 pb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{group.label}</span>
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition ${
                        active ? 'text-amber-400 bg-amber-400/10' : 'text-neutral-300 hover:bg-neutral-800'
                      }`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}

            <div className="border-t border-neutral-800 my-2" />

            <div className="py-1">
              {username && (
                <Link href={`/profiles/${username}`} className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition">
                  <UserCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> My Profile
                </Link>
              )}
              <Link href="/dashboard/contractor/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition">
                <Settings className="w-4 h-4 shrink-0" aria-hidden="true" /> Contractor Settings
              </Link>
              <Link href="/dashboard/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition">
                <Settings className="w-4 h-4 shrink-0" aria-hidden="true" /> Account Settings
              </Link>
              <Link href="/dashboard/billing" className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition">
                <CreditCard className="w-4 h-4 shrink-0" aria-hidden="true" /> Billing
              </Link>
              <Link href="/dashboard/messages" className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition">
                <Bell className="w-4 h-4 shrink-0" aria-hidden="true" /> Messages
                {unreadMessages > 0 && (
                  <span className="ml-auto w-5 h-5 bg-amber-500 text-neutral-950 text-xs font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>
              <Link href="/dashboard/feedback" className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition">
                <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> Feedback
              </Link>
            </div>

            <div className="border-t border-neutral-800 my-1" />
            <div className="py-1 pb-4">
              <button
                onClick={() => { setDrawerOpen(false); onLogout(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition min-h-11"
              >
                <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" /> Logout
              </button>
            </div>
          </div>
        </>
      )}

      {/* Mobile bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-950 border-t border-neutral-800 lg:hidden"
        role="tablist"
        aria-label="Contractor navigation"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex h-14">
          {[
            { label: 'Hub', href: '/dashboard/contractor', icon: HardHat },
            { label: 'Jobs', href: '/dashboard/contractor/jobs', icon: HardHat },
            { label: 'Invoices', href: '/dashboard/finance/invoices', icon: FileText },
            { label: 'Travel', href: '/dashboard/travel', icon: Car },
            { label: 'Scan', href: '/dashboard/scan', icon: ScanLine },
          ].map(({ label, href, icon: Icon }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                role="tab"
                aria-selected={active}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-11 transition-colors ${
                  active ? 'text-amber-400' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-xs font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
