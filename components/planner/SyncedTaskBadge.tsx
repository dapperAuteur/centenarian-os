// components/planner/SyncedTaskBadge.tsx
// Small amber badge for tasks auto-synced from Work.WitUS.

'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';

interface SyncedTaskBadgeProps {
  sourceType: string;
  sourceId: string | null;
}

export default function SyncedTaskBadge({ sourceType, sourceId }: SyncedTaskBadgeProps) {
  const badge = (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
      <FileText className="w-3 h-3 shrink-0" aria-hidden="true" />
      Synced from Work.WitUS
    </span>
  );

  if (sourceType === 'invoice_due' && sourceId) {
    return (
      <Link
        href={`/dashboard/finance/invoices/${sourceId}`}
        className="inline-block hover:opacity-80 transition min-h-11 min-w-11 flex items-center"
      >
        {badge}
      </Link>
    );
  }

  return badge;
}
