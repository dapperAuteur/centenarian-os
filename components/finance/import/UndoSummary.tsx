'use client';

// components/finance/import/UndoSummary.tsx
// What an undo did: how many imported transactions were deleted, how many of
// the person's own entries were unlinked, and which imported transactions
// were kept because they had been edited since.

import type { UndoResult } from '@/lib/finance/csv-import/types';
import { formatCents, formatIsoDate } from '@/lib/finance/csv-import/ui-helpers';
import { StatusNotice, ToneIcon } from './shared';

const rows = (n: number, one: string, many: string): string => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

export default function UndoSummary({ undo }: { undo: UndoResult }) {
  if (undo.alreadyUndone) {
    return (
      <StatusNotice>
        <p className="font-medium">This import was already undone. Nothing was changed.</p>
      </StatusNotice>
    );
  }

  return (
    <StatusNotice tone="success">
      <p className="font-medium">The import was undone.</p>
      <ul className="list-disc space-y-0.5 pl-5">
        <li>Deleted {rows(undo.deleted, 'imported transaction', 'imported transactions')}.</li>
        <li>
          Unlinked {rows(undo.unlinked, 'entry', 'entries')} you had made yourself. Those entries are still in your
          transactions.
        </li>
        {(undo.transfersUndone ?? 0) > 0 && (
          <li>
            Took apart {rows(undo.transfersUndone ?? 0, 'payment', 'payments')} linked as transfers. A payment the
            import had recorded on another account was removed with it.
          </li>
        )}
        <li>
          Kept {rows(undo.kept.length, 'transaction', 'transactions')} because{' '}
          {undo.kept.length === 1 ? 'it was' : 'they were'} edited after the import.
        </li>
      </ul>
      {undo.kept.length > 0 && (
        <>
          <p className="mt-2 flex items-center gap-1.5 font-medium">
            <ToneIcon tone="attention" className="h-4 w-4" />
            Needs your attention: kept because edited
          </p>
          <ul role="list" className="space-y-0.5">
            {undo.kept.map((kept) => (
              <li key={kept.id}>
                {formatIsoDate(kept.transaction_date)} · {formatCents(Math.round(Number(kept.amount) * 100))} ·{' '}
                {kept.vendor?.trim() || kept.description?.trim() || 'No name'}
              </li>
            ))}
          </ul>
          <p>Delete them from the Transactions page if you don&apos;t want them.</p>
        </>
      )}
    </StatusNotice>
  );
}
