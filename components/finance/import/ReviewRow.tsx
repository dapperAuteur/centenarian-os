'use client';

// components/finance/import/ReviewRow.tsx
// One statement row in the review step: what the import found, and the
// controls to change what it will do. Memoized, because a page holds up to
// 200 of these and a change to one row must not re-render the rest.
//
// On a credit card or loan the row is described in card terms (Charge,
// Payment, Refund or credit, Interest, Fee) instead of expense or income,
// and a payment gets "Paid from" so it is linked as a transfer. On a bank
// account, money out whose wording says it paid a card or loan gets "This
// paid", and an ATM or branch withdrawal gets "Cash withdrawal -> into" a
// cash account in the same currency. See lib/finance/csv-import/card-terms.ts.

import { memo } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, Banknote, Sparkles } from 'lucide-react';
import CategorySelect, { type BudgetCategory } from '@/components/finance/CategorySelect';
import {
  CARD_ROW_KINDS,
  cardKindLabel,
  isDebtAccountType,
  otherCurrencyCashAccounts,
  type CardRowKind,
  type TransferRole,
} from '@/lib/finance/csv-import/card-terms';
import { planStatusChipLabel, toneForPlanStatus } from '@/lib/finance/csv-import/status-tones';
import type { PlannedRow, RowActionKind } from '@/lib/finance/csv-import/types';
import {
  STATUS_LABELS,
  accountLabel,
  actionLabel,
  categorySuggestionNote,
  effectiveCardKind,
  effectiveDecision,
  effectiveTransferAccount,
  formatCents,
  formatIsoDate,
  matchSummaryText,
  pickerAccountsFor,
  rowTransferRole,
  type RowDecision,
  type TransferContext,
} from '@/lib/finance/csv-import/ui-helpers';
import { StatusChip, selectInput } from './shared';

interface ReviewRowProps {
  row: PlannedRow;
  decision: RowDecision | undefined;
  selected: boolean;
  onToggleSelect: (rowNumber: number) => void;
  onChange: (row: PlannedRow, patch: RowDecision) => void;
  categories: BudgetCategory[];
  onCategoryCreated: (category: BudgetCategory) => void;
  /** The account, its siblings and the suggested "paid from" account. */
  transfer: TransferContext;
}

const smallLabel = 'mb-1 block text-xs font-medium text-gray-600';

/** The picker's label for each kind of link. */
function pickerLabel(role: Exclude<TransferRole, null>): string {
  if (role === 'paid_from') return 'Paid from';
  if (role === 'cash_withdrawal') return 'Cash withdrawal → into';
  return 'This paid';
}

/** The picker's value for "not linked". */
const NOT_LINKED = '';

function ReviewRow({
  row,
  decision,
  selected,
  onToggleSelect,
  onChange,
  categories,
  onCategoryCreated,
  transfer,
}: ReviewRowProps) {
  const number = row.rowNumber;
  const effective = effectiveDecision(row, decision);
  const debt = isDebtAccountType(transfer.accountType);
  const cardKind = effectiveCardKind(row, decision);
  // A row that can only be skipped has nothing to choose, so it gets no controls.
  const canChoose = row.allowedActions.length > 1;
  const suggestionNote = categorySuggestionNote(row, effective.categoryId);
  const detail =
    row.status === 'matches' && row.match
      ? row.match.source === 'transfer'
        ? `The payment recorded here from another statement: ${matchSummaryText(row.match)}`
        : `Your entry: ${matchSummaryText(row.match)}`
      : row.reason;
  const showVendor = row.vendor && row.vendor.toLowerCase() !== row.description.toLowerCase();
  const directionLabelId = `import-direction-label-${number}`;

  const role = rowTransferRole(row, decision, transfer.accountType);
  const transferAccount = role ? effectiveTransferAccount(row, decision, transfer) : null;
  const pickerAccounts = role ? pickerAccountsFor(role, transfer) : [];
  const pickerId = `import-transfer-${number}`;
  const cash = role === 'cash_withdrawal';
  // Cash accounts in another currency can't take the same amount: that is Exchange money.
  const foreignCash = cash && pickerAccounts.length === 0 ? otherCurrencyCashAccounts(transfer.accounts, transfer.accountId) : [];

  const directionButton = (type: 'expense' | 'income', label: string, position: string) => {
    const pressed = effective.type === type;
    return (
      <button
        type="button"
        aria-pressed={pressed}
        onClick={() => onChange(row, { type })}
        className={`min-h-11 flex-1 border px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${position} ${
          pressed ? 'border-sky-700 bg-sky-700 text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <li className={`px-3 py-4 sm:px-4 ${effective.action === 'skip' ? 'bg-gray-50' : 'bg-white'}`}>
      <div className="flex items-start gap-1 sm:gap-2">
        {canChoose ? (
          <label
            htmlFor={`import-select-${number}`}
            className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center"
          >
            <input
              id={`import-select-${number}`}
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(number)}
              className="h-5 w-5 accent-sky-700"
            />
            <span className="sr-only">Select row {number}</span>
          </label>
        ) : (
          <span className="w-11 shrink-0" aria-hidden="true" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="min-w-0 wrap-break-word font-medium text-gray-900">{row.description}</p>
            <p className="font-semibold tabular-nums text-gray-900">
              {formatCents(row.amountCents)}
              <span className="ml-2 text-xs font-medium text-gray-600">
                {debt ? cardKindLabel(cardKind, transfer.accountType) : effective.type === 'income' ? 'Money in' : 'Money out'}
              </span>
            </p>
          </div>
          <p className="mt-0.5 text-xs text-gray-600">
            Row {number} · {formatIsoDate(row.date)}
            {showVendor ? ` · ${row.vendor}` : ''}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusChip tone={toneForPlanStatus(row)}>{planStatusChipLabel(row, STATUS_LABELS)}</StatusChip>
            {detail && <span className="text-xs text-gray-700">{detail}</span>}
          </div>

          {canChoose && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor={`import-action-${number}`} className={smallLabel}>
                  What to do
                </label>
                <select
                  id={`import-action-${number}`}
                  value={effective.action}
                  onChange={(event) => onChange(row, { action: event.target.value as RowActionKind })}
                  className={selectInput}
                >
                  {row.allowedActions.map((action) => (
                    <option key={action} value={action}>
                      {actionLabel(row, action)}
                    </option>
                  ))}
                </select>
              </div>

              {effective.action === 'insert' && (
                <>
                  {debt ? (
                    <div>
                      <label htmlFor={`import-kind-${number}`} className={smallLabel}>
                        What is this row?
                      </label>
                      <select
                        id={`import-kind-${number}`}
                        value={cardKind}
                        onChange={(event) => onChange(row, { cardKind: event.target.value as CardRowKind })}
                        className={selectInput}
                      >
                        {CARD_ROW_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {cardKindLabel(kind, transfer.accountType)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <span id={directionLabelId} className={smallLabel}>
                        Expense or income
                      </span>
                      <div role="group" aria-labelledby={directionLabelId} className="flex">
                        {directionButton('expense', 'Expense', 'rounded-l-lg')}
                        {directionButton('income', 'Income', 'rounded-r-lg border-l-0')}
                      </div>
                    </div>
                  )}

                  {/* A payment is a transfer, so it has no spending category. */}
                  {!transferAccount && (
                    <div>
                      <CategorySelect
                        id={`import-category-${number}`}
                        size="touch"
                        value={effective.categoryId ?? ''}
                        onChange={(categoryId) => onChange(row, { categoryId: categoryId || null })}
                        categories={categories}
                        onCategoryCreated={onCategoryCreated}
                      />
                      {suggestionNote && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-gray-700">
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-sky-700" aria-hidden="true" />
                          {suggestionNote}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {cash && pickerAccounts.length === 0 && (
                <div className="sm:col-span-2 lg:col-span-1">
                  <p className={smallLabel}>Cash withdrawal</p>
                  <p className="flex items-start gap-1 text-xs text-gray-700">
                    <Banknote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-700" aria-hidden="true" />
                    <span>
                      {foreignCash.length > 0 ? (
                        <>
                          Your cash {foreignCash.length === 1 ? 'account is' : 'accounts are'} in another currency. Import this
                          row as spending, or skip it and record the cash with{' '}
                          <Link href="/dashboard/finance/accounts" className="font-medium text-sky-700 underline underline-offset-2">
                            Exchange money
                          </Link>
                          .
                        </>
                      ) : (
                        <>
                          This looks like cash taken out.{' '}
                          <Link href="/dashboard/finance/accounts" className="font-medium text-sky-700 underline underline-offset-2">
                            Add a cash account
                          </Link>{' '}
                          to track it as cash on hand instead of spending.
                        </>
                      )}
                    </span>
                  </p>
                </div>
              )}

              {role && !(cash && pickerAccounts.length === 0) && (
                <div className="sm:col-span-2 lg:col-span-1">
                  <label htmlFor={pickerId} className={smallLabel}>
                    {pickerLabel(role)}
                  </label>
                  <select
                    id={pickerId}
                    value={transferAccount ?? NOT_LINKED}
                    onChange={(event) => onChange(row, { transferAccountId: event.target.value || null })}
                    aria-describedby={`${pickerId}-hint`}
                    className={selectInput}
                  >
                    <option value={NOT_LINKED}>
                      {role === 'paid_from'
                        ? 'Not linked: choose the account'
                        : cash
                          ? 'Not a cash withdrawal'
                          : 'Not a payment to my card or loan'}
                    </option>
                    {pickerAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {accountLabel(account)}
                      </option>
                    ))}
                  </select>
                  <p id={`${pickerId}-hint`} className="mt-1 flex items-start gap-1 text-xs text-gray-700">
                    <ArrowRightLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-700" aria-hidden="true" />
                    {transferAccount
                      ? cash
                        ? 'Recorded as cash coming into that account, linked as a transfer, so it is not counted as spending.'
                        : 'Linked as a transfer, so it is not counted as income or spending.'
                      : role === 'paid_from'
                        ? 'Choose where the money came from so this payment is not counted as income.'
                        : cash
                          ? 'Choose the cash account the money went into, so it is not counted as spending.'
                          : 'If this paid one of your cards or loans, choose it so it is not counted as spending.'}
                  </p>
                </div>
              )}

              {effective.action === 'link' && (
                <p className="self-end text-xs text-gray-700 sm:col-span-1 lg:col-span-2">
                  {row.match?.source === 'transfer'
                    ? 'Nothing new is added. The payment already recorded here is marked as this statement row, and stays linked as a transfer.'
                    : 'Nothing new is added. Your entry keeps its own details and is marked as matched to this statement row.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export default memo(ReviewRow);
