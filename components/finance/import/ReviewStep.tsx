'use client';

// components/finance/import/ReviewStep.tsx
// Step 3 of the statement import: the server's plan for every row, with the
// person's changes on top. Nothing is written here; the choices are sent with
// the file when "Import statement" is pressed.

import { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, Banknote, Loader2 } from 'lucide-react';
import { cardKindSummary, importExplanation, isDebtAccountType, type CardRowKind } from '@/lib/finance/csv-import/card-terms';
import { needsReconciliationConfirmation } from '@/lib/finance/pdf-import/reconcile';
import type { BudgetCategory } from '@/components/finance/CategorySelect';
import type { PreviewResponse } from '@/lib/finance/csv-import/service';
import type { PlannedRow } from '@/lib/finance/csv-import/types';
import type { StatementPreview } from '@/lib/finance/pdf-import/service';
import {
  REVIEW_PAGE_SIZE,
  STATUS_FILTERS,
  STATUS_LABELS,
  accountLabel,
  applyDecision,
  cashWithdrawalCounts,
  effectiveCardKind,
  effectiveDecision,
  filterRows,
  pageCount,
  pageOf,
  pickerAccountsFor,
  rowTransferRole,
  statusCounts,
  summarizeDecisions,
  summaryLine,
  transferCounts,
  type Decisions,
  type RowDecision,
  type StatusFilter,
  type TransferContext,
} from '@/lib/finance/csv-import/ui-helpers';
import ReviewRow from './ReviewRow';
import StatementSummary from './StatementSummary';
import { ErrorNotice, StatusNotice, ToneIcon, card, primaryButton, secondaryButton, selectInput } from './shared';

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
  /** A PDF statement's summary, shown above the rows. Absent for a CSV. */
  statement?: StatementPreview | null;
  accountMatchesStatement?: boolean | null;
  /** The "Import anyway" tick for a statement that doesn't add up. */
  confirmUnreconciled?: boolean;
  onConfirmUnreconciledChange?: (confirmed: boolean) => void;
  /** What the Back button says. */
  backLabel?: string;
  /** The account, the person's other accounts, and the suggested "paid from" account. */
  transfer: TransferContext;
  /** Turns "record the payment on the other account when it has no matching row" on or off. */
  onRecordMissingChange: (record: boolean) => void;
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
  statement = null,
  accountMatchesStatement = null,
  confirmUnreconciled = false,
  onConfirmUnreconciledChange,
  backLabel = 'Back to columns',
  transfer,
  onRecordMissingChange,
}: ReviewStepProps) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());
  const [bulkMessage, setBulkMessage] = useState('');
  const [showAllRejected, setShowAllRejected] = useState(false);
  const listTopRef = useRef<HTMLDivElement>(null);

  const { rows, rejected } = preview;
  const skipped = useMemo(() => preview.skipped ?? [], [preview.skipped]);
  // "12: An item line that details another PayPal row." One line per reason.
  const skippedReasons = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of skipped) counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1);
    return [...counts.entries()];
  }, [skipped]);
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

  const debt = isDebtAccountType(transfer.accountType);
  const transfers = useMemo(() => transferCounts(rows, decisions, transfer), [rows, decisions, transfer]);
  const cashWithdrawals = useMemo(() => cashWithdrawalCounts(rows, decisions, transfer), [rows, decisions, transfer]);
  const cashRowCount = cashWithdrawals.linked + cashWithdrawals.unassigned;
  // Rows that will be saved, in card words: "40 charges, 3 payments, 1 refund or credit".
  const kindCounts = useMemo(() => {
    const counts: Record<CardRowKind, number> = { charge: 0, payment: 0, refund: 0, interest: 0, fee: 0 };
    for (const row of rows) {
      if (effectiveDecision(row, decisions[row.rowNumber]).action === 'skip') continue;
      counts[effectiveCardKind(row, decisions[row.rowNumber])] += 1;
    }
    return counts;
  }, [rows, decisions]);
  const paymentRows = useMemo(
    () => rows.filter((row) => rowTransferRole(row, decisions[row.rowNumber], transfer.accountType) === 'paid_from'),
    [rows, decisions, transfer.accountType],
  );
  const paidFromOptions = debt ? pickerAccountsFor('paid_from', transfer) : [];

  /** "Paid from" for every payment on this statement at once. */
  function setPaidFromForAll(accountId: string) {
    if (paymentRows.length === 0) return;
    onDecisionsChange((current) => applyDecision(current, paymentRows, { transferAccountId: accountId || null }));
    const chosen = paidFromOptions.find((account) => account.id === accountId);
    setBulkMessage(
      chosen
        ? `${formatCount(paymentRows.length)} ${paymentRows.length === 1 ? 'payment' : 'payments'} set to paid from ${accountLabel(chosen)}.`
        : `${formatCount(paymentRows.length)} ${paymentRows.length === 1 ? 'payment is' : 'payments are'} no longer linked.`,
    );
  }

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
  const needsConfirmation =
    statement !== null && needsReconciliationConfirmation(statement.reconciliation) && !confirmUnreconciled;
  const importDisabled = busy || !online || nothingToImport || needsConfirmation;
  const firstShown = visible.length === 0 ? 0 : (currentPage - 1) * REVIEW_PAGE_SIZE + 1;
  const lastShown = Math.min(currentPage * REVIEW_PAGE_SIZE, visible.length);
  const shownRejected = showAllRejected ? rejected : rejected.slice(0, REJECTED_SHOWN);

  const importButton = (
    <button
      type="button"
      onClick={onImport}
      disabled={importDisabled}
      aria-describedby={
        !online
          ? 'import-offline-note'
          : nothingToImport
            ? 'import-nothing-note'
            : needsConfirmation
              ? 'import-confirm-note'
              : undefined
      }
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
            {debt && <p className="mt-1 text-sm text-gray-800">To import: {cardKindSummary(kindCounts, transfer.accountType)}.</p>}
            <p className="mt-1 text-sm text-gray-700">{importExplanation(transfer.accountType)}</p>
            {(transfers.linked > 0 || transfers.unassigned > 0) && (
              <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-800">
                <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
                <span>
                  {formatCount(transfers.linked)} {transfers.linked === 1 ? 'payment' : 'payments'} will be linked as{' '}
                  {transfers.linked === 1 ? 'a transfer' : 'transfers'}.
                  {transfers.unassigned > 0 &&
                    ` ${formatCount(transfers.unassigned)} more ${transfers.unassigned === 1 ? 'looks' : 'look'} like ${transfers.unassigned === 1 ? 'a payment' : 'payments'} with no account chosen.`}
                </span>
              </p>
            )}
            {cashRowCount > 0 && (
              <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-800">
                <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
                <span>
                  {formatCount(cashWithdrawals.linked)} cash {cashWithdrawals.linked === 1 ? 'withdrawal goes' : 'withdrawals go'} into
                  a cash account as {cashWithdrawals.linked === 1 ? 'a transfer' : 'transfers'}.
                  {cashWithdrawals.unassigned > 0 &&
                    ` ${formatCount(cashWithdrawals.unassigned)} more ${cashWithdrawals.unassigned === 1 ? 'looks' : 'look'} like cash taken out with no cash account chosen, and will count as spending.`}
                </span>
              </p>
            )}
            {nothingToImport && (
              <p id="import-nothing-note" className="mt-1 text-sm font-medium text-gray-900">
                Every row is being skipped, so there is nothing to import.
              </p>
            )}
            {needsConfirmation && !nothingToImport && (
              <p id="import-confirm-note" className="mt-1 flex items-start gap-1.5 text-sm font-medium text-amber-900">
                <ToneIcon tone="attention" className="mt-0.5 h-4 w-4" />
                <span>
                  Needs your attention: this statement doesn&apos;t add up. Tick &quot;Import anyway&quot; in the statement
                  summary to import it.
                </span>
              </p>
            )}
          </div>
          <div className="flex flex-col sm:shrink-0">{importButton}</div>
        </div>
      </section>

      {statement && (
        <StatementSummary
          statement={statement}
          accountMatchesStatement={accountMatchesStatement}
          confirmUnreconciled={confirmUnreconciled}
          onConfirmUnreconciledChange={(confirmed) => onConfirmUnreconciledChange?.(confirmed)}
        />
      )}

      {/* Payments: where they came from, for all of them at once */}
      {(paymentRows.length > 0 || transfers.linked + transfers.unassigned > 0 || cashRowCount > 0) && (
        <section className={card} aria-labelledby="import-payments-heading">
          <h3 id="import-payments-heading" className="text-base font-semibold text-gray-900">
            {debt
              ? 'Payments on this statement'
              : cashRowCount > 0 && transfers.linked + transfers.unassigned === 0
                ? 'Cash withdrawals'
                : cashRowCount > 0
                  ? 'Payments and cash withdrawals'
                  : 'Payments to your cards and loans'}
          </h3>
          <p className="mt-1 text-sm text-gray-700">
            {debt
              ? 'A payment moves money from another of your accounts, so it is linked to that account as a transfer instead of counting as income.'
              : transfers.linked + transfers.unassigned > 0
                ? 'Money out that paid one of your cards or loans is linked to it as a transfer instead of counting as spending. Choose the card or loan on each row.'
                : ''}
            {!debt && cashRowCount > 0 && (
              <>
                {transfers.linked + transfers.unassigned > 0 ? ' ' : ''}
                Cash taken out at an ATM, a branch or a teller goes into one of your cash accounts in the same currency
                (Cash withdrawal → into), so it is cash on hand, not spending. ATM fees on their own line stay expenses.
              </>
            )}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {debt && paymentRows.length > 0 && (
              <div>
                <label htmlFor="import-paid-from-all" className="mb-1 block text-sm font-medium text-gray-800">
                  Paid from, for all {formatCount(paymentRows.length)} {paymentRows.length === 1 ? 'payment' : 'payments'}
                </label>
                <select
                  id="import-paid-from-all"
                  value=""
                  onChange={(event) => setPaidFromForAll(event.target.value)}
                  aria-describedby="import-paid-from-all-hint"
                  className={selectInput}
                >
                  <option value="" disabled>
                    Choose an account...
                  </option>
                  {paidFromOptions.map((account) => (
                    <option key={account.id} value={account.id}>
                      {accountLabel(account)}
                    </option>
                  ))}
                </select>
                <p id="import-paid-from-all-hint" className="mt-1 text-xs text-gray-600">
                  {transfer.paidFromDefault
                    ? 'Each payment starts with the account your last linked payment came from. Each row can still be changed.'
                    : 'Once you link a payment, the next statement for this account starts with the same account.'}
                </p>
              </div>
            )}
            <div className="flex min-h-11 items-start gap-3">
              <input
                id="import-record-missing"
                type="checkbox"
                checked={transfer.recordMissing}
                onChange={(event) => onRecordMissingChange(event.target.checked)}
                aria-describedby="import-record-missing-hint"
                className="mt-0.5 h-5 w-5 shrink-0 accent-sky-700"
              />
              <div>
                <label htmlFor="import-record-missing" className="text-sm font-medium text-gray-900">
                  Record the payment on the other account if it isn&apos;t there yet
                </label>
                <p id="import-record-missing-hint" className="text-xs text-gray-600">
                  If the other account already has the same amount within 5 days, the two are linked. If not, this adds
                  it there, so both balances are right. When you later import that account&apos;s statement, its row
                  links to this one instead of being added twice.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

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
                transfer={transfer}
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

      {/* Rows the layout leaves out on purpose: they move no money */}
      {skipped.length > 0 && (
        <StatusNotice>
          <p className="font-medium">
            {formatCount(skipped.length)} {skipped.length === 1 ? 'row was' : 'rows were'} left out because{' '}
            {skipped.length === 1 ? 'it moves' : 'they move'} no money.
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {skippedReasons.map(([reason, n]) => (
              <li key={reason}>
                {formatCount(n)}: {reason}
              </li>
            ))}
          </ul>
        </StatusNotice>
      )}

      {/* Rows the parser could not read */}
      {rejected.length > 0 && (
        <section className={card} aria-labelledby="import-rejected-heading">
          <h3 id="import-rejected-heading" className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <ToneIcon tone="attention" className="h-5 w-5" />
            Rows that couldn&apos;t be read ({formatCount(rejected.length)})
          </h3>
          <p className="mt-1 text-sm text-gray-700">
            Needs your attention: these rows are left out. Check them against your statement and add any that matter by
            hand. The number is the row in your file, counting its first line as row 1.
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
          {backLabel}
        </button>
        {importButton}
      </div>
    </div>
  );
}
