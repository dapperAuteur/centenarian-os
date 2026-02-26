'use client';

import { useEffect, useState, useCallback } from 'react';
import { Activity, Lock, CheckCircle2, TrendingUp, Calendar, Upload } from 'lucide-react';
import Link from 'next/link';
import MetricUnlockModal from '@/components/metrics/MetricUnlockModal';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface MetricConfig {
  metric_key: string;
  label: string;
  description: string;
  is_globally_enabled: boolean;
  is_locked: boolean;
  unlock_type: string;
  sort_order: number;
}

interface UserPermission {
  metric_key: string;
  is_enabled: boolean;
  acknowledged_disclaimer: boolean;
}

interface DailyLog {
  logged_date: string;
  [key: string]: string | number | null;
}

interface SummaryData {
  days: number;
  log_count: number;
  averages: Record<string, number | null>;
}

const CORE_METRICS = ['resting_hr', 'steps', 'sleep_hours', 'activity_min'];

const UNITS: Record<string, string> = {
  resting_hr: 'bpm',
  steps: 'steps',
  sleep_hours: 'hrs',
  activity_min: 'min',
  sleep_score: '/100',
  hrv_ms: 'ms',
  spo2_pct: '%',
  active_calories: 'cal',
  stress_score: '/100',
  recovery_score: '/100',
  weight_lbs: 'lbs',
  body_fat_pct: '%',
  muscle_mass_lbs: 'lbs',
  bmi: '',
};

const BODY_COMP_KEYS = ['weight_lbs', 'body_fat_pct', 'muscle_mass_lbs', 'bmi'];
const DECIMAL_STEP_KEYS = ['sleep_hours', 'spo2_pct', 'weight_lbs', 'body_fat_pct', 'muscle_mass_lbs', 'bmi'];

export default function MetricsDashboardPage() {
  const [configs, setConfigs] = useState<MetricConfig[]>([]);
  const [permissions, setPermissions] = useState<Map<string, UserPermission>>(new Map());
  const [todayLog, setTodayLog] = useState<Partial<DailyLog>>({});
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<MetricConfig | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, logRes, summaryRes] = await Promise.all([
        offlineFetch('/api/health-metrics/config'),
        offlineFetch(`/api/health-metrics?date=${today}`),
        offlineFetch('/api/health-metrics/summary?days=7'),
      ]);

      if (configRes.ok) {
        const { data } = await configRes.json() as { data: MetricConfig[] };
        const enabled = (data || []).filter((m) => m.is_globally_enabled);
        setConfigs(enabled);

        // Extract permissions from config response (joined)
        const permRes = await offlineFetch('/api/health-metrics/permissions');
        if (permRes.ok) {
          const { data: perms } = await permRes.json() as { data: UserPermission[] };
          const map = new Map<string, UserPermission>();
          for (const p of (perms || [])) map.set(p.metric_key, p);
          setPermissions(map);
        }
      }

      if (logRes.ok) {
        const { data } = await logRes.json() as { data: DailyLog | null };
        setTodayLog(data || {});
      }

      if (summaryRes.ok) {
        const json = await summaryRes.json() as SummaryData;
        setSummary(json);
      }
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const isUnlocked = (key: string, config: MetricConfig): boolean => {
    if (!config.is_locked) return true;
    const perm = permissions.get(key);
    return !!(perm?.is_enabled && perm?.acknowledged_disclaimer);
  };

  const handleChange = (key: string, value: string) => {
    setTodayLog((prev) => ({ ...prev, [key]: value === '' ? null : value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { logged_date: today };
      for (const config of configs) {
        if (isUnlocked(config.metric_key, config)) {
          const val = todayLog[config.metric_key];
          payload[config.metric_key] = val === '' ? null : val ?? null;
        }
      }
      const res = await offlineFetch('/api/health-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUnlockSuccess = () => {
    setUnlockTarget(null);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-10 w-10 border-4 border-fuchsia-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const coreMetrics = configs.filter((c) => CORE_METRICS.includes(c.metric_key));
  const enrichmentMetrics = configs.filter(
    (c) => !CORE_METRICS.includes(c.metric_key) && !BODY_COMP_KEYS.includes(c.metric_key)
  );
  const bodyCompMetrics = configs.filter((c) => BODY_COMP_KEYS.includes(c.metric_key));

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-fuchsia-600" />
            Health Metrics
          </h1>
          <p className="text-gray-500 mt-1">Log your daily data from your wearable device</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/metrics/import"
            className="flex items-center gap-1.5 px-3 py-2 bg-fuchsia-100 text-fuchsia-700 rounded-lg text-sm font-medium hover:bg-fuchsia-200 transition min-h-10"
          >
            <Upload className="w-4 h-4" />
            Import
          </Link>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            {new Date(today + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </div>
        </div>
      </div>

      {/* 7-day summary strip */}
      {summary && summary.log_count > 0 && (
        <div className="bg-fuchsia-50 border border-fuchsia-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-fuchsia-600" />
            <span className="text-sm font-semibold text-fuchsia-700">
              7-Day Averages ({summary.log_count} days logged)
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {coreMetrics.map((m) => {
              const avg = summary.averages[m.metric_key];
              if (avg === null) return null;
              return (
                <div key={m.metric_key} className="bg-white rounded-xl p-3 text-center shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                  <p className="text-lg font-bold text-gray-900">
                    {avg}
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      {UNITS[m.metric_key]}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Core metrics form */}
      <MetricSection
        title="Core Metrics"
        subtitle="The four essential metrics from your wearable"
        metrics={coreMetrics}
        todayLog={todayLog}
        permissions={permissions}
        onChange={handleChange}
        onUnlock={setUnlockTarget}
        isUnlocked={isUnlocked}
      />

      {/* Enrichment metrics */}
      {enrichmentMetrics.length > 0 && (
        <MetricSection
          title="Enrichment Metrics"
          subtitle="Additional data points your device may track"
          metrics={enrichmentMetrics}
          todayLog={todayLog}
          permissions={permissions}
          onChange={handleChange}
          onUnlock={setUnlockTarget}
          isUnlocked={isUnlocked}
        />
      )}

      {/* Body composition — always last, locked by default */}
      {bodyCompMetrics.length > 0 && (
        <MetricSection
          title="Body Composition"
          subtitle="Locked by default — each metric requires acknowledgment to enable"
          metrics={bodyCompMetrics}
          todayLog={todayLog}
          permissions={permissions}
          onChange={handleChange}
          onUnlock={setUnlockTarget}
          isUnlocked={isUnlocked}
        />
      )}

      {/* Save button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl font-semibold text-sm transition disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Today\'s Log'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Saved
          </span>
        )}
      </div>

      {/* Unlock modal */}
      {unlockTarget && (
        <MetricUnlockModal
          metricKey={unlockTarget.metric_key}
          metricLabel={unlockTarget.label}
          onSuccess={handleUnlockSuccess}
          onClose={() => setUnlockTarget(null)}
        />
      )}
    </div>
  );
}

interface MetricSectionProps {
  title: string;
  subtitle: string;
  metrics: MetricConfig[];
  todayLog: Partial<DailyLog>;
  permissions: Map<string, UserPermission>;
  onChange: (key: string, value: string) => void;
  onUnlock: (config: MetricConfig) => void;
  isUnlocked: (key: string, config: MetricConfig) => boolean;
}

function MetricSection({
  title, subtitle, metrics, todayLog, onChange, onUnlock, isUnlocked,
}: MetricSectionProps) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {metrics.map((m) => {
          const unlocked = isUnlocked(m.metric_key, m);
          const val = todayLog[m.metric_key];

          return (
            <div
              key={m.metric_key}
              className={`relative rounded-xl border p-4 transition ${
                unlocked
                  ? 'bg-white border-gray-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor={`metric-${m.metric_key}`}
                  className="text-sm font-medium text-gray-700"
                >
                  {m.label}
                  {UNITS[m.metric_key] && (
                    <span className="ml-1 text-xs text-gray-400">({UNITS[m.metric_key]})</span>
                  )}
                </label>
                {!unlocked && (
                  <button
                    onClick={() => onUnlock(m)}
                    className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 border border-amber-200 rounded-lg px-2 py-1 bg-amber-50 hover:bg-amber-100 transition"
                  >
                    <Lock className="w-3 h-3" />
                    Unlock
                  </button>
                )}
              </div>
              {m.description && (
                <p className="text-xs text-gray-400 mb-2 leading-relaxed">{m.description}</p>
              )}
              <input
                id={`metric-${m.metric_key}`}
                type="number"
                step={DECIMAL_STEP_KEYS.includes(m.metric_key) ? '0.1' : '1'}
                min="0"
                placeholder={unlocked ? 'Enter value' : 'Locked'}
                disabled={!unlocked}
                value={val !== null && val !== undefined ? String(val) : ''}
                onChange={(e) => onChange(m.metric_key, e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
