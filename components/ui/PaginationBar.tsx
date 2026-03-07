'use client';

// components/ui/PaginationBar.tsx
// Reusable pagination control for admin tables.

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  variant?: 'dark' | 'light';
}

export default function PaginationBar({ page, totalPages, onPageChange, variant = 'dark' }: PaginationBarProps) {
  if (totalPages <= 1) return null;

  const dark = variant === 'dark';

  return (
    <nav className={`flex items-center justify-between px-5 py-3 border-t ${dark ? 'border-gray-800' : 'border-gray-200'}`} aria-label="Pagination">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className={`flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed transition ${dark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        Prev
      </button>
      <span className={`text-sm ${dark ? 'text-gray-500' : 'text-gray-400'}`} aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className={`flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed transition ${dark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
      >
        Next
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
