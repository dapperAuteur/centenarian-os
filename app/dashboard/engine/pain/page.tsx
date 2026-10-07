'use client';

// app/dashboard/engine/pain/page.tsx
// Body Check & Pain Log. Every save adds a new entry (time defaults to now and can be
// changed), so pain can be logged as often as it is noticed. Today's entries are listed
// below the form with Edit and Delete. Saving works offline: the entry is queued and sent
// when the connection returns. Each day's daily_logs.pain_* summary (what the correlation
// engine and AI reports read) is recomputed by the API after every change.
//
// Before migration 222 the API keeps the old one-entry-per-day behavior; the page then
// pre-fills today's entry, as it used to, and shows "Run migration 222 first".

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';
import EntryComposer from '@/components/ui/EntryComposer';
import PainEntryFields from '@/components/pain/PainEntryFields';
import PainEntryItem from '@/components/pain/PainEntryItem';
import { todayLocal, parseLocalDate } from '@/lib/dates/local';
import { formatTime, useClockFormat } from '@/lib/hooks/useClockFormat';
import { useSyncContext } from '@/lib/contexts/SyncContext';
import { intensityBadgeClass } from '@/lib/pain/options';
import type { PainEntry } from '@/lib/pain/logic';
import {
  createPainEntry,
  emptyForm,
  fetchEntries,
  formFromEntry,
  newEntryId,
  pendingEntry,
  toTimeInput,
  type DayState,
  type PainFormState,
} from '@/lib/pain/client';

function newestFirst(a: PainEntry, b: PainEntry): number {
  return Date.parse(b.occurred_at) - Date.parse(a.occurred_at);
}

export default function PainTrackingPage() {
  const clockFormat = useClockFormat();
  const today = todayLocal();

  const [form, setForm] = useState<PainFormState>(() => emptyForm());
  // Until the person changes the time, it follows the clock.
  const [timeTouched, setTimeTouched] = useState(false);
  const [entries, setEntries] = useState<PainEntry[]>([]);
  const [pending, setPending] = useState<PainEntry[]>([]);
  const [dailyLogId, setDailyLogId] = useState<string | null>(null);
  const [ready, setReady] = useState(true);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetchEntries({ date: today, limit: 200 });
      setReady(res.ready);
      setNotice(res.notice ?? '');
      setDailyLogId(res.days[today]?.daily_log_id ?? null);
      if (res.ready) {
        setEntries([...res.entries].sort(newestFirst));
      } else {
        // The old behavior: one record per day, shown in the form to change.
        setEntries([]);
        const existing = res.entries[0];
        if (existing) setForm({ ...formFromEntry(existing), time: toTimeInput(new Date()) });
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load today\'s entries.');
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  // Entries saved offline: once the queue has been sent, show them from the server.
  const { justSynced } = useSyncContext();
  const hasPending = pending.length > 0;
  useEffect(() => {
    if (!justSynced || !hasPending) return;
    setPending([]);
    load();
  }, [justSynced, hasPending, load]);

  useEffect(() => {
    if (timeTouched) return;
    const timer = setInterval(() => setForm((f) => ({ ...f, time: toTimeInput(new Date()) })), 30_000);
    return () => clearInterval(timer);
  }, [timeTouched]);

  const handleChange = (next: PainFormState) => {
    if (next.time !== form.time) setTimeTouched(true);
    setForm(next);
  };

  const resetTimeToNow = () => {
    setTimeTouched(false);
    setForm((f) => ({ ...f, time: toTimeInput(new Date()) }));
  };

  const applyDay = (day: DayState | null) => {
    if (day && day.date === today && day.daily_log_id) setDailyLogId(day.daily_log_id);
  };

  const handleSave = async () => {
    setMessage('');
    const submitted = timeTouched ? form : { ...form, time: toTimeInput(new Date()) };
    const id = newEntryId();
    const result = await createPainEntry(submitted, id);

    if (result.queued) {
      const queued = pendingEntry(id, submitted);
      if (queued.local_date === today) setPending((p) => [queued, ...p]);
      setMessage('Saved offline. The entry is sent when you reconnect.');
      setForm(emptyForm());
      setTimeTouched(false);
      return;
    }

    applyDay(result.day);
    if (!result.ready) {
      setReady(false);
      setNotice(result.notice ?? '');
      setMessage('Saved as today\'s pain log.');
      return;
    }
    setReady(true);
    const saved = result.entry;
    if (saved && saved.local_date === today) {
      setEntries((list) => [saved, ...list.filter((e) => e.id !== saved.id)].sort(newestFirst));
      setMessage(`Entry saved for ${formatTime(saved.occurred_at, clockFormat)}.`);
    } else if (saved) {
      setMessage(`Entry saved to ${parseLocalDate(saved.local_date).toLocaleDateString()}.`);
    }
    setForm(emptyForm());
    setTimeTouched(false);
  };

  const onUpdated = (entry: PainEntry, days: DayState[] | null) => {
    setEntries((list) =>
      list
        .map((e) => (e.id === entry.id ? entry : e))
        .filter((e) => e.local_date === today)
        .sort(newestFirst),
    );
    days?.forEach(applyDay);
  };

  const onDeleted = (id: string, day: DayState | null) => {
    setEntries((list) => list.filter((e) => e.id !== id));
    applyDay(day);
  };

  const shown = useMemo(() => [...pending, ...entries].sort(newestFirst), [pending, entries]);
  const highest = shown.length > 0 ? Math.max(...shown.map((e) => e.intensity)) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Body Check & Pain Log</h1>
          <p className="text-gray-600">
            {parseLocalDate(today).toLocaleDateString()} · Log pain each time you notice it. Every save adds a new entry.
          </p>
        </div>
        <Link
          href="/dashboard/engine/history/pain"
          className="min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-sky-700 bg-white border border-sky-200 rounded-lg hover:bg-sky-50 transition"
        >
          <History className="w-4 h-4" aria-hidden="true" /> Pain history
        </Link>
      </header>

      {!ready && notice && (
        <div role="status" className="mb-6 p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-sm">
          {notice}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-8">
        <EntryComposer
          entityType="daily_log"
          entityId={dailyLogId}
          features={{ audio: true, photos: true, activityLinks: true, lifeCategories: true }}
          onSave={handleSave}
          saveLabel={ready ? 'Add entry' : 'Log Body Check'}
        >
          <PainEntryFields value={form} onChange={handleChange} idPrefix="pain-new" onUseNow={resetTimeToNow} />
          <p className="mt-4 text-xs text-gray-600">
            Photos, voice notes, links and life categories below belong to the day, not to one entry.
          </p>
        </EntryComposer>
        {message && (
          <p role="status" className="mt-4 text-sm text-gray-800">
            {message}
          </p>
        )}
      </div>

      {ready && (
        <section className="mt-8" aria-labelledby="pain-today-heading">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <h2 id="pain-today-heading" className="text-xl font-bold text-gray-900">
              Today&apos;s entries
            </h2>
            {highest != null && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${intensityBadgeClass(highest)}`}>
                Highest {highest}/10
              </span>
            )}
            {shown.length > 0 && <span className="text-sm text-gray-600">{shown.length} logged</span>}
          </div>

          {loading ? (
            <p role="status" className="text-sm text-gray-600">
              Loading today&apos;s entries...
            </p>
          ) : loadError ? (
            <p role="alert" className="text-sm text-red-700">
              {loadError}
            </p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-gray-600">Nothing logged yet today.</p>
          ) : (
            <ul className="space-y-2">
              {shown.map((entry) => (
                <PainEntryItem
                  key={entry.id}
                  entry={entry}
                  clockFormat={clockFormat}
                  pending={pending.some((p) => p.id === entry.id)}
                  onUpdated={onUpdated}
                  onDeleted={onDeleted}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
