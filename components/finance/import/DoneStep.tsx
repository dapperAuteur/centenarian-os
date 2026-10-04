'use client';

// components/finance/import/DoneStep.tsx
// Step 4 of the statement import: what was imported, linked, skipped and
// rejected, with the way back (Undo), the way forward (View these
// transactions) and a fresh start (Import another file).

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, ListChecks, RotateCcw, Upload } from 'lucide-react';
import type { CommitResult, UndoResult } from '@/lib/finance/csv-import/types';
import UndoSummary from './UndoSummary';
import { ErrorNotice, StatusNotice, card, dangerButton, primaryButton, secondaryButton } from './shared';

interface DoneStepProps {
  result: CommitResult;
  /** The account's full label: institution, name and last four. */
  accountName: string;
  /** Set once this import has been undone. */
  undo: UndoResult | null;
  onUndo: () => void;
  onImportAnother: () => void;
  /** True once the column settings were saved on the account. */
  settingsSaved: boolean;
  /** Why saving the column settings failed, if it did. The import itself still succeeded. */
  settingsError: string | null;
  /** Possible transfers found in the imported date range; 0 shows nothing. */
  transferCount: number;
  online: boolean;
}

const REJECTED_SHOWN = 20;

const formatCount = (n: number): string => n.toLocaleString('en-US');

/** "Imported 42 new transactions and linked 3 to entries you had already made." */
function headline(result: CommitResult): string {
  const added = result.inserted + result.linked;
  if (added === 0) {
    return 'Nothing new was added. Every row was already in this account, was skipped, or could not be read.';
  }
  const parts: string[] = [];
  if (result.inserted > 0) {
    parts.push(`imported ${formatCount(result.inserted)} new ${result.inserted === 1 ? 'transaction' : 'transactions'}`);
  }
  if (result.linked > 0) {
    parts.push(`linked ${formatCount(result.linked)} to ${result.linked === 1 ? 'an entry' : 'entries'} you had already made`);
  }
  const sentence = parts.join(' and ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

export default function DoneStep({
  result,
  accountName,
  undo,
  onUndo,
  onImportAnother,
  settingsSaved,
  settingsError,
  transferCount,
  online,
}: DoneStepProps) {
  const [showAllRejected, setShowAllRejected] = useState(false);
  const shownRejected = showAllRejected ? result.rejected : result.rejected.slice(0, REJECTED_SHOWN);

  const figures: { label: string; value: number }[] = [
    { label: 'Imported', value: result.inserted },
    { label: 'Linked to your entries', value: result.linked },
    { label: 'Skipped as duplicates', value: result.duplicates },
    { label: 'Rejected', value: result.invalid },
  ];
  if (result.skipped > 0) figures.push({ label: 'Skipped by you', value: result.skipped });

  return (
    <div className="space-y-5">
      {undo ? (
        <UndoSummary undo={undo} />
      ) : (
        <StatusNotice tone={result.inserted + result.linked > 0 ? 'success' : 'info'}>
          <p className="font-medium">{headline(result)}</p>
          <p>Account: {accountName}</p>
        </StatusNotice>
      )}

      <section className={card} aria-labelledby="import-result-heading">
        <h3 id="import-result-heading" className="text-base font-semibold text-gray-900">
          {undo ? 'What the import had done' : 'What happened to each row'}
        </h3>
        <dl className={`mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 ${figures.length > 4 ? 'lg:grid-cols-5' : ''}`}>
          {figures.map((figure) => (
            <div key={figure.label} className="rounded-lg bg-gray-50 px-3 py-2">
              <dt className="text-xs text-gray-600">{figure.label}</dt>
              <dd className="text-xl font-semibold tabular-nums text-gray-900">{formatCount(figure.value)}</dd>
            </div>
          ))}
        </dl>

        {result.rejected.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-900">Rejected rows and why</h4>
            <ul id="import-result-rejected" role="list" className="mt-2 divide-y divide-gray-100 text-sm">
              {shownRejected.map((item) => (
                <li key={`${item.row}-${item.reason}`} className="py-2 text-gray-800">
                  <span className="font-medium text-gray-900">Row {formatCount(item.row)}:</span> {item.reason}
                </li>
              ))}
            </ul>
            {result.rejected.length > REJECTED_SHOWN && (
              <button
                type="button"
                onClick={() => setShowAllRejected((current) => !current)}
                aria-expanded={showAllRejected}
                aria-controls="import-result-rejected"
                className={`${secondaryButton} mt-3`}
              >
                {showAllRejected
                  ? `Show the first ${REJECTED_SHOWN}`
                  : `Show all ${formatCount(result.rejected.length)}`}
              </button>
            )}
          </div>
        )}
      </section>

      {settingsSaved && !undo && (
        <p className="text-sm text-gray-700">
          The column settings are saved for {accountName} and will be filled in next time.
        </p>
      )}
      {settingsError && (
        <ErrorNotice>
          <p>The import worked, but the column settings could not be saved for next time: {settingsError}</p>
        </ErrorNotice>
      )}

      {transferCount > 0 && !undo && (
        <StatusNotice>
          <Link
            href="/dashboard/finance/transactions?review=transfers"
            className="inline-flex min-h-11 items-center gap-2 font-medium text-sky-900 underline underline-offset-2 hover:text-sky-950"
          >
            <ArrowRightLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            {formatCount(transferCount)} possible {transferCount === 1 ? 'transfer' : 'transfers'} between your
            accounts to review
          </Link>
        </StatusNotice>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {!undo && (
          <>
            <button
              type="button"
              onClick={onUndo}
              disabled={!online}
              aria-describedby={!online ? 'import-offline-note' : undefined}
              className={dangerButton}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Undo this import
            </button>
            <Link
              href={`/dashboard/finance/transactions?batch=${encodeURIComponent(result.batchId)}`}
              className={secondaryButton}
            >
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              View these transactions
            </Link>
          </>
        )}
        <button type="button" onClick={onImportAnother} className={`${primaryButton} sm:ml-auto`}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          Import another file
        </button>
      </div>
    </div>
  );
}
