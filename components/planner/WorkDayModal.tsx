// components/planner/WorkDayModal.tsx
'use client';

import { useState } from 'react';
import { Check, Clock, CalendarOff } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { ScheduleExceptionType } from '@/lib/types';

interface WorkDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleName: string;
  date?: string;
  taskId?: string;
  taskCompleted?: boolean;
  dailyRevenue?: number;
  payRate?: number;
  rateType?: string;
  hoursPerDay?: number;
  onConfirmDay: (data: ConfirmDayData) => Promise<void>;
  onDayOff: (data: DayOffData) => Promise<void>;
  bulkMode?: boolean;
}

export interface ConfirmDayData {
  taskId: string;
  type: 'full' | 'partial';
  hoursWorked?: number;
  revenue: number;
}

export interface DayOffData {
  exception_date?: string;
  date_from?: string;
  date_to?: string;
  exception_type: ScheduleExceptionType;
  reason?: string;
  notes?: string;
}

const EXCEPTION_TYPES: { value: ScheduleExceptionType; label: string; description: string }[] = [
  { value: 'skip', label: 'Skip', description: 'Remove this day entirely' },
  { value: 'paid_off', label: 'Paid Day Off', description: 'Day off but still counted toward pay' },
  { value: 'unpaid_off', label: 'Unpaid Day Off', description: 'Day off, not counted toward pay' },
  { value: 'reschedule', label: 'Reschedule', description: 'Change the time for this day' },
];

const REASONS = ['sick', 'vacation', 'holiday', 'personal', 'other'];

export default function WorkDayModal({
  isOpen,
  onClose,
  scheduleName,
  date,
  taskId,
  taskCompleted,
  dailyRevenue = 0,
  payRate = 0,
  rateType = 'daily',
  hoursPerDay = 8,
  onConfirmDay,
  onDayOff,
  bulkMode = false,
}: WorkDayModalProps) {
  const [tab, setTab] = useState<'confirm' | 'dayoff'>(taskCompleted ? 'dayoff' : 'confirm');
  const [saving, setSaving] = useState(false);

  // Confirm Day state
  const [confirmType, setConfirmType] = useState<'full' | 'partial'>('full');
  const [hoursWorked, setHoursWorked] = useState(String(hoursPerDay));

  // Day Off state
  const [exceptionType, setExceptionType] = useState<ScheduleExceptionType>('paid_off');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const calculatedRevenue = confirmType === 'full'
    ? dailyRevenue
    : rateType === 'hourly'
      ? payRate * (parseFloat(hoursWorked) || 0)
      : dailyRevenue * ((parseFloat(hoursWorked) || 0) / hoursPerDay);

  const handleConfirm = async () => {
    if (!taskId) return;
    setSaving(true);
    try {
      await onConfirmDay({
        taskId,
        type: confirmType,
        hoursWorked: confirmType === 'partial' ? parseFloat(hoursWorked) || 0 : undefined,
        revenue: Math.round(calculatedRevenue * 100) / 100,
      });
      onClose();
    } catch {
      alert('Failed to confirm work day.');
    } finally {
      setSaving(false);
    }
  };

  const handleDayOff = async () => {
    setSaving(true);
    try {
      const data: DayOffData = {
        exception_type: exceptionType,
        reason: reason || undefined,
        notes: notes || undefined,
      };

      if (bulkMode) {
        if (!dateFrom || !dateTo) { alert('Select a date range'); setSaving(false); return; }
        data.date_from = dateFrom;
        data.date_to = dateTo;
      } else {
        data.exception_date = date;
      }

      await onDayOff(data);
      onClose();
    } catch {
      alert('Failed to save day off.');
    } finally {
      setSaving(false);
    }
  };

  const dateFormatted = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    : '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Work Day" size="md">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">{scheduleName}</p>
            {date && !bulkMode && <p className="text-xs text-gray-500">{dateFormatted}</p>}
          </div>
          {dailyRevenue > 0 && (
            <span className="text-sm font-semibold text-green-600">
              ${dailyRevenue.toFixed(2)}/day
            </span>
          )}
        </div>

        {/* Tabs */}
        {taskId && (
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => setTab('confirm')}
              className={`min-h-11 flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                tab === 'confirm'
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              Confirm Day
            </button>
            <button
              type="button"
              onClick={() => setTab('dayoff')}
              className={`min-h-11 flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                tab === 'dayoff'
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <CalendarOff className="w-4 h-4" aria-hidden="true" />
              Day Off
            </button>
          </div>
        )}

        {/* ─── Confirm Day Tab ─── */}
        {tab === 'confirm' && taskId && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmType('full')}
                className={`min-h-11 p-4 rounded-lg border text-left transition ${
                  confirmType === 'full'
                    ? 'bg-green-50 border-green-300 ring-1 ring-green-300'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Check className="w-4 h-4 text-green-600" aria-hidden="true" />
                  <span className="text-sm font-medium text-gray-900">Full Day</span>
                </div>
                <p className="text-xs text-gray-500">{hoursPerDay}h — ${dailyRevenue.toFixed(2)}</p>
              </button>
              <button
                type="button"
                onClick={() => setConfirmType('partial')}
                className={`min-h-11 p-4 rounded-lg border text-left transition ${
                  confirmType === 'partial'
                    ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-300'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-amber-600" aria-hidden="true" />
                  <span className="text-sm font-medium text-gray-900">Partial Day</span>
                </div>
                <p className="text-xs text-gray-500">Enter hours worked</p>
              </button>
            </div>

            {confirmType === 'partial' && (
              <div>
                <label htmlFor="hoursWorked" className="block text-sm font-medium text-gray-700 mb-1">
                  Hours Worked
                </label>
                <input
                  id="hoursWorked"
                  type="number"
                  value={hoursWorked}
                  onChange={e => setHoursWorked(e.target.value)}
                  step="0.5"
                  min="0"
                  max="24"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>
            )}

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-800">Income for this day</span>
                <span className="text-lg font-bold text-green-700">${calculatedRevenue.toFixed(2)}</span>
              </div>
              {rateType === 'hourly' && confirmType === 'partial' && (
                <p className="text-xs text-green-600 mt-1">
                  ${payRate}/hr &times; {parseFloat(hoursWorked) || 0}h
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
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
                onClick={handleConfirm}
                disabled={saving}
                className="min-h-11 px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {saving ? 'Confirming...' : taskCompleted ? 'Update Day' : 'Confirm Work Day'}
              </button>
            </div>
          </div>
        )}

        {/* ─── Day Off Tab ─── */}
        {(tab === 'dayoff' || !taskId) && (
          <div className="space-y-4">
            {bulkMode && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="dayOffFrom" className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <input
                    id="dayOffFrom"
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label htmlFor="dayOffTo" className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input
                    id="dayOffTo"
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              {EXCEPTION_TYPES.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setExceptionType(opt.value)}
                  className={`min-h-11 w-full text-left px-4 py-3 rounded-lg border transition ${
                    exceptionType === opt.value
                      ? 'bg-sky-50 border-sky-300 ring-1 ring-sky-300'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.description}</p>
                </button>
              ))}
            </div>

            <div>
              <label htmlFor="dayOffReason" className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <select
                id="dayOffReason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Select reason...</option>
                {REASONS.map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="dayOffNotes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                id="dayOffNotes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                placeholder="Optional notes..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
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
                onClick={handleDayOff}
                disabled={saving}
                className="min-h-11 px-6 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
