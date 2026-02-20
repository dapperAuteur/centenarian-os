'use client';

// components/ui/PaginationBar.tsx
// Reusable pagination control for admin tables.

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function PaginationBar({ page, totalPages, onPageChange }: PaginationBarProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        <ChevronLeft className="w-4 h-4" />
        Prev
      </button>
      <span className="text-sm text-gray-500">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
