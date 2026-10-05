'use client';

// components/finance/import/ReviewRow.tsx
// One statement row in the review step: what the import found, and the
// controls to change what it will do. Memoized, because a page holds up to
// 200 of these and a change to one row must not re-render the rest.

import { memo } from 'react';
import { Sparkles } from 'lucide-react';
import CategorySelect, { type BudgetCategory } from '@/components/finance/CategorySelect';
import type { PlanStatus, PlannedRow, RowActionKind } from '@/lib/finance/csv-import/types';
import {
  STATUS_LABELS,
  actionLabel,
  categorySuggestionNote,
  effectiveDecision,
  formatCents,
  formatIsoDate,
  matchSummaryText,
  type RowDecision,
} from '@/lib/finance/csv-import/ui-helpers';
import { selectInput } from './shared';

// Each chip carries its label as text; the color only groups them.
const STATUS_CHIP: Record<PlanStatus, string> = {
  new: 'bg-sky-100 text-sky-900',
  matches: 'bg-emerald-100 text-emerald-900',
  duplicate: 'bg-gray-200 text-gray-800',
  duplicate_in_file: 'bg-gray-200 text-gray-800',
  invalid: 'bg-red-100 text-red-900',
};

interface ReviewRowProps {
  row: PlannedRow;
  decision: RowDecision | undefined;
  selected: boolean;
  onToggleSelect: (rowNumber: number) => void;
  onChange: (row: PlannedRow, patch: RowDecision) => void;
  categories: BudgetCategory[];
  onCategoryCreated: (category: BudgetCategory) => void;
}

const smallLabel = 'mb-1 block text-xs font-medium text-gray-600';

function ReviewRow({
  row,
  decision,
  selected,
  onToggleSelect,
  onChange,
  categories,
  onCategoryCreated,
}: ReviewRowProps) {
  const number = row.rowNumber;
  const effective = effectiveDecision(row, decision);
  // A row that can only be skipped has nothing to choose, so it gets no controls.
  const canChoose = row.allowedActions.length > 1;
  const suggestionNote = categorySuggestionNote(row, effective.categoryId);
  const detail = row.status === 'matches' && row.match ? `Your entry: ${matchSummaryText(row.match)}` : row.reason;
  const showVendor = row.vendor && row.vendor.toLowerCase() !== row.description.toLowerCase();
  const directionLabelId = `import-direction-label-${number}`;

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
            <p className="font-semibold tabular-nums text-gray-900">{formatCents(row.amountCents)}</p>
          </div>
          <p className="mt-0.5 text-xs text-gray-600">
            Row {number} · {formatIsoDate(row.date)}
            {showVendor ? ` · ${row.vendor}` : ''}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CHIP[row.status]}`}>
              {STATUS_LABELS[row.status]}
            </span>
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
                  <div>
                    <span id={directionLabelId} className={smallLabel}>
                      Expense or income
                    </span>
                    <div role="group" aria-labelledby={directionLabelId} className="flex">
                      {directionButton('expense', 'Expense', 'rounded-l-lg')}
                      {directionButton('income', 'Income', 'rounded-r-lg border-l-0')}
                    </div>
                  </div>

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
                </>
              )}

              {effective.action === 'link' && (
                <p className="self-end text-xs text-gray-700 sm:col-span-1 lg:col-span-2">
                  Nothing new is added. Your entry keeps its own details and is marked as matched to this statement
                  row.
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
