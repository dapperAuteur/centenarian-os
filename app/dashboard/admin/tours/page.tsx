'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BarChart3, Play, Eye, UserPlus, CheckCircle2,
  XCircle, SkipForward, LogIn,
} from 'lucide-react';

interface Overview {
  total_tours_started: number;
  total_tours_completed: number;
  total_tours_skipped: number;
  total_tours_exited: number;
  total_demo_logins: number;
  total_feature_views: number;
  total_signup_clicks: number;
  last_7_days: {
    tours_started: number;
    tours_completed: number;
    demo_logins: number;
    feature_views: number;
  };
}

interface RecentEvent {
  alias: string;
  app: string;
  module: string;
  event: string;
  step: string | null;
  stepTitle: string | null;
  time: string;
}

interface AnalyticsData {
  overview: Overview;
  module_stats: Record<string, { started: number; completed: number; skipped: number; exited: number }>;
  top_demo_sources: { module: string; count: number }[];
  recent_activity: RecentEvent[];
}

function StatCard({ label, value, sub, icon: Icon }: {
  label: string;
  value: number;
  sub?: string;
  icon: typeof BarChart3;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-neutral-500" aria-hidden="true" />
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-neutral-100">{value}</p>
      {sub && <p className="text-xs text-neutral-500 mt-1">{sub}</p>}
    </div>
  );
}

const EVENT_LABELS: Record<string, string> = {
  tour_started: 'Started tour',
  tour_completed: 'Completed tour',
  tour_skipped: 'Skipped tour',
  tour_exited: 'Exited tour',
  step_completed: 'Completed step',
  step_skipped: 'Skipped step',
  cta_demo_click: 'Demo login',
  cta_signup_click: 'Signup click',
  feature_page_view: 'Feature page view',
  demo_feature_view: 'Demo feature view',
  tour_restarted: 'Restarted tour',
};

export default function TourAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/tour-analytics')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-neutral-500 text-sm">Loading tour analytics…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-red-400 text-sm">Failed to load analytics.</p>
      </div>
    );
  }

  const { overview: o } = data;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link
        href="/dashboard/admin"
        className="flex items-center gap-2 text-neutral-500 hover:text-neutral-300 text-sm font-medium mb-6 min-h-11"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Admin Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-neutral-100 mb-6">Tour Analytics</h1>

      {/* Overview cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard label="Tours Started" value={o.total_tours_started} sub={`${o.last_7_days.tours_started} last 7 days`} icon={Play} />
        <StatCard label="Tours Completed" value={o.total_tours_completed} sub={`${o.last_7_days.tours_completed} last 7 days`} icon={CheckCircle2} />
        <StatCard label="Demo Logins" value={o.total_demo_logins} sub={`${o.last_7_days.demo_logins} last 7 days`} icon={LogIn} />
        <StatCard label="Feature Page Views" value={o.total_feature_views} sub={`${o.last_7_days.feature_views} last 7 days`} icon={Eye} />
      </div>

      <div className="grid gap-4 grid-cols-3 mb-8">
        <StatCard label="Signup Clicks" value={o.total_signup_clicks} icon={UserPlus} />
        <StatCard label="Tours Skipped" value={o.total_tours_skipped} icon={SkipForward} />
        <StatCard label="Tours Exited" value={o.total_tours_exited} icon={XCircle} />
      </div>

      {/* Top demo sources */}
      {data.top_demo_sources.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-neutral-200 mb-3">Top Demo Sources</h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left px-4 py-3 text-neutral-500 font-medium">Module</th>
                  <th className="text-right px-4 py-3 text-neutral-500 font-medium">Demo Logins</th>
                </tr>
              </thead>
              <tbody>
                {data.top_demo_sources.map((s) => (
                  <tr key={s.module} className="border-b border-neutral-800/50 last:border-0">
                    <td className="px-4 py-3 text-neutral-300">{s.module}</td>
                    <td className="px-4 py-3 text-right text-neutral-200 font-medium">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Module completion rates */}
      {Object.keys(data.module_stats).length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-neutral-200 mb-3">Module Tour Status</h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left px-4 py-3 text-neutral-500 font-medium">Module</th>
                  <th className="text-right px-4 py-3 text-neutral-500 font-medium">In Progress</th>
                  <th className="text-right px-4 py-3 text-neutral-500 font-medium">Completed</th>
                  <th className="text-right px-4 py-3 text-neutral-500 font-medium">Skipped</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.module_stats).map(([key, stats]) => (
                  <tr key={key} className="border-b border-neutral-800/50 last:border-0">
                    <td className="px-4 py-3 text-neutral-300">{key}</td>
                    <td className="px-4 py-3 text-right text-neutral-400">{stats.started}</td>
                    <td className="px-4 py-3 text-right text-green-400">{stats.completed}</td>
                    <td className="px-4 py-3 text-right text-neutral-500">{stats.skipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-200 mb-3">Recent Activity</h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left px-4 py-3 text-neutral-500 font-medium">Alias</th>
                <th className="text-left px-4 py-3 text-neutral-500 font-medium">App</th>
                <th className="text-left px-4 py-3 text-neutral-500 font-medium">Module</th>
                <th className="text-left px-4 py-3 text-neutral-500 font-medium">Event</th>
                <th className="text-left px-4 py-3 text-neutral-500 font-medium">Step</th>
                <th className="text-right px-4 py-3 text-neutral-500 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_activity.map((e, i) => (
                <tr key={i} className="border-b border-neutral-800/50 last:border-0">
                  <td className="px-4 py-3 text-amber-400 font-mono text-xs">{e.alias}</td>
                  <td className="px-4 py-3 text-neutral-400">{e.app}</td>
                  <td className="px-4 py-3 text-neutral-300">{e.module}</td>
                  <td className="px-4 py-3 text-neutral-300">{EVENT_LABELS[e.event] || e.event}</td>
                  <td className="px-4 py-3 text-neutral-500">{e.stepTitle || e.step || '—'}</td>
                  <td className="px-4 py-3 text-right text-neutral-500 text-xs">
                    {new Date(e.time).toLocaleString()}
                  </td>
                </tr>
              ))}
              {data.recent_activity.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-neutral-600">
                    No tour events yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
