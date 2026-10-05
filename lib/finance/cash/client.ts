// lib/finance/cash/client.ts
// Browser-side types and helpers for cash on hand: what GET /api/finance/cash
// returns, and the cash account remembered on this device (so "Paid cash"
// starts on the last one used, even offline).

import type { RateView } from '@/lib/finance/fx/client';
import type { CountFreshness } from './logic';

export interface CashCountView {
  id: string;
  account_id: string;
  counted_amount: number;
  recorded_balance: number;
  difference: number;
  currency: string | null;
  denominations: Record<string, number> | null;
  adjustment_transaction_id: string | null;
  category_id: string | null;
  note: string | null;
  counted_on: string;
  counted_at: string;
}

export interface CashAccountView {
  id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  last_four: string | null;
  is_active: boolean;
  currency: string;
  balance: number;
  home_currency: string;
  balance_home: number | null;
  fx: RateView | null;
  last_count: CashCountView | null;
  count_status: CountFreshness;
  days_since_count: number | null;
}

export interface CashOverviewResponse {
  ready: boolean;
  home_currency: string;
  accounts: CashAccountView[];
  last_used_account_id: string | null;
}

const REMEMBER_KEY = 'centos_last_cash_account';

/** The cash account last used on this device, or null. */
export function rememberedCashAccount(): string | null {
  try {
    return localStorage.getItem(REMEMBER_KEY);
  } catch {
    return null;
  }
}

export function rememberCashAccount(id: string): void {
  try {
    localStorage.setItem(REMEMBER_KEY, id);
  } catch {
    /* storage unavailable: the server's last-used account is the fallback */
  }
}

/** "Oct 5, 2026" for a YYYY-MM-DD date. */
export function formatDay(date: string): string {
  if (!date) return '';
  return new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
