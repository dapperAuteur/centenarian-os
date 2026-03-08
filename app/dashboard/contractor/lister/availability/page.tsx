'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, CalendarCheck, Search, CheckCircle, XCircle, Minus,
} from 'lucide-react';

interface BusyJob {
  job_id: string;
  event_name: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface ContractorAvail {
  contact_id: string;
  name: string;
  linked_user_id: string | null;
  username: string | null;
  skills: string[] | null;
  availability_notes: string | null;
  busy_dates: BusyJob[];
  available: boolean | null;
}

export default function ListerAvailabilityPage() {
  const [contractors, setContractors] = useState<ContractorAvail[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searched, setSearched] = useState(false);

  // Default to next 7 days
  useEffect(() => {
    const today = new Date();
    const week = new Date(today);
    week.setDate(week.getDate() + 7);
    setFrom(today.toISOString().split('T')[0]);
    setTo(week.toISOString().split('T')[0]);
  }, []);

  const search = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setSearched(true);
    const res = await fetch(`/api/contractor/availability?from=${from}&to=${to}`);
    const d = await res.json();
    setContractors(d.contractors ?? []);
    setLoading(false);
  }, [from, to]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-2xl font-bold text-neutral-100">Contractor Availability</h1>

      {/* Date range picker */}
      <div className="flex gap-3 items-end flex-wrap">
        <label className="block">
          <span className="text-xs font-medium text-neutral-400">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-neutral-400">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </label>
        <button
          onClick={search}
          disabled={loading || !from || !to}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
        >
          {loading ? <Loader2 size={14} className="animate-spin" aria-label="Loading..." /> : <Search size={14} aria-hidden="true" />}
          Check
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-neutral-500" size={24} aria-label="Loading..." />
        </div>
      ) : !searched ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          Select a date range and click Check to see contractor availability.
        </div>
      ) : contractors.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          No contractors in your roster.
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label="Contractor availability">
          {contractors.map((c) => (
            <article key={c.contact_id} role="listitem" className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {c.available === true ? (
                    <CheckCircle size={18} className="text-green-400" aria-label="Available" />
                  ) : c.available === false ? (
                    <XCircle size={18} className="text-red-400" aria-label="Busy" />
                  ) : (
                    <Minus size={18} className="text-neutral-500" aria-label="Unknown" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-neutral-100">{c.name}</span>
                    {c.username && (
                      <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-400">@{c.username}</span>
                    )}
                    {c.available === true && (
                      <span className="rounded-full bg-green-400/10 px-2 py-0.5 text-xs text-green-400 font-medium">Available</span>
                    )}
                    {c.available === false && (
                      <span className="rounded-full bg-red-400/10 px-2 py-0.5 text-xs text-red-400 font-medium">Busy</span>
                    )}
                    {c.available === null && (
                      <span className="rounded-full bg-neutral-700/30 px-2 py-0.5 text-xs text-neutral-500 font-medium">No linked account</span>
                    )}
                  </div>

                  {c.skills && c.skills.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.skills.map((s) => (
                        <span key={s} className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">{s}</span>
                      ))}
                    </div>
                  )}

                  {c.availability_notes && (
                    <p className="mt-1 text-xs text-neutral-500">{c.availability_notes}</p>
                  )}

                  {c.busy_dates.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-neutral-500 font-medium">Conflicting jobs:</p>
                      {c.busy_dates.map((b) => (
                        <div key={b.job_id} className="text-xs text-red-400/80 flex gap-2">
                          <CalendarCheck size={12} className="shrink-0 mt-0.5" aria-hidden="true" />
                          <span>
                            {b.event_name || 'Unnamed job'}
                            {b.start_date && ` (${new Date(b.start_date + 'T00:00:00').toLocaleDateString()}`}
                            {b.end_date && ` – ${new Date(b.end_date + 'T00:00:00').toLocaleDateString()}`}
                            {b.start_date && ')'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
