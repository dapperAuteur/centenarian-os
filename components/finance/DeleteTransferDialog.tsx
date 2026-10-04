'use client';

// components/finance/DeleteTransferDialog.tsx
// Delete confirmation for a transaction that is one side of a transfer.
// Deleting one side alone would leave the other counted as plain spending or
// income, so the person chooses: delete both sides, or unlink the transfer and
// delete only this one.

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { offlineFetch, isQueuedResponse } from '@/lib/offline/offline-fetch';
import type { TransferPartnerView } from '@/components/finance/TransferBadge';

interface DeleteTransferDialogProps {
  /** The transaction being deleted. Null keeps the dialog closed. */
  transactionId: string | null;
  partner: TransferPartnerView | null;
  onClose: () => void;
  /** Called after the delete went through (or was queued while offline). */
  onDeleted: (result: { both: boolean; queued: boolean }) => void;
}

function money(amount: number): string {
  return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DeleteTransferDialog({
  transactionId,
  partner,
  onClose,
  onDeleted,
}: DeleteTransferDialogProps) {
  const [working, setWorking] = useState<'delete' | 'unlink' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (working) return;
    setError(null);
    onClose();
  };

  const run = async (mode: 'delete' | 'unlink') => {
    if (!transactionId) return;
    setWorking(mode);
    setError(null);
    try {
      const res = await offlineFetch(
        `/api/finance/transactions?id=${encodeURIComponent(transactionId)}&pair=${mode}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === 'string' ? data.error : 'Delete failed. Please try again.');
        return;
      }
      setError(null);
      onDeleted({ both: mode === 'delete', queued: isQueuedResponse(res) });
    } catch {
      setError('Delete failed. Check your connection and try again.');
    } finally {
      setWorking(null);
    }
  };

  // An entry the transfer feature wrote itself (source 'transfer') never
  // counts in totals; any other row goes back to being plain income or spending.
  const otherSideAfterUnlink =
    partner?.source === 'transfer'
      ? 'keeps the other entry on its account, no longer linked to anything.'
      : `keeps the other transaction as ${partner?.type === 'income' ? 'income' : 'an expense'} that counts in your totals again.`;

  return (
    <Modal isOpen={Boolean(transactionId)} onClose={close} title="Delete part of a transfer?" size="sm">
      <div className="p-6 space-y-4 text-sm text-gray-700">
        <p>
          This transaction is one side of a transfer.
          {partner && (
            <>
              {' '}The other side is on <strong>{partner.account_label}</strong>
              {' '}({shortDate(partner.transaction_date)}, {money(partner.amount)}).
            </>
          )}
        </p>
        <ul className="space-y-2 text-xs text-gray-600">
          <li>
            <strong className="text-gray-800">Delete both sides</strong> removes the transfer from both accounts.
          </li>
          <li>
            <strong className="text-gray-800">Unlink and delete only this one</strong> {otherSideAfterUnlink}
          </li>
        </ul>

        {error && (
          <p role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => run('delete')}
            disabled={working !== null}
            className="min-h-11 px-4 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {working === 'delete' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Delete both sides
          </button>
          <button
            type="button"
            onClick={() => run('unlink')}
            disabled={working !== null}
            className="min-h-11 px-4 rounded-lg border border-red-200 bg-white text-red-700 font-medium hover:bg-red-50 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {working === 'unlink' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Unlink and delete only this one
          </button>
          <button
            type="button"
            onClick={close}
            disabled={working !== null}
            className="min-h-11 px-4 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 disabled:opacity-50 transition"
          >
            Cancel
          </button>
        </div>
        {working && <p role="status" className="sr-only">Deleting…</p>}
      </div>
    </Modal>
  );
}
