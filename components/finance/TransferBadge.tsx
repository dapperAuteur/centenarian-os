'use client';

// components/finance/TransferBadge.tsx
// The "Transfer ↔ <institution> <name> ••<last four>" badge shown on a
// transaction that is one side of a transfer. It links to the other side.
// The account is always written with institution and last four, because two
// accounts can share a name.

import Link from 'next/link';
import { ArrowRightLeft } from 'lucide-react';

/** The other side of a transfer, as GET /api/finance/transactions returns it in `transfer_partner`. */
export interface TransferPartnerView {
  id: string;
  account_id: string | null;
  account_label: string;
  account_type: string | null;
  amount: number;
  type: 'expense' | 'income';
  transaction_date: string;
  description: string | null;
  source: string | null;
}

interface TransferBadgeProps {
  /** Null when the other side no longer exists. */
  partner: TransferPartnerView | null | undefined;
  /** Extra classes for the outer element (spacing in a list row, say). */
  className?: string;
}

const badge =
  'inline-flex items-center gap-1.5 min-h-11 px-2.5 rounded-lg text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200';

export default function TransferBadge({ partner, className = '' }: TransferBadgeProps) {
  if (!partner) {
    return (
      <span className={`${badge} ${className}`}>
        <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Transfer
      </span>
    );
  }
  return (
    <Link
      href={`/dashboard/finance/transactions/${partner.id}`}
      // Rows in the transactions list open on click; this link goes to the other side instead.
      onClick={(e) => e.stopPropagation()}
      aria-label={`Transfer. The other side is on ${partner.account_label}. Open that transaction.`}
      className={`${badge} hover:bg-sky-100 transition ${className}`}
    >
      <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Transfer ↔ {partner.account_label}</span>
    </Link>
  );
}
