// components/planner/PaycheckReconcileModal.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Save, BookmarkPlus } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { PaycheckLineItem, PaycheckLineItemTemplate } from '@/lib/types';

type LineType = 'earning' | 'tax' | 'deduction' | 'benefit';

interface DraftLineItem {
  id?: string;
  line_type: LineType;
  description: string;
  rate: string;
  hours: string;
  amount: string;
  ytd_amount: string;
  is_pretax: boolean;
}

interface PaycheckReconcileModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  payPeriodId: string;
  scheduleName: string;
  periodStart: string;
  periodEnd: string;
  estimatedGross?: number;
  estimatedNet?: number;
  payRate?: number;
  rateType?: string;
  hoursPerDay?: number;
  daysWorked?: number;
  lineItemTemplates?: PaycheckLineItemTemplate[];
  existingLineItems?: PaycheckLineItem[];
  onSave: (data: ReconcileSaveData) => Promise<void>;
}

export interface ReconcileSaveData {
  templateId: string;
  payPeriodId: string;
  lineItems: Omit<PaycheckLineItem, 'id' | 'pay_period_id' | 'created_at'>[];
  actualGross: number;
  actualTaxes: number;
  actualNet: number;
  saveAsTemplate: boolean;
}

const SECTION_CONFIG: { type: LineType; label: string; columns: string[] }[] = [
  { type: 'earning', label: 'Earnings', columns: ['Description', 'Rate', 'Hours', 'Amount'] },
  { type: 'tax', label: 'Taxes', columns: ['Description', 'Amount', 'YTD Amount'] },
  { type: 'deduction', label: 'Deductions', columns: ['Description', 'Amount', 'YTD Amount'] },
  { type: 'benefit', label: 'Benefits (Employer-Paid)', columns: ['Description', 'Amount', 'YTD Amount'] },
];

function emptyLine(type: LineType): DraftLineItem {
  return { line_type: type, description: '', rate: '', hours: '', amount: '', ytd_amount: '', is_pretax: false };
}

export default function PaycheckReconcileModal({
  isOpen,
  onClose,
  templateId,
  payPeriodId,
  scheduleName,
  periodStart,
  periodEnd,
  estimatedGross = 0,
  estimatedNet: _estimatedNet = 0, // eslint-disable-line @typescript-eslint/no-unused-vars
  payRate = 0,
  rateType = 'daily',
  hoursPerDay = 8,
  daysWorked = 0,
  lineItemTemplates = [],
  existingLineItems = [],
  onSave,
}: PaycheckReconcileModalProps) {
  const [lines, setLines] = useState<DraftLineItem[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize lines from existing items or templates
  useEffect(() => {
    if (!isOpen) return;

    if (existingLineItems.length > 0) {
      setLines(existingLineItems.map(li => ({
        id: li.id,
        line_type: li.line_type,
        description: li.description,
        rate: li.rate?.toString() || '',
        hours: li.hours?.toString() || '',
        amount: li.amount.toString(),
        ytd_amount: li.ytd_amount?.toString() || '',
        is_pretax: li.is_pretax,
      })));
    } else if (lineItemTemplates.length > 0) {
      // Pre-populate from saved templates
      setLines(lineItemTemplates.map(tmpl => ({
        line_type: tmpl.line_type,
        description: tmpl.description,
        rate: tmpl.rate?.toString() || '',
        hours: tmpl.hours?.toString() || '',
        amount: '', // user fills in actual amounts
        ytd_amount: '',
        is_pretax: tmpl.is_pretax || false,
      })));
    } else {
      // Default: one earning line pre-populated from schedule finance
      const defaultLines: DraftLineItem[] = [];
      if (payRate > 0 && daysWorked > 0) {
        defaultLines.push({
          line_type: 'earning',
          description: rateType === 'hourly'
            ? `Regular Hours`
            : `Regular Pay`,
          rate: payRate.toString(),
          hours: rateType === 'hourly' ? (hoursPerDay * daysWorked).toString() : daysWorked.toString(),
          amount: estimatedGross.toString(),
          ytd_amount: '',
          is_pretax: false,
        });
      }
      // Add common tax stubs
      defaultLines.push(
        { ...emptyLine('tax'), description: 'Federal Taxes' },
        { ...emptyLine('tax'), description: 'State Tax' },
        { ...emptyLine('tax'), description: 'Social Security' },
        { ...emptyLine('tax'), description: 'Medicare' },
      );
      setLines(defaultLines);
    }
  }, [isOpen, existingLineItems, lineItemTemplates, payRate, rateType, hoursPerDay, daysWorked, estimatedGross]);

  const addLine = (type: LineType) => {
    setLines(prev => [...prev, emptyLine(type)]);
  };

  const removeLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof DraftLineItem, value: string | boolean) => {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  // Auto-calculate summaries
  const totals = useMemo(() => {
    const byType = (type: LineType) =>
      lines.filter(l => l.line_type === type).reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

    const grossEarnings = byType('earning');
    const totalTaxes = byType('tax');
    const totalDeductions = byType('deduction');
    const totalBenefits = byType('benefit');
    const netPay = grossEarnings - totalTaxes - totalDeductions;

    return { grossEarnings, totalTaxes, totalDeductions, totalBenefits, netPay };
  }, [lines]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const lineItems = lines
        .filter(l => l.description.trim() && (parseFloat(l.amount) || 0) !== 0)
        .map((l, i) => ({
          line_type: l.line_type,
          description: l.description,
          rate: parseFloat(l.rate) || undefined,
          hours: parseFloat(l.hours) || undefined,
          amount: parseFloat(l.amount) || 0,
          ytd_amount: parseFloat(l.ytd_amount) || undefined,
          is_pretax: l.is_pretax,
          sort_order: i,
        }));

      await onSave({
        templateId,
        payPeriodId,
        lineItems: lineItems as ReconcileSaveData['lineItems'],
        actualGross: Math.round(totals.grossEarnings * 100) / 100,
        actualTaxes: Math.round(totals.totalTaxes * 100) / 100,
        actualNet: Math.round(totals.netPay * 100) / 100,
        saveAsTemplate,
      });
      onClose();
    } catch {
      alert('Failed to save paycheck reconciliation.');
    } finally {
      setSaving(false);
    }
  };

  const periodFormatted = `${new Date(periodStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(periodEnd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reconcile Paycheck" size="xl">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">{scheduleName}</p>
            <p className="text-xs text-gray-500">{periodFormatted} &middot; {daysWorked} days worked</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Estimated Gross</p>
            <p className="text-lg font-bold text-gray-900">${estimatedGross.toFixed(2)}</p>
          </div>
        </div>

        {/* Line Item Sections */}
        {SECTION_CONFIG.map(section => {
          const sectionLines = lines
            .map((l, originalIndex) => ({ ...l, originalIndex }))
            .filter(l => l.line_type === section.type);

          return (
            <div key={section.type}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">{section.label}</h3>
                <button
                  type="button"
                  onClick={() => addLine(section.type)}
                  className="min-h-11 flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium"
                >
                  <Plus className="w-3 h-3" aria-hidden="true" /> Add
                </button>
              </div>

              {sectionLines.length > 0 ? (
                <div className="space-y-2">
                  {/* Column headers */}
                  <div className="hidden sm:grid gap-2 text-xs font-medium text-gray-500 px-1" style={{
                    gridTemplateColumns: section.type === 'earning'
                      ? '1fr 80px 80px 100px 100px 40px'
                      : '1fr 100px 100px 40px'
                  }}>
                    {section.columns.map(col => (
                      <span key={col}>{col}</span>
                    ))}
                    {section.type === 'earning' && <span>Pre-tax</span>}
                    <span></span>
                  </div>

                  {sectionLines.map(line => (
                    <div
                      key={line.originalIndex}
                      className="grid gap-2 items-center"
                      style={{
                        gridTemplateColumns: section.type === 'earning'
                          ? '1fr 80px 80px 100px 100px 40px'
                          : '1fr 100px 100px 40px'
                      }}
                    >
                      <input
                        type="text"
                        value={line.description}
                        onChange={e => updateLine(line.originalIndex, 'description', e.target.value)}
                        placeholder="Description"
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-sky-500"
                      />
                      {section.type === 'earning' && (
                        <>
                          <input
                            type="number"
                            value={line.rate}
                            onChange={e => updateLine(line.originalIndex, 'rate', e.target.value)}
                            placeholder="Rate"
                            step="0.01"
                            className="px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:ring-1 focus:ring-sky-500"
                          />
                          <input
                            type="number"
                            value={line.hours}
                            onChange={e => updateLine(line.originalIndex, 'hours', e.target.value)}
                            placeholder="Hrs"
                            step="0.01"
                            className="px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:ring-1 focus:ring-sky-500"
                          />
                        </>
                      )}
                      <input
                        type="number"
                        value={line.amount}
                        onChange={e => updateLine(line.originalIndex, 'amount', e.target.value)}
                        placeholder="Amount"
                        step="0.01"
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm text-right font-medium focus:ring-1 focus:ring-sky-500"
                      />
                      {section.type !== 'earning' ? (
                        <input
                          type="number"
                          value={line.ytd_amount}
                          onChange={e => updateLine(line.originalIndex, 'ytd_amount', e.target.value)}
                          placeholder="YTD"
                          step="0.01"
                          className="px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:ring-1 focus:ring-sky-500"
                        />
                      ) : (
                        <label className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={line.is_pretax}
                            onChange={e => updateLine(line.originalIndex, 'is_pretax', e.target.checked)}
                            className="rounded text-sky-600"
                          />
                        </label>
                      )}
                      <button
                        type="button"
                        onClick={() => removeLine(line.originalIndex)}
                        className="min-h-11 min-w-11 flex items-center justify-center text-red-400 hover:text-red-600"
                        aria-label="Remove line"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-2">No {section.label.toLowerCase()} added</p>
              )}
            </div>
          );
        })}

        {/* Summary */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">Gross Earnings</p>
              <p className="font-bold text-gray-900">${totals.grossEarnings.toFixed(2)}</p>
              {estimatedGross > 0 && totals.grossEarnings !== estimatedGross && (
                <p className={`text-xs ${totals.grossEarnings > estimatedGross ? 'text-green-600' : 'text-red-600'}`}>
                  {totals.grossEarnings > estimatedGross ? '+' : ''}${(totals.grossEarnings - estimatedGross).toFixed(2)} vs est.
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Taxes</p>
              <p className="font-bold text-red-600">${totals.totalTaxes.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Deductions</p>
              <p className="font-bold text-amber-600">${totals.totalDeductions.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Net Pay</p>
              <p className="text-xl font-bold text-green-700">${totals.netPay.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Save as Template + Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-gray-200">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={saveAsTemplate}
              onChange={e => setSaveAsTemplate(e.target.checked)}
              className="rounded text-sky-600 focus:ring-sky-500"
            />
            <BookmarkPlus className="w-4 h-4" aria-hidden="true" />
            Save line items as template for future paychecks
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-11 px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="min-h-11 flex items-center gap-2 px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              {saving ? 'Saving...' : 'Reconcile Paycheck'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
