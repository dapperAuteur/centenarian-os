'use client';

// components/nav/ContractorNav.tsx
// Stripped-down navigation for the contractor subdomain.
// Shows only contractor-relevant routes with an amber accent.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import {
  HardHat, CreditCard, FileText, DollarSign, Car,
  Package, ScanLine, Database, Settings, Bell, LogOut,
  UserCircle, ChevronDown, Menu, X, MessageCircle,
  BarChart3, ArrowUpDown, Users, Building2, MapPin, Scale,
} from 'lucide-react';

interface ContractorNavItem {
  label: string;
  href: string;
  icon: typeof HardHat;
}

const NAV_ITEMS: ContractorNavItem[] = [
  { label: 'Job Hub', href: '/dashboard/contractor', icon: HardHat },
  { label: 'Jobs', href: '/dashboard/contractor/jobs', icon: HardHat },
  { label: 'Rate Cards', href: '/dashboard/contractor/rate-cards', icon: CreditCard },
  { label: 'Reports', href: '/dashboard/contractor/reports', icon: BarChart3 },
  { label: 'Compare', href: '/dashboard/contractor/compare', icon: ArrowUpDown },
  { label: 'Board', href: '/dashboard/contractor/board', icon: Users },
  { label: 'Venues', href: '/dashboard/contractor/venues', icon: Building2 },
  { label: 'Cities', href: '/dashboard/contractor/cities', icon: MapPin },
  { label: 'Union', href: '/dashboard/contractor/union', icon: Scale },
  { label: 'Invoices', href: '/dashboard/finance/invoices', icon: FileText },
  { label: 'Finance', href: '/dashboard/finance/transactions', icon: DollarSign },
  { label: 'Travel', href: '/dashboard/travel', icon: Car },
  { label: 'Equipment', href: '/dashboard/equipment', icon: Package },
  { label: 'Scan', href: '/dashboard/scan', icon: ScanLine },
  { label: 'Data Hub', href: '/dashboard/data', icon: Database },
];

function isActive(href: string, pathname: string): boolean {
  if (href === '/dashboard/contractor') return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

export interface ContractorNavProps {
  username: string | null;
  unreadMessages: number;
  onLogout: () => void;
}

export default function ContractorNav({ username, unreadMessages, onLogout }: ContractorNavProps) {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUserMenuOpen(false);
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

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
            <Link href="/dashboard/contractor" className="flex items-center gap-2 text-lg font-bold text-amber-400 shrink-0 mr-6">
              <HardHat className="w-5 h-5" />
              JobHub
            </Link>

            <div className="flex items-center gap-0.5 overflow-x-auto">
              {NAV_ITEMS.slice(1).map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                      active
                        ? 'text-amber-400 bg-amber-400/10'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1 pl-4 border-l border-neutral-800 ml-auto">
              <Link
                href="/dashboard/messages"
                className="relative flex items-center p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
                aria-label={`Messages${unreadMessages > 0 ? `, ${unreadMessages} unread` : ''}`}
              >
                <Bell className="w-5 h-5" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-neutral-950 text-xs font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>

              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                  aria-label="User menu"
                >
                  <UserCircle className="w-4 h-4" />
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute top-full right-0 mt-1 w-44 bg-neutral-900 rounded-xl shadow-lg border border-neutral-700 py-1 z-50" role="menu">
                    {username && (
                      <Link
                        href={`/profiles/${username}`}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 transition"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <UserCircle className="w-4 h-4 shrink-0" />
                        My Profile
                      </Link>
                    )}
                    <Link
                      href="/dashboard/settings"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 transition"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings className="w-4 h-4 shrink-0" />
                      Settings
                    </Link>
                    <Link
                      href="/dashboard/billing"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 transition"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <CreditCard className="w-4 h-4 shrink-0" />
                      Billing
                    </Link>
                    <Link
                      href="/dashboard/feedback"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 transition"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" />
                      Feedback
                    </Link>
                    <div className="my-1 border-t border-neutral-700" />
                    <button
                      onClick={() => { setUserMenuOpen(false); onLogout(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition"
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

          {/* Mobile header (< lg) */}
          <div className="flex lg:hidden items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDrawerOpen(true)}
                className="p-2 text-neutral-400 hover:bg-neutral-800 rounded-lg transition"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <Link href="/dashboard/contractor" className="flex items-center gap-2 text-lg font-bold text-amber-400">
                <HardHat className="w-5 h-5" />
                JobHub
              </Link>
            </div>
            <Link
              href="/dashboard/messages"
              className="relative p-2 text-neutral-400 hover:bg-neutral-800 rounded-lg transition"
              aria-label={`Messages${unreadMessages > 0 ? `, ${unreadMessages} unread` : ''}`}
            >
              <Bell className="w-5 h-5" />
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
                <HardHat className="w-5 h-5" /> JobHub
              </span>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-neutral-800 transition" aria-label="Close menu">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <div className="py-2">
              {NAV_ITEMS.map((item) => {
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
                    <Icon className="w-5 h-5 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="border-t border-neutral-800 my-1" />

            <div className="py-1">
              {username && (
                <Link href={`/profiles/${username}`} className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition">
                  <UserCircle className="w-4 h-4 shrink-0" /> My Profile
                </Link>
              )}
              <Link href="/dashboard/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition">
                <Settings className="w-4 h-4 shrink-0" /> Settings
              </Link>
              <Link href="/dashboard/billing" className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition">
                <CreditCard className="w-4 h-4 shrink-0" /> Billing
              </Link>
              <Link href="/dashboard/messages" className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition">
                <Bell className="w-4 h-4 shrink-0" /> Messages
                {unreadMessages > 0 && (
                  <span className="ml-auto w-5 h-5 bg-amber-500 text-neutral-950 text-xs font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>
              <Link href="/dashboard/feedback" className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition">
                <MessageCircle className="w-4 h-4 shrink-0" /> Feedback
              </Link>
            </div>

            <div className="border-t border-neutral-800 my-1" />
            <div className="py-1 pb-4">
              <button
                onClick={() => { setDrawerOpen(false); onLogout(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition"
              >
                <LogOut className="w-4 h-4 shrink-0" /> Logout
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
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? 'text-amber-400' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
