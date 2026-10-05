'use client';

// components/finance/ExchangeModal.tsx
// "Exchange money": record swapping cash or bank money into another currency (a booth, an ATM
// abroad). Posts to /api/finance/fx/exchange, which writes a transfer pair (never spending or
// income) plus the fee as its own expense, and saves the rate you got as your manual rate.

import { useMemo, useState } from 'react';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { todayLocal } from '@/lib/dates/local';
import { accountLabel } from '@/lib/finance/transfers/pairing';
import { formatRate } from '@/lib/finance/fx/math';

interface Account {
  id: string;
  name: string;
  account_type: string;
  institution_name?: string | null;
  last_four: string | null;
  is_active: boolean;
  currency?: string;
}

interface ExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onSuccess: () => void;
}

export default function ExchangeModal({ isOpen, onClose, accounts, onSuccess }: ExchangeModalProps) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [sent, setSent] = useState('');
  const [received, setReceived] = useState('');
  const [fee, setFee] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const active = accounts.filter((a) => a.is_active);
  const from = active.find((a) => a.id === fromId);
  const to = active.find((a) => a.id === toId);
  const fromCur = from?.currency ?? 'USD';
  const toCur = to?.currency ?? 'USD';
  const destinations = active.filter((a) => a.id !== fromId && (!from || (a.currency ?? 'USD') !== fromCur));

  const rate = useMemo(() => {
    const s = Number(sent);
    const r = Number(received);
    return s > 0 && r > 0 ? r / s : null;
  }, [sent, received]);

  function reset() {
    setFromId('');
    setToId('');
    setSent('');
    setReceived('');
    setFee('');
    setDate(todayLocal());
    setError('');
  }

  function close() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!from || !to) { setError('Pick both accounts.'); return; }
    if (fromCur === toCur) { setError('Both accounts are in the same currency. Use Transfer instead.'); return; }
    if (!(Number(sent) > 0) || !(Number(received) > 0)) { setError('Enter both amounts.'); return; }
    setSaving(true);
    try {
      const res = await offlineFetch('/api/finance/fx/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_account_id: fromId,
          to_account_id: toId,
          sent: Number(sent),
          received: Number(received),
          fee: fee ? Number(fee) : null,
          date,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'The exchange could not be saved.');
        return;
      }
      reset();
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const label = (a: Account) => `${accountLabel(a)} (${a.currency ?? 'USD'})`;

  return (
    <Modal isOpen={isOpen} onClose={close} title="Exchange money" size="sm">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>
        )}

        <p className="text-xs text-gray-600">
          Swapping money into another currency moves it between your accounts, so it isn&apos;t counted as spending.
          A fee is recorded as its own expense. The rate you got is saved as your rate for that day.
        </p>

        <div>
          <label htmlFor="fx-from" className="text-xs font-medium text-gray-600">From account</label>
          <select
            id="fx-from"
            required
            value={fromId}
            onChange={(e) => { setFromId(e.target.value); setToId(''); }}
            className="w-full mt-1 min-h-11 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900"
          >
            <option value="">Select account…</option>
            {active.map((a) => <option key={a.id} value={a.id}>{label(a)}</option>)}
          </select>
        </div>

        <div className="flex justify-center">
          <ArrowRightLeft className="w-5 h-5 text-gray-400" aria-hidden="true" />
        </div>

        <div>
          <label htmlFor="fx-to" className="text-xs font-medium text-gray-600">To account (another currency)</label>
          <select
            id="fx-to"
            required
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className="w-full mt-1 min-h-11 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900"
          >
            <option value="">Select account…</option>
            {destinations.map((a) => <option key={a.id} value={a.id}>{label(a)}</option>)}
          </select>
          {from && destinations.length === 0 && (
            <p className="mt-1 text-xs text-gray-600">
              No account in another currency yet. Add a cash account in that currency first.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="fx-sent" className="text-xs font-medium text-gray-600">You handed over ({fromCur})</label>
            <input
              id="fx-sent"
              required
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={sent}
              onChange={(e) => setSent(e.target.value)}
              className="w-full mt-1 min-h-11 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900"
              placeholder="0.00"
            />
          </div>
          <div>
            <label htmlFor="fx-received" className="text-xs font-medium text-gray-600">You received ({toCur})</label>
            <input
              id="fx-received"
              required
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              className="w-full mt-1 min-h-11 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="fx-fee" className="text-xs font-medium text-gray-600">Fee, if any ({fromCur})</label>
            <input
              id="fx-fee"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="w-full mt-1 min-h-11 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900"
              placeholder="0.00"
            />
          </div>
          <div>
            <label htmlFor="fx-date" className="text-xs font-medium text-gray-600">Date</label>
            <input
              id="fx-date"
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 min-h-11 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900"
            />
          </div>
        </div>

        {rate !== null && from && to && (
          <p className="text-sm text-gray-700" aria-live="polite">
            Your rate: 1 {fromCur} = {formatRate(rate)} {toCur} (1 {toCur} = {formatRate(1 / rate)} {fromCur})
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 min-h-11 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Save exchange
          </button>
          <button
            type="button"
            onClick={close}
            className="min-h-11 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
