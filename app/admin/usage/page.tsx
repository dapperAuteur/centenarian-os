'use client';

// app/admin/usage/page.tsx
// Admin usage analytics: module usage, daily trends, feature adoption, subscription breakdown.

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { Activity, Users, TrendingUp, Star, RefreshCw } from 'lucide-react';
import { MODULES } from '@/lib/constants/modules';

interface UsageData {
  byModule: { module: string; count: number }[];
  byDay: { date: string; count: number }[];
  byAction: { action: string; count: number }[];
  bySubscription: { type: string; count: number }[];
  topFeatures: { module: string; action: string; detail: string | null; count: number }[];
  summary: { totalEvents: number; uniqueUsers: number; avgPerDay: number; topModule: string | null };
}

const MODULE_OPTIONS = ['all', ...Object.values(MODULES)];
const SUB_OPTIONS = ['all', 'free', 'monthly', 'lifetime', 'teacher', 'invited'];
const SUB_COLORS: Record<string, string> = {
  free: '#6b7280', monthly: '#8b5cf6', lifetime: '#d946ef',
  teacher: '#22c55e', invited: '#f59e0b', unknown: '#374151',
};
const PIE_COLORS = ['#d946ef', '#8b5cf6', '#22c55e', '#f59e0b', '#6b7280', '#374151'];

export default function AdminUsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [excludeAdmin, setExcludeAdmin] = useState(true);
  const [excludeDemo, setExcludeDemo] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [subFilter, setSubFilter] = useState('all');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('from', fromDate);
    params.set('to', toDate);
    if (excludeAdmin) params.set('exclude_admin', 'true');
    if (excludeDemo) params.set('exclude_demo', 'true');
    if (moduleFilter !== 'all') params.set('module', moduleFilter);
    if (subFilter !== 'all') params.set('subscription_type', subFilter);

    try {
      const res = await fetch(`/api/admin/usage?${params}`);
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, excludeAdmin, excludeDemo, moduleFilter, subFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const s = data?.summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usage Analytics</h1>
        <p className="text-sm text-gray-400 mt-1">Module usage, feature adoption, and user segmentation</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-gray-900 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-gray-800 text-sm text-gray-200 rounded-lg px-2 py-1.5 border border-gray-700"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-gray-800 text-sm text-gray-200 rounded-lg px-2 py-1.5 border border-gray-700"
          />

          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="bg-gray-800 text-sm text-gray-200 rounded-lg px-3 py-1.5 border border-gray-700"
          >
            {MODULE_OPTIONS.map((m) => (
              <option key={m} value={m}>{m === 'all' ? 'All Modules' : m.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <select
            value={subFilter}
            onChange={(e) => setSubFilter(e.target.value)}
            className="bg-gray-800 text-sm text-gray-200 rounded-lg px-3 py-1.5 border border-gray-700"
          >
            {SUB_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All Plans' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={excludeAdmin} onChange={(e) => setExcludeAdmin(e.target.checked)} className="rounded" />
            Exclude admin
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={excludeDemo} onChange={(e) => setExcludeDemo(e.target.checked)} className="rounded" />
            Exclude demo
          </label>

          <button onClick={fetchData} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition ml-auto">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5" /> Total Events
            </div>
            <p className="text-2xl font-bold text-white mt-1">{s.totalEvents.toLocaleString()}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" /> Unique Users
            </div>
            <p className="text-2xl font-bold text-white mt-1">{s.uniqueUsers}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5" /> Avg/Day
            </div>
            <p className="text-2xl font-bold text-white mt-1">{s.avgPerDay}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
              <Star className="w-3.5 h-3.5" /> Top Module
            </div>
            <p className="text-2xl font-bold text-fuchsia-400 mt-1">{s.topModule ?? '—'}</p>
          </div>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Module Usage Bar Chart */}
          {data.byModule.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Events by Module</h2>
              <ResponsiveContainer width="100%" height={Math.max(200, data.byModule.length * 36)}>
                <BarChart data={data.byModule} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis type="category" dataKey="module" tick={{ fontSize: 11, fill: '#9ca3af' }} width={120} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', fontSize: 12 }} />
                  <Bar dataKey="count" fill="#d946ef" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Subscription Breakdown Pie Chart */}
          {data.bySubscription.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Events by Plan Type</h2>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={data.bySubscription}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                    labelLine={{ stroke: '#6b7280' }}
                  >
                    {data.bySubscription.map((entry, i) => (
                      <Cell key={entry.type} fill={SUB_COLORS[entry.type] || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Daily Activity Line Chart */}
          {data.byDay.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Daily Activity</h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.byDay} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} interval={Math.max(0, Math.floor(data.byDay.length / 10))} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                  <Line type="monotone" dataKey="count" name="Events" stroke="#d946ef" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Top Features Table */}
      {data?.topFeatures && data.topFeatures.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Top Features</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-300 uppercase border-b border-gray-800">
                  <th className="text-left py-2 px-3">Module</th>
                  <th className="text-left py-2 px-3">Action</th>
                  <th className="text-left py-2 px-3">Detail</th>
                  <th className="text-right py-2 px-3">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.topFeatures.map((f, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 px-3 text-fuchsia-400">{f.module}</td>
                    <td className="py-2 px-3 text-gray-300">{f.action}</td>
                    <td className="py-2 px-3 text-gray-400 truncate max-w-xs">{f.detail || '—'}</td>
                    <td className="py-2 px-3 text-right text-gray-200 font-medium">{f.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions by Type */}
      {data?.byAction && data.byAction.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Events by Action Type</h2>
          <div className="flex flex-wrap gap-3">
            {data.byAction.map((a) => (
              <div key={a.action} className="bg-gray-800 rounded-lg px-4 py-2">
                <p className="text-xs text-gray-400">{a.action}</p>
                <p className="text-lg font-bold text-gray-200">{a.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !data?.summary?.totalEvents && (
        <div className="text-center py-12 text-gray-500">
          <Activity className="w-8 h-8 mx-auto mb-2" />
          <p>No usage events recorded yet</p>
          <p className="text-xs mt-1">Events will appear as users interact with the app</p>
        </div>
      )}
    </div>
  );
}
