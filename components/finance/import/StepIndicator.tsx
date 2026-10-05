'use client';

// components/finance/import/StepIndicator.tsx
// "1 Account and file · 2 Columns · 3 Review · 4 Done", with the current step
// marked for sighted users (color and weight) and for screen readers
// (aria-current, plus a live line that is read out when the step changes).

import { Check } from 'lucide-react';

export const IMPORT_STEPS = ['Account and file', 'Columns', 'Review', 'Done'] as const;

export type ImportStep = 1 | 2 | 3 | 4;

export default function StepIndicator({ current }: { current: ImportStep }) {
  return (
    <nav aria-label="Import steps">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        {IMPORT_STEPS.map((label, index) => {
          const number = index + 1;
          const isCurrent = number === current;
          const isDone = number < current;
          return (
            <li
              key={label}
              aria-current={isCurrent ? 'step' : undefined}
              className="flex items-center gap-2"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isCurrent
                    ? 'bg-sky-700 text-white'
                    : isDone
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-gray-200 text-gray-700'
                }`}
              >
                {isDone ? <Check className="h-4 w-4" aria-hidden="true" /> : number}
                {isDone && <span className="sr-only">{number}, finished</span>}
              </span>
              <span className={isCurrent ? 'font-semibold text-gray-900' : 'text-gray-600'}>{label}</span>
              {number < IMPORT_STEPS.length && (
                <span className="mx-1 text-gray-400" aria-hidden="true">·</span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="sr-only" role="status" aria-live="polite">
        Step {current} of {IMPORT_STEPS.length}: {IMPORT_STEPS[current - 1]}
      </p>
    </nav>
  );
}
