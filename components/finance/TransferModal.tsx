'use client';

// components/finance/TransferModal.tsx
// Modal for transferring funds between two financial accounts.

import { useState } from 'react';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Account {
  id: string;
  name: string;
  account_type: string;
  last_four: string | null;
  balance: number;
  is_active: boolean;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onSuccess: () => void;
}

export default function TransferModal({ isOpen, onClose, accounts, onSuccess }: TransferModalProps) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeAccounts = accounts.filter((a) => a.is_active);

  function reset() {
    setFromId('');
    setToId('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!fromId || !toId) { setError('Select both accounts'); return; }
    if (fromId === toId) { setError('Cannot transfer to the same account'); return; }
    if (!amount || Number(amount) <= 0) { setError('Enter a positive amount'); return; }

    setSaving(true);
    try {
      const res = await offlineFetch('/api/finance/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_account_id: fromId,
          to_account_id: toId,
          amount: Number(amount),
          date,
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Transfer failed');
        return;
      }
      reset();
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function label(a: Account) {
    return `${a.name}${a.last_four ? ` ··${a.last_four}` : ''}`;
  }

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Transfer Funds" size="sm">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
        )}

        <div>
          <label className="text-xs font-medium text-gray-600">From Account</label>
          <select
            required
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
          >
            <option value="">Select account…</option>
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>{label(a)}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-center">
          <ArrowRightLeft className="w-5 h-5 text-gray-400" />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">To Account</label>
          <select
            required
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
          >
            <option value="">Select account…</option>
            {activeAccounts.filter((a) => a.id !== fromId).map((a) => (
              <option key={a.id} value={a.id}>{label(a)}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Amount ($)</label>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Date</label>
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Description (optional)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
            placeholder="e.g. Credit card payment"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Transfer
          </button>
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
