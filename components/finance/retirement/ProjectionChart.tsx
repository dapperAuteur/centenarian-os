'use client';

// components/finance/retirement/ProjectionChart.tsx
// Projected total by age in today's dollars: "your plan" (sky, solid) and the three presets
// (slate, dashed, darker = higher return), with the target as a fuchsia reference line. A table
// view under the chart gives the same figures every five years. Estimates, not advice.

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Preset, SeriesPoint } from '@/lib/finance/retirement/logic';
import { PRESET_LABEL } from '@/lib/finance/retirement/logic';
import { compactMoney, moneyIn } from './format';

const LINES: { key: keyof SeriesPoint; label: string; color: string; dash?: string }[] = [
  { key: 'yours', label: 'Your plan', color: '#0284c7' },
  { key: 'conservative', label: `${PRESET_LABEL.conservative} preset`, color: '#94a3b8', dash: '2 4' },
  { key: 'middle', label: `${PRESET_LABEL.middle} preset`, color: '#64748b', dash: '6 4' },
  { key: 'optimistic', label: `${PRESET_LABEL.optimistic} preset`, color: '#334155', dash: '10 4' },
];

export default function ProjectionChart({
  series,
  target,
  currency,
  returns,
}: {
  series: SeriesPoint[];
  target: number | null;
  currency: string;
  returns: Record<Preset, number>;
}) {
  if (series.length < 2) return null;
  const labelFor = (key: string) => LINES.find((l) => l.key === key)?.label ?? key;
  const tableRows = series.filter((p, i) => i === 0 || i === series.length - 1 || (p.age - series[0].age) % 5 === 0);
  return (
    <div>
      <div className="h-72" role="img" aria-label="Projected retirement savings by age in today's dollars, for your plan and three return presets, with the target line.">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="age" tick={{ fontSize: 11, fill: '#6b7280' }} minTickGap={24} />
            <YAxis tickFormatter={(v: number) => compactMoney(v, currency)} tick={{ fontSize: 11, fill: '#6b7280' }} width={56} />
            <Tooltip formatter={(v, name) => [moneyIn(Number(v ?? 0), currency, true), labelFor(String(name))]} labelFormatter={(age) => `Age ${age}`} />
            <Legend formatter={(v: string) => <span className="text-gray-700 text-xs">{labelFor(v)}</span>} />
            {target !== null && target > 0 && (
              <ReferenceLine y={target} stroke="#c026d3" strokeDasharray="4 4" label={{ value: 'Target', position: 'insideTopLeft', fill: '#86198f', fontSize: 11 }} />
            )}
            {LINES.map((l) => (
              <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} strokeDasharray={l.dash} dot={false} activeDot={{ r: 4 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-sky-700 min-h-11 flex items-center">Show as a table</summary>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs mt-2">
            <thead className="text-gray-500">
              <tr>
                <th className="py-1 pr-3 font-medium">Age</th>
                <th className="py-1 pr-3 font-medium">Your plan</th>
                <th className="py-1 pr-3 font-medium">Conservative ({returns.conservative}%)</th>
                <th className="py-1 pr-3 font-medium">Middle ({returns.middle}%)</th>
                <th className="py-1 pr-3 font-medium">Optimistic ({returns.optimistic}%)</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {tableRows.map((p) => (
                <tr key={p.age} className="border-t border-gray-100">
                  <td className="py-1 pr-3">{p.age}</td>
                  <td className="py-1 pr-3">{moneyIn(p.yours, currency, true)}</td>
                  <td className="py-1 pr-3">{moneyIn(p.conservative, currency, true)}</td>
                  <td className="py-1 pr-3">{moneyIn(p.middle, currency, true)}</td>
                  <td className="py-1 pr-3">{moneyIn(p.optimistic, currency, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
