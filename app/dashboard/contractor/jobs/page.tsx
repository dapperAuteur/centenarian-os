'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Loader2, Search, Filter } from 'lucide-react';
import JobStatusBadge from '@/components/contractor/JobStatusBadge';

interface Job {
  id: string;
  job_number: string;
  client_name: string;
  event_name: string | null;
  location_name: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  pay_rate: number | null;
  union_local: string | null;
  department: string | null;
}

const STATUSES = ['all', 'assigned', 'confirmed', 'in_progress', 'completed', 'invoiced', 'paid', 'cancelled'];

export default function JobsListPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (statusFilter !== 'all') params.set('status', statusFilter);

    fetch(`/api/contractor/jobs?${params}`)
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = search
    ? jobs.filter(
        (j) =>
          j.job_number.toLowerCase().includes(search.toLowerCase()) ||
          j.client_name.toLowerCase().includes(search.toLowerCase()) ||
          j.event_name?.toLowerCase().includes(search.toLowerCase()) ||
          j.location_name?.toLowerCase().includes(search.toLowerCase()),
      )
    : jobs;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-100">All Jobs</h1>
        <Link
          href="/dashboard/contractor/jobs/new"
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-amber-500 min-h-11"
          aria-label="Create new job"
        >
          <Plus size={16} aria-hidden="true" /> New Job
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search jobs by number, client, event, or location"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 py-2.5 pl-9 pr-3 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-neutral-500" aria-hidden="true" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by job status"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 focus:border-amber-500 focus:outline-none"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All Statuses' : s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-neutral-500" size={24} aria-label="Loading jobs" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          {search ? 'No jobs match your search.' : 'No jobs found.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((job) => (
            <Link
              key={job.id}
              href={`/dashboard/contractor/jobs/${job.id}`}
              className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-700 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-amber-400">{job.job_number}</span>
                  <JobStatusBadge status={job.status} />
                  {job.union_local && (
                    <span className="text-xs text-neutral-500">{job.union_local}</span>
                  )}
                  {job.department && (
                    <span className="text-xs text-neutral-500">· {job.department}</span>
                  )}
                </div>
                <div className="mt-1 text-neutral-100 font-medium truncate">
                  {job.client_name}
                  {job.event_name && <span className="text-neutral-400"> — {job.event_name}</span>}
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  {job.location_name && <span>{job.location_name} · </span>}
                  {job.start_date && <span>{new Date(job.start_date + 'T00:00').toLocaleDateString()}</span>}
                  {job.end_date && job.end_date !== job.start_date && (
                    <span> – {new Date(job.end_date + 'T00:00').toLocaleDateString()}</span>
                  )}
                  {job.pay_rate && (
                    <span> · ${Number(job.pay_rate).toFixed(2)}/hr</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
