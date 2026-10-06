'use client';

// components/finance/debt/DueSoonBanner.tsx
// The in-app "Due soon" banner: unpaid card/loan payments due today or in the next 3 days.
// Shown on the finance dashboard and the debt page. Pass `items` when the page already has them;
// otherwise it loads /api/finance/debt/due-soon itself. Renders nothing when nothing is due.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { todayLocal } from '@/lib/dates/local';
import { money, shortDate } from '@/lib/finance/debt/due';
import type { DueSoonEntry } from '@/lib/finance/debt/due';

function when(days: number): string {
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `due in ${days} days`;
}

export default function DueSoonBanner({ items: given, showLink = true }: { items?: DueSoonEntry[]; showLink?: boolean }) {
  const [loaded, setLoaded] = useState<DueSoonEntry[]>([]);

  useEffect(() => {
    if (given) return;
    let cancelled = false;
    fetch(`/api/finance/debt/due-soon?today=${todayLocal()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!cancelled && body?.items) setLoaded(body.items as DueSoonEntry[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [given]);

  const items = given ?? loaded;
  if (!items.length) return null;
  const today = todayLocal();

  return (
    <div role="status" className="rounded-xl p-4 bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-2">
        <CalendarClock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-amber-900">
            {items.length === 1 ? 'Payment due soon' : `${items.length} payments due soon`}
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-amber-900">
            {items.map((i) => (
              <li key={i.key}>
                <span className="font-medium">{i.accountName}</span>
                {i.minimum !== null && <> · {money(i.minimum)} minimum</>}
                {i.statementBalance !== null && i.statementBalance > 0 && <> ({money(i.statementBalance)} to avoid interest)</>}
                {' '}· {when(i.daysUntil)} ({shortDate(i.dueDate, today)})
              </li>
            ))}
          </ul>
        </div>
      </div>
      {showLink && (
        <Link
          href="/dashboard/finance/debt"
          className="min-h-11 inline-flex items-center justify-center px-4 rounded-lg text-sm font-medium bg-sky-600 text-white hover:bg-sky-700 transition shrink-0"
        >
          View debts
        </Link>
      )}
    </div>
  );
}
