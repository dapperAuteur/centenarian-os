'use client';

// components/finance/ReconcileAuditCard.tsx
// The monthly audit on the Finance dashboard: active accounts (cash left out: counting cash is
// their check) that were never reconciled, were last reconciled more than 30 days ago, or have a
// statement left open. Each links to its Reconcile page. Shown in amber; hidden when every account
// is up to date. Before migration 221 it says "Run migration 221 first".
//
// Data: GET /api/finance/reconciliations/audit through offlineFetch, so the last list still shows
// offline.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Scale } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { todayLocal } from '@/lib/dates/local';
import { formatMoney } from '@/lib/finance/fx/math';
import { accountLabel } from '@/lib/finance/transfers/pairing';
import { formatDay, reconcileHref, type AuditResponse } from '@/lib/finance/reconciliation/client';

export default function ReconcileAuditCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<AuditResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    offlineFetch(`/api/finance/reconciliations/audit?today=${todayLocal()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body && Array.isArray(body.due)) setData(body as AuditResponse);
      })
      .catch(() => { /* keep whatever was shown */ });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!data || data.accounts.length === 0) return null;
  if (data.ready && data.due.length === 0) return null;

  return (
    <section aria-labelledby="reconcile-audit-heading" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <h2 id="reconcile-audit-heading" className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <Scale className="h-4 w-4" aria-hidden="true" />
        Reconcile your accounts
      </h2>
      {!data.ready ? (
        <p className="mt-1 text-sm text-amber-900">
          Run migration 221 first (supabase/migrations/221_account_reconciliation.sql) to reconcile accounts to their statements.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-amber-900">
            Not reconciled in the last 30 days. Compare each with its latest statement so the balances stay right.
          </p>
          <ul className="mt-2 divide-y divide-amber-200" aria-label="Accounts to reconcile">
            {data.due.map((a) => (
              <li key={a.id}>
                <Link
                  href={reconcileHref(a.id)}
                  className="flex min-h-11 flex-col justify-center py-2 text-sm hover:underline sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <span className="font-medium text-gray-900">{accountLabel(a)}</span>
                  <span className="text-xs text-amber-900">
                    {a.reconciled_through ? `Reconciled through ${formatDay(a.reconciled_through)} (${a.days} days ago)` : 'Never reconciled'}
                    {a.open ? ` · ${formatDay(a.open.statement_date)} left open, ${formatMoney(a.open.difference, a.currency)} off` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
