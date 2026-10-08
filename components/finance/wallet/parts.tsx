// components/finance/wallet/parts.tsx
// Shared pieces of the Wallet and business pages: a labelled card, an accessible usage meter, an
// amber attention line and money formatting. Colors: sky for actions, amber for anything that
// needs attention, green only for "On track".

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { formatMoney } from '@/lib/finance/fx/math';
import type { BrandSummaries } from '@/lib/finance/brands/server';
import type { WalletView } from '@/lib/finance/wallet/logic';

/** GET /api/finance/wallet. */
export type WalletResponse = WalletView & { brands: BrandSummaries | null; warnings: string[] };

/** "$1,234.50", or "—" for a missing amount. */
export function money(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  return formatMoney(amount, currency);
}

/** "+$1,234.50" / "-$12.00": a net figure with its sign. */
export function signedMoney(amount: number, currency: string): string {
  return `${amount > 0 ? '+' : amount < 0 ? '-' : ''}${formatMoney(Math.abs(amount), currency)}`;
}

/** The amount in its own currency, plus "≈ home" when it is foreign. */
export function MoneyWithHome({ amount, currency, home, homeAmount }: { amount: number; currency: string; home: string; homeAmount: number | null }) {
  if (currency === home) return <>{money(amount, currency)}</>;
  return (
    <>
      {money(amount, currency)} <span className="text-xs text-gray-600">{currency}</span>
      <span className="block text-xs text-gray-600">{homeAmount === null ? 'no rate yet' : `≈ ${money(homeAmount, home)}`}</span>
    </>
  );
}

export function WalletCard({ id, title, icon, action, children }: { id: string; title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h2 id={headingId} className="flex items-center gap-2 text-base font-semibold text-gray-900">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** An accessible bar that reads its percentage aloud. Amber at or over the threshold. */
export function UsageMeter({ percent, warn, label }: { percent: number; warn: boolean; label: string }) {
  const shown = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={`${percent}% used`}
      className="h-2 w-full rounded-full bg-gray-100 overflow-hidden"
    >
      <div className={`h-full rounded-full ${warn ? 'bg-amber-500' : 'bg-sky-600'}`} style={{ width: `${shown}%` }} />
    </div>
  );
}

/** An amber line that needs attention, with an optional sky action link. */
export function Attention({ children, href, action }: { children: ReactNode; href?: string; action?: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
      <span>
        {children}
        {href && action && (
          <>
            {' '}
            <Link href={href} className="font-medium text-sky-700 underline underline-offset-2">
              {action}
            </Link>
          </>
        )}
      </span>
    </p>
  );
}

/** A sky text link that is at least 44px tall. */
export function ActionLink({ href, children, label }: { href: string; children: ReactNode; label?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="min-h-11 inline-flex items-center gap-1 px-2 -mx-2 rounded-lg text-sm font-medium text-sky-700 hover:bg-sky-50"
    >
      {children}
    </Link>
  );
}
