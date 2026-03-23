// components/planner/DayOffModal.tsx
'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import type { ScheduleExceptionType } from '@/lib/types';

interface DayOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: DayOffData) => Promise<void>;
  scheduleName: string;
  date?: string;
  bulkMode?: boolean;
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

export default function DayOffModal({
  isOpen,
  onClose,
  onSave,
  scheduleName,
  date,
  bulkMode = false,
}: DayOffModalProps) {
  const [exceptionType, setExceptionType] = useState<ScheduleExceptionType>('paid_off');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: DayOffData = {
        exception_type: exceptionType,
        reason: reason || undefined,
        notes: notes || undefined,
      };

      if (bulkMode) {
        if (!dateFrom || !dateTo) {
          alert('Please select a date range');
          return;
        }
        data.date_from = dateFrom;
        data.date_to = dateTo;
      } else {
        data.exception_date = date;
      }

      await onSave(data);
      onClose();
      setExceptionType('paid_off');
      setReason('');
      setNotes('');
      setDateFrom('');
      setDateTo('');
    } catch (error) {
      console.error('[DayOffModal] Save failed:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mark Day Off" size="sm">
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-600">
          <span className="font-medium">{scheduleName}</span>
          {date && !bulkMode && (
            <> &mdash; {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</>
          )}
        </p>

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

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Type</p>
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

        <div className="flex items-center justify-end gap-3 pt-2">
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
            className="min-h-11 px-6 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
