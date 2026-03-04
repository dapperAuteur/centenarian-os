'use client';

// app/dashboard/retrospective/page.tsx
// AI-powered life retrospective — analyze any date range across all modules.

import { useState } from 'react';
import { RotateCcw, Sparkles, Loader2 } from 'lucide-react';

interface Summary {
  period: { from: string; to: string; days: number };
  tasks: { total: number; completed: number; completion_rate: number | null };
  finance: { total_income: number; total_expenses: number; net: number };
  invoices: { receivable_created: number; paid: number; still_draft: number; total_invoiced: number; total_paid: number };
  income_activities: { planned: number; completed: number; completion_rate: number | null };
  focus: { total_sessions: number; total_minutes: number; avg_quality: number | null; total_revenue: number };
  health: { days_logged: number; avg_steps: number | null; avg_sleep_hours: number | null; avg_resting_hr: number | null };
  workouts: { total: number; total_minutes: number };
}

type Preset = { label: string; from: string; to: string };

function getPresets(): Preset[] {
  const now = new Date();
  const y = now.getFullYear();
  const today = now.toISOString().split('T')[0];

  // Last 30 days
  const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
  // Last 90 days
  const d90 = new Date(now); d90.setDate(d90.getDate() - 90);
  // YTD
  const ytdFrom = `${y}-01-01`;
  // Q1, Q2, Q3, Q4 of current year
  const quarters: Preset[] = [];
  const qDefs = [
    ['Q1', `${y}-01-01`, `${y}-03-31`],
    ['Q2', `${y}-04-01`, `${y}-06-30`],
    ['Q3', `${y}-07-01`, `${y}-09-30`],
    ['Q4', `${y}-10-01`, `${y}-12-31`],
  ];
  for (const [label, from, to] of qDefs) {
    if (from <= today) quarters.push({ label, from, to: to > today ? today : to });
  }
  // Last full year
  const lastY = y - 1;

  return [
    { label: 'Last 30 days', from: d30.toISOString().split('T')[0], to: today },
    { label: 'Last 90 days', from: d90.toISOString().split('T')[0], to: today },
    { label: `YTD ${y}`, from: ytdFrom, to: today },
    ...quarters,
    { label: `All of ${lastY}`, from: `${lastY}-01-01`, to: `${lastY}-12-31` },
    { label: `2024`, from: '2024-01-01', to: '2024-12-31' },
    { label: `2023`, from: '2023-01-01', to: '2023-12-31' },
  ];
}

function fmtDate(d: string): string {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`bg-white border ${color} rounded-xl p-4`}>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function RetrospectivePage() {
  const presets = getPresets();
  const today = new Date().toISOString().split('T')[0];

  const [from, setFrom] = useState(presets[0].from);
  const [to, setTo] = useState(presets[0].to);
  const [activePreset, setActivePreset] = useState('Last 30 days');
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyPreset(preset: Preset) {
    setFrom(preset.from);
    setTo(preset.to);
    setActivePreset(preset.label);
    setContent(null);
    setSummary(null);
    setError(null);
  }

  async function handleAnalyze() {
    setLoading(true);
    setContent(null);
    setSummary(null);
    setError(null);

    try {
      const res = await fetch('/api/ai/life-retrospective', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to generate retrospective');
      } else {
        setContent(data.content);
        setSummary(data.summary);
      }
    } catch {
      setError('Network error — please try again');
    }

    setLoading(false);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
          <RotateCcw className="w-7 h-7 text-indigo-600 shrink-0" />
          Life Retrospective
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          AI-powered analysis of any date range — tasks, finances, focus, health, and workouts.
        </p>
      </header>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              activePreset === p.label
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range + Analyze button */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex items-center gap-2 flex-1">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => { setFrom(e.target.value); setActivePreset('Custom'); setContent(null); }}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 min-h-11"
          />
          <span className="text-gray-400 text-sm shrink-0">to</span>
          <input
            type="date"
            value={to}
            min={from}
            max={today}
            onChange={(e) => { setTo(e.target.value); setActivePreset('Custom'); setContent(null); }}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 min-h-11"
          />
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading || !from || !to}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition disabled:opacity-50 min-h-11 shrink-0"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Analyze</>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Summary stats */}
      {summary && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {fmtDate(summary.period.from)} – {fmtDate(summary.period.to)} · {summary.period.days} days
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Tasks Completed"
              value={`${summary.tasks.completed}/${summary.tasks.total}`}
              sub={summary.tasks.completion_rate != null ? `${summary.tasks.completion_rate}% rate` : undefined}
              color="border-indigo-100"
            />
            <StatCard
              label="Net Income"
              value={`$${summary.finance.net.toLocaleString()}`}
              sub={`$${summary.finance.total_income.toLocaleString()} in · $${summary.finance.total_expenses.toLocaleString()} out`}
              color={summary.finance.net >= 0 ? 'border-green-100' : 'border-red-100'}
            />
            <StatCard
              label="Focus Hours"
              value={`${Math.round(summary.focus.total_minutes / 60)}h`}
              sub={`${summary.focus.total_sessions} sessions`}
              color="border-purple-100"
            />
            <StatCard
              label="Health Days Logged"
              value={`${summary.health.days_logged}`}
              sub={summary.health.avg_sleep_hours != null ? `${summary.health.avg_sleep_hours}h avg sleep` : undefined}
              color="border-teal-100"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Invoices Sent"
              value={`${summary.invoices.receivable_created}`}
              sub={`${summary.invoices.paid} paid · ${summary.invoices.still_draft} draft`}
              color="border-amber-100"
            />
            <StatCard
              label="Income Activities"
              value={`${summary.income_activities.completed}/${summary.income_activities.planned}`}
              sub={summary.income_activities.completion_rate != null ? `${summary.income_activities.completion_rate}% done` : 'none planned'}
              color="border-green-100"
            />
            <StatCard
              label="Workouts"
              value={`${summary.workouts.total}`}
              sub={`${Math.round(summary.workouts.total_minutes / 60)}h total`}
              color="border-fuchsia-100"
            />
            <StatCard
              label="Avg Steps/Day"
              value={summary.health.avg_steps != null ? summary.health.avg_steps.toLocaleString() : '—'}
              sub={summary.health.avg_resting_hr != null ? `${summary.health.avg_resting_hr} bpm RHR` : undefined}
              color="border-red-100"
            />
          </div>
        </div>
      )}

      {/* AI Analysis */}
      {content && (
        <div className="bg-white rounded-2xl shadow-md p-5 sm:p-8 border-t-4 border-indigo-500 space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="font-medium">AI Analysis · {fmtDate(from)} – {fmtDate(to)}</span>
          </div>
          <div className="text-gray-700 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
          <button
            onClick={handleAnalyze}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Regenerate
          </button>
        </div>
      )}

      {!content && !loading && !error && (
        <div className="text-center py-16 text-gray-400">
          <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a date range and click Analyze to generate your retrospective.</p>
        </div>
      )}
    </div>
  );
}
