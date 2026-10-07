'use client';

// components/finance/import/ImportDraftsList.tsx
// Statement imports the person reviewed but didn't finish (import_drafts,
// migration 219), each with "Resume import" and "Discard". Shown on the Import
// page (step 1) and on the finance Review page.
//
// Resume is either a button (the Import page resumes in place) or a link to
// /dashboard/finance/import?draft=<id> (the Review page). Discard asks once
// before deleting, inline, so it works with a keyboard and a screen reader.

import { useState } from 'react';
import Link from 'next/link';
import { FileClock, Loader2, Play, Trash2 } from 'lucide-react';
import { formatTime, useClockFormat } from '@/lib/hooks/useClockFormat';
import type { DraftSummary } from '@/lib/finance/import-drafts/drafts';
import { accountLabel } from '@/lib/finance/csv-import/ui-helpers';
import { dangerButton, primaryButton, secondaryButton } from './shared';

interface ImportDraftsListProps {
  drafts: DraftSummary[];
  /** Resume in place. Leave out to link to the Import page instead. */
  onResume?: (draft: DraftSummary) => void;
  onDiscard: (draft: DraftSummary) => void;
  /** The draft being resumed or discarded. */
  busyId?: string | null;
  online?: boolean;
  headingLevel?: 'h2' | 'h3';
}

function formatDay(timestamp: string | null | undefined): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function draftTitle(draft: Pick<DraftSummary, 'file_name' | 'source'>): string {
  return draft.file_name?.trim() || (draft.source === 'pdf' ? 'PDF statement' : 'Pasted text');
}

export default function ImportDraftsList({
  drafts,
  onResume,
  onDiscard,
  busyId = null,
  online = true,
  headingLevel = 'h2',
}: ImportDraftsListProps) {
  const clockFormat = useClockFormat();
  const [confirming, setConfirming] = useState<string | null>(null);
  if (drafts.length === 0) return null;
  const Heading = headingLevel;

  return (
    <section aria-labelledby="import-drafts-heading" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:p-5">
      <Heading id="import-drafts-heading" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        <FileClock className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        Unfinished imports ({drafts.length})
      </Heading>
      <p className="text-sm text-amber-900">
        Your choices were saved as you reviewed. Resume to pick up where you left off: every row is checked again
        against your transactions as they are now. A saved import is kept for 30 days after you last worked on it,
        and only the rows read from the file are kept, never the file itself.
      </p>
      <ul role="list" className="divide-y divide-amber-200 overflow-hidden rounded-lg border border-amber-200 bg-white">
        {drafts.map((draft) => {
          const title = draftTitle(draft);
          const busy = busyId === draft.id;
          const saved = formatDay(draft.updated_at);
          return (
            <li key={draft.id} className="px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-all font-medium text-gray-900">{title}</p>
                  <p className="text-sm text-gray-700">{accountLabel(draft.financial_accounts)}</p>
                  <p className="text-xs text-gray-600">
                    {Number(draft.row_count).toLocaleString('en-US')} {Number(draft.row_count) === 1 ? 'row' : 'rows'}
                    {saved ? ` · saved ${saved} at ${formatTime(draft.updated_at, clockFormat)}` : ''}
                    {draft.expires_at ? ` · kept until ${formatDay(draft.expires_at)}` : ''}
                  </p>
                </div>
                {confirming === draft.id ? (
                  <div role="group" aria-label={`Discard ${title}?`} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <p className="text-sm text-gray-800">Discard it? Your choices are lost.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(null);
                        onDiscard(draft);
                      }}
                      disabled={busy || !online}
                      className={dangerButton}
                    >
                      Discard
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className={secondaryButton}>
                      Keep it
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
                    {onResume ? (
                      <button
                        type="button"
                        onClick={() => onResume(draft)}
                        disabled={busy || !online}
                        aria-label={`Resume import: ${title}`}
                        className={primaryButton}
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                        Resume import
                      </button>
                    ) : (
                      <Link
                        href={`/dashboard/finance/import?draft=${encodeURIComponent(draft.id)}`}
                        aria-label={`Resume import: ${title}`}
                        className={primaryButton}
                      >
                        <Play className="h-4 w-4" aria-hidden="true" />
                        Resume import
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfirming(draft.id)}
                      disabled={busy || !online}
                      aria-label={`Discard the saved import: ${title}`}
                      className={secondaryButton}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Discard
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
