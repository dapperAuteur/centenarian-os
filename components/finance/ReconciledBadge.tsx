// components/finance/ReconciledBadge.tsx
// A small "Reconciled" badge for a transaction dated inside a reconciled
// statement period (the reconciled_period flag from /api/finance/transactions).

import { Lock } from 'lucide-react';
import { formatDay, type ReconciledPeriodView } from '@/lib/finance/reconciliation/client';

export default function ReconciledBadge({ period, className = '' }: { period?: ReconciledPeriodView | null; className?: string }) {
  if (!period) return null;
  const label = `Reconciled: statement of ${formatDay(period.statement_date)}`;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 ${className}`}
      title={label}
    >
      <Lock className="w-3 h-3" aria-hidden="true" />
      <span>Reconciled</span>
      <span className="sr-only">{`, statement of ${formatDay(period.statement_date)}`}</span>
    </span>
  );
}
