'use client';

// components/finance/import/AccountFileStep.tsx
// Step 1 of the statement import: choose the account (required), then give
// the statement as a file or as pasted text. A CSV is read and parsed in the
// browser, so it works without a connection and can say what it found before
// anything is sent. A PDF is read by CentenarianOS's own server (never by any
// other service), which says what statement it is and which account ends in
// the same four digits.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, FileText, Loader2, X } from 'lucide-react';
import { detectMapping, parseStatementCsv } from '@/lib/finance/csv-import/parse';
import type { StatementCsv } from '@/lib/finance/csv-import/types';
import {
  TOO_LARGE_TEXT,
  accountLabel,
  certainlyTooLarge,
  describeDetection,
  fileSizeProblem,
  formatIsoDate,
  rowCountProblem,
  sortAccountsForPicker,
  type ImportAccount,
} from '@/lib/finance/csv-import/ui-helpers';
import { MAX_PDF_FILE_BYTES, PDF_TOO_LARGE_TEXT, fileToBase64, isPdfFile } from '@/lib/finance/pdf-import/client';
import { inspectPdfStatement } from './api';
import {
  ErrorNotice,
  StatusNotice,
  card,
  fieldHint,
  fieldLabel,
  primaryButton,
  secondaryButton,
  selectInput,
  textLink,
  type ParsedFile,
  type PdfFile,
} from './shared';

interface AccountFileStepProps {
  accounts: ImportAccount[];
  accountsState: 'loading' | 'ready' | 'error';
  accountsError: string | null;
  onRetryAccounts: () => void;
  accountId: string;
  onAccountChange: (accountId: string) => void;
  file: ParsedFile | null;
  /** A statement that was read and passed every check, or null to clear the current one. */
  onFileRead: (file: Omit<ParsedFile, 'version'> | null) => void;
  pasteText: string;
  onPasteTextChange: (text: string) => void;
  onContinue: () => void;
  /** A PDF statement the server read, or null. */
  pdfFile: PdfFile | null;
  /** A PDF that was read and recognized, or null to clear the current one. */
  onPdfRead: (file: Omit<PdfFile, 'version'> | null) => void;
  /** A file chosen on another page (Settings) to load as soon as this step shows. */
  initialFile?: File | null;
  onInitialFileUsed?: () => void;
  /** Put focus on the file input when the step first shows. */
  autoFocusFile?: boolean;
}

/** "Best Buy credit card (Citibank) statement, Dec 28, 2025 to Jan 27, 2026." */
function pdfHeadline(pdf: PdfFile): string {
  const { statement } = pdf;
  const { start, end } = statement.period;
  const period = start && end ? `, ${formatIsoDate(start)} to ${formatIsoDate(end)}` : end ? `, closing ${formatIsoDate(end)}` : '';
  const what = statement.issuer === 'generic' ? 'A statement in a layout CentenarianOS does not know yet' : `${statement.issuerLabel} statement`;
  return `${what}${period}.`;
}

export default function AccountFileStep({
  accounts,
  accountsState,
  accountsError,
  onRetryAccounts,
  accountId,
  onAccountChange,
  file,
  onFileRead,
  pasteText,
  onPasteTextChange,
  onContinue,
  pdfFile,
  onPdfRead,
  initialFile = null,
  onInitialFileUsed,
  autoFocusFile = false,
}: AccountFileStepProps) {
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const accountRef = useRef<HTMLSelectElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sortedAccounts = sortAccountsForPicker(accounts);
  const accountMissing = attempted && !accountId;
  const fileMissing = attempted && !file && !pdfFile && !fileError;
  const initialHandledRef = useRef(false);

  /** Checks the text, parses it, and hands the result up. Nothing leaves the browser here. */
  function loadText(text: string, fileName: string | null) {
    const refuse = (message: string) => {
      setFileError(message);
      onFileRead(null);
    };

    const sizeProblem = fileSizeProblem(text.length);
    if (sizeProblem) return refuse(sizeProblem);
    if (text.trim() === '') return refuse('There is nothing in that file.');

    let table: StatementCsv;
    try {
      table = parseStatementCsv(text);
    } catch {
      return refuse("This file couldn't be read as a CSV. Download it again from your bank as CSV and try once more.");
    }
    const rowProblem = rowCountProblem(table.rows.length);
    if (rowProblem) return refuse(rowProblem);

    setFileError(null);
    onFileRead({ text, fileName, table, detected: detectMapping(table.headers, table.rows) });
  }

  /** Sends a PDF to this app's server to be read. Nothing is saved, and it goes nowhere else. */
  async function loadPdf(chosen: File) {
    const refuse = (message: string) => {
      setFileError(message);
      onPdfRead(null);
    };
    if (chosen.size > MAX_PDF_FILE_BYTES) return refuse(PDF_TOO_LARGE_TEXT);
    if (!navigator.onLine) {
      return refuse('Reading a PDF statement needs a connection. Reconnect and choose the file again, or use a CSV, which works offline.');
    }
    setReading(true);
    try {
      const base64 = await fileToBase64(chosen);
      const response = await inspectPdfStatement({ pdf_base64: base64, file_name: chosen.name });
      if (!response.ok) return refuse(response.message);
      setFileError(null);
      onPdfRead({
        base64,
        fileName: chosen.name,
        statement: response.data.statement,
        matchingAccountIds: response.data.matchingAccountIds,
      });
    } catch {
      refuse("The file couldn't be opened. Choose it again.");
    } finally {
      setReading(false);
    }
  }

  async function loadChosenFile(chosen: File) {
    if (isPdfFile(chosen)) return loadPdf(chosen);
    // Far past the limit in any encoding: don't read it into memory at all.
    if (certainlyTooLarge(chosen.size)) {
      setFileError(TOO_LARGE_TEXT);
      onFileRead(null);
      return;
    }
    setReading(true);
    try {
      loadText(await chosen.text(), chosen.name);
    } catch {
      setFileError("The file couldn't be opened. Choose it again.");
      onFileRead(null);
    } finally {
      setReading(false);
    }
  }

  async function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    await loadChosenFile(chosen);
  }

  // Opened from Settings without a file: land on the file input.
  useEffect(() => {
    if (initialHandledRef.current) return;
    initialHandledRef.current = true;
    if (autoFocusFile && !initialFile) fileInputRef.current?.focus();
    // Runs once, when the step first shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A file handed over from Settings is loaded as soon as it arrives, once.
  useEffect(() => {
    if (!initialFile) return;
    onInitialFileUsed?.();
    void loadChosenFile(initialFile);
    // Keyed on the file alone: the handlers are recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  function handleUsePastedText() {
    if (pasteText.trim() === '') {
      setFileError('Paste the statement text into the box first.');
      onFileRead(null);
      return;
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    loadText(pasteText, null);
  }

  function handleRemoveFile() {
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFileError(null);
    onFileRead(null);
    onPdfRead(null);
  }

  function handleContinue() {
    setAttempted(true);
    if (!accountId) {
      accountRef.current?.focus();
      return;
    }
    if (!file && !pdfFile) {
      fileInputRef.current?.focus();
      return;
    }
    onContinue();
  }

  const detection = file ? describeDetection(file.detected, file.table) : null;
  const pdfLastFour = pdfFile?.statement.accountLastFour ?? null;
  const matchedAccounts = pdfFile ? accounts.filter((account) => pdfFile.matchingAccountIds.includes(account.id)) : [];

  return (
    <div className="space-y-5">
      {/* Account */}
      <section className={card} aria-labelledby="import-account-heading">
        <h3 id="import-account-heading" className="text-base font-semibold text-gray-900">
          Which account is this statement for?
        </h3>

        {accountsState === 'loading' && (
          <p role="status" className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading your accounts...
          </p>
        )}

        {accountsState === 'error' && (
          <div className="mt-3 space-y-3">
            <ErrorNotice>
              <p>{accountsError ?? 'Your accounts could not be loaded.'}</p>
            </ErrorNotice>
            <button type="button" onClick={onRetryAccounts} className={secondaryButton}>
              Try again
            </button>
          </div>
        )}

        {accountsState === 'ready' && accounts.length === 0 && (
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            <p>You have no accounts yet. A statement is always imported into an account, so add one first.</p>
            <Link href="/dashboard/finance/accounts" className={textLink}>
              Add an account
            </Link>
          </div>
        )}

        {accountsState === 'ready' && accounts.length > 0 && (
          <div className="mt-3">
            <label htmlFor="import-account" className={fieldLabel}>
              Account <span className="font-normal text-gray-600">(required)</span>
            </label>
            <select
              id="import-account"
              ref={accountRef}
              required
              aria-required="true"
              aria-invalid={accountMissing}
              aria-describedby={accountMissing ? 'import-account-hint import-account-error' : 'import-account-hint'}
              value={accountId}
              onChange={(event) => onAccountChange(event.target.value)}
              className={selectInput}
            >
              <option value="">Choose an account</option>
              {sortedAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountLabel(account)}
                  {account.is_active === false ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
            <p id="import-account-hint" className={fieldHint}>
              Every transaction in the file goes into this account. Each option shows the bank, the account name and
              its last four digits.
            </p>
            {accountMissing && (
              <p id="import-account-error" role="alert" className="mt-1 text-sm font-medium text-red-700">
                Choose the account this statement belongs to.
              </p>
            )}
            <Link href="/dashboard/finance/accounts" className={`${textLink} mt-1`}>
              Account not listed? Add it on the Accounts page
            </Link>
          </div>
        )}
      </section>

      {/* File or pasted text */}
      <section className={card} aria-labelledby="import-file-heading">
        <h3 id="import-file-heading" className="text-base font-semibold text-gray-900">
          The statement
        </h3>
        <p className="mt-1 text-sm text-gray-700">
          Download your statement from your bank or card&apos;s website as a CSV file or a PDF, then choose that file
          here.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div>
            <label htmlFor="import-file" className={fieldLabel}>
              Statement file (CSV or PDF)
            </label>
            <input
              id="import-file"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,.pdf,application/pdf"
              onChange={handleFileChosen}
              aria-invalid={fileMissing || Boolean(fileError)}
              aria-describedby="import-file-messages"
              className="block w-full text-sm text-gray-700 file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border-0 file:bg-sky-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-sky-800 hover:file:bg-sky-100"
            />
            <p className={fieldHint}>
              A CSV is read on this device first. A PDF is read by CentenarianOS itself and never sent to any other
              service; only text PDFs work, not scans. Nothing is saved until you confirm in the review step.
            </p>
          </div>

          <div>
            <label htmlFor="import-paste" className={fieldLabel}>
              Or paste the statement text
            </label>
            <textarea
              id="import-paste"
              rows={4}
              value={pasteText}
              onChange={(event) => onPasteTextChange(event.target.value)}
              spellCheck={false}
              className="w-full rounded-lg border border-gray-300 p-2 font-mono text-xs text-gray-900"
              placeholder={'Date,Description,Amount\n01/13/2026,Coffee shop,-4.75'}
            />
            <button type="button" onClick={handleUsePastedText} className={`${secondaryButton} mt-2 w-full sm:w-auto`}>
              Use pasted text
            </button>
          </div>
        </div>

        <div id="import-file-messages" className="mt-4 space-y-3">
          {reading && (
            <p role="status" className="flex items-center gap-2 text-sm text-gray-700">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Reading the file...
            </p>
          )}

          {fileError && (
            <ErrorNotice>
              <p>{fileError}</p>
            </ErrorNotice>
          )}

          {fileMissing && (
            <ErrorNotice>
              <p>Choose a CSV or PDF file, or paste CSV text and press &quot;Use pasted text&quot;.</p>
            </ErrorNotice>
          )}

          {pdfFile && (
            <StatusNotice tone={pdfFile.statement.confidence === 'high' ? 'success' : 'warning'}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-medium">
                  <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="break-all">{pdfFile.fileName}</span>
                </p>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="min-h-11 inline-flex items-center gap-1 rounded-lg px-3 text-sm font-medium underline underline-offset-2 hover:bg-white/60"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Remove
                </button>
              </div>
              <p>{pdfHeadline(pdfFile)}</p>
              <ul className="list-disc space-y-0.5 pl-5">
                <li>
                  {pdfFile.statement.rowCount.toLocaleString('en-US')}{' '}
                  {pdfFile.statement.rowCount === 1 ? 'transaction' : 'transactions'} found on{' '}
                  {pdfFile.statement.pageCount} {pdfFile.statement.pageCount === 1 ? 'page' : 'pages'}.
                </li>
                {pdfLastFour && matchedAccounts.length === 1 && (
                  <li>Account ending {pdfLastFour}: matched to {accountLabel(matchedAccounts[0])}.</li>
                )}
                {pdfLastFour && matchedAccounts.length > 1 && (
                  <li>Account ending {pdfLastFour}: more than one of your accounts ends in those digits, so choose it above.</li>
                )}
                {pdfLastFour && matchedAccounts.length === 0 && (
                  <li>Account ending {pdfLastFour}: none of your accounts ends in those digits, so choose it above.</li>
                )}
                {!pdfFile.statement.reconciliation.ok && (
                  <li>
                    {pdfFile.statement.reconciliation.checked
                      ? "The statement's totals don't add up. The review step shows the differences."
                      : "The statement's totals couldn't be checked. The review step says why."}
                  </li>
                )}
                {pdfFile.statement.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </StatusNotice>
          )}

          {file && detection && (
            <StatusNotice tone="success">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-medium">
                  <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="break-all">{file.fileName ?? 'Pasted text'}</span>
                </p>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="min-h-11 inline-flex items-center gap-1 rounded-lg px-3 text-sm font-medium text-green-900 underline underline-offset-2 hover:bg-green-100"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Remove
                </button>
              </div>
              <p>{detection.headline}</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {detection.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
              {file.table.warnings.length > 0 && (
                <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
                  <p className="font-medium">Check these before you continue:</p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {file.table.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </StatusNotice>
          )}
        </div>

        <p className="mt-4 text-sm text-gray-700">
          No bank export? Fill in the simple template (date, amount, type, description, vendor, category) and import
          it the same way.
        </p>
        <a href="/templates/finance-import-template.csv" download className={textLink}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Download the simple template
        </a>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={handleContinue} disabled={reading} className={primaryButton}>
          {pdfFile ? 'Continue to review' : 'Continue to columns'}
        </button>
      </div>
    </div>
  );
}
