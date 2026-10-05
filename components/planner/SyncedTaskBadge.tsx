// components/planner/SyncedTaskBadge.tsx
// Badge for tasks auto-synced from Work.WitUS or schedules.
// Differentiates: emerald (expected_payment), amber (invoice_due), sky (schedule),
// fuchsia (savings_milestone_<25|50|75|100>, from Finance > Savings; links to the Savings page).

'use client';

import Link from 'next/link';
import { FileText, DollarSign, CalendarClock, Target } from 'lucide-react';

interface SyncedTaskBadgeProps {
  sourceType: string;
  sourceId: string | null;
}

const BADGE_CONFIG: Record<string, { bg: string; text: string; icon: typeof FileText; label: string }> = {
  expected_payment: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    icon: DollarSign,
    label: 'Expected Payment',
  },
  invoice_due: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    icon: FileText,
    label: 'Invoice Due',
  },
  schedule: {
    bg: 'bg-sky-100',
    text: 'text-sky-700',
    icon: CalendarClock,
    label: 'Scheduled Work',
  },
};

const SAVINGS_MILESTONE_CONFIG = {
  bg: 'bg-fuchsia-50',
  text: 'text-fuchsia-700',
  icon: Target,
  label: 'Savings milestone',
};

const DEFAULT_CONFIG = {
  bg: 'bg-amber-100',
  text: 'text-amber-700',
  icon: FileText,
  label: 'Synced from Work.WitUS',
};

export default function SyncedTaskBadge({ sourceType, sourceId }: SyncedTaskBadgeProps) {
  const isSavingsMilestone = sourceType.startsWith('savings_milestone_');
  const config = isSavingsMilestone ? SAVINGS_MILESTONE_CONFIG : BADGE_CONFIG[sourceType] ?? DEFAULT_CONFIG;
  const Icon = config.icon;

  const badge = (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bg} ${config.text} text-xs font-medium`}>
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      {config.label}
    </span>
  );

  if (sourceType === 'invoice_due' && sourceId) {
    return (
      <Link
        href={`/dashboard/finance/invoices/${sourceId}`}
        className="inline-flex items-center hover:opacity-80 transition min-h-11"
      >
        {badge}
      </Link>
    );
  }

  if (isSavingsMilestone) {
    return (
      <Link href="/dashboard/finance/savings" className="inline-flex items-center hover:opacity-80 transition min-h-11">
        {badge}
      </Link>
    );
  }

  return badge;
}
