'use client';

// components/finance/review/UncategorizedSection.tsx
// Review page: spending and income with no budget category. Transfers are left
// out (they are neither). Pick a category on one row, or tick several and set
// one category on all of them. Counted and paged by the database, so a long
// history of imports is fine.

import { forwardRef, useMemo, useState } from 'react';
import { Tag } from 'lucide-react';
import type { TxnView } from '@/lib/finance/review/sections';
import type { SectionPage } from '@/lib/finance/review/server';
import { fieldLabel, primaryButton, selectInput } from '@/components/finance/import/shared';
import { categorize, plural } from './api';
import SectionShell, { ItemCheckbox } from './SectionShell';
import TxnLine, { money, txnName } from './TxnLine';
import type { RunAction } from './types';

interface UncategorizedSectionProps {
  page: SectionPage<TxnView>;
  pageSize: number;
  onPage: (offset: number) => void;
  busy: boolean;
  onAction: RunAction;
  categories: { id: string; name: string }[];
}

const UncategorizedSection = forwardRef<HTMLHeadingElement, UncategorizedSectionProps>(function UncategorizedSection(
  { page, pageSize, onPage, busy, onAction, categories },
  headingRef,
) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState('');
  const [rowChoices, setRowChoices] = useState<Record<string, string>>({});
  const pageKeys = useMemo(() => page.items.map((item) => item.id), [page.items]);
  const chosen = page.items.filter((item) => selected.has(item.id));
  const sorted = useMemo(() => [...categories].sort((a, b) => a.name.localeCompare(b.name)), [categories]);
  const nameOf = (id: string) => categories.find((category) => category.id === id)?.name ?? 'the category';

  const setCategory = (items: TxnView[], categoryId: string) =>
    onAction('uncategorized', async () => {
      const response = await categorize(
        items.map((item) => item.id),
        categoryId,
      );
      if (!response.ok) return { error: response.message };
      return { status: `${plural(response.data.updated, 'transaction is', 'transactions are')} now in ${nameOf(categoryId)}.` };
    });

  const options = (
    <>
      <option value="">Choose a category...</option>
      {sorted.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </>
  );

  return (
    <SectionShell
      ref={headingRef}
      id="review-uncategorized"
      title="Uncategorized"
      description={
        <p>
          Spending and income with no budget category, newest first. Transfers between your accounts aren&rsquo;t
          listed: they are neither. To teach a vendor its category for future imports, open the transaction and answer
          &ldquo;Always&rdquo; when asked.
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <label htmlFor="uncategorized-bulk-category" className={fieldLabel}>
              Category for the selected
            </label>
            <select
              id="uncategorized-bulk-category"
              value={bulkCategory}
              onChange={(event) => setBulkCategory(event.target.value)}
              disabled={busy || sorted.length === 0}
              className={selectInput}
            >
              {options}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setCategory(chosen, bulkCategory)}
            disabled={busy || chosen.length === 0 || !bulkCategory}
            className={primaryButton}
          >
            <Tag className="h-4 w-4" aria-hidden="true" />
            Set category{chosen.length > 0 ? ` (${chosen.length})` : ''}
          </button>
        </div>
      }
    >
      {page.items.map((item) => {
        const selectId = `uncategorized-${item.id}`;
        const what = `${money(item.amount)} ${txnName(item)} on ${item.date}`;
        return (
          <li key={item.id} className="flex gap-2 py-2">
            <ItemCheckbox
              checked={selected.has(item.id)}
              onChange={(on) =>
                setSelected((current) => {
                  const next = new Set(current);
                  if (on) next.add(item.id);
                  else next.delete(item.id);
                  return next;
                })
              }
              label={`Select ${what}`}
              disabled={busy}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <div className="min-w-0 flex-1">
                <TxnLine row={item} />
              </div>
              {/* A separate Set button: arrowing through a select fires change events in some browsers. */}
              <div className="flex gap-2 sm:w-72 sm:shrink-0">
                <label htmlFor={selectId} className="sr-only">
                  Category for {what}
                </label>
                <select
                  id={selectId}
                  value={rowChoices[item.id] ?? ''}
                  onChange={(event) => setRowChoices((current) => ({ ...current, [item.id]: event.target.value }))}
                  disabled={busy || sorted.length === 0}
                  className={selectInput}
                >
                  {options}
                </select>
                <button
                  type="button"
                  onClick={() => setCategory([item], rowChoices[item.id] ?? '')}
                  disabled={busy || !rowChoices[item.id]}
                  aria-label={`Set the category of ${what}`}
                  className={`${primaryButton} shrink-0`}
                >
                  Set
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </SectionShell>
  );
});

export default UncategorizedSection;
