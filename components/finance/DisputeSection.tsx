'use client';

// components/finance/DisputeSection.tsx
// Inline dispute status/notes editor for a transaction.

import { useState } from 'react';
import { Flag, Loader2, Check } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface DisputeSectionProps {
  transactionId: string;
  disputeStatus: string | null;
  disputeDate: string | null;
  disputeNotes: string | null;
  onUpdate: () => void;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Not Disputed' },
  { value: 'flagged', label: 'Flagged for Dispute' },
  { value: 'submitted', label: 'Dispute Submitted' },
  { value: 'resolved', label: 'Resolved in My Favor' },
  { value: 'denied', label: 'Dispute Denied' },
];

const STATUS_COLORS: Record<string, string> = {
  flagged: 'bg-amber-100 text-amber-800',
  submitted: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-800',
};

export default function DisputeSection({
  transactionId, disputeStatus, disputeDate, disputeNotes, onUpdate,
}: DisputeSectionProps) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(disputeStatus ?? '');
  const [date, setDate] = useState(disputeDate ?? '');
  const [notes, setNotes] = useState(disputeNotes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await offlineFetch('/api/finance/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transactionId,
          dispute_status: status || null,
          dispute_date: date || null,
          dispute_notes: notes || null,
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

  const handleFlag = async () => {
    setSaving(true);
    try {
      const res = await offlineFetch('/api/finance/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transactionId,
          dispute_status: 'flagged',
          dispute_date: new Date().toISOString().slice(0, 10),
        }),
      });
      if (res.ok) onUpdate();
    } finally {
      setSaving(false);
    }
  };

  if (!disputeStatus && !editing) {
    return (
      <button
        onClick={handleFlag}
        disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
        Flag for Dispute
      </button>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-gray-700">Dispute</span>
          {disputeStatus && !editing && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[disputeStatus] ?? 'bg-gray-100 text-gray-700'}`}>
              {STATUS_OPTIONS.find((o) => o.value === disputeStatus)?.label ?? disputeStatus}
            </span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg">
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Date Filed</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
              placeholder="Dispute details, reference numbers, etc." />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </button>
            <button onClick={() => { setEditing(false); setStatus(disputeStatus ?? ''); setDate(disputeDate ?? ''); setNotes(disputeNotes ?? ''); }}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-600 space-y-1">
          {disputeDate && <p>Filed: {disputeDate}</p>}
          {disputeNotes && <p>{disputeNotes}</p>}
        </div>
      )}
    </div>
  );
}
