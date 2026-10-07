'use client';

// components/finance/review/SectionShell.tsx
// The frame every section of the finance Review page shares: a heading with
// its count (amber while something waits, a plain "Nothing to review"
// otherwise), what the section is for, "Select all on this page", the bulk
// actions, the list, and Previous / Next for long lists.
//
// The heading takes focus after a bulk action (the items it acted on leave the
// list), so keyboard and screen reader users stay in the section.

import { forwardRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StatusChip, secondaryButton } from '@/components/finance/import/shared';

interface SectionShellProps {
  id: string;
  title: string;
  description: React.ReactNode;
  total: number;
  offset: number;
  pageSize: number;
  onPage: (offset: number) => void;
  /** Keys on this page, and the ones ticked. */
  pageKeys: string[];
  selected: ReadonlySet<string>;
  onSelectAll: (select: boolean) => void;
  /** Bulk actions for the ticked items. */
  bulk?: React.ReactNode;
  busy?: boolean;
  children: React.ReactNode;
}

const SectionShell = forwardRef<HTMLHeadingElement, SectionShellProps>(function SectionShell(
  { id, title, description, total, offset, pageSize, onPage, pageKeys, selected, onSelectAll, bulk, busy = false, children },
  headingRef,
) {
  const headingId = `${id}-heading`;
  const selectedOnPage = pageKeys.filter((key) => selected.has(key)).length;
  const allSelected = pageKeys.length > 0 && selectedOnPage === pageKeys.length;
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + pageSize, total);

  return (
    <section aria-labelledby={headingId} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="scroll-mt-24 text-lg font-semibold text-gray-900">
          {title}
        </h2>
        {total > 0 ? (
          <StatusChip tone="attention">{total.toLocaleString('en-US')} to review</StatusChip>
        ) : (
          <StatusChip tone="neutral">Nothing to review</StatusChip>
        )}
      </div>
      <div className="text-sm text-gray-700">{description}</div>

      {total > 0 && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => onSelectAll(event.target.checked)}
                disabled={busy}
                className="h-5 w-5 rounded border-gray-400 text-sky-700"
              />
              Select all on this page
              {selectedOnPage > 0 && <span className="text-gray-600">({selectedOnPage.toLocaleString('en-US')} selected)</span>}
            </label>
            {bulk}
          </div>

          <ul role="list" className="divide-y divide-gray-100">
            {children}
          </ul>

          {total > pageSize && (
            <nav aria-label={`${title}: pages`} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-700">
                Showing {first.toLocaleString('en-US')} to {last.toLocaleString('en-US')} of {total.toLocaleString('en-US')}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => onPage(Math.max(0, offset - pageSize))}
                  disabled={busy || offset === 0}
                  className={secondaryButton}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous {pageSize}
                </button>
                <button
                  type="button"
                  onClick={() => onPage(offset + pageSize)}
                  disabled={busy || last >= total}
                  className={secondaryButton}
                >
                  Next {pageSize}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </section>
  );
});

export default SectionShell;

/** The tick box in front of one item, with a label a screen reader reads. 44px target. */
export function ItemCheckbox({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="h-5 w-5 rounded border-gray-400 text-sky-700"
      />
      <span className="sr-only">{label}</span>
    </label>
  );
}
