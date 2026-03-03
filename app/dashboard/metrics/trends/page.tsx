'use client';

// app/dashboard/metrics/trends/page.tsx
// Health Metrics Trends — time-series charts, stats, personal records, source comparison

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  ChartLine, TrendingUp, TrendingDown, Minus, Trophy, BarChart3,
  Loader2, ArrowUpDown, ChevronDown, Layers, Pencil, Trash2, X, Check,
  AlertTriangle,
} from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MetricRow {
  id?: string;
  logged_date: string;
  source: string;
  [key: string]: string | number | null | undefined;
}

interface MetricStat {
  metric: string;
  avg: number | null;
  min: number | null;
  max: number | null;
  latest: number | null;
  trend: 'up' | 'down' | 'flat';
  trend_pct: number;
  count: number;
}

interface PersonalRecord {
  metric: string;
  value: number;
  date: string;
  type: 'highest' | 'lowest';
}

interface TrendsData {
  rows: MetricRow[];
  stats: MetricStat[];
  records: PersonalRecord[];
  data_range: { first_date: string; last_date: string; total_days: number; days_with_data: number };
  sources: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  resting_hr: 'Resting HR',
  steps: 'Steps',
  sleep_hours: 'Sleep',
  activity_min: 'Activity',
  sleep_score: 'Sleep Score',
  hrv_ms: 'HRV',
  spo2_pct: 'SpO2',
  active_calories: 'Active Cal',
  stress_score: 'Stress',
  recovery_score: 'Recovery',
  weight_lbs: 'Weight',
  body_fat_pct: 'Body Fat',
  muscle_mass_lbs: 'Muscle Mass',
  bmi: 'BMI',
};

const UNITS: Record<string, string> = {
  resting_hr: 'bpm', steps: '', sleep_hours: 'hrs', activity_min: 'min',
  sleep_score: '/100', hrv_ms: 'ms', spo2_pct: '%', active_calories: 'cal',
  stress_score: '/100', recovery_score: '/100', weight_lbs: 'lbs',
  body_fat_pct: '%', muscle_mass_lbs: 'lbs', bmi: '',
};

const LOWER_IS_BETTER = new Set(['resting_hr', 'stress_score', 'body_fat_pct', 'bmi']);

type MetricGroup = 'core' | 'enrichment' | 'body' | 'custom';

const ALL_METRIC_KEYS = Object.keys(METRIC_LABELS);

const GROUPS: Record<MetricGroup, { label: string; metrics: string[]; charts: string[][] }> = {
  core: {
    label: 'Core',
    metrics: ['resting_hr', 'steps', 'sleep_hours', 'activity_min'],
    charts: [['resting_hr'], ['steps'], ['sleep_hours'], ['activity_min']],
  },
  enrichment: {
    label: 'Enrichment',
    metrics: ['sleep_score', 'hrv_ms', 'spo2_pct', 'active_calories', 'stress_score', 'recovery_score'],
    charts: [['sleep_score'], ['hrv_ms'], ['spo2_pct'], ['active_calories'], ['stress_score', 'recovery_score']],
  },
  body: {
    label: 'Body Composition',
    metrics: ['weight_lbs', 'body_fat_pct', 'muscle_mass_lbs', 'bmi'],
    charts: [['weight_lbs', 'muscle_mass_lbs'], ['body_fat_pct', 'bmi']],
  },
  custom: {
    label: 'Custom Compare',
    metrics: ALL_METRIC_KEYS,
    charts: [],
  },
};

const CHART_COLORS = ['#d946ef', '#6366f1', '#0d9488', '#f59e0b', '#ec4899', '#3b82f6'];

const SOURCE_COLORS: Record<string, string> = {
  manual: '#6b7280',
  garmin: '#f59e0b',
  apple_health: '#3b82f6',
  oura: '#8b5cf6',
  whoop: '#ef4444',
  google_health: '#10b981',
  inbody: '#ec4899',
  hume_health: '#0d9488',
  csv: '#64748b',
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual / Merged',
  garmin: 'Garmin',
  apple_health: 'Apple Health',
  oura: 'Oura',
  whoop: 'Whoop',
  google_health: 'Google Health',
  inbody: 'InBody',
  hume_health: 'Hume Health',
  csv: 'CSV Import',
};

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
  { label: 'All', days: 0 },
];

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
}

function formatDate(d: string, range: number): string {
  const dt = new Date(d + 'T12:00:00');
  if (range > 365) return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  if (range > 90) return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MetricsTrendsPage() {
  const today = new Date().toISOString().split('T')[0];
  const [from, setFrom] = useState(daysAgo(90));
  const [to, setTo] = useState(today);
  const [group, setGroup] = useState<MetricGroup>('core');
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [compareMetric, setCompareMetric] = useState('weight_lbs');
  const [customMetrics, setCustomMetrics] = useState<string[]>(['weight_lbs', 'muscle_mass_lbs', 'body_fat_pct']);

  const rangeDays = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await offlineFetch(`/api/health-metrics/trends?from=${from}&to=${to}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
        if (d.sources.length > 1 && selectedSources.length === 0) {
          setSelectedSources(d.sources);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const applyPreset = (days: number) => {
    setTo(today);
    setFrom(days === 0 ? '2015-01-01' : daysAgo(days));
  };

  const toggleSource = (s: string) => {
    setSelectedSources((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const toggleCustomMetric = (m: string) => {
    setCustomMetrics((prev) => {
      if (prev.includes(m)) return prev.filter((x) => x !== m);
      if (prev.length >= 4) return prev; // max 4
      return [...prev, m];
    });
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-600" />
      </div>
    );
  }

  if (!data) return null;

  const groupDef = GROUPS[group];
  const groupStats = data.stats.filter((s) => groupDef.metrics.includes(s.metric));
  const groupRecords = data.records.filter((r) => groupDef.metrics.includes(r.metric));

  // Aggregate rows for charting (sample if too dense)
  const manualRows = data.rows.filter((r) => r.source === 'manual');
  const chartRows = rangeDays > 730
    ? aggregateMonthly(manualRows)
    : rangeDays > 365
      ? aggregateWeekly(manualRows)
      : manualRows;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ChartLine className="w-7 h-7 text-fuchsia-600 shrink-0" />
            Health Trends
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            {data.data_range.days_with_data} days of data across {data.sources.length} source{data.sources.length !== 1 ? 's' : ''}
          </p>
        </div>
        {loading && <Loader2 className="w-5 h-5 animate-spin text-fuchsia-400 shrink-0" />}
      </header>

      {/* Date Range Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1.5 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.days)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition min-h-10 ${
                (p.days === 0 && from <= '2015-01-02') || (p.days > 0 && from === daysAgo(p.days) && to === today)
                  ? 'bg-fuchsia-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800" />
          <span className="text-gray-600">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800" />
        </div>
      </div>

      {/* Data Completeness */}
      <DataCompletenessBar dataRange={data.data_range} />

      {/* Group Tabs */}
      <div className="flex gap-1.5 border-b border-gray-200 pb-px">
        {(Object.entries(GROUPS) as [MetricGroup, typeof GROUPS.core][]).map(([key, g]) => (
          <button
            key={key}
            onClick={() => setGroup(key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition ${
              group === key
                ? 'bg-white border border-gray-200 border-b-white text-fuchsia-700 -mb-px'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {groupStats.map((stat) => (
          <StatCard key={stat.metric} stat={stat} />
        ))}
      </div>

      {/* Personal Records */}
      {groupRecords.length > 0 && <PersonalRecordsStrip records={groupRecords} />}

      {/* Source Comparison Toggle */}
      {data.sources.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={compareMode}
              onChange={(e) => setCompareMode(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500"
            />
            <span className="text-sm font-medium text-gray-700">Compare Sources</span>
            <span className="text-xs text-gray-500">({data.sources.length} sources available)</span>
          </label>

          {compareMode && (
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex flex-wrap gap-2">
                {data.sources.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSource(s)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition border"
                    style={selectedSources.includes(s)
                      ? { backgroundColor: SOURCE_COLORS[s] || '#6b7280', color: '#fff', borderColor: 'transparent' }
                      : { borderColor: '#d1d5db', color: '#374151' }
                    }
                  >
                    {SOURCE_LABELS[s] || s}
                  </button>
                ))}
              </div>
              <div className="relative">
                <select
                  value={compareMetric}
                  onChange={(e) => setCompareMetric(e.target.value)}
                  className="px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm appearance-none bg-white text-gray-800"
                >
                  {[...GROUPS.core.metrics, ...GROUPS.enrichment.metrics, ...GROUPS.body.metrics].map((m) => (
                    <option key={m} value={m}>{METRIC_LABELS[m]}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Custom Metric Selector (visible only in custom group) */}
      {group === 'custom' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-fuchsia-600" />
            <span className="text-sm font-medium text-gray-700">Pick up to 4 metrics to compare</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_METRIC_KEYS.map((m) => (
              <button
                key={m}
                onClick={() => toggleCustomMetric(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                  customMetrics.includes(m)
                    ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                } ${!customMetrics.includes(m) && customMetrics.length >= 4 ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      {compareMode && data.sources.length > 1 ? (
        <SourceComparisonChart
          rows={data.rows}
          metric={compareMetric}
          sources={selectedSources}
          rangeDays={rangeDays}
        />
      ) : group === 'custom' ? (
        customMetrics.length > 0 && (
          <CustomComparisonChart
            rows={chartRows}
            metrics={customMetrics}
            rangeDays={rangeDays}
          />
        )
      ) : (
        <div className="space-y-4">
          {groupDef.charts.map((metrics, i) => (
            <TrendChart
              key={metrics.join(',')}
              rows={chartRows}
              metrics={metrics}
              rangeDays={rangeDays}
              colorOffset={i}
            />
          ))}
        </div>
      )}

      {/* Data Table */}
      <DataTable
        rows={data.rows}
        metrics={group === 'custom' ? customMetrics : groupDef.metrics}
        rangeDays={rangeDays}
        sources={data.sources}
        onRefresh={load}
      />
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function StatCard({ stat }: { stat: MetricStat }) {
  if (stat.count === 0) return null;

  const isLowerBetter = LOWER_IS_BETTER.has(stat.metric);
  const trendColor = stat.trend === 'flat'
    ? 'text-gray-500'
    : (stat.trend === 'up') === !isLowerBetter
      ? 'text-lime-600'
      : 'text-red-500';

  const TrendIcon = stat.trend === 'up' ? TrendingUp : stat.trend === 'down' ? TrendingDown : Minus;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-600 mb-1">{METRIC_LABELS[stat.metric]}</p>
      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-bold text-gray-900">{stat.avg ?? '—'}</span>
        <span className="text-xs text-gray-500 mb-1">{UNITS[stat.metric]}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
        <span className={`text-xs font-medium ${trendColor}`}>
          {stat.trend_pct > 0 ? '+' : ''}{stat.trend_pct.toFixed(1)}%
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Min {stat.min} / Max {stat.max} ({stat.count} pts)
      </p>
    </div>
  );
}

function PersonalRecordsStrip({ records }: { records: PersonalRecord[] }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="flex gap-3 pb-1">
        {records.map((r) => (
          <div
            key={`${r.metric}-${r.type}`}
            className="shrink-0 bg-amber-50 border border-amber-200 rounded-xl p-3 min-w-[150px]"
          >
            <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1">
              <Trophy className="w-3 h-3" />
              {r.type === 'highest' ? 'Best' : 'Best Low'}
            </div>
            <div className="text-lg font-bold text-gray-900">
              {r.value.toLocaleString()}{' '}
              <span className="text-sm font-normal text-gray-500">{UNITS[r.metric]}</span>
            </div>
            <div className="text-xs text-gray-600">{METRIC_LABELS[r.metric]}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {new Date(r.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataCompletenessBar({ dataRange }: { dataRange: TrendsData['data_range'] }) {
  const pct = Math.round((dataRange.days_with_data / dataRange.total_days) * 100);
  return (
    <div className="flex items-center gap-3 text-sm">
      <BarChart3 className="w-4 h-4 text-gray-500 shrink-0" />
      <div className="flex-1">
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className="bg-fuchsia-500 rounded-full h-1.5 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-xs text-gray-600 shrink-0 whitespace-nowrap">
        {dataRange.days_with_data}/{dataRange.total_days} days ({pct}%)
      </span>
    </div>
  );
}

// ─── Charts ──────────────────────────────────────────────────────────────────

function TrendChart({ rows, metrics, rangeDays, colorOffset }: {
  rows: MetricRow[];
  metrics: string[];
  rangeDays: number;
  colorOffset: number;
}) {
  const hasData = rows.some((r) => metrics.some((m) => r[m] != null));
  if (!hasData) {
    return (
      <ChartCard title={metrics.map((m) => METRIC_LABELS[m]).join(' & ')}>
        <p className="text-sm text-gray-500 py-12 text-center">No data in this range</p>
      </ChartCard>
    );
  }

  const useDualAxis = metrics.length === 2;

  return (
    <ChartCard title={metrics.map((m) => METRIC_LABELS[m]).join(' & ')}>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows} margin={{ top: 5, right: useDualAxis ? 50 : 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="logged_date"
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            minTickGap={40}
            tickFormatter={(d: string) => formatDate(d, rangeDays)}
          />
          {metrics.map((m, i) => (
            <YAxis
              key={m}
              yAxisId={useDualAxis ? (i === 0 ? 'left' : 'right') : 'left'}
              orientation={useDualAxis && i === 1 ? 'right' : 'left'}
              tick={{ fontSize: 11 }}
              stroke={CHART_COLORS[(colorOffset + i) % CHART_COLORS.length]}
              width={50}
              label={UNITS[m] ? {
                value: UNITS[m],
                angle: useDualAxis && i === 1 ? 90 : -90,
                position: useDualAxis && i === 1 ? 'insideRight' : 'insideLeft',
                fontSize: 10,
                fill: '#9ca3af',
              } : undefined}
            />
          ))}
          <Tooltip
            contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: 12 }}
            labelFormatter={(d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [
              `${value} ${UNITS[name] || ''}`,
              METRIC_LABELS[name] || name,
            ]}
          />
          {metrics.length > 1 && <Legend />}
          {metrics.map((m, i) => (
            <Line
              key={m}
              yAxisId={useDualAxis ? (i === 0 ? 'left' : 'right') : 'left'}
              type="monotone"
              dataKey={m}
              stroke={CHART_COLORS[(colorOffset + i) % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
              name={m}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function SourceComparisonChart({ rows, metric, sources, rangeDays }: {
  rows: MetricRow[];
  metric: string;
  sources: string[];
  rangeDays: number;
}) {
  // Pivot: { date, garmin: 195, apple_health: 196, ... }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dateMap = new Map<string, Record<string, any>>();
  for (const row of rows) {
    if (!sources.includes(row.source)) continue;
    const val = row[metric];
    if (val == null) continue;
    if (!dateMap.has(row.logged_date)) dateMap.set(row.logged_date, { date: row.logged_date });
    const entry = dateMap.get(row.logged_date)!;
    entry[row.source] = typeof val === 'number' ? val : parseFloat(val as string);
  }

  const chartData = Array.from(dateMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );

  if (chartData.length === 0) {
    return (
      <ChartCard title={`${METRIC_LABELS[metric]} — Source Comparison`}>
        <p className="text-sm text-gray-500 py-12 text-center">No overlapping data for selected sources</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title={`${METRIC_LABELS[metric]} — Source Comparison`}>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            minTickGap={40}
            tickFormatter={(d: string) => formatDate(d, rangeDays)}
          />
          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" width={50} />
          <Tooltip
            contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: 12 }}
            labelFormatter={(d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [
              `${value} ${UNITS[metric] || ''}`,
              SOURCE_LABELS[name] || name,
            ]}
          />
          <Legend formatter={(value: string) => SOURCE_LABELS[value] || value} />
          {sources.map((s) => (
            <Line
              key={s}
              type="monotone"
              dataKey={s}
              stroke={SOURCE_COLORS[s] || '#6b7280'}
              strokeWidth={2}
              dot={false}
              connectNulls
              name={s}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function CustomComparisonChart({ rows, metrics, rangeDays }: {
  rows: MetricRow[];
  metrics: string[];
  rangeDays: number;
}) {
  const hasData = rows.some((r) => metrics.some((m) => r[m] != null));
  if (!hasData) {
    return (
      <ChartCard title={metrics.map((m) => METRIC_LABELS[m]).join(' & ')}>
        <p className="text-sm text-gray-500 py-12 text-center">No data in this range</p>
      </ChartCard>
    );
  }

  // Normalize: convert each metric to % of its own max for overlaid comparison
  // Also keep raw values for the tooltip
  const maxVals: Record<string, number> = {};
  for (const m of metrics) {
    let mx = 0;
    for (const r of rows) {
      const v = r[m];
      if (typeof v === 'number' && v > mx) mx = v;
    }
    maxVals[m] = mx || 1;
  }

  const normalizedData = rows.map((r) => {
    const point: Record<string, string | number | null> = { logged_date: r.logged_date };
    for (const m of metrics) {
      const v = r[m];
      // Store normalized value for charting
      point[m] = typeof v === 'number' ? Math.round((v / maxVals[m]) * 1000) / 10 : null;
      // Store raw value for tooltip
      point[`_raw_${m}`] = v ?? null;
    }
    return point;
  });

  return (
    <ChartCard title={metrics.map((m) => METRIC_LABELS[m]).join(' & ')}>
      <p className="text-xs text-gray-500 mb-3">
        Values normalized to % of max for visual comparison. Hover for actual values.
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={normalizedData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="logged_date"
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            minTickGap={40}
            tickFormatter={(d: string) => formatDate(d, rangeDays)}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            width={40}
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: 12 }}
            labelFormatter={(d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any, props: any) => {
              const raw = props.payload?.[`_raw_${name}`];
              return [
                `${raw ?? '—'} ${UNITS[name] || ''} (${value}%)`,
                METRIC_LABELS[name] || name,
              ];
            }}
          />
          <Legend formatter={(value: string) => METRIC_LABELS[value] || value} />
          {metrics.map((m, i) => (
            <Line
              key={m}
              type="monotone"
              dataKey={m}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
              name={m}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ─── Data Table ──────────────────────────────────────────────────────────────

function DataTable({ rows, metrics, rangeDays, sources, onRefresh }: {
  rows: MetricRow[];
  metrics: string[];
  rangeDays: number;
  sources: string[];
  onRefresh: () => void;
}) {
  const [sortKey, setSortKey] = useState('logged_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleteSource, setBulkDeleteSource] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const PAGE_SIZE = 30;

  const filteredRows = sourceFilter === 'all'
    ? rows
    : rows.filter((r) => r.source === sourceFilter);

  const sorted = [...filteredRows].sort((a, b) => {
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'asc' ? av - bv : bv - av;
    }
    return sortDir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  const pageCount = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(0);
  };

  const startEdit = (row: MetricRow) => {
    if (!row.id) return;
    setEditingId(row.id);
    const vals: Record<string, string> = {};
    for (const m of metrics) {
      vals[m] = row[m] != null ? String(row[m]) : '';
    }
    setEditValues(vals);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const body: Record<string, unknown> = { id: editingId };
    for (const [k, v] of Object.entries(editValues)) {
      body[k] = v === '' ? null : parseFloat(v);
    }
    await offlineFetch('/api/health-metrics', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setEditingId(null);
    setSaving(false);
    onRefresh();
  };

  const deleteRow = async (id: string) => {
    setDeletingId(id);
    await offlineFetch(`/api/health-metrics?id=${id}`, { method: 'DELETE' });
    setDeletingId(null);
    onRefresh();
  };

  const bulkDelete = async (source: string) => {
    setBulkDeleting(true);
    await offlineFetch(`/api/health-metrics?source=${source}`, { method: 'DELETE' });
    setBulkDeleting(false);
    setBulkDeleteSource(null);
    onRefresh();
  };

  if (rows.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Data ({filteredRows.length} rows)
          </h3>
          {/* Source filter */}
          {sources.length > 1 && (
            <select
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }}
              className="px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-800"
            >
              <option value="all">All Sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Bulk delete by source */}
          {sources.length > 0 && sourceFilter !== 'all' && (
            bulkDeleteSource === sourceFilter ? (
              <div className="flex items-center gap-1.5 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-red-600 font-medium">Delete all {SOURCE_LABELS[sourceFilter]} data?</span>
                <button
                  onClick={() => bulkDelete(sourceFilter)}
                  disabled={bulkDeleting}
                  className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {bulkDeleting ? 'Deleting...' : 'Yes, delete'}
                </button>
                <button onClick={() => setBulkDeleteSource(null)} className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setBulkDeleteSource(sourceFilter)}
                className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3 inline mr-1" />
                Delete all {SOURCE_LABELS[sourceFilter]}
              </button>
            )
          )}
          {pageCount > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-gray-700">{page + 1}/{pageCount}</span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page === pageCount - 1}
                className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="overflow-auto max-h-[600px]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-[0_1px_0_0_#e5e7eb]">
            <tr>
              <th
                className="px-3 py-2 text-left font-medium text-gray-600 cursor-pointer whitespace-nowrap"
                onClick={() => toggleSort('logged_date')}
              >
                <span className="inline-flex items-center gap-1">
                  Date <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                Source
              </th>
              {metrics.map((m) => (
                <th
                  key={m}
                  className="px-3 py-2 text-right font-medium text-gray-600 cursor-pointer whitespace-nowrap"
                  onClick={() => toggleSort(m)}
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    {METRIC_LABELS[m]} <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageRows.map((row) => {
              const isEditing = editingId === row.id;
              return (
                <tr key={`${row.logged_date}-${row.source}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                    {formatDate(row.logged_date, rangeDays)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                      style={{ backgroundColor: SOURCE_COLORS[row.source] || '#6b7280' }}
                    >
                      {SOURCE_LABELS[row.source] || row.source}
                    </span>
                  </td>
                  {metrics.map((m) => (
                    <td key={m} className="px-3 py-2 text-right tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="any"
                          value={editValues[m] || ''}
                          onChange={(e) => setEditValues((v) => ({ ...v, [m]: e.target.value }))}
                          className="w-20 px-1.5 py-0.5 border border-gray-300 rounded text-right text-sm"
                        />
                      ) : row[m] != null ? (
                        <span className="text-gray-900">{row[m]}</span>
                      ) : (
                        <span className="text-gray-400">&mdash;</span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {row.id && (
                      <div className="flex items-center gap-1 justify-end">
                        {isEditing ? (
                          <>
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="p-1 rounded text-lime-600 hover:bg-lime-50"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 rounded text-gray-400 hover:bg-gray-100"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(row)}
                              className="p-1 rounded text-gray-400 hover:text-fuchsia-600 hover:bg-fuchsia-50"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteRow(row.id!)}
                              disabled={deletingId === row.id}
                              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Aggregation helpers ─────────────────────────────────────────────────────

function aggregateWeekly(rows: MetricRow[]): MetricRow[] {
  return aggregateByPeriod(rows, (d) => {
    const dt = new Date(d + 'T12:00:00');
    const start = new Date(dt);
    start.setDate(dt.getDate() - dt.getDay());
    return start.toISOString().split('T')[0];
  });
}

function aggregateMonthly(rows: MetricRow[]): MetricRow[] {
  return aggregateByPeriod(rows, (d) => d.slice(0, 7) + '-15');
}

function aggregateByPeriod(rows: MetricRow[], keyFn: (d: string) => string): MetricRow[] {
  const buckets = new Map<string, MetricRow[]>();
  for (const row of rows) {
    const key = keyFn(row.logged_date);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(row);
  }

  const allMetrics = Object.keys(METRIC_LABELS);
  const result: MetricRow[] = [];

  for (const [date, bucket] of buckets) {
    const agg: MetricRow = { logged_date: date, source: 'manual' };
    for (const m of allMetrics) {
      const vals = bucket.map((r) => r[m]).filter((v): v is number => typeof v === 'number');
      if (vals.length > 0) {
        agg[m] = Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
      }
    }
    result.push(agg);
  }

  return result.sort((a, b) => a.logged_date.localeCompare(b.logged_date));
}
