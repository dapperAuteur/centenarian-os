'use client';

// app/dashboard/correlations/page.tsx
// AI-powered correlation analysis with scatter plot visualizations.

import { useEffect, useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ZAxis,
} from 'recharts';
import { TrendingUp, Loader2, Sparkles, AlertCircle } from 'lucide-react';

interface CorrelationPair {
  metric_a: string;
  metric_b: string;
  label_a: string;
  label_b: string;
  coefficient: number;
  sample_size: number;
  points: { x: number; y: number }[];
}

interface CorrelationData {
  pairs: CorrelationPair[];
  insights: string[];
  days: number;
}

const PAIR_COLORS = ['#0d9488', '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'];

function strengthLabel(r: number): string {
  const abs = Math.abs(r);
  if (abs >= 0.7) return 'Strong';
  if (abs >= 0.4) return 'Moderate';
  return 'Weak';
}

function strengthColor(r: number): string {
  const abs = Math.abs(r);
  if (abs >= 0.7) return 'text-lime-600';
  if (abs >= 0.4) return 'text-amber-600';
  return 'text-gray-500';
}

export default function CorrelationsPage() {
  const [data, setData] = useState<CorrelationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/ai/correlations?days=${days}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 flex items-center gap-3">
            <TrendingUp className="w-7 h-7 sm:w-8 sm:h-8 text-teal-600 shrink-0" />
            Correlations
          </h1>
          <p className="text-gray-600 text-sm mt-1">AI-detected patterns in your health and productivity data</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium text-sm transition min-h-11 ${
                days === d ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </header>

      {/* AI Insights */}
      {data?.insights && data.insights.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-fuchsia-500" />
            AI Insights
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {data.insights.map((insight, i) => (
              <div key={i} className="bg-white rounded-xl shadow-md p-4 sm:p-5 border-l-4 border-teal-500">
                <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Scatter Plots */}
      {data?.pairs && data.pairs.length > 0 ? (
        <section className="space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Metric Correlations</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.pairs.map((pair, i) => (
              <div key={`${pair.metric_a}-${pair.metric_b}`} className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900">
                    {pair.label_a} vs {pair.label_b}
                  </h3>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${strengthColor(pair.coefficient)}`}>
                      r = {pair.coefficient > 0 ? '+' : ''}{pair.coefficient}
                    </div>
                    <div className="text-xs text-gray-500">
                      {strengthLabel(pair.coefficient)} &middot; {pair.sample_size} days
                    </div>
                  </div>
                </div>
                <div className="h-[250px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name={pair.label_a}
                        tick={{ fontSize: 11 }}
                        label={{ value: pair.label_a, position: 'bottom', offset: 5, fontSize: 11, fill: '#6b7280' }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name={pair.label_b}
                        tick={{ fontSize: 11 }}
                        label={{ value: pair.label_b, angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#6b7280' }}
                      />
                      <ZAxis range={[40, 40]} />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ payload }) => {
                          if (!payload?.length) return null;
                          const p = payload[0].payload as { x: number; y: number };
                          return (
                            <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg">
                              <div>{pair.label_a}: {p.x}</div>
                              <div>{pair.label_b}: {p.y}</div>
                            </div>
                          );
                        }}
                      />
                      <Scatter
                        data={pair.points}
                        fill={PAIR_COLORS[i % PAIR_COLORS.length]}
                        fillOpacity={0.7}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="bg-white rounded-xl shadow-lg p-8 sm:p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">Not enough data yet</h3>
          <p className="text-gray-500 text-sm">
            Continue logging health metrics, focus sessions, and meals for at least 5 days to detect patterns.
          </p>
        </div>
      )}
    </div>
  );
}
