'use client';

// components/finance/review/ReviewBadgeLink.tsx
// The "Review" link in the Finance dashboard's header, with an amber count of
// everything waiting on the Review page (GET /api/finance/review/summary).
// The count says nothing when it can't be worked out (offline, or before the
// transfer columns exist): the link still works.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';
import { loadReviewCounts } from './api';

export default function ReviewBadgeLink({ className = '' }: { className?: string }) {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadReviewCounts().then((response) => {
      if (!cancelled && response.ok && typeof response.data?.total === 'number') setTotal(response.data.total);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const waiting = total !== null && total > 0;
  return (
    <Link
      href="/dashboard/finance/review"
      aria-label={waiting ? `Review: ${total.toLocaleString('en-US')} ${total === 1 ? 'item waits' : 'items wait'} for a decision` : 'Review'}
      className={`flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        waiting ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      } ${className}`}
    >
      <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
      Review
      {waiting && (
        <span aria-hidden="true" className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
          {total > 999 ? '999+' : total.toLocaleString('en-US')}
        </span>
      )}
    </Link>
  );
}
