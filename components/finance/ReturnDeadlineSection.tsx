'use client';

// components/finance/ReturnDeadlineSection.tsx
// Return deadline countdown and status editor for a transaction.

import { useState } from 'react';
import { RotateCcw, Loader2, Check } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface ReturnDeadlineSectionProps {
  transactionId: string;
  returnDeadline: string | null;
  returnPolicyDays: number | null;
  returnStatus: string | null;
  transactionDate: string;
  accountDefaultReturnDays: number | null;
  onUpdate: () => void;
}

const STATUS_OPTIONS = [
  { value: '', label: 'No Return' },
  { value: 'eligible', label: 'Eligible' },
  { value: 'expired', label: 'Expired' },
  { value: 'returned', label: 'Returned' },
];

function getDaysRemaining(deadline: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline + 'T00:00:00');
  return Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getCountdownColor(days: number): string {
  if (days <= 0) return 'text-red-600';
  if (days <= 7) return 'text-amber-600';
  return 'text-green-600';
}

function getCountdownBg(days: number): string {
  if (days <= 0) return 'bg-red-50 border-red-200';
  if (days <= 7) return 'bg-amber-50 border-amber-200';
  return 'bg-green-50 border-green-200';
}

export default function ReturnDeadlineSection({
  transactionId, returnDeadline, returnPolicyDays, returnStatus,
  transactionDate, accountDefaultReturnDays, onUpdate,
}: ReturnDeadlineSectionProps) {
  const [editing, setEditing] = useState(false);
  const [deadline, setDeadline] = useState(returnDeadline ?? '');
  const [policyDays, setPolicyDays] = useState(returnPolicyDays?.toString() ?? '');
  const [status, setStatus] = useState(returnStatus ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await offlineFetch('/api/finance/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transactionId,
          return_deadline: deadline || null,
          return_policy_days: policyDays ? Number(policyDays) : null,
          return_status: status || null,
        }),
      });
      if (res.ok) {
        setEditing(false);
        onUpdate();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async () => {
    const days = accountDefaultReturnDays ?? 30;
    const d = new Date(transactionDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    const dl = d.toISOString().slice(0, 10);

    setSaving(true);
    try {
      const res = await offlineFetch('/api/finance/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transactionId,
          return_deadline: dl,
          return_policy_days: days,
          return_status: 'eligible',
        }),
      });
      if (res.ok) onUpdate();
    } finally {
      setSaving(false);
    }
  };

  if (!returnDeadline && !editing) {
    return (
      <button
        onClick={handleSetDefault}
        disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
        Set Return Deadline ({accountDefaultReturnDays ?? 30}d)
      </button>
    );
  }

  const daysLeft = returnDeadline ? getDaysRemaining(returnDeadline) : 0;

  return (
    <div className={`border rounded-xl p-4 space-y-3 ${returnDeadline ? getCountdownBg(daysLeft) : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">Return Policy</span>
          {returnDeadline && !editing && (
            <span className={`text-sm font-bold ${getCountdownColor(daysLeft)}`}>
              {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : daysLeft === 0 ? 'Last day!' : 'Expired'}
            </span>
          )}
          {returnStatus === 'returned' && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Returned</span>
          )}
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-fuchsia-600 hover:underline">
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500">Deadline</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Policy (days)</label>
              <input type="number" min="0" value={policyDays} onChange={(e) => setPolicyDays(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white" placeholder="e.g. 30" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </button>
            <button onClick={() => { setEditing(false); setDeadline(returnDeadline ?? ''); setPolicyDays(returnPolicyDays?.toString() ?? ''); setStatus(returnStatus ?? ''); }}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-600 space-y-1">
          {returnDeadline && <p>Deadline: {returnDeadline}</p>}
          {returnPolicyDays && <p>Policy: {returnPolicyDays} days from purchase</p>}
        </div>
      )}
    </div>
  );
}
