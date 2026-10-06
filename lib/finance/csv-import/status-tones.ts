// lib/finance/csv-import/status-tones.ts
// One color scale for every message, chip and banner in the statement import
// (and the Statements box on Settings), so the color always means the same
// thing:
//   success    green  done and fine: "Adds up", "Imported"
//   attention  amber  you have something to check or decide: a total that
//                     doesn't add up, dates that read two ways, rows that
//                     can't be imported, possible duplicates, saved settings
//                     that don't fit
//   error      red    something failed or blocks you
//   info       sky    information, nothing to do
//   neutral    gray   a plain label ("Already imported", "Skipped")
// Color is never the only signal: every tone has its own icon and the text
// always says the state in words.
//
// Contrast (Tailwind v4 palette, WCAG 2.1 AA needs 4.5:1 for text):
//   text-green-900 on bg-green-50   ~ 10.6:1   text-amber-900 on bg-amber-50 ~ 9.4:1
//   text-red-900 on bg-red-50       ~ 10.0:1   text-sky-900 on bg-sky-50     ~ 10.1:1
//   text-gray-800 on bg-gray-100    ~ 11.6:1
//   chips (100 backgrounds) keep the 900 text: all above 8:1.
// Icons use the 700 shade (3:1 or better against the 50 background, as
// non-text UI needs).
//
// Pure data and functions; the React parts are in components/finance/import/shared.tsx.
// Relative imports end in `.ts` for `node --test --experimental-strip-types`.

import type { PlanStatus, PlannedRow } from './types.ts';

export type StatusTone = 'success' | 'attention' | 'error' | 'info' | 'neutral';

export interface ToneClasses {
  /** A banner or notice box: border, background and text. */
  box: string;
  /** The icon inside a box or chip. */
  icon: string;
  /** A small rounded chip. */
  chip: string;
  /** A word a screen reader hears before the message, so the state is never color alone. */
  srLabel: string;
}

export const TONE_CLASSES: Record<StatusTone, ToneClasses> = {
  success: {
    box: 'border-green-200 bg-green-50 text-green-900',
    icon: 'text-green-700',
    chip: 'bg-green-100 text-green-900',
    srLabel: 'Done:',
  },
  attention: {
    box: 'border-amber-300 bg-amber-50 text-amber-900',
    icon: 'text-amber-700',
    chip: 'bg-amber-100 text-amber-900',
    srLabel: 'Needs your attention:',
  },
  error: {
    box: 'border-red-200 bg-red-50 text-red-900',
    icon: 'text-red-700',
    chip: 'bg-red-100 text-red-900',
    srLabel: 'Error:',
  },
  info: {
    box: 'border-sky-200 bg-sky-50 text-sky-900',
    icon: 'text-sky-700',
    chip: 'bg-sky-100 text-sky-900',
    srLabel: 'Note:',
  },
  neutral: {
    box: 'border-gray-200 bg-gray-50 text-gray-800',
    icon: 'text-gray-600',
    chip: 'bg-gray-100 text-gray-800',
    srLabel: '',
  },
};

/** The tone of a review row's status chip. */
export function toneForPlanStatus(row: Pick<PlannedRow, 'status' | 'duplicateRule'>): StatusTone {
  switch (row.status) {
    case 'new':
      return 'info';
    case 'matches':
      return 'info';
    case 'duplicate':
      // Already imported from this statement: nothing to decide. The same date,
      // amount and vendor is only a guess: check it.
      return row.duplicateRule === 'external_id' ? 'neutral' : 'attention';
    case 'duplicate_in_file':
      return 'attention';
    case 'invalid':
      return 'error';
    default:
      return 'neutral';
  }
}

/** The chip words for a review row: a same-transaction duplicate is only "possible". */
export function planStatusChipLabel(row: Pick<PlannedRow, 'status' | 'duplicateRule'>, labels: Record<PlanStatus, string>): string {
  if (row.status === 'duplicate' && row.duplicateRule === 'same_transaction') return 'Possible duplicate';
  return labels[row.status];
}

/**
 * The tone of the box that describes a file just read in step 1: success
 * only when a known layout was recognized and nothing needs checking.
 */
export function toneForCsvDetection(input: { confidence: 'high' | 'medium' | 'low'; warnings: number }): StatusTone {
  if (input.warnings > 0 || input.confidence === 'low') return 'attention';
  return input.confidence === 'high' ? 'success' : 'info';
}

/**
 * The tone of the box that describes a PDF just read in step 1: success only
 * for a recognized layout that adds up (or, for a transaction list, has
 * nothing to add up), with no warnings and an account that fits.
 */
export function toneForPdfDetection(input: {
  confidence: 'high' | 'low';
  reconciliationOk: boolean;
  reconciliationApplicable: boolean;
  warnings: number;
  accountMatches: number;
  hasLastFour: boolean;
}): StatusTone {
  if (input.confidence !== 'high') return 'attention';
  if (input.reconciliationApplicable && !input.reconciliationOk) return 'attention';
  if (input.warnings > 0) return 'attention';
  if (input.hasLastFour && input.accountMatches !== 1) return 'attention';
  return 'success';
}

/** Reconciliation: "adds up" is success; a difference, or totals that couldn't be checked, need attention. */
export function toneForReconciliation(input: { ok: boolean; applicable: boolean }): StatusTone {
  if (!input.applicable) return 'info';
  return input.ok ? 'success' : 'attention';
}
