'use client';

// components/finance/import/shared.tsx
// Pieces every step of the statement import shares: the parsed file as the
// page holds it, button and field classes, and the message boxes.

import { AlertTriangle, CheckCircle2, Info, MinusCircle, XCircle } from 'lucide-react';
import { TONE_CLASSES, type StatusTone } from '@/lib/finance/csv-import/status-tones';
import type { MappingGuess, StatementCsv } from '@/lib/finance/csv-import/types';
import type { StatementPreview } from '@/lib/finance/pdf-import/service';

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

/** A statement PDF that the server read and recognized, ready for the review step. */
export interface PdfFile {
  /** The PDF, base64, sent again at preview and commit. */
  base64: string;
  fileName: string;
  /** What the server found in it. */
  statement: StatementPreview;
  /** The person's accounts with the statement's last four digits. */
  matchingAccountIds: string[];
  /** Goes up each time a new file is read. */
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

/** The icon for each tone: color is never the only signal. */
export function ToneIcon({ tone, className = 'w-5 h-5' }: { tone: StatusTone; className?: string }) {
  const classes = `${className} shrink-0 ${TONE_CLASSES[tone].icon}`;
  switch (tone) {
    case 'success':
      return <CheckCircle2 className={classes} aria-hidden="true" />;
    case 'attention':
      return <AlertTriangle className={classes} aria-hidden="true" />;
    case 'error':
      return <XCircle className={classes} aria-hidden="true" />;
    case 'info':
      return <Info className={classes} aria-hidden="true" />;
    default:
      return <MinusCircle className={classes} aria-hidden="true" />;
  }
}

/** An error the person needs to act on. Announced as soon as it appears. */
export function ErrorNotice({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${TONE_CLASSES.error.box} ${className}`}
    >
      <ToneIcon tone="error" className="w-5 h-5 mt-0.5" />
      <div className="min-w-0 space-y-1">
        <span className="sr-only">{TONE_CLASSES.error.srLabel} </span>
        {children}
      </div>
    </div>
  );
}

/**
 * A message box on the import's one color scale (lib/finance/csv-import/status-tones.ts):
 * success (green) only for something done and fine, attention (amber) for
 * something to check or decide, info (sky) for information. Errors use
 * ErrorNotice. 'warning' is the old name for 'attention'.
 *
 * Announced politely (role=status); pass `alert` for something that blocks
 * the next step and must be heard at once.
 */
export function StatusNotice({
  children,
  tone = 'info',
  className = '',
  alert = false,
  id,
}: {
  children: React.ReactNode;
  tone?: Exclude<StatusTone, 'error'> | 'warning';
  className?: string;
  alert?: boolean;
  id?: string;
}) {
  const resolved: StatusTone = tone === 'warning' ? 'attention' : tone;
  const label = TONE_CLASSES[resolved].srLabel;
  return (
    <div
      id={id}
      role={alert ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${TONE_CLASSES[resolved].box} ${className}`}
    >
      <ToneIcon tone={resolved} className="w-5 h-5 mt-0.5" />
      <div className="min-w-0 space-y-1">
        {label && <span className="sr-only">{label} </span>}
        {children}
      </div>
    </div>
  );
}

/** A small status chip: an icon and words, on the same color scale. */
export function StatusChip({
  tone,
  children,
  className = '',
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone].chip} ${className}`}
    >
      <ToneIcon tone={tone} className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}
