'use client';

// app/dashboard/settings/calendar/event-builder/cheat-sheet/page.tsx
// The printable calendar event cheat sheet. Renders buildCheatSheetMarkdown(), the same text as
// public/templates/calendar-event-cheat-sheet.md, so the page, the file and the parser's word
// lists cannot drift apart. Print CSS hides the dashboard around the sheet.
//
// The markdown is our own constant text (no user input), so rendering it as HTML is safe.

import { useMemo } from 'react';
import Link from 'next/link';
import { marked } from 'marked';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { buildCheatSheetMarkdown } from '@/lib/capture/event-templates';

export default function CalendarCheatSheetPage() {
  const html = useMemo(() => marked.parse(buildCheatSheetMarkdown(), { async: false }) as string, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <Link
          href="/dashboard/settings/calendar/event-builder"
          className="min-h-11 inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-800"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to the event builder
        </Link>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            Print
          </button>
          <a
            href="/templates/calendar-event-cheat-sheet.md"
            download="calendar-event-cheat-sheet.md"
            className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-sky-800 bg-white border border-sky-300 hover:bg-sky-50 rounded-lg transition"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Download (.md)
          </a>
        </div>
      </div>

      <article
        id="calendar-cheat-sheet"
        className="prose prose-sm max-w-none bg-white border border-gray-200 rounded-2xl p-6 print:border-0 print:p-0 prose-table:text-xs prose-code:before:content-none prose-code:after:content-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <style jsx global>{`
        @media print {
          @page {
            margin: 12mm;
          }
          body * {
            visibility: hidden;
          }
          #calendar-cheat-sheet,
          #calendar-cheat-sheet * {
            visibility: visible;
          }
          #calendar-cheat-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            font-size: 10pt;
          }
        }
      `}</style>
    </div>
  );
}
