'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus } from 'lucide-react';

interface Trip {
  id: string;
  mode: string;
  date: string;
  origin: string | null;
  destination: string | null;
  distance_miles: number | null;
  duration_min: number | null;
  purpose: string | null;
  calories_burned: number | null;
  co2_kg: number | null;
  cost: number | null;
  source: string;
  notes: string | null;
}

const MODE_ICONS: Record<string, string> = {
  bike: '🚲', car: '🚗', bus: '🚌', train: '🚂', plane: '✈️',
  walk: '🚶', run: '🏃', ferry: '⛴️', rideshare: '🚕', other: '🚐',
};

function fmt(n: number | null | undefined, d = 1) {
  if (n == null) return null;
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      });
      if (filter) params.set('mode', filter);
      const res = await fetch(`/api/travel/trips?${params}`);
      if (res.ok) {
        const d = await res.json();
        setTrips(d.trips || []);
        setTotal(d.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this trip?')) return;
    await fetch('/api/travel/trips', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/travel" className="text-gray-400 hover:text-gray-600 transition">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Trip History</h1>
            <p className="text-sm text-gray-500">{total.toLocaleString()} trips</p>
          </div>
        </div>
        <Link
          href="/dashboard/travel"
          className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium hover:bg-sky-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Trip
        </Link>
      </div>

      {/* Mode Filter */}
      <div className="flex flex-wrap gap-2">
        {['', 'bike', 'car', 'walk', 'run', 'bus', 'train', 'plane'].map((m) => (
          <button
            key={m}
            onClick={() => { setFilter(m); setPage(0); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filter === m
                ? 'bg-sky-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {m ? `${MODE_ICONS[m] ?? ''} ${m}` : 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-4 border-sky-600 border-t-transparent rounded-full" />
          </div>
        ) : trips.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">No trips found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Mode</th>
                  <th className="px-4 py-3 text-left">Route</th>
                  <th className="px-4 py-3 text-right">Miles</th>
                  <th className="px-4 py-3 text-right">Min</th>
                  <th className="px-4 py-3 text-right">Cal</th>
                  <th className="px-4 py-3 text-left">Purpose</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trips.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{t.date}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-base">{MODE_ICONS[t.mode] ?? '🚐'}</span>{' '}
                      <span className="text-gray-700 capitalize">{t.mode}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                      {t.origin && t.destination
                        ? `${t.origin} → ${t.destination}`
                        : t.notes?.substring(0, 40) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(t.distance_miles) ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{t.duration_min ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{t.calories_burned ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{t.purpose ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {t.source === 'garmin_import' ? 'Garmin' : t.source === 'csv_import' ? 'CSV' : 'Manual'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition"
                      >
                        del
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
