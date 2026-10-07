'use client';

// components/finance/import/BatchRowItem.tsx
// One row of a past import on its Import history page: change its vendor,
// type and category (Save changes), link it to the other side of a transfer
// or unlink it, or delete it when the import added it. Every change goes
// through the routes that check the row belongs to this import and this person.

import { useState } from 'react';
import Link from 'next/link';
import { Link2, Loader2, Trash2, Unlink } from 'lucide-react';
import type { BatchEdit, BatchRow } from '@/lib/finance/import-history/batch-rows';
import { TRANSFER_KIND_LABEL } from '@/lib/finance/transfers/pairing';
import { formatIsoDate } from '@/lib/finance/csv-import/ui-helpers';
import { ItemCheckbox } from '@/components/finance/review/SectionShell';
import { money } from '@/components/finance/review/TxnLine';
import { StatusChip, dangerButton, fieldLabel, primaryButton, secondaryButton, selectInput } from './shared';
import { transferCandidates, type TransferCandidateView } from './history-api';

export const NO_CATEGORY = '__none';

interface BatchRowItemProps {
  row: BatchRow;
  categories: { id: string; name: string }[];
  selected: boolean;
  onSelect: (selected: boolean) => void;
  busy: boolean;
  online: boolean;
  onSave: (row: BatchRow, changes: BatchEdit) => void;
  onDelete: (row: BatchRow) => void;
  onLink: (row: BatchRow, candidate: TransferCandidateView) => void;
  onUnlink: (row: BatchRow) => void;
}

export default function BatchRowItem({
  row,
  categories,
  selected,
  onSelect,
  busy,
  online,
  onSave,
  onDelete,
  onLink,
  onUnlink,
}: BatchRowItemProps) {
  const [vendor, setVendor] = useState(row.vendor ?? '');
  const [type, setType] = useState<BatchRow['type']>(row.type);
  const [category, setCategory] = useState(row.category_id ?? NO_CATEGORY);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [candidates, setCandidates] = useState<TransferCandidateView[] | null>(null);
  const [candidatesBusy, setCandidatesBusy] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);

  const name = row.description?.trim() || row.vendor?.trim() || 'No description';
  const what = `${money(row.amount)} ${name} on ${formatIsoDate(row.transaction_date)}`;
  const importedHere = row.source === 'csv_import';
  const grouped = Boolean(row.transfer_group_id);

  const changes: BatchEdit = {};
  if (vendor.trim() !== (row.vendor ?? '').trim()) changes.vendor = vendor.trim() || null;
  if (type !== row.type) changes.type = type;
  if ((category === NO_CATEGORY ? null : category) !== row.category_id) changes.category_id = category === NO_CATEGORY ? null : category;
  const dirty = Object.keys(changes).length > 0;

  async function findOtherSide() {
    setCandidatesBusy(true);
    setCandidatesError(null);
    const response = await transferCandidates(row.id);
    setCandidatesBusy(false);
    if (!response.ok) {
      setCandidatesError(response.message);
      return;
    }
    setCandidates(Array.isArray(response.data?.candidates) ? response.data.candidates : []);
  }

  const id = (field: string) => `batch-row-${row.id}-${field}`;

  return (
    <li className="flex gap-2 py-4">
      <ItemCheckbox checked={selected} onChange={onSelect} label={`Select ${what}`} disabled={busy} />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
          <span className="whitespace-nowrap text-sm text-gray-700">{formatIsoDate(row.transaction_date)}</span>
          <span className="whitespace-nowrap text-sm font-semibold text-gray-900">
            {row.type === 'income' ? '+' : '-'}
            {money(row.amount)}
            <span className="sr-only">{row.type === 'income' ? ' in' : ' out'}</span>
          </span>
          <Link
            href={`/dashboard/finance/transactions/${row.id}`}
            className="inline-flex min-h-11 min-w-0 items-center wrap-break-word text-sm font-medium text-sky-800 underline underline-offset-2"
          >
            {name}
          </Link>
          <span className="flex flex-wrap gap-1.5">
            {!importedHere && <StatusChip tone="info">Your entry, linked by this import</StatusChip>}
            {row.edited && <StatusChip tone="neutral">Changed after the import</StatusChip>}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <label htmlFor={id('vendor')} className={fieldLabel}>
              Vendor
            </label>
            <input
              id={id('vendor')}
              type="text"
              value={vendor}
              maxLength={200}
              onChange={(event) => setVendor(event.target.value)}
              disabled={busy}
              className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900"
            />
          </div>
          <div>
            <label htmlFor={id('type')} className={fieldLabel}>
              Type
            </label>
            <select
              id={id('type')}
              value={type}
              onChange={(event) => setType(event.target.value === 'income' ? 'income' : 'expense')}
              disabled={busy || grouped}
              aria-describedby={grouped ? id('type-note') : undefined}
              className={selectInput}
            >
              <option value="expense">Expense (money out)</option>
              <option value="income">Income (money in)</option>
            </select>
            {grouped && (
              <p id={id('type-note')} className="mt-1 text-xs text-gray-600">
                One side of a transfer keeps its type. Unlink it first to change it.
              </p>
            )}
          </div>
          <div>
            <label htmlFor={id('category')} className={fieldLabel}>
              Category
            </label>
            <select
              id={id('category')}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              disabled={busy}
              className={selectInput}
            >
              <option value={NO_CATEGORY}>No category</option>
              {categories.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => onSave(row, changes)}
            disabled={busy || !dirty || !online}
            aria-label={`Save changes to ${what}`}
            className={primaryButton}
          >
            Save changes
          </button>

          {grouped ? (
            <>
              <p className="text-sm text-gray-800">
                {row.transfer_partner
                  ? `Transfer with ${row.transfer_partner.account_label} on ${formatIsoDate(row.transfer_partner.transaction_date)}${
                      row.transfer_partner.source === 'transfer' ? ' (recorded there for this payment: Unlink removes it)' : ''
                    }`
                  : 'Part of a transfer'}
              </p>
              <button
                type="button"
                onClick={() => onUnlink(row)}
                disabled={busy || !online}
                aria-label={`Unlink the transfer of ${what}`}
                className={secondaryButton}
              >
                <Unlink className="h-4 w-4" aria-hidden="true" />
                Unlink
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void findOtherSide()}
              disabled={busy || candidatesBusy || !online}
              aria-expanded={candidates !== null}
              aria-controls={id('candidates')}
              className={secondaryButton}
            >
              {candidatesBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
              Link as a transfer
            </button>
          )}

          {importedHere &&
            (confirmDelete ? (
              <div role="group" aria-label={`Delete ${what}?`} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <p className="text-sm text-gray-800">Delete this row?{grouped ? ' Its transfer is taken apart too.' : ''}</p>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                    onDelete(row);
                  }}
                  disabled={busy || !online}
                  className={dangerButton}
                >
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className={secondaryButton}>
                  Keep it
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy || !online}
                aria-label={`Delete ${what}`}
                className={secondaryButton}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete row
              </button>
            ))}
        </div>

        {candidatesError && (
          <p role="alert" className="text-sm font-medium text-red-800">
            {candidatesError}
          </p>
        )}
        {candidates !== null && (
          <div id={id('candidates')} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            {candidates.length === 0 ? (
              <p role="status" className="text-sm text-gray-700">
                No transaction on another account has the same amount within 5 days.
              </p>
            ) : (
              <ul role="list" className="space-y-2">
                {candidates.map((candidate) => (
                  <li key={candidate.transaction.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-800">
                      {formatIsoDate(candidate.transaction.date)} · {candidate.transaction.type === 'income' ? '+' : '-'}
                      {money(candidate.transaction.amount)} · {candidate.transaction.account_label} ·{' '}
                      {candidate.transaction.description || candidate.transaction.vendor || 'No description'} (
                      {TRANSFER_KIND_LABEL[candidate.kind]})
                    </p>
                    <button
                      type="button"
                      onClick={() => onLink(row, candidate)}
                      disabled={busy || !online}
                      aria-label={`Link ${what} with ${candidate.transaction.account_label} on ${formatIsoDate(candidate.transaction.date)}`}
                      className={primaryButton}
                    >
                      Link
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
