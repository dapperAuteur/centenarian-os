'use client';

// components/settings/StatementsUploadSection.tsx
// "Statements" on the Settings page: one box that takes a CSV or PDF
// statement and opens the Finance import with that file already loaded.
//
// The file is handed to the import page in memory (lib/finance/pdf-import/
// client.ts) during a client-side navigation, so it is never written to
// browser storage or sent anywhere before the import page reads it. If the
// handoff is lost (a full reload), the import page opens with its file input
// focused instead.

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileUp, XCircle } from 'lucide-react';
import {
  MAX_PDF_FILE_BYTES,
  PDF_TOO_LARGE_TEXT,
  isPdfFile,
  isStatementFile,
  setPendingStatementFile,
} from '@/lib/finance/pdf-import/client';

const IMPORT_URL = '/dashboard/finance/import?from=settings';

export default function StatementsUploadSection() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const pdf = isPdfFile(file);
    if (!isStatementFile(file)) {
      setError('Choose a CSV or PDF statement.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (pdf && file.size > MAX_PDF_FILE_BYTES) {
      setError(PDF_TOO_LARGE_TEXT);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setError(null);
    setPendingStatementFile(file);
    router.push(IMPORT_URL);
  }

  return (
    <section
      aria-labelledby="settings-statements-heading"
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mt-6"
    >
      <div className="flex items-center gap-2 mb-1">
        <FileUp className="w-5 h-5 text-fuchsia-600" aria-hidden="true" />
        <h2 id="settings-statements-heading" className="text-base font-semibold text-gray-800">
          Statements
        </h2>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Upload a bank or card statement as a CSV or PDF. It opens in the Finance import, where you pick the account
        (a PDF statement usually picks it for you) and check every row before anything is saved. PDFs are read inside
        CentenarianOS and never sent to any other service.
      </p>
      <label htmlFor="settings-statement-file" className="block text-sm font-medium text-gray-800 mb-1">
        Statement file (CSV or PDF)
      </label>
      <input
        id="settings-statement-file"
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,.txt,.tsv,.pdf,application/pdf,.xls,.xlsx"
        onChange={handleChosen}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'settings-statement-hint settings-statement-error' : 'settings-statement-hint'}
        className="block w-full text-sm text-gray-700 file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border-0 file:bg-sky-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-sky-800 hover:file:bg-sky-100"
      />
      <p id="settings-statement-hint" className="text-xs text-gray-600 mt-1">
        Text PDFs only; scanned statements can&apos;t be read. Up to 10 MB. Excel workbooks can&apos;t be read: use the
        PDF statement instead.
      </p>
      {error && (
        <p id="settings-statement-error" role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-medium text-red-700">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="sr-only">Error: </span>
            {error}
          </span>
        </p>
      )}
      <Link
        href={IMPORT_URL}
        className="mt-2 min-h-11 inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-900 underline underline-offset-2"
      >
        Or open the statement import
      </Link>
    </section>
  );
}
