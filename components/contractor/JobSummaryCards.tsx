'use client';

import { Clock, DollarSign, FileText, Car, Briefcase } from 'lucide-react';

interface Summary {
  days_worked: number;
  total_hours: number;
  total_invoiced: number;
  total_paid: number;
  pending_invoices: number;
  total_miles: number;
  total_expenses: number;
  net_earnings: number;
}

function Card({ icon: Icon, label, value, sub }: { icon: typeof Clock; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center gap-2 text-neutral-400 text-sm mb-1">
        <Icon size={14} />
        {label}
      </div>
      <div className="text-xl font-bold text-neutral-100">{value}</div>
      {sub && <div className="text-xs text-neutral-500 mt-0.5">{sub}</div>}
    </div>
  );
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function JobSummaryCards({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card icon={Clock} label="Hours Worked" value={`${summary.total_hours}h`} sub={`${summary.days_worked} days`} />
      <Card icon={DollarSign} label="Total Invoiced" value={fmt(summary.total_invoiced)} sub={`${fmt(summary.total_paid)} paid`} />
      <Card icon={FileText} label="Pending" value={String(summary.pending_invoices)} sub="invoices" />
      <Card icon={Briefcase} label="Net Earnings" value={fmt(summary.net_earnings)} sub={summary.total_expenses > 0 ? `${fmt(summary.total_expenses)} expenses` : undefined} />
      {summary.total_miles > 0 && (
        <Card icon={Car} label="Mileage" value={`${summary.total_miles.toLocaleString()} mi`} />
      )}
    </div>
  );
}
