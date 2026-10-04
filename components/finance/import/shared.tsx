'use client';

// components/finance/import/shared.tsx
// Pieces every step of the statement import shares: the parsed file as the
// page holds it, button and field classes, and the message boxes.

import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { MappingGuess, StatementCsv } from '@/lib/finance/csv-import/types';

/** A statement that was read in the browser and is ready for the columns step. */
export interface ParsedFile {
  /** The text that is sent to the server. */
  text: string;
  /** Null when the text was pasted. */
  fileName: string | null;
  table: StatementCsv;
  detected: MappingGuess;
  /** Goes up each time a new file or pasted text is read, so settings are rebuilt for it. */
  version: number;
}

// White on sky-700 is about 5.9:1, so button text passes WCAG AA; sky-600 does not.
export const primaryButton =
  'min-h-11 inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-sky-700 text-white text-sm font-medium hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition';

export const secondaryButton =
  'min-h-11 inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition';

export const dangerButton =
  'min-h-11 inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg border border-red-300 bg-white text-red-700 text-sm font-medium hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition';

export const textLink =
  'min-h-11 inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-900 underline underline-offset-2';

export const fieldLabel = 'block text-sm font-medium text-gray-800 mb-1';

export const fieldHint = 'text-xs text-gray-600 mt-1';

export const selectInput =
  'w-full min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500';

export const card = 'bg-white border border-gray-200 rounded-xl p-4 sm:p-5';

/** An error the person needs to act on. Announced as soon as it appears. */
export function ErrorNotice({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 ${className}`}
    >
      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
}

/** Progress or a result. Announced politely. */
export function StatusNotice({
  children,
  tone = 'info',
  className = '',
}: {
  children: React.ReactNode;
  tone?: 'info' | 'success' | 'warning';
  className?: string;
}) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    success: 'border-green-200 bg-green-50 text-green-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  } as const;
  const icons = {
    info: <Info className="w-5 h-5 shrink-0 mt-0.5 text-sky-700" aria-hidden="true" />,
    success: <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-green-700" aria-hidden="true" />,
    warning: <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />,
  } as const;
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${tones[tone]} ${className}`}
    >
      {icons[tone]}
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
}
