'use client';

// components/admin/AdminSidebar.tsx
// Admin navigation sidebar with live unread badges for Messages and Feedback.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, MessageSquare, FileText, Heart, MessageCircle, GraduationCap, Radio } from 'lucide-react';

interface UnreadCounts { feedback: number; messages: number; }

const NAV_ITEMS = [
  { href: '/admin',            label: 'Overview',    icon: LayoutDashboard, exact: true,  badgeKey: null },
  { href: '/admin/users',      label: 'Users',       icon: Users,           exact: false, badgeKey: null },
  { href: '/admin/messages',   label: 'Messages',    icon: MessageSquare,   exact: false, badgeKey: 'messages' as const },
  { href: '/admin/content',    label: 'Content',     icon: FileText,        exact: false, badgeKey: null },
  { href: '/admin/engagement', label: 'Engagement',  icon: Heart,           exact: false, badgeKey: null },
  { href: '/admin/feedback',   label: 'Feedback',    icon: MessageCircle,   exact: false, badgeKey: 'feedback' as const },
  { href: '/admin/academy',    label: 'Academy',     icon: GraduationCap,   exact: false, badgeKey: null },
  { href: '/admin/live',       label: 'Live',        icon: Radio,           exact: false, badgeKey: null },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [unread, setUnread] = useState<UnreadCounts>({ feedback: 0, messages: 0 });

  const fetchCounts = useCallback(() => {
    fetch('/api/admin/unread')
      .then((r) => r.json())
      .then((d) => setUnread({ feedback: d.feedback ?? 0, messages: d.messages ?? 0 }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30_000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  return (
    <nav className="flex-1 p-3 space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact, badgeKey }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        const badge = badgeKey ? unread[badgeKey] : 0;
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              active ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="flex-1">{label}</span>
            {badge > 0 && (
              <span className="px-1.5 py-0.5 bg-fuchsia-600 text-white text-xs font-bold rounded-full min-w-[20px] text-center leading-tight">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
