'use client';

// components/finance/TransferModal.tsx
// Modal for transferring funds between two financial accounts.
// `defaultToId` starts the To account on one account (the cash card's Withdraw
// button opens it into a cash account). It is read once: give the modal a
// `key` per target so a new target starts a fresh form.

import { useState } from 'react';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { todayLocal } from '@/lib/dates/local';
import { accountLabel } from '@/lib/finance/transfers/pairing';

interface Account {
  id: string;
  name: string;
  account_type: string;
  institution_name?: string | null;
  last_four: string | null;
  balance: number;
  is_active: boolean;
  /** Migration 210; missing means USD. */
  currency?: string;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onSuccess: () => void;
  /** The To account the form starts on. */
  defaultToId?: string;
}

export default function TransferModal({ isOpen, onClose, accounts, onSuccess, defaultToId }: TransferModalProps) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState(defaultToId ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeAccounts = accounts.filter((a) => a.is_active);

  function reset() {
    setFromId('');
    setToId(defaultToId ?? '');
    setAmount('');
    setDate(todayLocal());
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

  // Institution, name and last four: two accounts can share a name.
  const label = (a: Account) => accountLabel(a);

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Transfer Funds" size="sm">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>
        )}

        <p className="text-xs text-gray-600">
          A transfer is recorded on both accounts and is not counted as spending or income. Paying a credit
          card or a loan from a bank account is a transfer too.
        </p>

        <div>
          <label htmlFor="transfer-from" className="text-xs font-medium text-gray-600">From Account</label>
          <select
            id="transfer-from"
            required
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            className="w-full mt-1 min-h-11 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900"
          >
            <option value="">Select account…</option>
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>{label(a)}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-center">
          <ArrowRightLeft className="w-5 h-5 text-gray-400" aria-hidden="true" />
        </div>

        <div>
          <label htmlFor="transfer-to" className="text-xs font-medium text-gray-600">To Account</label>
          <select
            id="transfer-to"
            required
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className="w-full mt-1 min-h-11 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900"
          >
            <option value="">Select account…</option>
            {/* Same currency only: money into another currency is an exchange (ExchangeModal). */}
            {activeAccounts
              .filter((a) => a.id !== fromId)
              .filter((a) => {
                const from = activeAccounts.find((x) => x.id === fromId);
                return !from || (a.currency ?? 'USD') === (from.currency ?? 'USD');
              })
              .map((a) => (
              <option key={a.id} value={a.id}>{label(a)}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="transfer-amount" className="text-xs font-medium text-gray-600">Amount ($)</label>
            <input
              id="transfer-amount"
              required
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full mt-1 min-h-11 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900"
              placeholder="0.00"
            />
          </div>
          <div>
            <label htmlFor="transfer-date" className="text-xs font-medium text-gray-600">Date</label>
            <input
              id="transfer-date"
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 min-h-11 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900"
            />
          </div>
        </div>

        <div>
          <label htmlFor="transfer-description" className="text-xs font-medium text-gray-600">Description (optional)</label>
          <input
            id="transfer-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full mt-1 min-h-11 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900"
            placeholder="e.g. Credit card payment"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 min-h-11 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Transfer
          </button>
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            className="min-h-11 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
