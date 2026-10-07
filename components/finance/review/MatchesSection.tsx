'use client';

// components/finance/review/MatchesSection.tsx
// Review page: a row a statement import added and an entry you typed or
// scanned that look like the same purchase, but were never linked (the entry
// was made after the import, or "Import as a new transaction" was chosen).
// "Same purchase" keeps your entry (its notes, receipt and category) with the
// statement's details, and removes the imported copy, exactly the link an
// import makes when it finds the match itself. "Not the same" is remembered.

import { forwardRef, useMemo, useState } from 'react';
import { Merge, X } from 'lucide-react';
import type { MatchItem } from '@/lib/finance/review/sections';
import type { SectionPage } from '@/lib/finance/review/server';
import { primaryButton, secondaryButton } from '@/components/finance/import/shared';
import { dismiss, failureText, mergeMatches, plural } from './api';
import SectionShell, { ItemCheckbox } from './SectionShell';
import TxnLine, { money } from './TxnLine';
import type { RunAction } from './types';

interface MatchesSectionProps {
  page: SectionPage<MatchItem>;
  pageSize: number;
  onPage: (offset: number) => void;
  busy: boolean;
  onAction: RunAction;
  canRemember: boolean;
}

const MatchesSection = forwardRef<HTMLHeadingElement, MatchesSectionProps>(function MatchesSection(
  { page, pageSize, onPage, busy, onAction, canRemember },
  headingRef,
) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pageKeys = useMemo(() => page.items.map((item) => item.key), [page.items]);
  const chosen = page.items.filter((item) => selected.has(item.key));

  const merge = (items: MatchItem[]) =>
    onAction('matches', async () => {
      const response = await mergeMatches(items.map((item) => ({ imported_id: item.imported.id, entry_id: item.entry.id })));
      if (!response.ok) return { error: response.message };
      const { merged, failed } = response.data;
      return {
        status:
          merged > 0
            ? `${plural(merged, 'entry now carries', 'entries now carry')} the statement's details, and the imported ${merged === 1 ? 'copy was' : 'copies were'} removed.`
            : undefined,
        error: failed.length > 0 ? failureText(failed) : undefined,
      };
    });

  const notSame = (items: MatchItem[]) =>
    onAction('matches', async () => {
      const response = await dismiss(
        items.map((item) => ({ section: 'possible_match' as const, transaction_id: item.imported.id, other_transaction_id: item.entry.id })),
      );
      if (!response.ok) return { error: response.message };
      return { status: `${plural(items.length, 'pair', 'pairs')} kept as separate transactions. ${items.length === 1 ? 'It' : 'They'} won't be suggested again.` };
    });

  return (
    <SectionShell
      ref={headingRef}
      id="review-matches"
      title="Imported rows that match an entry you made"
      description={
        <p>
          A statement row and a transaction you typed or scanned that look like the same purchase: the amount within a
          cent, dates up to 5 days apart, and alike names. If they are, &ldquo;Same purchase&rdquo; keeps your entry,
          with its notes and receipt, gives it the statement&rsquo;s details, and removes the imported copy, so it is
          counted once.
        </p>
      }
      total={page.total}
      offset={page.offset}
      pageSize={pageSize}
      onPage={onPage}
      pageKeys={pageKeys}
      selected={selected}
      onSelectAll={(all) => setSelected(all ? new Set(pageKeys) : new Set())}
      busy={busy}
      bulk={
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => merge(chosen)} disabled={busy || chosen.length === 0} className={primaryButton}>
            <Merge className="h-4 w-4" aria-hidden="true" />
            Same purchase{chosen.length > 0 ? ` (${chosen.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => notSame(chosen)}
            disabled={busy || chosen.length === 0 || !canRemember}
            className={secondaryButton}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Not the same{chosen.length > 0 ? ` (${chosen.length})` : ''}
          </button>
        </div>
      }
    >
      {page.items.map((item) => {
        const what = `${money(item.imported.amount)} on ${item.imported.date}`;
        return (
          <li key={item.key} className="flex gap-2 py-3">
            <ItemCheckbox
              checked={selected.has(item.key)}
              onChange={(on) =>
                setSelected((current) => {
                  const next = new Set(current);
                  if (on) next.add(item.key);
                  else next.delete(item.key);
                  return next;
                })
              }
              label={`Select the pair of ${what}`}
              disabled={busy}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <TxnLine label="Imported" row={item.imported} />
                <TxnLine label="Yours" row={item.entry} />
              </div>
              <p className="text-xs text-gray-700">{item.reasons.join('. ')}.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => merge([item])} disabled={busy} aria-label={`Same purchase: ${what}`} className={primaryButton}>
                  Same purchase
                </button>
                <button
                  type="button"
                  onClick={() => notSame([item])}
                  disabled={busy || !canRemember}
                  aria-label={`Not the same purchase: ${what}`}
                  className={secondaryButton}
                >
                  Not the same
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </SectionShell>
  );
});

export default MatchesSection;
