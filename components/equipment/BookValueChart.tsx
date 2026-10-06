'use client';

// Book value over the item's life: one line, from cost on the in-service date
// to each calendar year-end. The schedule table beside it is the table view.

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { ScheduleRow } from '@/lib/equipment/depreciation';

interface Props {
  cost: number;
  inServiceDate: string;
  schedule: ScheduleRow[];
}

const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function BookValueChart({ cost, inServiceDate, schedule }: Props) {
  if (schedule.length === 0) return null;
  const points = [
    { label: inServiceDate.slice(0, 4) + ' start', value: cost },
    ...schedule.map((r) => ({ label: `End ${r.period}`, value: r.bookValue })),
  ];
  return (
    <figure aria-label="Book value by year" className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={money} tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} width={56} />
          <Tooltip
            formatter={(v) => [money(Number(v)), 'Book value']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <Line type="monotone" dataKey="value" stroke="#0284c7" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
