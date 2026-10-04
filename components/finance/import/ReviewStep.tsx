'use client';

// components/finance/import/ReviewStep.tsx
// Step 3 of the statement import: the server's plan for every row, with the
// person's changes on top. Nothing is written here; the choices are sent with
// the file when "Import statement" is pressed.

import { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { BudgetCategory } from '@/components/finance/CategorySelect';
import type { PreviewResponse } from '@/lib/finance/csv-import/service';
import type { PlannedRow } from '@/lib/finance/csv-import/types';
import {
  REVIEW_PAGE_SIZE,
  STATUS_FILTERS,
  STATUS_LABELS,
  accountLabel,
  applyDecision,
  filterRows,
  pageCount,
  pageOf,
  statusCounts,
  summarizeDecisions,
  summaryLine,
  type Decisions,
  type RowDecision,
  type StatusFilter,
} from '@/lib/finance/csv-import/ui-helpers';
import ReviewRow from './ReviewRow';
import { ErrorNotice, card, primaryButton, secondaryButton, selectInput } from './shared';

interface ReviewStepProps {
  preview: PreviewResponse;
  decisions: Decisions;
  onDecisionsChange: (update: (current: Decisions) => Decisions) => void;
  categories: BudgetCategory[];
  onCategoryCreated: (category: BudgetCategory) => void;
  onBack: () => void;
  onImport: () => void;
  /** True while the import request is running. */
  busy: boolean;
  error: string | null;
  online: boolean;
}

/** How many unreadable rows are listed before "Show all". */
const REJECTED_SHOWN = 20;

/** The bulk category list's value for "no category", which can't be the empty placeholder. */
const NO_CATEGORY = '__none__';

const formatCount = (n: number): string => n.toLocaleString('en-US');

const isSelectable = (row: PlannedRow): boolean => row.allowedActions.length > 1;

export default function ReviewStep({
  preview,
  decisions,
  onDecisionsChange,
  categories,
  onCategoryCreated,
  onBack,
  onImport,
  busy,
  error,
  online,
}: ReviewStepProps) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());
  const [bulkMessage, setBulkMessage] = useState('');
  const [showAllRejected, setShowAllRejected] = useState(false);
  const listTopRef = useRef<HTMLDivElement>(null);

  const { rows, rejected } = preview;
  const counts = useMemo(() => statusCounts(rows), [rows]);
  const summary = useMemo(() => summarizeDecisions(rows, decisions), [rows, decisions]);
  const visible = useMemo(() => filterRows(rows, filter), [rows, filter]);
  const pages = pageCount(visible.length);
  const currentPage = Math.min(page, pages);
  const pageRows = useMemo(() => pageOf(visible, currentPage), [visible, currentPage]);

  const selectablePageRows = pageRows.filter(isSelectable);
  const pageFullySelected =
    selectablePageRows.length > 0 && selectablePageRows.every((row) => selected.has(row.rowNumber));
  const selectableInView = useMemo(() => visible.filter(isSelectable), [visible]);

  const changeRow = useCallback(
    (row: PlannedRow, patch: RowDecision) => {
      onDecisionsChange((current) => applyDecision(current, [row], patch));
    },
    [onDecisionsChange],
  );

  const toggleSelect = useCallback((rowNumber: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }, []);

  function changeFilter(next: StatusFilter) {
    setFilter(next);
    setPage(1);
    // A selection is only ever what is in view, so nothing hidden gets changed by a bulk action.
    setSelected(new Set());
    setBulkMessage('');
  }

  function goToPage(next: number) {
    setPage(next);
    listTopRef.current?.scrollIntoView({ block: 'start' });
  }

  function togglePageSelection(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const row of selectablePageRows) {
        if (checked) next.add(row.rowNumber);
        else next.delete(row.rowNumber);
      }
      return next;
    });
  }

  function selectAllInView() {
    setSelected(new Set(selectableInView.map((row) => row.rowNumber)));
  }

  const selectedRows = (): PlannedRow[] => rows.filter((row) => selected.has(row.rowNumber));

  function skipSelected() {
    const targets = selectedRows();
    if (targets.length === 0) return;
    onDecisionsChange((current) => applyDecision(current, targets, { action: 'skip' }));
    setBulkMessage(`${formatCount(targets.length)} ${targets.length === 1 ? 'row' : 'rows'} will be skipped.`);
    setSelected(new Set());
  }

  function categorizeSelected(value: string) {
    const targets = selectedRows();
    if (!value || targets.length === 0) return;
    const categoryId = value === NO_CATEGORY ? null : value;
    onDecisionsChange((current) => applyDecision(current, targets, { categoryId }));
    const name = categoryId ? (categories.find((category) => category.id === categoryId)?.name ?? 'the category') : null;
    setBulkMessage(
      name
        ? `${formatCount(targets.length)} ${targets.length === 1 ? 'row' : 'rows'} set to ${name}.`
        : `Category removed from ${formatCount(targets.length)} ${targets.length === 1 ? 'row' : 'rows'}.`,
    );
    setSelected(new Set());
  }

  const nothingToImport = summary.add + summary.link === 0;
  const importDisabled = busy || !online || nothingToImport;
  const firstShown = visible.length === 0 ? 0 : (currentPage - 1) * REVIEW_PAGE_SIZE + 1;
  const lastShown = Math.min(currentPage * REVIEW_PAGE_SIZE, visible.length);
  const shownRejected = showAllRejected ? rejected : rejected.slice(0, REJECTED_SHOWN);

  const importButton = (
    <button
      type="button"
      onClick={onImport}
      disabled={importDisabled}
      aria-describedby={!online ? 'import-offline-note' : nothingToImport ? 'import-nothing-note' : undefined}
      className={primaryButton}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {busy ? 'Importing...' : 'Import statement'}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Summary */}
      <section className={card} aria-label="What this import will do">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p role="status" aria-live="polite" className="text-lg font-semibold text-gray-900">
              {summaryLine(summary)}.
            </p>
            <p className="mt-1 text-sm text-gray-700">
              Into {accountLabel(preview.account)}. {formatCount(rows.length)} {rows.length === 1 ? 'row was' : 'rows were'}{' '}
              read from the file
              {rejected.length > 0
                ? `, and ${formatCount(rejected.length)} more could not be read (listed at the bottom).`
                : '.'}{' '}
              Nothing is saved until you press Import statement.
            </p>
            {nothingToImport && (
              <p id="import-nothing-note" className="mt-1 text-sm font-medium text-gray-900">
                Every row is being skipped, so there is nothing to import.
              </p>
            )}
          </div>
          <div className="flex flex-col sm:shrink-0">{importButton}</div>
        </div>
      </section>

      {/* Filters */}
      <div role="group" aria-label="Show rows by status" className="flex flex-wrap gap-2">
        {STATUS_FILTERS.filter((option) => option === 'all' || counts[option] > 0).map((option) => {
          const active = filter === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => changeFilter(option)}
              className={`min-h-11 rounded-full border px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${
                active
                  ? 'border-sky-700 bg-sky-700 text-white'
                  : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
              }`}
            >
              {option === 'all' ? 'All' : STATUS_LABELS[option]} ({formatCount(counts[option])})
            </button>
          );
        })}
      </div>

      {/* Rows */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white" aria-label="Statement rows">
        <div ref={listTopRef} className="scroll-mt-4 border-b border-gray-200 bg-gray-50 px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label
                htmlFor="import-select-page"
                className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-gray-900"
              >
                <input
                  id="import-select-page"
                  type="checkbox"
                  checked={pageFullySelected}
                  disabled={selectablePageRows.length === 0}
                  onChange={(event) => togglePageSelection(event.target.checked)}
                  className="h-5 w-5 accent-sky-700"
                />
                Select all on this page
              </label>
              {selectableInView.length > selectablePageRows.length && (
                <button
                  type="button"
                  onClick={selectAllInView}
                  className="min-h-11 rounded-lg px-2 text-sm font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900"
                >
                  Select all {formatCount(selectableInView.length)} in this view
                </button>
              )}
              <p className="text-sm text-gray-700">{formatCount(selected.size)} selected</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div>
                <label htmlFor="import-bulk-category" className="sr-only">
                  Set category for the selected rows
                </label>
                <select
                  id="import-bulk-category"
                  value=""
                  disabled={selected.size === 0}
                  onChange={(event) => categorizeSelected(event.target.value)}
                  className={`${selectInput} sm:w-56`}
                >
                  <option value="">Set category...</option>
                  <option value={NO_CATEGORY}>No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={skipSelected} disabled={selected.size === 0} className={secondaryButton}>
                Skip selected
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                disabled={selected.size === 0}
                className={secondaryButton}
              >
                Clear selection
              </button>
            </div>
          </div>
          <p role="status" aria-live="polite" className={bulkMessage ? 'mt-2 text-sm text-gray-800' : 'sr-only'}>
            {bulkMessage}
          </p>
        </div>

        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-700">
            {rows.length === 0
              ? 'None of the rows in this file could be read. Go back and check the columns.'
              : 'No rows in this view.'}
          </p>
        ) : (
          <ul role="list" className="divide-y divide-gray-200">
            {pageRows.map((row) => (
              <ReviewRow
                key={row.rowNumber}
                row={row}
                decision={decisions[row.rowNumber]}
                selected={selected.has(row.rowNumber)}
                onToggleSelect={toggleSelect}
                onChange={changeRow}
                categories={categories}
                onCategoryCreated={onCategoryCreated}
              />
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav
            aria-label="Pages of statement rows"
            className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
          >
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className={secondaryButton}
            >
              Previous {REVIEW_PAGE_SIZE}
            </button>
            <p aria-live="polite" className="text-center text-sm text-gray-800">
              Rows {formatCount(firstShown)} to {formatCount(lastShown)} of {formatCount(visible.length)} (page{' '}
              {currentPage} of {pages})
            </p>
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === pages}
              className={secondaryButton}
            >
              Next {REVIEW_PAGE_SIZE}
            </button>
          </nav>
        )}
      </section>

      {/* Rows the parser could not read */}
      {rejected.length > 0 && (
        <section className={card} aria-labelledby="import-rejected-heading">
          <h3 id="import-rejected-heading" className="text-base font-semibold text-gray-900">
            Rows that couldn&apos;t be read ({formatCount(rejected.length)})
          </h3>
          <p className="mt-1 text-sm text-gray-700">
            These rows are left out. The number is the row in your file, counting its first line as row 1.
          </p>
          <ul id="import-rejected-list" role="list" className="mt-3 divide-y divide-gray-100 text-sm">
            {shownRejected.map((item) => (
              <li key={item.row} className="py-2 text-gray-800">
                <span className="font-medium text-gray-900">Row {formatCount(item.row)}:</span> {item.reason}
              </li>
            ))}
          </ul>
          {rejected.length > REJECTED_SHOWN && (
            <button
              type="button"
              onClick={() => setShowAllRejected((current) => !current)}
              aria-expanded={showAllRejected}
              aria-controls="import-rejected-list"
              className={`${secondaryButton} mt-3`}
            >
              {showAllRejected ? `Show the first ${REJECTED_SHOWN}` : `Show all ${formatCount(rejected.length)}`}
            </button>
          )}
        </section>
      )}

      {error && (
        <ErrorNotice>
          <p>{error}</p>
        </ErrorNotice>
      )}

      {busy && (
        <p role="status" className="flex items-center gap-2 text-sm text-gray-700">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Importing. Keep this page open until it finishes.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button type="button" onClick={onBack} disabled={busy} className={secondaryButton}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to columns
        </button>
        {importButton}
      </div>
    </div>
  );
}
