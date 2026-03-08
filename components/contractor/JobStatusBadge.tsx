'use client';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  assigned:    { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Assigned' },
  confirmed:   { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'Confirmed' },
  in_progress: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'In Progress' },
  completed:   { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Completed' },
  invoiced:    { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Invoiced' },
  paid:        { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Paid' },
  cancelled:   { bg: 'bg-neutral-500/20', text: 'text-neutral-400', label: 'Cancelled' },
};

export default function JobStatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.assigned;
  return (
    <span
      role="status"
      aria-label={`Job status: ${s.label}`}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  );
}
