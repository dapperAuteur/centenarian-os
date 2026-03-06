'use client';

// app/admin/shortlinks/page.tsx
// Links & Traffic dashboard — short link management + page view analytics.

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from 'recharts';
import { Link2, Loader2, CheckCircle2, Eye, Globe, TrendingUp, ExternalLink, RefreshCw } from 'lucide-react';

interface ShortlinkCounts {
  blog: { with: number; without: number };
  recipe: { with: number; without: number };
  course: { with: number; without: number };
  feature?: { total: number };
}

interface TrafficData {
  summary: { totalViews: number; uniquePaths: number; avgPerDay: number; topReferrer: string | null };
  byDay: { date: string; count: number }[];
  byPath: { path: string; count: number; unique_referrers: number }[];
  byReferrer: { referrer: string; count: number }[];
  byUtmSource: { source: string; count: number }[];
  byUserType: { type: string; count: number }[];
}

const USER_TYPE_COLORS: Record<string, string> = {
  anonymous: '#6b7280',
  real: '#d946ef',
  admin: '#f59e0b',
  demo: '#22c55e',
  tutorial: '#8b5cf6',
};

export default function LinksAndTrafficPage() {
  const [counts, setCounts] = useState<ShortlinkCounts | null>(null);
  const [traffic, setTraffic] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ created: number; failed: number } | null>(null);

  // Filters
  const [excludeAdmin, setExcludeAdmin] = useState(true);
  const [excludeDemo, setExcludeDemo] = useState(true);
  const [pathPrefix, setPathPrefix] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const loadCounts = useCallback(async () => {
    const res = await fetch('/api/admin/shortlinks/sync');
    if (res.ok) setCounts(await res.json());
  }, []);

  const loadTraffic = useCallback(async () => {
    const params = new URLSearchParams();
    params.set('from', fromDate);
    params.set('to', toDate);
    if (excludeAdmin) params.set('exclude_admin', 'true');
    if (excludeDemo) params.set('exclude_demo', 'true');
    if (pathPrefix) params.set('path_prefix', pathPrefix);

    const res = await fetch(`/api/admin/traffic?${params}`);
    if (res.ok) setTraffic(await res.json());
  }, [fromDate, toDate, excludeAdmin, excludeDemo, pathPrefix]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadCounts(), loadTraffic()]).finally(() => setLoading(false));
  }, [loadCounts, loadTraffic]);

  const sync = async (type: string) => {
    setSyncing(type);
    setSyncResult(null);
    const res = await fetch(`/api/admin/shortlinks/sync?type=${type}`, { method: 'POST' });
    if (res.ok) {
      setSyncResult(await res.json());
      loadCounts();
    }
    setSyncing(null);
  };

  const s = traffic?.summary;
  const totalShortLinks = counts
    ? (counts.blog.with + counts.recipe.with + counts.course.with)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-600" />
      </div>
    );
  }

  const shortlinkSections = [
    { key: 'blog', label: 'Blog Posts', data: counts?.blog },
    { key: 'recipe', label: 'Recipes', data: counts?.recipe },
    { key: 'course', label: 'Courses', data: counts?.course },
  ];

  const prefixOptions = [
    { label: 'All', value: '' },
    { label: 'Features', value: '/features/' },
    { label: 'Blog', value: '/blog/' },
    { label: 'Recipes', value: '/recipes/' },
    { label: 'Academy', value: '/academy/' },
    { label: 'Institutions', value: '/institutions/' },
    { label: 'Pricing', value: '/pricing' },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Link2 className="w-6 h-6 text-fuchsia-500" />
          Links & Traffic
        </h1>
        <p className="text-sm text-gray-400 mt-1">Short links, page views, referrers, and campaign tracking</p>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div className="flex items-center gap-2 bg-lime-900/30 border border-lime-700/40 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-lime-400 shrink-0" />
          <p className="text-sm text-lime-300">
            Created {syncResult.created} short links{syncResult.failed > 0 ? `, ${syncResult.failed} failed` : ''}
          </p>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-gray-900 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-gray-800 text-sm text-white rounded-lg px-2 py-1.5 border border-gray-700 scheme-dark"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-gray-800 text-sm text-white rounded-lg px-2 py-1.5 border border-gray-700 scheme-dark"
          />

          <div className="flex items-center gap-1">
            {prefixOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPathPrefix(opt.value)}
                className={`px-2 py-1 text-xs rounded-lg transition ${
                  pathPrefix === opt.value
                    ? 'bg-fuchsia-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={excludeAdmin} onChange={(e) => setExcludeAdmin(e.target.checked)} className="rounded" />
            No admin
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={excludeDemo} onChange={(e) => setExcludeDemo(e.target.checked)} className="rounded" />
            No demo
          </label>

          <button onClick={loadTraffic} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition ml-auto">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
              <Eye className="w-3.5 h-3.5" /> Page Views
            </div>
            <p className="text-2xl font-bold text-white mt-1">{s.totalViews.toLocaleString()}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
              <Globe className="w-3.5 h-3.5" /> Unique Pages
            </div>
            <p className="text-2xl font-bold text-white mt-1">{s.uniquePaths}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5" /> Avg/Day
            </div>
            <p className="text-2xl font-bold text-white mt-1">{s.avgPerDay}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
              <Link2 className="w-3.5 h-3.5" /> Short Links
            </div>
            <p className="text-2xl font-bold text-fuchsia-400 mt-1">{totalShortLinks}</p>
          </div>
        </div>
      )}

      {traffic && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Traffic Over Time */}
          {traffic.byDay.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Traffic Over Time</h2>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={traffic.byDay} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} interval={Math.max(0, Math.floor(traffic.byDay.length / 10))} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                  <Area type="monotone" dataKey="count" name="Views" stroke="#d946ef" fill="#d946ef" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Pages */}
          {traffic.byPath.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Top Pages</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase border-b border-gray-800">
                      <th className="text-left py-2 px-3">Path</th>
                      <th className="text-right py-2 px-3">Views</th>
                      <th className="text-right py-2 px-3">Referrers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traffic.byPath.slice(0, 20).map((p) => (
                      <tr key={p.path} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-2 px-3 text-fuchsia-400 truncate max-w-xs">{p.path}</td>
                        <td className="py-2 px-3 text-right text-gray-200 font-medium">{p.count}</td>
                        <td className="py-2 px-3 text-right text-gray-400">{p.unique_referrers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Referrer Breakdown */}
          {traffic.byReferrer.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Top Referrers</h2>
              <ResponsiveContainer width="100%" height={Math.max(200, traffic.byReferrer.slice(0, 10).length * 36)}>
                <BarChart data={traffic.byReferrer.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis type="category" dataKey="referrer" tick={{ fontSize: 11, fill: '#9ca3af' }} width={140} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', fontSize: 12 }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* User Type Breakdown */}
          {traffic.byUserType.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Visitors by Type</h2>
              <div className="space-y-3">
                {traffic.byUserType.map((ut) => {
                  const pct = s ? Math.round((ut.count / s.totalViews) * 100) : 0;
                  return (
                    <div key={ut.type}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-300 capitalize">{ut.type}</span>
                        <span className="text-gray-400">{ut.count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: USER_TYPE_COLORS[ut.type] || '#6b7280',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* UTM Sources */}
          {traffic.byUtmSource.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">UTM Sources</h2>
              <div className="space-y-2">
                {traffic.byUtmSource.map((u) => (
                  <div key={u.source} className="flex items-center justify-between text-sm bg-gray-800 rounded-lg px-3 py-2">
                    <span className="text-gray-300 flex items-center gap-2">
                      <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
                      {u.source}
                    </span>
                    <span className="text-gray-200 font-medium">{u.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Short Link Management */}
      <div>
        <h2 className="text-lg font-bold text-gray-200 mb-4">Short Link Management</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shortlinkSections.map(({ key, label, data }) => (
            <div key={key} className="bg-gray-900 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300">{label}</h3>
                <button
                  onClick={() => sync(key)}
                  disabled={syncing !== null || (data?.without || 0) === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs font-medium hover:bg-fuchsia-700 transition disabled:opacity-50"
                >
                  {syncing === key ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Sync
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-lime-900/30 rounded-lg p-2">
                  <div className="text-xl font-bold text-lime-400">{data?.with || 0}</div>
                  <div className="text-xs text-lime-500">Linked</div>
                </div>
                <div className="bg-amber-900/30 rounded-lg p-2">
                  <div className="text-xl font-bold text-amber-400">{data?.without || 0}</div>
                  <div className="text-xs text-amber-500">Missing</div>
                </div>
              </div>
            </div>
          ))}

          {/* Feature Pages Card */}
          <div className="bg-gray-900 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">Features</h3>
              <button
                onClick={() => sync('feature')}
                disabled={syncing !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs font-medium hover:bg-fuchsia-700 transition disabled:opacity-50"
              >
                {syncing === 'feature' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Sync
              </button>
            </div>
            <div className="bg-blue-900/30 rounded-lg p-2 text-center">
              <div className="text-xl font-bold text-blue-400">{counts?.feature?.total || 0}</div>
              <div className="text-xs text-blue-500">Feature Pages</div>
            </div>
          </div>
        </div>

        {/* Sync All */}
        <div className="mt-4 text-center">
          <button
            onClick={() => sync('all')}
            disabled={syncing !== null}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-700 transition disabled:opacity-50 text-sm"
          >
            {syncing === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Sync All Content
          </button>
        </div>
      </div>

      {!traffic?.summary?.totalViews && !loading && (
        <div className="text-center py-12 text-gray-500">
          <Eye className="w-8 h-8 mx-auto mb-2" />
          <p>No page views recorded yet</p>
          <p className="text-xs mt-1">Views will appear as visitors browse your public pages</p>
        </div>
      )}
    </div>
  );
}
