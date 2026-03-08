'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, HardHat, ArrowRight, Loader2 } from 'lucide-react';
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
  est_pay_date: string | null;
}

interface StatCard {
  label: string;
  value: number;
  status: string;
}

export default function ContractorHubPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/contractor/jobs?limit=20')
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []))
      .finally(() => setLoading(false));
  }, []);

  const stats: StatCard[] = [
    { label: 'Assigned', value: jobs.filter((j) => j.status === 'assigned' || j.status === 'confirmed').length, status: 'assigned' },
    { label: 'In Progress', value: jobs.filter((j) => j.status === 'in_progress').length, status: 'in_progress' },
    { label: 'Completed', value: jobs.filter((j) => j.status === 'completed' || j.status === 'invoiced').length, status: 'completed' },
    { label: 'Paid', value: jobs.filter((j) => j.status === 'paid').length, status: 'paid' },
  ];

  const upcoming = jobs.filter((j) => ['assigned', 'confirmed', 'in_progress'].includes(j.status));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HardHat className="text-amber-400" size={28} />
          <h1 className="text-2xl font-bold text-neutral-100">Job Hub</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/contractor/jobs/new"
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500"
          >
            <Plus size={16} /> New Job
          </Link>
          <Link
            href="/dashboard/contractor/jobs"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            All Jobs <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.status} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-center">
            <div className="text-3xl font-bold text-neutral-100">{s.value}</div>
            <div className="mt-1">
              <JobStatusBadge status={s.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming / Active Jobs */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-neutral-200">Upcoming & Active</h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-neutral-500" size={24} />
          </div>
        ) : upcoming.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
            No upcoming jobs.{' '}
            <Link href="/dashboard/contractor/jobs/new" className="text-amber-400 hover:underline">
              Create one
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/contractor/jobs/${job.id}`}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-700 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-amber-400">{job.job_number}</span>
                    <JobStatusBadge status={job.status} />
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
                  </div>
                </div>
                <ArrowRight size={16} className="shrink-0 text-neutral-600" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
