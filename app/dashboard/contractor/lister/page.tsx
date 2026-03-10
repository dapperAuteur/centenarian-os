'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Loader2, Briefcase, Users, Send, UserPlus, CalendarCheck,
  UsersRound, BarChart3, ChevronRight, Clock,
} from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface DashboardData {
  summary: {
    total_jobs: number;
    upcoming_jobs: number;
    job_status: Record<string, number>;
    total_assignments: number;
    pending_offers: number;
    accepted: number;
    declined: number;
    fill_rate: number;
    roster_size: number;
    unread_messages: number;
    group_count: number;
  };
  upcoming: { id: string; event_name: string | null; client_name: string; start_date: string | null }[];
}

const STAT_CARDS: { key: string; label: string; icon: typeof Briefcase; href?: string; suffix?: string }[] = [
  { key: 'total_jobs', label: 'Total Jobs', icon: Briefcase, href: '/dashboard/contractor/jobs' },
  { key: 'upcoming_jobs', label: 'Upcoming', icon: CalendarCheck, href: '/dashboard/contractor/jobs' },
  { key: 'roster_size', label: 'Roster', icon: Users, href: '/dashboard/contractor/lister/roster' },
  { key: 'pending_offers', label: 'Pending Offers', icon: Clock, href: '/dashboard/contractor/lister/assign' },
  { key: 'accepted', label: 'Accepted', icon: UserPlus, href: '/dashboard/contractor/lister/assign' },
  { key: 'fill_rate', label: 'Fill Rate', icon: BarChart3, suffix: '%' },
  { key: 'unread_messages', label: 'Unread Messages', icon: Send, href: '/dashboard/contractor/lister/messages' },
  { key: 'group_count', label: 'Groups', icon: UsersRound, href: '/dashboard/contractor/lister/groups' },
];

export default function ListerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    offlineFetch('/api/contractor/lister/dashboard')
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-neutral-500" size={28} aria-label="Loading..." />
      </div>
    );
  }

  if (!data?.summary) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <div className="rounded-xl border border-red-800/50 bg-red-900/20 p-4 text-sm text-red-300">
          Lister role required. Contact admin to upgrade your account.
        </div>
      </div>
    );
  }

  const { summary, upcoming } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <h1 className="text-2xl font-bold text-neutral-100">Lister Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon: Icon, href, suffix }) => {
          const value = summary[key as keyof typeof summary];
          const card = (
            <div
              key={key}
              className={`rounded-xl border border-neutral-800 bg-neutral-900 p-4 ${href ? 'hover:border-indigo-700/50 transition' : ''}`}
            >
              <div className="flex items-center gap-2 text-neutral-500 mb-1">
                <Icon size={14} className="shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium">{label}</span>
              </div>
              <p className="text-2xl font-bold text-neutral-100">
                {typeof value === 'number' ? value : 0}
                {suffix ?? ''}
              </p>
            </div>
          );

          return href ? (
            <Link key={key} href={href} className="block">
              {card}
            </Link>
          ) : (
            <div key={key}>{card}</div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Create Job', href: '/dashboard/contractor/jobs/new', icon: Briefcase },
          { label: 'Assign Contractors', href: '/dashboard/contractor/lister/assign', icon: UserPlus },
          { label: 'Send Message', href: '/dashboard/contractor/lister/messages', icon: Send },
        ].map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3.5 text-sm font-medium text-neutral-200 hover:border-indigo-700/50 hover:bg-neutral-800/50 transition"
          >
            <Icon size={16} className="text-indigo-400 shrink-0" aria-hidden="true" />
            {label}
            <ChevronRight size={14} className="ml-auto text-neutral-500" aria-hidden="true" />
          </Link>
        ))}
      </div>

      {/* Upcoming jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-neutral-100">Upcoming Jobs</h2>
          <Link href="/dashboard/contractor/jobs" className="text-sm text-indigo-400 hover:underline">
            View all
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-500">
            No upcoming jobs. Create one to get started.
          </div>
        ) : (
          <div className="space-y-2" role="list" aria-label="Upcoming jobs">
            {upcoming.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/contractor/jobs/${job.id}`}
                role="listitem"
                className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-indigo-700/50 transition"
              >
                <Briefcase size={16} className="text-indigo-400 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-100 truncate">
                    {job.event_name || job.client_name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {job.client_name}{job.start_date ? ` · ${new Date(job.start_date + 'T00:00:00').toLocaleDateString()}` : ''}
                  </p>
                </div>
                <ChevronRight size={14} className="text-neutral-500 shrink-0" aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
