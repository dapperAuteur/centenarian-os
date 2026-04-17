// components/ui/StripeFeeBreakdown.tsx
// Live Stripe-fee breakdown shown beneath product-price inputs.
// Plan 30. Stripe US standard card rate: 2.9% + $0.30 per transaction.
// Non-US cards and Stripe Connect platform fees are out of scope — this
// component shows the floor (what Stripe takes before any other deductions).
//
// Pure function of `amount` prop — no state, no hooks, no network.
// Renders nothing when amount is zero/non-positive/non-numeric so the
// host UI stays clean before the user types anything.
//
// Accessibility: aria-live="polite" on the container so screen readers
// announce the recalculated total when the amount changes (useful when
// the user is checking fee impact).

import { AlertTriangle } from 'lucide-react';

export interface StripeFeeBreakdownProps {
  /** Dollar amount the customer is charged. */
  amount: number;
  /**
   * Cycle label, displayed next to "Customer pays". One-time purchases
   * show nothing; subscriptions show "/month" or "/year" so the teacher
   * understands the fee compounds each cycle.
   */
  cycle?: 'one_time' | 'monthly' | 'yearly';
  /** Optional theme hint. Defaults to `light`. */
  theme?: 'light' | 'dark';
  /** Compact mode — tighter spacing, smaller type. Default true. */
  compact?: boolean;
}

const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED = 0.30;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function cycleLabel(cycle: StripeFeeBreakdownProps['cycle']): string {
  if (cycle === 'monthly') return '/month';
  if (cycle === 'yearly') return '/year';
  return '';
}

export default function StripeFeeBreakdown({
  amount,
  cycle = 'one_time',
  theme = 'light',
  compact = true,
}: StripeFeeBreakdownProps) {
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const fee = round2(amount * STRIPE_PERCENT + STRIPE_FIXED);
  const net = round2(amount - fee);
  const cycleStr = cycleLabel(cycle);
  const loss = net <= 0;

  const darkBg = theme === 'dark';
  // Color tokens — keep within ecosystem conventions (CLAUDE.md).
  const labelColor = darkBg ? 'text-gray-400' : 'text-gray-500';
  const amountColor = darkBg ? 'text-gray-200' : 'text-gray-700';
  const feeColor = darkBg ? 'text-amber-400' : 'text-amber-600';
  const netColor = loss
    ? 'text-red-600 font-semibold'
    : darkBg
      ? 'text-green-400 font-semibold'
      : 'text-green-700 font-semibold';
  const bg = darkBg ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-200';

  const spacing = compact ? 'p-2 space-y-0.5' : 'p-3 space-y-1';
  const textSize = compact ? 'text-xs' : 'text-sm';

  return (
    <dl
      aria-live="polite"
      aria-label="Stripe fee breakdown"
      className={`${spacing} ${textSize} border rounded-lg ${bg} mt-1`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <dt className={labelColor}>Customer pays</dt>
        <dd className={`tabular-nums ${amountColor}`}>
          ${amount.toFixed(2)}
          {cycleStr && <span className={labelColor}>{cycleStr}</span>}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <dt className={labelColor}>Stripe fee (2.9% + $0.30)</dt>
        <dd className={`tabular-nums ${feeColor}`}>−${fee.toFixed(2)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-current/10">
        <dt className={labelColor}>You receive</dt>
        <dd className={`tabular-nums ${netColor}`}>
          ${net.toFixed(2)}
          {cycleStr && <span className={labelColor}>{cycleStr}</span>}
        </dd>
      </div>
      {loss && (
        <p className="flex items-start gap-1 text-red-600 font-medium mt-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>Fee exceeds price — you&rsquo;d lose money on each sale.</span>
        </p>
      )}
    </dl>
  );
}
