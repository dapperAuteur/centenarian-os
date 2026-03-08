'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Search, X, ArrowUpDown } from 'lucide-react';

interface Job {
  id: string;
  job_number: string;
  client_name: string;
  event_name: string | null;
  status: string;
}

interface Comparison {
  id: string;
  job_number: string;
  client_name: string;
  event_name: string | null;
  location_name: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  pay_rate: number;
  ot_rate: number;
  dt_rate: number;
  union_local: string | null;
  department: string | null;
  benefits_eligible: boolean;
  days_worked: number;
  total_hours: number;
  st_hours: number;
  ot_hours: number;
  dt_hours: number;
  total_invoiced: number;
  total_paid: number;
  total_miles: number;
  total_expenses: number;
  net_earnings: number;
  effective_rate: number;
}

const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ROW_DEFS: { label: string; key: keyof Comparison; format?: (v: unknown, comp?: Comparison) => string }[] = [
  { label: 'Client', key: 'client_name' },
  { label: 'Event', key: 'event_name', format: (v) => (v as string) || '—' },
  { label: 'Location', key: 'location_name', format: (v) => (v as string) || '—' },
  { label: 'Status', key: 'status' },
  { label: 'Dates', key: 'start_date', format: (_v, comp) => {
    if (!comp?.start_date) return '—';
    const s = new Date(comp.start_date + 'T00:00').toLocaleDateString();
    const e = comp.end_date ? new Date(comp.end_date + 'T00:00').toLocaleDateString() : '';
    return e && e !== s ? `${s} – ${e}` : s;
  }},
  { label: 'Union', key: 'union_local', format: (v) => (v as string) || '—' },
  { label: 'Department', key: 'department', format: (v) => (v as string) || '—' },
  { label: 'ST Rate', key: 'pay_rate', format: (v) => fmt(v as number) },
  { label: 'OT Rate', key: 'ot_rate', format: (v) => fmt(v as number) },
  { label: 'DT Rate', key: 'dt_rate', format: (v) => fmt(v as number) },
  { label: 'Days Worked', key: 'days_worked', format: (v) => String(v) },
  { label: 'Total Hours', key: 'total_hours', format: (v) => `${(v as number).toFixed(1)}h` },
  { label: 'ST Hours', key: 'st_hours', format: (v) => `${(v as number).toFixed(1)}h` },
  { label: 'OT Hours', key: 'ot_hours', format: (v) => `${(v as number).toFixed(1)}h` },
  { label: 'DT Hours', key: 'dt_hours', format: (v) => `${(v as number).toFixed(1)}h` },
  { label: 'Total Invoiced', key: 'total_invoiced', format: (v) => fmt(v as number) },
  { label: 'Total Paid', key: 'total_paid', format: (v) => fmt(v as number) },
  { label: 'Mileage', key: 'total_miles', format: (v) => `${(v as number).toLocaleString()} mi` },
  { label: 'Expenses', key: 'total_expenses', format: (v) => fmt(v as number) },
  { label: 'Net Earnings', key: 'net_earnings', format: (v) => fmt(v as number) },
  { label: 'Effective $/hr', key: 'effective_rate', format: (v) => fmt(v as number) },
  { label: 'Benefits', key: 'benefits_eligible', format: (v) => (v ? 'Yes' : 'No') },
];

export default function CompareJobsPage() {
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [results, setResults] = useState<Comparison[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/contractor/jobs?limit=200')
      .then((r) => r.json())
      .then((d) => setAllJobs(d.jobs ?? []))
      .finally(() => setJobsLoading(false));
  }, []);

  const toggleJob = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
    setResults(null);
  }, []);

  const compare = useCallback(() => {
    if (selectedIds.length < 2) return;
    setLoading(true);
    fetch(`/api/contractor/compare?ids=${selectedIds.join(',')}`)
      .then((r) => r.json())
      .then((d) => setResults(d.comparisons ?? null))
      .finally(() => setLoading(false));
  }, [selectedIds]);

  const filtered = search
    ? allJobs.filter(
        (j) =>
          j.job_number.toLowerCase().includes(search.toLowerCase()) ||
          j.client_name.toLowerCase().includes(search.toLowerCase()) ||
          j.event_name?.toLowerCase().includes(search.toLowerCase()),
      )
    : allJobs;

  // Find best value per numeric row for highlighting
  const bestIdx: Record<string, number> = {};
  if (results) {
    for (const row of ROW_DEFS) {
      const val = results[0]?.[row.key];
      if (typeof val !== 'number') continue;
      // Higher is better for earnings/rates/hours, lower for expenses/miles
      const lowerBetter = row.key === 'total_expenses' || row.key === 'total_miles';
      let best = 0;
      for (let i = 1; i < results.length; i++) {
        const a = results[best][row.key] as number;
        const b = results[i][row.key] as number;
        if (lowerBetter ? b < a : b > a) best = i;
      }
      if ((results[best][row.key] as number) !== 0) bestIdx[row.key] = best;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <h1 className="text-2xl font-bold text-neutral-100">Compare Jobs</h1>

      {/* Job selector */}
      <section aria-label="Select jobs to compare">
        <div className="space-y-3">
          {/* Selected pills */}
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-2" role="list" aria-label="Selected jobs">
              {selectedIds.map((id) => {
                const job = allJobs.find((j) => j.id === id);
                return (
                  <span
                    key={id}
                    role="listitem"
                    className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-sm text-amber-300"
                  >
                    {job?.job_number ?? id}
                    <button
                      onClick={() => toggleJob(id)}
                      className="rounded-full p-0.5 hover:bg-amber-500/30 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      aria-label={`Remove ${job?.job_number ?? 'job'}`}
                    >
                      <X size={14} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Search + list */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search jobs to add..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 py-2.5 pl-9 pr-3 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              aria-label="Search jobs"
            />
          </div>

          {jobsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-neutral-500" size={20} aria-label="Loading jobs" />
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900" role="listbox" aria-label="Available jobs" aria-multiselectable="true">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-sm text-neutral-500">No jobs found.</div>
              ) : (
                filtered.map((job) => {
                  const selected = selectedIds.includes(job.id);
                  const disabled = !selected && selectedIds.length >= 4;
                  return (
                    <button
                      key={job.id}
                      role="option"
                      aria-selected={selected}
                      disabled={disabled}
                      onClick={() => toggleJob(job.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition border-b border-neutral-800 last:border-b-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500 ${
                        selected
                          ? 'bg-amber-500/10 text-amber-300'
                          : disabled
                            ? 'text-neutral-600 cursor-not-allowed'
                            : 'text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                          selected ? 'border-amber-500 bg-amber-500' : 'border-neutral-600'
                        }`}
                        aria-hidden="true"
                      >
                        {selected && <span className="text-neutral-950 text-xs font-bold">✓</span>}
                      </span>
                      <span className="font-mono text-amber-400/70">{job.job_number}</span>
                      <span className="truncate">{job.client_name}</span>
                      {job.event_name && (
                        <span className="hidden sm:inline truncate text-neutral-500">— {job.event_name}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Compare button */}
          <button
            onClick={compare}
            disabled={selectedIds.length < 2 || loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-neutral-950 transition"
            aria-label={`Compare ${selectedIds.length} selected jobs`}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpDown size={16} />}
            Compare {selectedIds.length} Job{selectedIds.length !== 1 ? 's' : ''}
          </button>
        </div>
      </section>

      {/* Comparison results */}
      {results && (
        <section aria-label="Comparison results">
          <h2 className="text-lg font-semibold text-neutral-200 mb-3">Results</h2>

          {/* Mobile: stacked cards */}
          <div className="space-y-4 lg:hidden">
            {results.map((comp, ci) => (
              <div key={comp.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-amber-400 text-sm">{comp.job_number}</span>
                  <span className="text-neutral-100 font-medium text-sm truncate">{comp.client_name}</span>
                </div>
                {ROW_DEFS.map((row) => {
                  const raw = comp[row.key];
                  const val = row.format
                    ? row.format(raw, comp)
                    : String(raw ?? '—');
                  const isBest = bestIdx[row.key] === ci;
                  return (
                    <div key={row.key} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">{row.label}</span>
                      <span className={isBest ? 'text-green-400 font-medium' : 'text-neutral-200'}>
                        {val}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Desktop: side-by-side table */}
          <div className="hidden lg:block overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="bg-neutral-900">
                  <th scope="col" className="sticky left-0 bg-neutral-900 text-left px-4 py-3 text-neutral-500 font-medium border-b border-neutral-800 z-10">
                    Metric
                  </th>
                  {results.map((comp) => (
                    <th key={comp.id} scope="col" className="text-left px-4 py-3 border-b border-neutral-800 min-w-[180px]">
                      <div className="font-mono text-amber-400">{comp.job_number}</div>
                      <div className="text-neutral-400 font-normal text-xs truncate">{comp.client_name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROW_DEFS.map((row, ri) => (
                  <tr key={row.key} className={ri % 2 === 0 ? 'bg-neutral-950' : 'bg-neutral-900/50'}>
                    <td className="sticky left-0 bg-inherit px-4 py-2 text-neutral-400 font-medium whitespace-nowrap z-10">
                      {row.label}
                    </td>
                    {results.map((comp, ci) => {
                      const raw = comp[row.key];
                      const val = row.format
                        ? row.format(raw, comp)
                        : String(raw ?? '—');
                      const isBest = bestIdx[row.key] === ci;
                      return (
                        <td key={comp.id} className={`px-4 py-2 whitespace-nowrap ${isBest ? 'text-green-400 font-medium' : 'text-neutral-200'}`}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
