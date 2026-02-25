'use client';

// components/nav/BottomSheet.tsx
// Reusable slide-up sheet for mobile navigation. Used for group item lists and the Me sheet.

import { X } from 'lucide-react';
import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function BottomSheet({ open, onClose, title, children }: Props) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet panel — sits above the bottom tab bar */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-xl lg:hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="font-semibold text-gray-900">{title}</span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {children}
      </div>
    </>
  );
}
