'use client';

// components/nav/MobileBottomBar.tsx
// Persistent 5-tab bottom navigation bar for mobile (< lg).
// Tapping an inactive group tab navigates directly to that group's first item.
// Tapping the active group tab opens a BottomSheet to pick a specific item.
// The Me tab always opens the account/utility sheet.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Lock, UserCircle } from 'lucide-react';
import { NAV_GROUPS, isGroupActive, isItemActive } from './NavConfig';
import BottomSheet from './BottomSheet';
import MeSheet from './MeSheet';
import type { DesktopNavProps } from './DesktopNav';

export default function MobileBottomBar({
  hasAccess,
  isAdmin,
  isTeacher,
  username,
  unreadMessages,
  onLogout,
}: Omit<DesktopNavProps, 'subLoading'>) {
  const pathname = usePathname();
  const router = useRouter();
  const [openSheet, setOpenSheet] = useState<string | null>(null); // group id | 'me' | null

  // Close sheet on route change
  useEffect(() => {
    setOpenSheet(null);
  }, [pathname]);

  const activeGroupId = NAV_GROUPS.find((g) => isGroupActive(g, pathname))?.id ?? null;

  function handleTabPress(tabId: string) {
    if (tabId === 'me') {
      setOpenSheet('me');
      return;
    }
    const group = NAV_GROUPS.find((g) => g.id === tabId);
    if (!group) return;

    if (activeGroupId === tabId) {
      // Already in this group — open sheet to jump to a specific item
      setOpenSheet(tabId);
    } else {
      // Navigate to the group's first item
      router.push(group.items[0].href);
    }
  }

  const tabs = [
    ...NAV_GROUPS.map((g) => ({ id: g.id, label: g.label, Icon: g.icon })),
    { id: 'me', label: 'Me', Icon: UserCircle },
  ];

  return (
    <>
      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-1px_4px_rgba(0,0,0,0.06)] lg:hidden"
        role="tablist"
        aria-label="Main navigation"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex h-16">
          {tabs.map(({ id, label, Icon }) => {
            const isActive = id !== 'me' && activeGroupId === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={isActive}
                aria-label={label}
                onClick={() => handleTabPress(id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive ? 'text-fuchsia-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Group item sheets ─────────────────────────────────────────── */}
      {NAV_GROUPS.map((group) => (
        <BottomSheet
          key={group.id}
          open={openSheet === group.id}
          onClose={() => setOpenSheet(null)}
          title={group.label}
        >
          <div className="py-2">
            {group.items.map((item) => {
              const ItemIcon = item.icon;
              const active = isItemActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition ${
                    active ? 'text-fuchsia-700 bg-fuchsia-50' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setOpenSheet(null)}
                  aria-current={active ? 'page' : undefined}
                >
                  <ItemIcon className="w-5 h-5 shrink-0" />
                  {item.label}
                  {item.paid && !hasAccess && (
                    <Lock className="w-3.5 h-3.5 ml-auto shrink-0 text-amber-500" />
                  )}
                </Link>
              );
            })}
          </div>
        </BottomSheet>
      ))}

      {/* ── Me sheet ─────────────────────────────────────────────────── */}
      <MeSheet
        open={openSheet === 'me'}
        onClose={() => setOpenSheet(null)}
        isTeacher={isTeacher}
        isAdmin={isAdmin}
        username={username}
        unreadMessages={unreadMessages}
        onLogout={onLogout}
      />
    </>
  );
}
