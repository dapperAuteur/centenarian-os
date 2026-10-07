'use client';

// app/dashboard/engine/history/pain/page.tsx
// Pain history: every pain entry, newest first, grouped by day with the day's highest
// intensity. Filters by date range, intensity range, location (one side or either side of
// a pair) and text in the notes. Loads 50 entries at a time and keeps loading as you scroll
// (or with "Load more"), so there is no 200-day limit. Edit and delete happen inline. The
// chart plots each day's summary (daily_logs.pain_intensity, the day's highest).
//
// Photos, voice notes, links and life categories belong to the day's daily log; each day
// can open them under "Links & categories".
//
// Data: /api/engine/pain-entries (lib/pain/server.ts). Before migration 222 the list shows
// one entry per day from daily_logs, with a "Run migration 222 first" note.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronDown, ChevronUp, Loader2, Plus } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';
import PainEntryItem from '@/components/pain/PainEntryItem';
import { parseLocalDate } from '@/lib/dates/local';
import { useClockFormat } from '@/lib/hooks/useClockFormat';
import { groupByDay, type PainEntry } from '@/lib/pain/logic';
import { INTENSITY_SCALE, intensityBadgeClass, locationFilterOptions } from '@/lib/pain/options';
import {
  fetchDayPoints,
  fetchEntries,
  type DayInfo,
  type DayPoint,
  type DayState,
} from '@/lib/pain/client';

const PAGE = 50;
const FIELD =
  'min-h-11 w-full bg-white text-sm text-gray-900 rounded-lg px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent';

interface Filters {
  from: string;
  to: string;
  min: string;
  max: string;
  location: string;
  q: string;
}

const NO_FILTERS: Filters = { from: '', to: '', min: '', max: '', location: '', q: '' };

function dayLabel(date: string): string {
  return parseLocalDate(date).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PainHistoryPage() {
  const clockFormat = useClockFormat();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState<PainEntry[]>([]);
  const [days, setDays] = useState<Record<string, DayInfo>>({});
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [points, setPoints] = useState<DayPoint[]>([]);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  // Answers to an older filter set are ignored.
  const requestId = useRef(0);

  // Typing in the search box waits for a pause before reloading.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search })), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const params = useMemo(
    () => ({
      from: filters.from,
      to: filters.to,
      min: filters.min,
      max: filters.max,
      location: filters.location,
      q: filters.q.trim(),
      limit: PAGE,
    }),
    [filters],
  );

  const loadFirst = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const res = await fetchEntries({ ...params, offset: 0 });
      if (id !== requestId.current) return;
      setEntries(res.entries);
      setDays(res.days);
      setNextOffset(res.next_offset);
      setNotice(res.ready ? '' : res.notice ?? '');
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : 'Could not load your pain history.');
      setEntries([]);
      setNextOffset(null);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [params]);

  const loadMore = useCallback(async () => {
    if (nextOffset == null || loadingMore || loading) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const res = await fetchEntries({ ...params, offset: nextOffset });
      if (id !== requestId.current) return;
      setEntries((list) => {
        const seen = new Set(list.map((e) => e.id));
        return [...list, ...res.entries.filter((e) => !seen.has(e.id))];
      });
      setDays((d) => ({ ...d, ...res.days }));
      setNextOffset(res.next_offset);
    } catch (err) {
      if (id === requestId.current) setError(err instanceof Error ? err.message : 'Could not load more entries.');
    } finally {
      setLoadingMore(false);
    }
  }, [params, nextOffset, loadingMore, loading]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  useEffect(() => {
    let cancelled = false;
    fetchDayPoints(filters.from, filters.to).then((p) => {
      if (!cancelled) setPoints(p);
    });
    return () => {
      cancelled = true;
    };
  }, [filters.from, filters.to]);

  // Infinite scroll: load the next page when the bottom of the list comes into view.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || nextOffset == null) return;
    const observer = new IntersectionObserver(
      (items) => {
        if (items.some((item) => item.isIntersecting)) loadMore();
      },
      { rootMargin: '400px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, nextOffset]);

  const chartData = useMemo(
    () =>
      points.map((p) => ({
        date: parseLocalDate(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        intensity: p.pain_intensity,
      })),
    [points],
  );

  const groups = useMemo(() => groupByDay(entries), [entries]);

  const applyDay = (day: DayState) => {
    setDays((d) => ({
      ...d,
      [day.date]: { daily_log_id: day.daily_log_id, pain_intensity: day.summary.pain_intensity ?? null },
    }));
    setPoints((list) => {
      const others = list.filter((p) => p.date !== day.date);
      if (day.summary.pain_intensity == null) return others;
      return [...others, { date: day.date, pain_intensity: day.summary.pain_intensity }].sort((a, b) =>
        a.date < b.date ? -1 : 1,
      );
    });
  };

  const onUpdated = (entry: PainEntry, changed: DayState[] | null) => {
    setEntries((list) => list.map((e) => (e.id === entry.id ? entry : e)));
    changed?.forEach(applyDay);
  };

  const onDeleted = (id: string, day: DayState | null) => {
    setEntries((list) => list.filter((e) => e.id !== id));
    if (day) applyDay(day);
  };

  const setFilter = (key: keyof Filters, value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const filtered = Object.entries(filters).some(([, v]) => v !== '') || search !== '';
  const locationOptions = useMemo(() => locationFilterOptions(), []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6">
      <Link
        href="/dashboard/engine/history"
        className="min-h-11 inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm mb-2 transition"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Engine History
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Pain History</h1>
          <p className="text-gray-600 text-sm">Every entry, newest first, grouped by day.</p>
        </div>
        <Link
          href="/dashboard/engine/pain"
          className="min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Log pain
        </Link>
      </div>

      {notice && (
        <div role="status" className="mb-6 p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-sm">
          {notice}
        </div>
      )}

      {chartData.length > 1 && (
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Daily highest intensity</h2>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="painGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 11 }} />
              <YAxis domain={[0, 10]} tick={{ fill: '#4b5563', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#111827' }} />
              <Area type="monotone" dataKey="intensity" name="Highest" stroke="#f43f5e" fill="url(#painGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <form
        className="bg-white rounded-xl shadow-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Filter pain entries"
      >
        <div>
          <label htmlFor="pain-filter-from" className="block text-xs font-medium text-gray-700 mb-1">From</label>
          <input id="pain-filter-from" type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} className={FIELD} />
        </div>
        <div>
          <label htmlFor="pain-filter-to" className="block text-xs font-medium text-gray-700 mb-1">To</label>
          <input id="pain-filter-to" type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} className={FIELD} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="pain-filter-min" className="block text-xs font-medium text-gray-700 mb-1">Intensity from</label>
            <select id="pain-filter-min" value={filters.min} onChange={(e) => setFilter('min', e.target.value)} className={FIELD}>
              <option value="">Any</option>
              {INTENSITY_SCALE.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pain-filter-max" className="block text-xs font-medium text-gray-700 mb-1">to</label>
            <select id="pain-filter-max" value={filters.max} onChange={(e) => setFilter('max', e.target.value)} className={FIELD}>
              <option value="">Any</option>
              {INTENSITY_SCALE.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="pain-filter-location" className="block text-xs font-medium text-gray-700 mb-1">Location</label>
          <select id="pain-filter-location" value={filters.location} onChange={(e) => setFilter('location', e.target.value)} className={FIELD}>
            <option value="">All locations</option>
            <optgroup label="Either side">
              {locationOptions.filter((o) => o.matches.length > 1).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
            <optgroup label="Locations">
              {locationOptions.filter((o) => o.matches.length === 1).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label htmlFor="pain-filter-q" className="block text-xs font-medium text-gray-700 mb-1">Search notes</label>
          <input
            id="pain-filter-q"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. after the run"
            className={FIELD}
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setFilters(NO_FILTERS);
              setSearch('');
            }}
            disabled={!filtered}
            className="min-h-11 w-full px-4 py-2 text-sm font-medium text-gray-800 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
          >
            Clear filters
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12" role="status" aria-label="Loading...">
          <Loader2 className="w-6 h-6 animate-spin text-fuchsia-600" aria-hidden="true" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p>{filtered ? 'No pain entries match these filters.' : 'No pain entries yet.'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const info = days[group.date];
            const highest = info?.pain_intensity ?? group.highest;
            const isOpen = openDay === group.date;
            return (
              <section key={group.date} aria-labelledby={`pain-day-${group.date}`}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h2 id={`pain-day-${group.date}`} className="text-base font-semibold text-gray-900">
                    {dayLabel(group.date)}
                  </h2>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${intensityBadgeClass(highest)}`}>
                    Highest {highest}/10
                  </span>
                  <span className="text-xs text-gray-600">
                    {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}
                    {filtered ? ' shown' : ''}
                  </span>
                  {info?.daily_log_id && (
                    <button
                      type="button"
                      onClick={() => setOpenDay(isOpen ? null : group.date)}
                      aria-expanded={isOpen}
                      className="ml-auto min-h-11 inline-flex items-center gap-1 px-3 text-xs font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition"
                    >
                      Links &amp; categories
                      {isOpen ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
                    </button>
                  )}
                </div>
                {isOpen && info?.daily_log_id && (
                  <div className="mb-3 p-3 bg-white border border-gray-200 rounded-xl space-y-2">
                    <ActivityLinker entityType="daily_log" entityId={info.daily_log_id} />
                    <LifeCategoryTagger entityType="daily_log" entityId={info.daily_log_id} compact />
                  </div>
                )}
                <ul className="space-y-2">
                  {group.entries.map((entry) => (
                    <PainEntryItem
                      key={entry.id}
                      entry={entry}
                      clockFormat={clockFormat}
                      onUpdated={onUpdated}
                      onDeleted={onDeleted}
                    />
                  ))}
                </ul>
              </section>
            );
          })}

          <div ref={sentinel} />
          {nextOffset != null && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="min-h-11 px-5 py-2 text-sm font-medium text-sky-700 bg-white border border-sky-200 rounded-lg hover:bg-sky-50 disabled:opacity-50 transition inline-flex items-center gap-2"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
