// lib/finance/reconciliation/client.ts
// What the pages share about reconciling: the response shapes of
// /api/finance/reconciliations*, the reconciled-period warning text, and the
// link to an account's Reconcile page. No React, no network.

import type { AuditState, ReconcileComparison, ReconciliationRow, StatementFactsRow } from './logic';

export type { AuditState, ReconcileComparison, ReconciliationRow, StatementFactsRow };

/** The flag transaction GET / PATCH / DELETE answer with (migration 221). */
export interface ReconciledPeriodView {
  statement_date: string;
  reconciliation_id?: string;
}

export interface ReconcileAccountView {
  id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  last_four: string | null;
  is_active: boolean;
  currency: string;
  opening_balance: number | string | null;
  opening_balance_date: string | null;
  is_debt: boolean;
}

export interface ReconcileViewResponse {
  ready: boolean;
  account: ReconcileAccountView;
  statements: StatementFactsRow[];
  suggested: { statement_id: string; statement_date: string; statement_balance: number } | null;
  starting_suggestion: { opening_balance: number; opening_balance_date: string; statement_id: string; period_start: string } | null;
  reconciliations: ReconciliationRow[];
  reconciled_through: string | null;
  check:
    | (ReconcileComparison & { existing: ReconciliationRow | null; before_start: boolean; earlier_reconciled: boolean })
    | null;
}

export interface AuditAccountView {
  id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  last_four: string | null;
  currency: string;
  state: AuditState;
  days: number | null;
  reconciled_through: string | null;
  open: { statement_date: string; difference: number } | null;
}

export interface AuditResponse {
  today: string;
  ready: boolean;
  accounts: AuditAccountView[];
  due: AuditAccountView[];
}

/** "Sep 30, 2026" from YYYY-MM-DD, read as a calendar day (no time-zone shift). */
export function formatDay(date: string | null | undefined): string {
  if (!date) return '';
  const d = new Date(`${date.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function reconcileHref(accountId: string, params: Record<string, string | null | undefined> = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const qs = query.toString();
  return `/dashboard/finance/accounts/${accountId}/reconcile${qs ? `?${qs}` : ''}`;
}

/** The warning shown before editing or deleting a transaction in a reconciled period. */
export function reconciledWarning(flag: ReconciledPeriodView): string {
  return (
    `This transaction is inside a reconciled period (the statement of ${formatDay(flag.statement_date)}). ` +
    'Changing or deleting it can put that reconciliation out of balance. Reconcile that statement again afterwards.'
  );
}

/** Said after a save or delete that touched a reconciled period the page didn't know about. */
export function reconciledAfterChange(flag: ReconciledPeriodView): string {
  return (
    `That change is inside a reconciled period (the statement of ${formatDay(flag.statement_date)}), ` +
    'so the reconciliation may no longer match. Reconcile that statement again on the account.'
  );
}
