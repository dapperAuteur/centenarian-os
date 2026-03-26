// components/planner/PayPeriodCard.tsx
'use client';

import { useState } from 'react';
import { DollarSign, CheckCircle, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import type { SchedulePayPeriod } from '@/lib/types';

interface PayPeriodCardProps {
  payPeriod: SchedulePayPeriod;
  scheduleName: string;
  showInvoiceButton?: boolean;
  onReconcile: ((data: ReconcileData) => Promise<void>) | (() => void);
  onConvertToInvoice?: (payPeriodId: string) => Promise<void>;
}

export interface ReconcileData {
  pay_period_id: string;
  actual_gross: number;
  actual_taxes: number;
  actual_net: number;
  notes?: string;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function PayPeriodCard({
  payPeriod,
  scheduleName,
  showInvoiceButton = false,
  onReconcile,
  onConvertToInvoice,
}: PayPeriodCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [actualGross, setActualGross] = useState(payPeriod.actual_gross?.toString() || '');
  const [actualTaxes, setActualTaxes] = useState(payPeriod.actual_taxes?.toString() || '');
  const [actualNet, setActualNet] = useState(payPeriod.actual_net?.toString() || '');
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleReconcile = async () => {
    setSaving(true);
    try {
      await onReconcile({
        pay_period_id: payPeriod.id,
        actual_gross: parseFloat(actualGross) || 0,
        actual_taxes: parseFloat(actualTaxes) || 0,
        actual_net: parseFloat(actualNet) || 0,
        notes: reconcileNotes || undefined,
      });
      setReconciling(false);
    } catch (error) {
      console.error('[PayPeriodCard] Reconcile failed:', error);
      alert('Failed to reconcile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const startFormatted = new Date(payPeriod.period_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endFormatted = new Date(payPeriod.period_end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const grossDiff = payPeriod.is_reconciled && payPeriod.actual_gross != null && payPeriod.estimated_gross != null
    ? payPeriod.actual_gross - payPeriod.estimated_gross : null;

  return (
    <div className={`border rounded-xl p-4 ${payPeriod.is_reconciled ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="min-h-11 w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          {payPeriod.is_reconciled ? (
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" aria-hidden="true" />
          ) : (
            <DollarSign className="w-5 h-5 text-sky-600 shrink-0" aria-hidden="true" />
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">{scheduleName}</p>
            <p className="text-xs text-gray-500">{startFormatted} &ndash; {endFormatted}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">
              {formatCurrency(payPeriod.is_reconciled ? payPeriod.actual_net : payPeriod.estimated_net)}
            </p>
            {payPeriod.is_reconciled && (
              <p className="text-xs text-green-600">Reconciled</p>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          {/* Day counts */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-gray-900">{payPeriod.days_scheduled}</p>
              <p className="text-xs text-gray-500">Scheduled</p>
            </div>
            <div>
              <p className="text-lg font-bold text-sky-600">{payPeriod.days_worked}</p>
              <p className="text-xs text-gray-500">Worked</p>
            </div>
            <div>
              <p className="text-lg font-bold text-green-600">{payPeriod.days_paid_off}</p>
              <p className="text-xs text-gray-500">Paid Off</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-600">{payPeriod.days_unpaid_off}</p>
              <p className="text-xs text-gray-500">Unpaid Off</p>
            </div>
          </div>

          {/* Estimated vs Actual */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Estimated</p>
              <p>Gross: {formatCurrency(payPeriod.estimated_gross)}</p>
              <p>Taxes: {formatCurrency(payPeriod.estimated_taxes)}</p>
              <p className="font-medium">Net: {formatCurrency(payPeriod.estimated_net)}</p>
            </div>
            {payPeriod.is_reconciled && (
              <div>
                <p className="text-xs font-medium text-green-600 mb-1">Actual</p>
                <p>Gross: {formatCurrency(payPeriod.actual_gross)}</p>
                <p>Taxes: {formatCurrency(payPeriod.actual_taxes)}</p>
                <p className="font-medium">Net: {formatCurrency(payPeriod.actual_net)}</p>
                {grossDiff != null && grossDiff !== 0 && (
                  <p className={`text-xs mt-1 ${grossDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {grossDiff > 0 ? '+' : ''}{formatCurrency(grossDiff)} vs estimated
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Per diem / travel */}
          {((payPeriod.per_diem_total && payPeriod.per_diem_total > 0) ||
            (payPeriod.travel_income_total && payPeriod.travel_income_total > 0)) && (
            <div className="flex gap-4 text-sm">
              {payPeriod.per_diem_total && payPeriod.per_diem_total > 0 && (
                <p>Per Diem: {formatCurrency(payPeriod.per_diem_total)}</p>
              )}
              {payPeriod.travel_income_total && payPeriod.travel_income_total > 0 && (
                <p>Travel: {formatCurrency(payPeriod.travel_income_total)}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            {!payPeriod.is_reconciled && !reconciling && (
              <button
                type="button"
                onClick={() => setReconciling(true)}
                className="min-h-11 flex-1 px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 transition"
              >
                Reconcile Paycheck
              </button>
            )}
            {showInvoiceButton && onConvertToInvoice && (
              <button
                type="button"
                onClick={() => onConvertToInvoice(payPeriod.id)}
                className="min-h-11 flex items-center justify-center gap-2 flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
              >
                <FileText className="w-4 h-4" aria-hidden="true" />
                Convert to Invoice
              </button>
            )}
          </div>

          {/* Reconcile form */}
          {reconciling && (
            <div className="p-4 bg-white border border-sky-200 rounded-lg space-y-3">
              <p className="text-sm font-medium text-gray-900">Enter actual paycheck amounts</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="reconcileGross" className="block text-xs text-gray-600 mb-1">Gross</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      id="reconcileGross"
                      type="number"
                      value={actualGross}
                      onChange={e => setActualGross(e.target.value)}
                      step="0.01"
                      className="w-full pl-6 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="reconcileTaxes" className="block text-xs text-gray-600 mb-1">Taxes</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      id="reconcileTaxes"
                      type="number"
                      value={actualTaxes}
                      onChange={e => setActualTaxes(e.target.value)}
                      step="0.01"
                      className="w-full pl-6 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="reconcileNet" className="block text-xs text-gray-600 mb-1">Net</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      id="reconcileNet"
                      type="number"
                      value={actualNet}
                      onChange={e => setActualNet(e.target.value)}
                      step="0.01"
                      className="w-full pl-6 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>
              <textarea
                value={reconcileNotes}
                onChange={e => setReconcileNotes(e.target.value)}
                rows={2}
                placeholder="Notes (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReconciling(false)}
                  className="min-h-11 px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReconcile}
                  disabled={saving}
                  className="min-h-11 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Actual Amounts'}
                </button>
              </div>
            </div>
          )}

          {payPeriod.notes && (
            <p className="text-xs text-gray-500 italic">{payPeriod.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}
