'use client';

// components/settings/CalendarNeedsALook.tsx
// Settings → Google Calendar: the synced events that need a look (GET /api/calendar/google/review).
// Each shows why, with links to its planner task and to the record it created, and a
// "Done" button (PATCH /api/calendar/google/review) that takes it off the list.
// `reloadKey` changes after a sync, so the list follows each run.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, Loader2 } from 'lucide-react';

const REVIEW_URL = '/api/calendar/google/review';

interface ReviewItem {
  id: string;
  title: string;
  event_status: string | null;
  reason: string | null;
  date: string | null;
  record_type: string | null;
  task_href: string | null;
  record_href: string | null;
}

const RECORD_TEXT: Record<string, string> = {
  transaction: 'Open the transaction',
  meal: 'Open meals',
  workout: 'Open the workout',
};

export default function CalendarNeedsALook({ reloadKey }: { reloadKey: number }) {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(REVIEW_URL, { cache: 'no-store' });
      const body = (await res.json().catch(() => null)) as { items?: ReviewItem[]; error?: string } | null;
      if (!res.ok) {
        setError(body?.error ?? 'Could not load the events that need a look.');
        return;
      }
      setItems(body?.items ?? []);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const resolve = async (id: string) => {
    setBusy((prev) => new Set(prev).add(id));
    setError(null);
    try {
      const res = await fetch(REVIEW_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? 'That item could not be marked as done.');
        return;
      }
      setItems((prev) => (prev ?? []).filter((item) => item.id !== id));
    } catch {
      setError('Could not reach the server, so that item was not marked as done.');
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Nothing to show until there is something to look at.
  if (items !== null && items.length === 0 && !error) return null;
  if (items === null && !error) return null;

  return (
    <section aria-labelledby="calendar-review-heading" className="border border-amber-200 bg-amber-50 rounded-2xl p-5 space-y-3">
      <h2 id="calendar-review-heading" className="font-semibold text-gray-900 flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-amber-700" aria-hidden="true" />
        Needs a look{items ? ` (${items.length})` : ''}
      </h2>
      <p className="text-sm text-gray-700">
        Events whose title was missing something, or whose record the sync would not change on its own. Fix the
        event in Google Calendar or the record here, then press Done.
      </p>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-800">
          {error}
        </p>
      )}
      {items && items.length > 0 && (
        <ul className="divide-y divide-amber-200">
          {items.map((item) => (
            <li key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 break-words">
                  {item.title}
                  {item.date && <span className="font-normal text-gray-600"> · {item.date}</span>}
                  {item.event_status === 'cancelled' && <span className="font-normal text-gray-600"> · cancelled</span>}
                </p>
                {item.reason && <p className="text-sm text-gray-800 break-words mt-0.5">{item.reason}</p>}
                <div className="flex flex-col sm:flex-row gap-x-4 mt-1">
                  {item.task_href && (
                    <Link href={item.task_href} className="min-h-11 inline-flex items-center text-sm text-sky-800 underline">
                      Open the task<span className="sr-only">: {item.title}</span>
                    </Link>
                  )}
                  {item.record_href && item.record_type && (
                    <Link href={item.record_href} className="min-h-11 inline-flex items-center text-sm text-sky-800 underline">
                      {RECORD_TEXT[item.record_type] ?? 'Open the record'}
                      <span className="sr-only">: {item.title}</span>
                    </Link>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => resolve(item.id)}
                disabled={busy.has(item.id)}
                aria-label={`Done: ${item.title}`}
                className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-gray-900 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg transition disabled:opacity-60 w-full sm:w-auto"
              >
                {busy.has(item.id) ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="w-4 h-4" aria-hidden="true" />
                )}
                Done
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
