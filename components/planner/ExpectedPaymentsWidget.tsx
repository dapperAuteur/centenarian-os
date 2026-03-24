// components/planner/ExpectedPaymentsWidget.tsx
// Emerald widget showing expected incoming payments summary on the planner.

'use client';

import Link from 'next/link';
import { DollarSign } from 'lucide-react';
import type { ExpectedPayment } from '@/lib/types';

interface ExpectedPaymentsWidgetProps {
  payments: ExpectedPayment[];
  totalExpected: number;
  count: number;
}

export default function ExpectedPaymentsWidget({
  payments,
  totalExpected,
  count,
}: ExpectedPaymentsWidgetProps) {
  if (count === 0) return null;

  // Show up to 5 items
  const displayItems = payments.slice(0, 5);

  return (
    <div className="rounded-xl bg-linear-to-r from-emerald-400 to-emerald-600 text-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 shrink-0" aria-hidden="true" />
          <h3 className="font-semibold text-sm">Expected Payments</h3>
        </div>
        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
          {count} payment{count !== 1 ? 's' : ''}
        </span>
      </div>

      <p className="text-2xl font-bold mb-3">
        ${totalExpected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>

      <div className="space-y-1.5 mb-3">
        {displayItems.map((p) => (
          <div key={`${p.source_type}-${p.source_id}`} className="flex items-center justify-between text-sm">
            <div className="min-w-0 flex-1">
              <span className="truncate block">{p.label}</span>
              <span className="text-xs text-emerald-100">
                {p.source_type === 'job' ? `Job ${p.reference_number ?? ''}` :
                  p.source_type === 'invoice' ? `Invoice ${p.reference_number ?? ''}` :
                  'Schedule'}
                {' · '}{new Date(p.expected_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <span className="font-medium shrink-0 ml-2">
              ${Number(p.expected_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
        {count > 5 && (
          <p className="text-xs text-emerald-100">+{count - 5} more</p>
        )}
      </div>

      <Link
        href="/dashboard/finance/forecast"
        className="min-h-11 min-w-11 inline-flex items-center justify-center px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition text-sm font-medium"
      >
        View Forecast
      </Link>
    </div>
  );
}
