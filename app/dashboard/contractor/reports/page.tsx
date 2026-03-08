'use client';

import { useEffect, useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight, AlertTriangle, TrendingUp, Clock, Car, DollarSign } from 'lucide-react';

interface ClientEarnings {
  client_name: string;
  job_count: number;
  total_invoiced: number;
  total_paid: number;
  total_hours: number;
  exceeds_1099: boolean;
}

interface Summary {
  total_jobs: number;
  total_invoiced: number;
  total_paid: number;
  pending_invoices: number;
  total_hours: number;
  st_hours: number;
  ot_hours: number;
  dt_hours: number;
  days_worked: number;
  total_miles: number;
  total_expenses: number;
  net_earnings: number;
  benefits_eligible_jobs: number;
}

interface ReportData {
  year: number;
  summary: Summary;
  earnings_by_client: ClientEarnings[];
  monthly_earnings: number[];
  by_union: Record<string, number>;
  by_department: Record<string, number>;
}

const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center gap-2 text-neutral-400 text-sm mb-1">
        <Icon size={14} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="text-lg font-bold text-neutral-100 sm:text-xl">{value}</div>
      {sub && <div className="text-xs text-neutral-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ContractorReportsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/contractor/reports?year=${year}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [year]);

  const s = data?.summary;
  const maxMonthly = data ? Math.max(...data.monthly_earnings, 1) : 1;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      {/* Header with year selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-neutral-100">Reports</h1>
        <div className="flex items-center gap-2" role="group" aria-label="Year selector">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-neutral-300 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            aria-label={`Previous year, ${year - 1}`}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[4rem] text-center text-lg font-bold text-neutral-100" aria-live="polite">
            {year}
          </span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-neutral-300 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            aria-label={`Next year, ${year + 1}`}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-neutral-500" size={28} aria-label="Loading reports" />
        </div>
      ) : !s ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          No data available.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <section aria-label="Year summary">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={DollarSign} label="Net Earnings" value={fmt(s.net_earnings)} sub={`${fmt(s.total_paid)} paid`} />
              <StatCard icon={TrendingUp} label="Total Invoiced" value={fmt(s.total_invoiced)} sub={`${s.pending_invoices} pending`} />
              <StatCard icon={Clock} label="Hours Worked" value={`${s.total_hours.toFixed(1)}h`} sub={`${s.days_worked} days · ST ${s.st_hours.toFixed(1)} · OT ${s.ot_hours.toFixed(1)} · DT ${s.dt_hours.toFixed(1)}`} />
              <StatCard icon={Car} label="Mileage" value={`${s.total_miles.toLocaleString()} mi`} sub={`${s.total_jobs} jobs · ${s.benefits_eligible_jobs} w/ benefits`} />
            </div>
          </section>

          {/* Monthly earnings bar chart */}
          <section aria-label="Monthly earnings">
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">Monthly Earnings</h2>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex items-end gap-1 sm:gap-2 h-40" role="img" aria-label={`Monthly earnings chart for ${year}`}>
                {data!.monthly_earnings.map((val, i) => {
                  const pct = (val / maxMonthly) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <div className="w-full flex flex-col items-center justify-end h-28">
                        {val > 0 && (
                          <span className="text-[10px] text-neutral-400 mb-1 hidden sm:block">
                            {fmt(val)}
                          </span>
                        )}
                        <div
                          className="w-full max-w-8 rounded-t bg-amber-500/80"
                          style={{ height: `${Math.max(pct, val > 0 ? 4 : 0)}%` }}
                          role="presentation"
                        />
                      </div>
                      <span className="text-[10px] text-neutral-500 sm:text-xs">{MONTHS[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Earnings by client / 1099 tracking */}
          <section aria-label="Earnings by client">
            <h2 className="text-lg font-semibold text-neutral-200 mb-3">
              Earnings by Client
              <span className="text-sm font-normal text-neutral-500 ml-2">1099 Threshold: $600</span>
            </h2>
            {data!.earnings_by_client.length === 0 ? (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-center text-neutral-500">
                No client data.
              </div>
            ) : (
              <div className="space-y-2">
                {data!.earnings_by_client.map((c) => (
                  <div
                    key={c.client_name}
                    className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-neutral-100 text-sm sm:text-base">{c.client_name}</span>
                          {c.exceeds_1099 && (
                            <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                              <AlertTriangle size={12} aria-hidden="true" />
                              1099
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {c.job_count} job{c.job_count !== 1 ? 's' : ''} · {c.total_hours.toFixed(1)}h
                        </div>
                      </div>
                      <div className="flex gap-4 text-sm sm:text-right">
                        <div>
                          <div className="text-neutral-400 text-xs">Invoiced</div>
                          <div className="font-medium text-neutral-200">{fmt(c.total_invoiced)}</div>
                        </div>
                        <div>
                          <div className="text-neutral-400 text-xs">Paid</div>
                          <div className="font-bold text-amber-400">{fmt(c.total_paid)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Union & Department breakdown */}
          {(Object.keys(data!.by_union).length > 0 || Object.keys(data!.by_department).length > 0) && (
            <section aria-label="Breakdown by union and department">
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.keys(data!.by_union).length > 0 && (
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                    <h3 className="text-sm font-semibold text-neutral-300 mb-2">By Union</h3>
                    <div className="space-y-1.5">
                      {Object.entries(data!.by_union)
                        .sort((a, b) => b[1] - a[1])
                        .map(([name, count]) => (
                          <div key={name} className="flex items-center justify-between text-sm">
                            <span className="text-neutral-300">{name}</span>
                            <span className="text-neutral-500">{count} job{count !== 1 ? 's' : ''}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                {Object.keys(data!.by_department).length > 0 && (
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                    <h3 className="text-sm font-semibold text-neutral-300 mb-2">By Department</h3>
                    <div className="space-y-1.5">
                      {Object.entries(data!.by_department)
                        .sort((a, b) => b[1] - a[1])
                        .map(([name, count]) => (
                          <div key={name} className="flex items-center justify-between text-sm">
                            <span className="text-neutral-300">{name}</span>
                            <span className="text-neutral-500">{count} job{count !== 1 ? 's' : ''}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
