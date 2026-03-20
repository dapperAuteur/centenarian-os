// components/planner/OutstandingInvoicesWidget.tsx
// Amber widget showing outstanding receivable invoices summary.

'use client';

import Link from 'next/link';
import { FileText, AlertTriangle } from 'lucide-react';

interface OutstandingInvoicesWidgetProps {
  outstandingCount: number;
  outstandingTotal: number;
  overdueCount: number;
}

export default function OutstandingInvoicesWidget({
  outstandingCount,
  outstandingTotal,
  overdueCount,
}: OutstandingInvoicesWidgetProps) {
  if (outstandingCount === 0) return null;

  return (
    <div className="rounded-xl bg-linear-to-r from-amber-400 to-amber-600 text-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 shrink-0" aria-hidden="true" />
          <h3 className="font-semibold text-sm">Outstanding Invoices</h3>
        </div>
        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
            <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
            {overdueCount} overdue
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold">${outstandingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-amber-100">{outstandingCount} invoice{outstandingCount !== 1 ? 's' : ''} pending</p>
        </div>
        <Link
          href="/dashboard/finance/invoices?status=sent&direction=receivable"
          className="min-h-11 min-w-11 flex items-center justify-center px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition text-sm font-medium"
        >
          View All
        </Link>
      </div>
    </div>
  );
}
