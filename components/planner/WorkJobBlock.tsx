// components/planner/WorkJobBlock.tsx
// Amber-accented card for displaying Work.WitUS contractor jobs in the planner.

'use client';

import { MapPin, DollarSign, User } from 'lucide-react';

export interface WorkJob {
  id: string;
  job_number: string;
  client_name: string;
  event_name: string | null;
  location_name: string | null;
  status: string;
  start_date: string;
  end_date: string | null;
  is_multi_day: boolean;
  pay_rate: number | null;
  rate_type: string | null;
  source: 'own' | 'assigned';
  assignment_status?: string;
  assigned_by_name?: string;
}

function formatDateRange(start: string, end: string | null, isMultiDay: boolean): string {
  if (!isMultiDay || !end || start === end) {
    return new Date(start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-amber-100 text-amber-700',
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-amber-200 text-amber-800',
  completed: 'bg-green-100 text-green-700',
};

export default function WorkJobBlock({ job }: { job: WorkJob }) {
  return (
    <div className="p-4 rounded-lg border-l-4 border-amber-500 bg-amber-50/50 hover:shadow-md transition min-h-11">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-amber-600">{job.job_number}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[job.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {job.status.replace('_', ' ')}
            </span>
            {job.source === 'assigned' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                Assigned
              </span>
            )}
          </div>
          <p className="font-semibold text-gray-900 mt-1 truncate">{job.client_name}</p>
          {job.event_name && (
            <p className="text-sm text-gray-600 truncate">{job.event_name}</p>
          )}
          {job.location_name && (
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{job.location_name}</span>
            </p>
          )}
          {job.source === 'assigned' && job.assigned_by_name && (
            <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
              <User className="w-3 h-3 shrink-0" aria-hidden="true" />
              Assigned by {job.assigned_by_name}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-500">
            {formatDateRange(job.start_date, job.end_date, job.is_multi_day)}
          </p>
          {job.pay_rate != null && (
            <p className="text-sm font-medium text-amber-700 flex items-center justify-end gap-0.5 mt-1">
              <DollarSign className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {job.pay_rate.toLocaleString()}
              {job.rate_type && <span className="text-xs text-gray-500">/{job.rate_type}</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
