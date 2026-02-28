'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface Valuation {
  id: string;
  valued_at: string;
  value: number;
  source: string | null;
}

interface ValuationChartProps {
  valuations: Valuation[];
  purchasePrice?: number | null;
  purchaseDate?: string | null;
}

export default function ValuationChart({ valuations, purchasePrice, purchaseDate }: ValuationChartProps) {
  // Build chart data: start with purchase price, then valuations in chronological order
  const points: { date: string; value: number }[] = [];

  if (purchasePrice && purchaseDate) {
    points.push({ date: purchaseDate, value: Number(purchasePrice) });
  }

  const sorted = [...valuations].sort(
    (a, b) => new Date(a.valued_at).getTime() - new Date(b.valued_at).getTime(),
  );
  for (const v of sorted) {
    points.push({ date: v.valued_at, value: Number(v.value) });
  }

  if (points.length < 2) {
    return (
      <p className="text-xs text-gray-400 py-4 text-center">
        Add valuations to see value history over time.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={points}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickFormatter={(d: string) => {
            const dt = new Date(d + 'T00:00:00');
            return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          }}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickFormatter={(v: number) => `$${v.toLocaleString()}`}
          width={60}
        />
        <Tooltip
          formatter={(v: number | undefined) => [`$${(v ?? 0).toLocaleString()}`, 'Value']}
          labelFormatter={(d: string) => new Date(d + 'T00:00:00').toLocaleDateString()}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#0d9488"
          strokeWidth={2}
          dot={{ r: 3, fill: '#0d9488' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
