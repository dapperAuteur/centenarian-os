'use client';

// app/admin/content-status/page.tsx
// Admin content staleness dashboard — shows when key content sources were last updated.

import { useEffect, useState } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import {
  Loader2, FileText, AlertTriangle, CheckCircle, Clock,
  BookOpen, BrainCircuit, GraduationCap, RefreshCw,
} from 'lucide-react';

interface ContentSource {
  key: string;
  label: string;
  description: string;
  path: string;
  modifiedAt: string | null;
  daysSinceUpdate: number | null;
  stale: boolean;
  exists: boolean;
}

interface StatusData {
  sources: ContentSource[];
  staleCount: number;
  staleDays: number;
}

function getStaleBadge(days: number | null, stale: boolean, exists: boolean) {
  if (!exists) return { label: 'Missing', color: 'bg-red-900/50 text-red-400', icon: AlertTriangle };
  if (stale) return { label: `${days}d old`, color: 'bg-amber-900/50 text-amber-400', icon: AlertTriangle };
  return { label: `${days}d ago`, color: 'bg-emerald-900/50 text-emerald-400', icon: CheckCircle };
}

function getGroupIcon(key: string) {
  if (key === 'help_rag') return BookOpen;
  if (key === 'admin_education') return BrainCircuit;
  return GraduationCap;
}

export default function ContentStatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  function fetchStatus() {
    setLoading(true);
    offlineFetch('/api/admin/content-status')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { fetchStatus(); }, []);

  if (loading && !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" />
      </div>
    );
  }

  if (!data) return null;

  const core = data.sources.filter((s) => s.key === 'help_rag' || s.key === 'admin_education');
  const tutorials = data.sources.filter((s) => s.key.startsWith('tutorial_'));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-fuchsia-400" />
            <h1 className="text-2xl font-bold text-white">Content Status</h1>
            {data.staleCount > 0 && (
              <span className="px-2.5 py-0.5 bg-amber-500 text-gray-900 text-xs font-bold rounded-full">
                {data.staleCount} stale
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Sources older than {data.staleDays} days are flagged as stale.
          </p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 min-h-11"
          aria-label="Refresh status"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{data.sources.length}</p>
          <p className="text-xs text-gray-400 mt-1">Total Sources</p>
        </div>
        <div className="bg-gray-900 border border-emerald-800/50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{data.sources.length - data.staleCount}</p>
          <p className="text-xs text-gray-400 mt-1">Up to Date</p>
        </div>
        <div className={`bg-gray-900 border rounded-xl p-4 text-center ${data.staleCount > 0 ? 'border-amber-700/50' : 'border-gray-800'}`}>
          <p className={`text-2xl font-bold ${data.staleCount > 0 ? 'text-amber-400' : 'text-white'}`}>{data.staleCount}</p>
          <p className="text-xs text-gray-400 mt-1">Stale ({data.staleDays}d+)</p>
        </div>
      </div>

      {/* Core content */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Core Content</h2>
      <div className="space-y-2 mb-8">
        {core.map((source) => (
          <SourceRow key={source.key} source={source} />
        ))}
      </div>

      {/* Tutorial courses */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Tutorial Courses ({tutorials.length})
      </h2>
      <div className="space-y-2">
        {tutorials.map((source) => (
          <SourceRow key={source.key} source={source} />
        ))}
      </div>
    </div>
  );
}

function SourceRow({ source }: { source: ContentSource }) {
  const badge = getStaleBadge(source.daysSinceUpdate, source.stale, source.exists);
  const BadgeIcon = badge.icon;
  const GroupIcon = getGroupIcon(source.key);

  return (
    <div className={`bg-gray-900 border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${source.stale ? 'border-amber-700/30' : 'border-gray-800'}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <GroupIcon className={`w-4 h-4 shrink-0 ${source.stale ? 'text-amber-400' : 'text-gray-500'}`} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">{source.label}</p>
          <p className="text-xs text-gray-500 truncate">{source.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {source.modifiedAt && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            {new Date(source.modifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
        <span className={`flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full ${badge.color}`}>
          <BadgeIcon className="w-3 h-3" />
          {badge.label}
        </span>
      </div>
    </div>
  );
}
