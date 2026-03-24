// app/dashboard/finance/forecast/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { DollarSign, TrendingUp, TrendingDown, Minus, AlertTriangle, Briefcase, FileText, CalendarClock, ArrowLeft, Settings } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTrackPageView } from '@/lib/hooks/useTrackPageView';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface ForecastPeriod {
  label: string;
  days: number;
  confirmed: number;
  projected: number;
  total: number;
}

interface ConfirmedPayment {
  source_type: string;
  source_id: string;
  label: string;
  reference_number: string | null;
  expected_date: string;
  expected_amount: number;
  status: string;
}

interface ScheduleProjection {
  schedule_id: string;
  schedule_name: string;
  pay_frequency: string;
  estimated_per_period: number;
  periods_in_year: number;
  annual_estimate: number;
  future_pay_dates: { expected_date: string }[];
}

interface FiscalPeriodData {
  label: string;
  start: string;
  end: string;
  confirmed: number;
  projected: number;
  total: number;
  quarter?: number;
}

interface ForecastData {
  periods: ForecastPeriod[];
  confirmed_payments: ConfirmedPayment[];
  projected_schedule_income: ScheduleProjection[];
  historical_monthly_avg: number;
  trend: 'up' | 'down' | 'stable';
  gaps: { from: string; to: string }[];
  fiscal_config: { startMonth: number; startDay: number };
  fiscal_periods: {
    ytd: FiscalPeriodData;
    full_year: FiscalPeriodData;
    quarters: FiscalPeriodData[];
  };
}

const PERIOD_OPTIONS = [30, 60, 90, 180, 270, 365];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  semimonthly: 'Twice monthly',
  monthly: 'Monthly',
};

const SOURCE_ICON: Record<string, typeof Briefcase> = {
  job: Briefcase,
  invoice: FileText,
  schedule: CalendarClock,
};

export default function ForecastPage() {
  useTrackPageView('forecast', '/dashboard/finance/forecast');
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState(90);
  // Fiscal view: null = rolling periods, 'ytd' | 'full_year' | 'q1'-'q4'
  const [fiscalView, setFiscalView] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await offlineFetch('/api/finance/forecast');
        if (res.ok) {
          setData(await res.json());
        }
      } catch (error) {
        console.error('[Forecast] Failed to load:', error);
      }
      setLoading(false);
    })();
  }, []);

  const isCalendar = !data?.fiscal_config || (data.fiscal_config.startMonth === 1 && data.fiscal_config.startDay === 1);

  const selectedPeriod = useMemo(() => {
    if (!data) return null;
    if (fiscalView) {
      const fp = data.fiscal_periods;
      if (fiscalView === 'ytd') return { ...fp.ytd, days: 0 };
      if (fiscalView === 'full_year') return { ...fp.full_year, days: 0 };
      const qIdx = parseInt(fiscalView.replace('q', '')) - 1;
      if (qIdx >= 0 && qIdx < fp.quarters.length) {
        return { ...fp.quarters[qIdx], days: 0 };
      }
    }
    return data.periods.find(p => p.days === selectedDays) ?? null;
  }, [data, selectedDays, fiscalView]);

  // Build monthly chart data from confirmed + projected within selected horizon
  const chartData = useMemo(() => {
    if (!data) return [];
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + selectedDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const monthMap: Record<string, { confirmed: number; projected: number }> = {};

    // Confirmed payments
    for (const p of data.confirmed_payments) {
      if (p.expected_date > cutoffStr) continue;
      const month = p.expected_date.slice(0, 7);
      if (!monthMap[month]) monthMap[month] = { confirmed: 0, projected: 0 };
      monthMap[month].confirmed += p.expected_amount;
    }

    // Projected schedule income
    for (const sched of data.projected_schedule_income) {
      for (const d of sched.future_pay_dates) {
        if (d.expected_date > cutoffStr) continue;
        const month = d.expected_date.slice(0, 7);
        if (!monthMap[month]) monthMap[month] = { confirmed: 0, projected: 0 };
        monthMap[month].projected += sched.estimated_per_period;
      }
    }

    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({
        month,
        label: new Date(month + '-15').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        confirmed: Math.round(vals.confirmed * 100) / 100,
        projected: Math.round(vals.projected * 100) / 100,
        total: Math.round((vals.confirmed + vals.projected) * 100) / 100,
      }));
  }, [data, selectedDays]);

  // Filter confirmed payments to selected horizon
  const visiblePayments = useMemo(() => {
    if (!data) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + selectedDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return data.confirmed_payments.filter(p => p.expected_date <= cutoffStr);
  }, [data, selectedDays]);

  const TrendIcon = data?.trend === 'up' ? TrendingUp : data?.trend === 'down' ? TrendingDown : Minus;
  const trendColor = data?.trend === 'up' ? 'text-emerald-600' : data?.trend === 'down' ? 'text-red-500' : 'text-gray-500';

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 flex justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <header>
        <Link href="/dashboard/finance" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-4 h-4" /> Finance
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-8 h-8 text-emerald-600" />
          Income Forecast
          {!isCalendar && data?.fiscal_periods?.full_year && (
            <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {data.fiscal_periods.full_year.label}
            </span>
          )}
        </h1>
        <p className="text-gray-600 mt-1 flex items-center gap-2">
          Rolling projections based on expected payments and recurring schedules
          {isCalendar && (
            <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-xs text-fuchsia-600 hover:text-fuchsia-700">
              <Settings className="w-3 h-3" /> Set fiscal year
            </Link>
          )}
        </p>
      </header>

      {/* Period Selector */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {PERIOD_OPTIONS.map(days => {
            const p = data?.periods.find(pp => pp.days === days);
            const label = days <= 90 ? `${days}d` : days === 180 ? '6mo' : days === 270 ? '9mo' : '1yr';
            return (
              <button
                key={days}
                onClick={() => { setSelectedDays(days); setFiscalView(null); }}
                className={`min-h-11 px-4 py-2 rounded-lg font-medium transition ${
                  !fiscalView && selectedDays === days
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
                {p && <span className="ml-1 text-xs opacity-80">{formatCurrency(p.total)}</span>}
              </button>
            );
          })}
        </div>

        {/* Fiscal period buttons (only when non-calendar fiscal year) */}
        {!isCalendar && data?.fiscal_periods && (
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs text-gray-400 self-center mr-1">Fiscal:</span>
            {[
              { key: 'ytd', data: data.fiscal_periods.ytd },
              ...data.fiscal_periods.quarters.map((q, i) => ({ key: `q${i + 1}`, data: q })),
              { key: 'full_year', data: data.fiscal_periods.full_year },
            ].map(({ key, data: pd }) => (
              <button
                key={key}
                onClick={() => setFiscalView(key)}
                className={`min-h-11 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  fiscalView === key
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {pd.label}
                <span className="ml-1 text-xs opacity-80">{formatCurrency(pd.total)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {selectedPeriod && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-linear-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-sm">
            <p className="text-sm opacity-90">Total Expected</p>
            <p className="text-2xl font-bold">{formatCurrency(selectedPeriod.total)}</p>
            <p className="text-xs opacity-80 mt-1">{fiscalView ? selectedPeriod.label : `Next ${selectedPeriod.label}`}</p>
          </div>
          <div className="bg-white border border-green-200 rounded-2xl p-5">
            <p className="text-sm text-gray-500">Confirmed</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(selectedPeriod.confirmed)}</p>
            <p className="text-xs text-gray-400 mt-1">Jobs + invoices</p>
          </div>
          <div className="bg-white border border-dashed border-green-300 rounded-2xl p-5">
            <p className="text-sm text-gray-500">Projected</p>
            <p className="text-2xl font-bold text-emerald-500">{formatCurrency(selectedPeriod.projected)}</p>
            <p className="text-xs text-gray-400 mt-1">From schedules</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-sm text-gray-500 flex items-center gap-1">
              Historical Avg/mo
              <TrendIcon className={`w-4 h-4 ${trendColor}`} />
            </p>
            <p className="text-2xl font-bold text-gray-700">{formatCurrency(data?.historical_monthly_avg ?? 0)}</p>
            <p className={`text-xs mt-1 ${trendColor}`}>
              Trend: {data?.trend ?? 'stable'}
            </p>
          </div>
        </div>
      )}

      {/* Gap Analysis */}
      {data?.gaps && data.gaps.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4" role="alert">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800 text-sm">Income Gap{data.gaps.length > 1 ? 's' : ''} Detected</h3>
              <ul className="mt-1 space-y-0.5">
                {data.gaps.slice(0, 3).map((gap, i) => (
                  <li key={i} className="text-sm text-amber-700">
                    No expected income {formatDate(gap.from)} – {formatDate(gap.to)}
                  </li>
                ))}
                {data.gaps.length > 3 && (
                  <li className="text-sm text-amber-600">+{data.gaps.length - 3} more gap{data.gaps.length - 3 !== 1 ? 's' : ''}</li>
                )}
              </ul>
              <p className="text-xs text-amber-600 mt-2">Consider pursuing new leads or following up on outstanding invoices.</p>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Chart */}
      {chartData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Breakdown</h2>
          <div className="h-70">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => formatCurrency(Number(value))}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="confirmed" fill="#22c55e" name="Confirmed" radius={[4, 4, 0, 0]} stackId="income" />
                <Bar dataKey="projected" fill="#86efac" name="Projected" radius={[4, 4, 0, 0]} stackId="income" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Confirmed Payments Table */}
      {visiblePayments.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Confirmed Payments</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200">
                  <th className="pb-2 font-medium text-gray-500">Source</th>
                  <th className="pb-2 font-medium text-gray-500">From</th>
                  <th className="pb-2 font-medium text-gray-500">Reference</th>
                  <th className="pb-2 font-medium text-gray-500">Date</th>
                  <th className="pb-2 font-medium text-gray-500 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {visiblePayments.map((p, i) => {
                  const Icon = SOURCE_ICON[p.source_type] ?? DollarSign;
                  return (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          p.source_type === 'job' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          <Icon className="w-3 h-3" aria-hidden="true" />
                          {p.source_type === 'job' ? 'Job' : 'Invoice'}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-900">{p.label}</td>
                      <td className="py-2.5 text-gray-500 font-mono text-xs">{p.reference_number ?? '—'}</td>
                      <td className="py-2.5 text-gray-600">{formatDate(p.expected_date)}</td>
                      <td className="py-2.5 text-right font-medium text-emerald-600">{formatCurrency(p.expected_amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td colSpan={4} className="py-2.5 font-semibold text-gray-900">Total Confirmed</td>
                  <td className="py-2.5 text-right font-bold text-emerald-600">
                    {formatCurrency(visiblePayments.reduce((s, p) => s + p.expected_amount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Recurring Income Sources */}
      {data?.projected_schedule_income && data.projected_schedule_income.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recurring Income Sources</h2>
          <div className="space-y-3">
            {data.projected_schedule_income.map((sched) => (
              <div key={sched.schedule_id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition">
                <div>
                  <p className="font-medium text-gray-900 flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-sky-500" aria-hidden="true" />
                    {sched.schedule_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {FREQ_LABELS[sched.pay_frequency] ?? sched.pay_frequency} · {formatCurrency(sched.estimated_per_period)}/period
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600">{formatCurrency(sched.annual_estimate)}</p>
                  <p className="text-xs text-gray-400">est. annual</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!data?.confirmed_payments.length && !data?.projected_schedule_income.length && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No forecast data yet</h2>
          <p className="text-gray-500 mb-4">
            Send invoices, complete contractor jobs with pay dates, or create work schedules to see income projections.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/dashboard/finance/invoices" className="min-h-11 inline-flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium">
              Create Invoice
            </Link>
            <Link href="/dashboard/planner?filter=schedule" className="min-h-11 inline-flex items-center justify-center px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition font-medium">
              Set Up Schedule
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
