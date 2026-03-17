'use client';

// app/dashboard/metrics/body-composition/page.tsx
// InBody body composition dashboard — trend charts, segmental analysis,
// body water compartments, device comparison scaffold (Hume ready).

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  Activity, ArrowLeft, TrendingUp, TrendingDown, Minus,
  Loader2, Scale, Dumbbell, Droplets, AlertTriangle, Info,
  ChevronDown,
} from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InBodyScan {
  id: string;
  logged_date: string;
  measured_at: string;
  device_model: string | null;
  weight_lbs: number | null;
  skeletal_muscle_mass_lbs: number | null;
  soft_lean_mass_lbs: number | null;
  body_fat_mass_lbs: number | null;
  bmi: number | null;
  body_fat_pct: number | null;
  bmr_kj: number | null;
  inbody_score: number | null;
  lean_right_arm_lbs: number | null;
  lean_left_arm_lbs: number | null;
  lean_trunk_lbs: number | null;
  lean_right_leg_lbs: number | null;
  lean_left_leg_lbs: number | null;
  fat_right_arm_lbs: number | null;
  fat_left_arm_lbs: number | null;
  fat_trunk_lbs: number | null;
  fat_right_leg_lbs: number | null;
  fat_left_leg_lbs: number | null;
  ecw_right_arm: number | null;
  ecw_left_arm: number | null;
  ecw_trunk: number | null;
  ecw_right_leg: number | null;
  ecw_left_leg: number | null;
  waist_hip_ratio: number | null;
  waist_circumference_in: number | null;
  visceral_fat_area_cm2: number | null;
  visceral_fat_level: number | null;
  total_body_water_l: number | null;
  intracellular_water_l: number | null;
  extracellular_water_l: number | null;
  ecw_ratio: number | null;
  upper_lower_ratio: number | null;
  leg_lean_mass_lbs: number | null;
  protein_lbs: number | null;
  mineral_lbs: number | null;
  bone_mineral_content_lbs: number | null;
  body_cell_mass_lbs: number | null;
  skeletal_muscle_index: number | null;
  phase_angle_deg: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, dec = 1): string {
  if (n == null) return '—';
  return n.toFixed(dec);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function trendIcon(first: number | null, last: number | null, higherIsBetter = true) {
  if (first == null || last == null) return <Minus className="w-4 h-4 text-gray-400" />;
  const delta = last - first;
  const up = delta > 0;
  const good = up === higherIsBetter;
  if (Math.abs(delta) < 0.1) return <Minus className="w-4 h-4 text-gray-400" />;
  return up
    ? <TrendingUp className={`w-4 h-4 ${good ? 'text-lime-500' : 'text-red-500'}`} />
    : <TrendingDown className={`w-4 h-4 ${good ? 'text-lime-500' : 'text-red-500'}`} />;
}

const DAY_OPTIONS = [
  { label: '30d', value: '30' },
  { label: '90d', value: '90' },
  { label: '365d', value: '365' },
  { label: 'All', value: 'all' },
];

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, icon, trend }: {
  label: string; value: string; unit: string;
  icon?: React.ReactNode; trend?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        <span className="text-sm text-gray-400 mb-0.5">{unit}</span>
        {trend && <span className="ml-auto">{trend}</span>}
      </div>
    </div>
  );
}

// ─── Segmental Bar Chart ──────────────────────────────────────────────────────

function SegmentalSection({ latest }: { latest: InBodyScan }) {
  const leanData = [
    { segment: 'R Arm', value: latest.lean_right_arm_lbs },
    { segment: 'L Arm', value: latest.lean_left_arm_lbs },
    { segment: 'Trunk', value: latest.lean_trunk_lbs },
    { segment: 'R Leg', value: latest.lean_right_leg_lbs },
    { segment: 'L Leg', value: latest.lean_left_leg_lbs },
  ].filter((d) => d.value != null);

  const fatData = [
    { segment: 'R Arm', value: latest.fat_right_arm_lbs },
    { segment: 'L Arm', value: latest.fat_left_arm_lbs },
    { segment: 'Trunk', value: latest.fat_trunk_lbs },
    { segment: 'R Leg', value: latest.fat_right_leg_lbs },
    { segment: 'L Leg', value: latest.fat_left_leg_lbs },
  ].filter((d) => d.value != null);

  if (leanData.length === 0 && fatData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center text-gray-400 text-sm">
        Segmental data not available for this scan (H20N shows segmental data on full scans only).
      </div>
    );
  }

  // Asymmetry check: flag if arm or leg difference > 5%
  const armAsymLean = latest.lean_right_arm_lbs && latest.lean_left_arm_lbs
    ? Math.abs(latest.lean_right_arm_lbs - latest.lean_left_arm_lbs) / ((latest.lean_right_arm_lbs + latest.lean_left_arm_lbs) / 2)
    : null;
  const legAsymLean = latest.lean_right_leg_lbs && latest.lean_left_leg_lbs
    ? Math.abs(latest.lean_right_leg_lbs - latest.lean_left_leg_lbs) / ((latest.lean_right_leg_lbs + latest.lean_left_leg_lbs) / 2)
    : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-4">
      <h3 className="font-bold text-gray-900">Segmental Analysis — Latest Scan</h3>
      {((armAsymLean && armAsymLean > 0.05) || (legAsymLean && legAsymLean > 0.05)) && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <span>
            {armAsymLean && armAsymLean > 0.05 && `Arm asymmetry: ${(armAsymLean * 100).toFixed(1)}%. `}
            {legAsymLean && legAsymLean > 0.05 && `Leg asymmetry: ${(legAsymLean * 100).toFixed(1)}%.`}
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {leanData.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">Lean Mass (lbs)</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={leanData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="segment" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number | string) => [`${Number(v).toFixed(1)} lbs`, 'Lean Mass']} />
                <Bar dataKey="value" fill="#a21caf" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {fatData.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">Fat Mass (lbs)</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={fatData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="segment" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number | string) => [`${Number(v).toFixed(1)} lbs`, 'Fat Mass']} />
                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BodyCompositionPage() {
  const [scans, setScans] = useState<InBodyScan[]>([]);
  const [days, setDays] = useState('90');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await offlineFetch(`/api/inbody-scans?days=${days}&limit=1000`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setScans(data.scans ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const latest = scans.length > 0 ? scans[scans.length - 1] : null;
  const first = scans.length > 0 ? scans[0] : null;

  // Build chart data (one point per unique date — use latest scan of that day)
  const byDate = new Map<string, InBodyScan>();
  for (const s of scans) {
    const ex = byDate.get(s.logged_date);
    if (!ex || s.measured_at > ex.measured_at) byDate.set(s.logged_date, s);
  }
  const chartData = Array.from(byDate.values()).map((s) => ({
    date: fmtDate(s.logged_date),
    rawDate: s.logged_date,
    weight: s.weight_lbs,
    bodyFat: s.body_fat_pct,
    muscle: s.skeletal_muscle_mass_lbs,
    score: s.inbody_score,
    phase: s.phase_angle_deg,
    visceralArea: s.visceral_fat_area_cm2,
    icw: s.intracellular_water_l,
    ecw: s.extracellular_water_l,
    totalWater: s.total_body_water_l,
    bmi: s.bmi,
  }));

  const uniqueDates = chartData.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6">

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Link
            href="/dashboard/metrics"
            className="flex items-center justify-center min-h-11 min-w-11 text-gray-400 hover:text-gray-700 transition"
            aria-label="Back to health metrics"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Scale className="w-7 h-7 text-fuchsia-600 shrink-0" aria-hidden="true" />
              Body Composition
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">InBody scan history · {uniqueDates} measurement days</p>
          </div>
        </div>
        <Link
          href="/dashboard/metrics/import?source=inbody"
          className="flex items-center gap-2 px-4 py-2.5 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 transition min-h-11 shrink-0"
        >
          Import InBody CSV
        </Link>
      </header>

      {/* Day range toggle */}
      <div className="flex gap-2" role="group" aria-label="Time range">
        {DAY_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setDays(o.value)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition min-h-10 ${
              days === o.value
                ? 'bg-fuchsia-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" aria-label="Loading..." />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4" role="alert">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {!loading && !error && scans.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center space-y-3">
          <Scale className="w-10 h-10 text-gray-300 mx-auto" aria-hidden="true" />
          <p className="text-gray-600 font-medium">No InBody scans found for this period.</p>
          <p className="text-sm text-gray-400">Import your InBody CSV export to get started.</p>
          <Link
            href="/dashboard/metrics/import?source=inbody"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 transition mt-2 min-h-11"
          >
            Import InBody CSV
          </Link>
        </div>
      )}

      {!loading && !error && latest && (
        <>
          {/* Latest scan summary */}
          <section aria-label="Latest scan summary">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Latest Scan</h2>
              <span className="text-sm text-gray-400">
                {new Date(latest.logged_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                {latest.device_model && <> · {latest.device_model}</>}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Weight"
                value={fmt(latest.weight_lbs)}
                unit="lbs"
                icon={<Scale className="w-4 h-4 text-gray-300" aria-hidden="true" />}
                trend={trendIcon(first?.weight_lbs ?? null, latest.weight_lbs, false)}
              />
              <StatCard
                label="Body Fat"
                value={fmt(latest.body_fat_pct)}
                unit="%"
                icon={<Activity className="w-4 h-4 text-gray-300" aria-hidden="true" />}
                trend={trendIcon(first?.body_fat_pct ?? null, latest.body_fat_pct, false)}
              />
              <StatCard
                label="Muscle Mass"
                value={fmt(latest.skeletal_muscle_mass_lbs)}
                unit="lbs"
                icon={<Dumbbell className="w-4 h-4 text-gray-300" aria-hidden="true" />}
                trend={trendIcon(first?.skeletal_muscle_mass_lbs ?? null, latest.skeletal_muscle_mass_lbs, true)}
              />
              <StatCard
                label="InBody Score"
                value={fmt(latest.inbody_score, 0)}
                unit="/ 100"
                icon={<TrendingUp className="w-4 h-4 text-gray-300" aria-hidden="true" />}
                trend={trendIcon(first?.inbody_score ?? null, latest.inbody_score, true)}
              />
              <StatCard
                label="Phase Angle"
                value={fmt(latest.phase_angle_deg)}
                unit="°"
                icon={<Info className="w-4 h-4 text-gray-300" aria-hidden="true" />}
                trend={trendIcon(first?.phase_angle_deg ?? null, latest.phase_angle_deg, true)}
              />
              <StatCard
                label="Visceral Fat"
                value={fmt(latest.visceral_fat_area_cm2, 0)}
                unit="cm²"
                icon={<AlertTriangle className="w-4 h-4 text-gray-300" aria-hidden="true" />}
                trend={trendIcon(first?.visceral_fat_area_cm2 ?? null, latest.visceral_fat_area_cm2, false)}
              />
              <StatCard
                label="BMI"
                value={fmt(latest.bmi)}
                unit="kg/m²"
                icon={<Scale className="w-4 h-4 text-gray-300" aria-hidden="true" />}
              />
              <StatCard
                label="Total Water"
                value={fmt(latest.total_body_water_l)}
                unit="L"
                icon={<Droplets className="w-4 h-4 text-gray-300" aria-hidden="true" />}
              />
            </div>
          </section>

          {/* Weight + Body Fat trend */}
          {chartData.length > 1 && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h2 className="font-bold text-gray-900 mb-4">Weight &amp; Body Fat Trend</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="weight" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                  <YAxis yAxisId="fat" orientation="right" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip
                    formatter={(v: number | string, name: string) => {
                      const n = Number(v);
                      return name === 'Weight' ? [`${n.toFixed(1)} lbs`, name] : [`${n.toFixed(1)}%`, name];
                    }}
                  />
                  <Legend />
                  <Line yAxisId="weight" type="monotone" dataKey="weight" name="Weight" stroke="#7c3aed" strokeWidth={2} dot={false} connectNulls />
                  <Line yAxisId="fat" type="monotone" dataKey="bodyFat" name="Body Fat %" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </section>
          )}

          {/* Skeletal Muscle Mass trend */}
          {chartData.length > 1 && chartData.some((d) => d.muscle != null) && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h2 className="font-bold text-gray-900 mb-4">Skeletal Muscle Mass</h2>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip formatter={(v: number | string) => [`${Number(v).toFixed(1)} lbs`, 'Muscle Mass']} />
                  <Line type="monotone" dataKey="muscle" name="Muscle Mass" stroke="#a21caf" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </section>
          )}

          {/* InBody Score + Phase Angle */}
          {chartData.length > 1 && (chartData.some((d) => d.score != null) || chartData.some((d) => d.phase != null)) && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h2 className="font-bold text-gray-900 mb-4">InBody Score &amp; Phase Angle</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="score" tick={{ fontSize: 11 }} domain={[70, 100]} />
                  <YAxis yAxisId="phase" orientation="right" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip />
                  <Legend />
                  {/* Reference lines for phase angle healthy range */}
                  <ReferenceLine yAxisId="phase" y={4} stroke="#d1d5db" strokeDasharray="4 4" label={{ value: '4°', fontSize: 10, fill: '#9ca3af' }} />
                  <ReferenceLine yAxisId="phase" y={7} stroke="#d1d5db" strokeDasharray="4 4" label={{ value: '7°', fontSize: 10, fill: '#9ca3af' }} />
                  <Line yAxisId="score" type="monotone" dataKey="score" name="InBody Score" stroke="#0ea5e9" strokeWidth={2} dot={false} connectNulls />
                  <Line yAxisId="phase" type="monotone" dataKey="phase" name="Phase Angle °" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 mt-2">
                Phase angle reference range: 4–7° (dashed lines). Higher values indicate better cell membrane integrity.
              </p>
            </section>
          )}

          {/* Visceral Fat trend */}
          {chartData.length > 1 && chartData.some((d) => d.visceralArea != null) && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h2 className="font-bold text-gray-900 mb-4">Visceral Fat Area</h2>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | string) => [`${Number(v).toFixed(0)} cm²`, 'Visceral Fat Area']} />
                  {/* Risk zone: > 100 cm² is elevated */}
                  <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '100 cm²', fontSize: 10, fill: '#f59e0b' }} />
                  <Area type="monotone" dataKey="visceralArea" name="Visceral Fat Area" stroke="#ef4444" fill="#fef2f2" strokeWidth={2} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 mt-2">
                Above 100 cm² is associated with elevated metabolic risk (dashed line).
              </p>
            </section>
          )}

          {/* Body Water Compartments */}
          {chartData.length > 1 && chartData.some((d) => d.icw != null) && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h2 className="font-bold text-gray-900 mb-4">Body Water Compartments</h2>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | string, name: string) => [`${Number(v).toFixed(1)} L`, name]} />
                  <Legend />
                  <Area type="monotone" dataKey="icw" name="Intracellular Water" stroke="#0ea5e9" fill="#e0f2fe" strokeWidth={2} connectNulls />
                  <Area type="monotone" dataKey="ecw" name="Extracellular Water" stroke="#6366f1" fill="#eef2ff" strokeWidth={2} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 mt-2">
                Healthy ECW ratio is ≈ 0.380. Rising ECW relative to ICW may indicate inflammation or dehydration.
              </p>
            </section>
          )}

          {/* Segmental Analysis */}
          <SegmentalSection latest={latest} />

          {/* Device Comparison (Hume scaffold) */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h2 className="font-bold text-gray-900 mb-1">Device Comparison</h2>
            <p className="text-sm text-gray-500 mb-4">Compare InBody with other body composition devices.</p>
            <div className="flex gap-2 mb-4">
              <span className="px-3 py-1.5 bg-fuchsia-100 text-fuchsia-700 rounded-full text-sm font-medium">InBody ✓</span>
              <span className="px-3 py-1.5 bg-gray-100 text-gray-400 rounded-full text-sm font-medium cursor-not-allowed" title="Coming soon">
                Hume Health (coming soon)
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Once you have Hume Health data, import it to see side-by-side accuracy comparison for weight, body fat %, and muscle mass.
            </p>
          </section>

          {/* History Table */}
          <section>
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition min-h-11 px-1"
              aria-expanded={showHistory}
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} aria-hidden="true" />
              Scan History ({scans.length} scans)
            </button>
            {showHistory && (
              <div className="mt-3 bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">Date</th>
                      <th className="px-4 py-2.5 font-medium text-gray-600">Weight</th>
                      <th className="px-4 py-2.5 font-medium text-gray-600">Body Fat%</th>
                      <th className="px-4 py-2.5 font-medium text-gray-600">Muscle Mass</th>
                      <th className="px-4 py-2.5 font-medium text-gray-600">Score</th>
                      <th className="px-4 py-2.5 font-medium text-gray-600">Phase °</th>
                      <th className="px-4 py-2.5 font-medium text-gray-600">Device</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...scans].reverse().map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                          {new Date(s.logged_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-2 text-gray-700">{fmt(s.weight_lbs)} lbs</td>
                        <td className="px-4 py-2 text-gray-700">{fmt(s.body_fat_pct)}%</td>
                        <td className="px-4 py-2 text-gray-700">{fmt(s.skeletal_muscle_mass_lbs)} lbs</td>
                        <td className="px-4 py-2">
                          {s.inbody_score != null && (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              s.inbody_score >= 90 ? 'bg-lime-100 text-lime-800' :
                              s.inbody_score >= 80 ? 'bg-sky-100 text-sky-800' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {s.inbody_score}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-700">{fmt(s.phase_angle_deg)}°</td>
                        <td className="px-4 py-2 text-gray-400 text-xs">{s.device_model ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
