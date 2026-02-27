'use client';

// components/nav/MeSheet.tsx
// Account/utility items in a bottom sheet — shown by the Me tab on mobile.

import Link from 'next/link';
import {
  Bell,
  UserCircle,
  CreditCard,
  MessageCircle,
  Presentation,
  Shield,
  LogOut,
  Bot,
  Gem,
} from 'lucide-react';
import BottomSheet from './BottomSheet';

interface Props {
  open: boolean;
  onClose: () => void;
  isTeacher: boolean;
  isAdmin: boolean;
  username: string | null;
  unreadMessages: number;
  onLogout: () => void;
}

export default function MeSheet({
  open,
  onClose,
  isTeacher,
  isAdmin,
  username,
  unreadMessages,
  onLogout,
}: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Account">
      <div className="py-2">
        <Link
          href="/dashboard/messages"
          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
          onClick={onClose}
        >
          <Bell className="w-5 h-5 shrink-0" />
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
            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
            onClick={onClose}
          >
            <UserCircle className="w-5 h-5 shrink-0" />
            My Profile
          </Link>
        )}

        <Link
          href="/dashboard/billing"
          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
          onClick={onClose}
        >
          <CreditCard className="w-5 h-5 shrink-0" />
          Billing
        </Link>

        <Link
          href="/dashboard/feedback"
          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
          onClick={onClose}
        >
          <MessageCircle className="w-5 h-5 shrink-0" />
          Feedback
        </Link>

        {(isTeacher || isAdmin) && <div className="my-1 border-t border-gray-100" />}

        {isTeacher && (
          <Link
            href="/dashboard/teaching"
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-purple-700 hover:bg-purple-50 transition"
            onClick={onClose}
          >
            <Presentation className="w-5 h-5 shrink-0" />
            Teaching
          </Link>
        )}

        {isAdmin && (
          <>
            <Link
              href="/dashboard/coach"
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-fuchsia-700 hover:bg-fuchsia-50 transition"
              onClick={onClose}
            >
              <Bot className="w-5 h-5 shrink-0" />
              Coach
            </Link>
            <Link
              href="/dashboard/gems"
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-fuchsia-700 hover:bg-fuchsia-50 transition"
              onClick={onClose}
            >
              <Gem className="w-5 h-5 shrink-0" />
              Gems
            </Link>
            <Link
              href="/admin"
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-fuchsia-700 hover:bg-fuchsia-50 transition"
              onClick={onClose}
            >
              <Shield className="w-5 h-5 shrink-0" />
              Admin Dashboard
            </Link>
          </>
        )}

        <div className="my-1 border-t border-gray-100" />

        <button
          onClick={() => {
            onClose();
            onLogout();
          }}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          Logout
        </button>
      </div>
    </BottomSheet>
  );
}
