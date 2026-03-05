'use client';

// components/nav/MobileDrawer.tsx
// Full-height slide-out drawer for mobile — gives single-tap access to every page.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  X, Lock, Bell, UserCircle, CreditCard,
  MessageCircle, Presentation, Shield, LogOut, Settings,
} from 'lucide-react';
import { getVisibleGroups, isItemActive } from './NavConfig';

interface Props {
  open: boolean;
  onClose: () => void;
  hasAccess: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  username: string | null;
  unreadMessages: number;
  onLogout: () => void;
  allowedModules?: string[] | null;
}

export default function MobileDrawer({
  open,
  onClose,
  hasAccess,
  isAdmin,
  isTeacher,
  username,
  unreadMessages,
  onLogout,
  allowedModules,
}: Props) {
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    onClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const groups = getVisibleGroups(isAdmin, allowedModules);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl overflow-y-auto lg:hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <span className="text-lg font-bold text-gray-900">CentenarianOS</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Nav groups */}
        <div className="py-2">
          {groups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.id} className="mb-1">
                <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <GroupIcon className="w-3.5 h-3.5" />
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const ItemIcon = item.icon;
                  const active = isItemActive(item.href, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition ${
                        active ? 'text-fuchsia-700 bg-fuchsia-50' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      aria-current={active ? 'page' : undefined}
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
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 my-1" />

        {/* Teaching / Admin */}
        <div className="py-1">
          {isTeacher && (
            <Link
              href="/dashboard/teaching"
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-purple-700 hover:bg-purple-50 transition"
            >
              <Presentation className="w-4 h-4 shrink-0" />
              Teaching
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-fuchsia-700 hover:bg-fuchsia-50 transition"
            >
              <Shield className="w-4 h-4 shrink-0" />
              Admin Dashboard
            </Link>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 my-1" />

        {/* Account items */}
        <div className="py-1">
          <Link
            href="/dashboard/messages"
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            <Bell className="w-4 h-4 shrink-0" />
            Messages
            {unreadMessages > 0 && (
              <span className="ml-auto w-5 h-5 bg-fuchsia-600 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </Link>
          {username && (
            <Link
              href={`/profiles/${username}`}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              <UserCircle className="w-4 h-4 shrink-0" />
              My Profile
            </Link>
          )}
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            <Settings className="w-4 h-4 shrink-0" />
            Settings
          </Link>
          <Link
            href="/dashboard/billing"
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            Billing
          </Link>
          <Link
            href="/dashboard/feedback"
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            Feedback
          </Link>
        </div>

        {/* Logout */}
        <div className="border-t border-gray-100 my-1" />
        <div className="py-1 pb-4">
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Logout
          </button>
        </div>
      </div>
    </>
  );
}
