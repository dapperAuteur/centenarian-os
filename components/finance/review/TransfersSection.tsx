'use client';

// components/finance/review/TransfersSection.tsx
// Review page: pairs of transactions that look like money moving between the
// person's own accounts (the same detector as the Possible transfers panel).
// Link makes them one transfer; "Not a transfer" is remembered and the pair is
// never suggested again. Both work on one pair or on the ticked ones.

import { forwardRef, useMemo, useState } from 'react';
import { Link2, X } from 'lucide-react';
import { TRANSFER_KIND_LABEL } from '@/lib/finance/transfers/pairing';
import type { TransferPairItem } from '@/lib/finance/review/sections';
import type { SectionPage } from '@/lib/finance/review/server';
import { StatusChip, primaryButton, secondaryButton } from '@/components/finance/import/shared';
import { dismiss, failureText, linkPairs, plural } from './api';
import SectionShell, { ItemCheckbox } from './SectionShell';
import TxnLine, { money } from './TxnLine';
import type { RunAction } from './types';

interface TransfersSectionProps {
  page: SectionPage<TransferPairItem>;
  pageSize: number;
  onPage: (offset: number) => void;
  busy: boolean;
  onAction: RunAction;
  canRemember: boolean;
}

const TransfersSection = forwardRef<HTMLHeadingElement, TransfersSectionProps>(function TransfersSection(
  { page, pageSize, onPage, busy, onAction, canRemember },
  headingRef,
) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pageKeys = useMemo(() => page.items.map((item) => item.key), [page.items]);

  const chosen = page.items.filter((item) => selected.has(item.key));
  const highOnPage = page.items.filter((item) => item.confidence === 'high');

  const link = (items: TransferPairItem[]) =>
    onAction('transfers', async () => {
      const response = await linkPairs(items.map((item) => ({ from_id: item.from.id, to_id: item.to.id })));
      if (!response.ok) return { error: response.message };
      const { linked, failed } = response.data;
      return {
        status: linked > 0 ? `Linked ${plural(linked, 'transfer', 'transfers')}. They no longer count as spending or income.` : undefined,
        error: failed.length > 0 ? failureText(failed) : undefined,
      };
    });

  const notTransfer = (items: TransferPairItem[]) =>
    onAction('transfers', async () => {
      const response = await dismiss(
        items.map((item) => ({ section: 'transfer_pair' as const, transaction_id: item.from.id, other_transaction_id: item.to.id })),
      );
      if (!response.ok) return { error: response.message };
      return { status: `${plural(items.length, 'pair', 'pairs')} marked as not a transfer. ${items.length === 1 ? 'It' : 'They'} won't be suggested again.` };
    });

  return (
    <SectionShell
      ref={headingRef}
      id="review-transfers"
      title="Possible transfers"
      description={
        <p>
          Two transactions with the same amount, a few days apart, on two of your accounts: money out of one and into
          the other. Linking makes them one transfer, so it stops counting as spending and income. Both stay where they
          are, so balances don&rsquo;t change.
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
          {highOnPage.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set(highOnPage.map((item) => item.key)))}
              disabled={busy}
              className={secondaryButton}
            >
              Select the {highOnPage.length.toLocaleString('en-US')} high-confidence
            </button>
          )}
          <button type="button" onClick={() => link(chosen)} disabled={busy || chosen.length === 0} className={primaryButton}>
            <Link2 className="h-4 w-4" aria-hidden="true" />
            Link selected{chosen.length > 0 ? ` (${chosen.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => notTransfer(chosen)}
            disabled={busy || chosen.length === 0 || !canRemember}
            className={secondaryButton}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Not a transfer{chosen.length > 0 ? ` (${chosen.length})` : ''}
          </button>
        </div>
      }
    >
      {page.items.map((item) => {
        const high = item.confidence === 'high';
        const what = `${money(item.from.amount)} from ${item.from.account_label} to ${item.to.account_label}`;
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
              label={`Select ${what}`}
              disabled={busy}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone={high ? 'info' : 'attention'}>{high ? 'High confidence' : 'Check this one'}</StatusChip>
                <StatusChip tone="neutral">{TRANSFER_KIND_LABEL[item.kind]}</StatusChip>
              </div>
              <div>
                <TxnLine label="From" row={item.from} />
                <TxnLine label="To" row={item.to} />
              </div>
              <p className="text-xs text-gray-700">{item.reasons.join('. ')}.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => link([item])} disabled={busy} aria-label={`Link ${what} as a transfer`} className={primaryButton}>
                  Link
                </button>
                <button
                  type="button"
                  onClick={() => notTransfer([item])}
                  disabled={busy || !canRemember}
                  aria-label={`Not a transfer: ${what}`}
                  className={secondaryButton}
                >
                  Not a transfer
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </SectionShell>
  );
});

export default TransfersSection;
