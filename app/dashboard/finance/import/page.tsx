'use client';

// app/dashboard/finance/import/page.tsx
// Import a bank or card statement (CSV or PDF) into one account, in four steps:
//   1 Account and file  -> AccountFileStep (a CSV is parsed in the browser; a
//                          PDF is read by POST /api/finance/import/pdf)
//   2 Columns           -> ColumnsStep (mapping, sign convention, date order;
//                          skipped for a PDF, whose layout the server knows)
//   3 Review            -> ReviewStep (POST /api/finance/import/preview), with
//                          the statement summary and reconciliation for a PDF
//   4 Done              -> DoneStep (POST /api/finance/import), with Undo
// plus the Import history list under steps 1 and 4.
//
// All state lives here so Back keeps what was entered. The server parses the
// file again itself: this page only ever sends the file (CSV text or PDF
// base64), the settings, and what to do with each row number.
//
// ?from=settings: opened from the Statements box on Settings. A file chosen
// there is handed over in memory (lib/finance/pdf-import/client.ts) and
// loaded straight away; without one, the file input gets focus.

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Upload } from 'lucide-react';
import type { BudgetCategory } from '@/components/finance/CategorySelect';
import AccountFileStep from '@/components/finance/import/AccountFileStep';
import ColumnsStep from '@/components/finance/import/ColumnsStep';
import DoneStep from '@/components/finance/import/DoneStep';
import ImportHistory, { batchTitle } from '@/components/finance/import/ImportHistory';
import ReviewStep from '@/components/finance/import/ReviewStep';
import StepIndicator, { type ImportStep } from '@/components/finance/import/StepIndicator';
import UndoImportDialog from '@/components/finance/import/UndoImportDialog';
import {
  commitPdfStatement,
  commitStatement,
  fetchTransferSuggestionCount,
  listImportBatches,
  previewPdfStatement,
  previewStatement,
  saveAccountMapping,
  undoImportBatch,
  type PdfStatementPayload,
  type StatementPayload,
} from '@/components/finance/import/api';
import { ErrorNotice, StatusNotice, type ParsedFile, type PdfFile } from '@/components/finance/import/shared';
import { useOnline } from '@/components/finance/import/useOnline';
import type { ImportBatchSummary, PreviewResponse } from '@/lib/finance/csv-import/service';
import type { CommitResult, SavedCsvMapping, UndoResult } from '@/lib/finance/csv-import/types';
import { takePendingStatementFile } from '@/lib/finance/pdf-import/client';
import type { PdfPreviewResponse } from '@/lib/finance/pdf-import/service';
import {
  MIGRATION_REQUIRED_TEXT,
  NETWORK_ERROR_TEXT,
  OFFLINE_TEXT,
  accountLabel,
  buildRowActions,
  cleanMapping,
  importErrorText,
  importedDateRange,
  initialSettings,
  readSavedMapping,
  type Decisions,
  type ImportAccount,
  type ImportSettings,
  type InitialSettings,
} from '@/lib/finance/csv-import/ui-helpers';
import { offlineFetch } from '@/lib/offline/offline-fetch';

type LoadState = 'loading' | 'ready' | 'error';

type SettingsOrigin = Pick<InitialSettings, 'mappingSource' | 'signSource' | 'savedIgnored'>;

/** A preview, with the statement summary when the file was a PDF. */
type Preview = PreviewResponse & Partial<Pick<PdfPreviewResponse, 'statement' | 'accountMatchesStatement'>>;

const STEP_HEADINGS: Record<ImportStep, string> = {
  1: 'Choose the account and the statement',
  2: 'Check the columns',
  3: 'Review what will be imported',
  4: 'Import finished',
};

export default function FinanceImportPage() {
  return (
    // useSearchParams (for ?account=) needs a Suspense boundary above it.
    <Suspense
      fallback={
        <div role="status" className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-gray-700">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading...
        </div>
      }
    >
      <StatementImport />
    </Suspense>
  );
}

function StatementImport() {
  const searchParams = useSearchParams();
  const requestedAccountId = searchParams.get('account') ?? '';
  const fromSettings = searchParams.get('from') === 'settings';
  const online = useOnline();

  // What the page loads once.
  const [accounts, setAccounts] = useState<ImportAccount[]>([]);
  const [accountsState, setAccountsState] = useState<LoadState>('loading');
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [batches, setBatches] = useState<ImportBatchSummary[]>([]);
  const [batchesState, setBatchesState] = useState<LoadState>('loading');
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [migrationNeeded, setMigrationNeeded] = useState(false);

  // Steps 1 and 2: what the person entered.
  const [step, setStep] = useState<ImportStep>(1);
  const [accountId, setAccountId] = useState('');
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [pdfFile, setPdfFile] = useState<PdfFile | null>(null);
  /** A file chosen on Settings, waiting to be loaded by step 1. */
  const [handedOverFile, setHandedOverFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<ImportSettings | null>(null);
  const [origin, setOrigin] = useState<SettingsOrigin | null>(null);
  /** The account and file the settings were built for: a new pair gets fresh settings. */
  const settingsKeyRef = useRef('');
  const fileVersionRef = useRef(0);

  // Step 3: the server's plan and the changes made to it.
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmUnreconciled, setConfirmUnreconciled] = useState(false);
  const [decisions, setDecisions] = useState<Decisions>({});
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  /** Goes up whenever the preview is thrown away, so a late answer to an old request is ignored. */
  const previewTokenRef = useRef(0);

  // Step 4: the outcome.
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [resultAccountName, setResultAccountName] = useState('');
  const [resultTitle, setResultTitle] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [transferCount, setTransferCount] = useState(0);
  const [statementNotice, setStatementNotice] = useState<{ saved: boolean; error?: string } | null>(null);

  // Undo, from step 4 or from the history list.
  const [undoTarget, setUndoTarget] = useState<{ id: string; label: string } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const undoBusyRef = useRef(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [resultUndo, setResultUndo] = useState<UndoResult | null>(null);
  const [historyUndo, setHistoryUndo] = useState<UndoResult | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusedStepRef = useRef<ImportStep>(1);

  const account = accounts.find((candidate) => candidate.id === accountId) ?? null;

  // ── Loading ─────────────────────────────────────────────────────────────

  const loadAccounts = useCallback(async () => {
    setAccountsState('loading');
    setAccountsError(null);
    try {
      // offlineFetch: a cached account list still lets steps 1 and 2 work offline.
      const response = await offlineFetch('/api/finance/accounts');
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(body)) {
        setAccountsError(
          navigator.onLine
            ? importErrorText(response.status, body)
            : 'Your accounts could not be loaded while offline. Reconnect and try again.',
        );
        setAccountsState('error');
        return;
      }
      const loaded = body as ImportAccount[];
      setAccounts(loaded);
      setAccountsState('ready');
      // Preselect the account the link asked for, or the only one there is.
      const requested = loaded.find((candidate) => candidate.id === requestedAccountId);
      const preselect = requested?.id ?? (loaded.length === 1 ? loaded[0].id : '');
      if (preselect) setAccountId((current) => current || preselect);
    } catch {
      setAccountsError(NETWORK_ERROR_TEXT);
      setAccountsState('error');
    }
  }, [requestedAccountId]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await offlineFetch('/api/finance/categories');
      if (!response.ok) return;
      const body: unknown = await response.json().catch(() => null);
      const list = (body as { categories?: unknown } | null)?.categories;
      if (Array.isArray(list)) setCategories(list as BudgetCategory[]);
    } catch {
      // Without the list, rows can still be imported; they keep their suggested category.
    }
  }, []);

  const loadBatches = useCallback(async (quiet = false) => {
    if (!quiet) setBatchesState('loading');
    setBatchesError(null);
    const response = await listImportBatches();
    if (response.ok) {
      setBatches(Array.isArray(response.data?.batches) ? response.data.batches : []);
      setBatchesState('ready');
      return;
    }
    if (response.code === 'migration_required') setMigrationNeeded(true);
    setBatchesError(response.message);
    setBatchesState('error');
  }, []);

  useEffect(() => {
    void loadAccounts();
    void loadCategories();
    void loadBatches();
  }, [loadAccounts, loadCategories, loadBatches]);

  // A statement chosen on Settings, handed over in memory (never stored).
  useEffect(() => {
    const handed = takePendingStatementFile();
    if (handed) setHandedOverFile(handed);
  }, []);

  // Moving to another step puts focus on its heading, so a screen reader starts at the top of it.
  // Compared against the last step seen, so nothing takes focus when the page first loads.
  useEffect(() => {
    if (focusedStepRef.current === step) return;
    focusedStepRef.current = step;
    headingRef.current?.focus();
  }, [step]);

  // ── Steps 1 and 2 ───────────────────────────────────────────────────────

  /** The plan belongs to one account, file and set of settings: any change to those discards it. */
  function discardPreview() {
    previewTokenRef.current += 1;
    setPreview(null);
    setDecisions({});
    setPreviewError(null);
    setImportError(null);
    setConfirmUnreconciled(false);
  }

  function handleAccountChange(nextAccountId: string) {
    setAccountId(nextAccountId);
    discardPreview();
  }

  function handleFileRead(next: Omit<ParsedFile, 'version'> | null) {
    if (next) {
      fileVersionRef.current += 1;
      setFile({ ...next, version: fileVersionRef.current });
      setPdfFile(null);
    } else {
      setFile(null);
    }
    discardPreview();
  }

  function handlePdfRead(next: Omit<PdfFile, 'version'> | null) {
    if (next) {
      fileVersionRef.current += 1;
      setPdfFile({ ...next, version: fileVersionRef.current });
      setFile(null);
      // The statement names its account by the last four digits: choose it when exactly one account fits.
      if (next.matchingAccountIds.length === 1) setAccountId(next.matchingAccountIds[0]);
    } else {
      setPdfFile(null);
    }
    discardPreview();
  }

  function goToColumns() {
    // A PDF has no columns to map: its layout is known to the server.
    if (pdfFile && account) {
      void goToReview();
      return;
    }
    if (!file || !account) return;
    const key = `${account.id}:${file.version}`;
    if (settingsKeyRef.current !== key || !settings) {
      const initial = initialSettings({
        saved: readSavedMapping(account.csv_import_mapping),
        detected: file.detected,
        table: file.table,
        accountType: account.account_type,
      });
      setSettings(initial.settings);
      setOrigin({
        mappingSource: initial.mappingSource,
        signSource: initial.signSource,
        savedIgnored: initial.savedIgnored,
      });
      settingsKeyRef.current = key;
    }
    setStep(2);
  }

  function handleSettingsChange(next: ImportSettings) {
    // "Remember these settings" doesn't change how the file is read, so the plan stays good.
    const sameReading =
      settings !== null &&
      next.mapping === settings.mapping &&
      next.sign === settings.sign &&
      next.dateOrder === settings.dateOrder &&
      next.includePending === settings.includePending;
    setSettings(next);
    if (!sameReading) discardPreview();
  }

  /** What preview and commit are both sent: the same file, read the same way. */
  function buildPayload(): StatementPayload | null {
    if (!file || !account || !settings || !settings.dateOrder) return null;
    const saved = readSavedMapping(account.csv_import_mapping);
    return {
      account_id: account.id,
      csv_text: file.text,
      mapping: cleanMapping(settings.mapping, settings.sign),
      sign: settings.sign,
      dateOrder: settings.dateOrder,
      include_pending: settings.includePending,
      file_name: file.fileName,
      preset: origin?.mappingSource === 'saved' && saved?.preset ? saved.preset : file.detected.preset,
    };
  }

  function buildPdfPayload(): PdfStatementPayload | null {
    if (!pdfFile || !account) return null;
    return { account_id: account.id, pdf_base64: pdfFile.base64, file_name: pdfFile.fileName };
  }

  // ── Step 3 ──────────────────────────────────────────────────────────────

  async function goToReview() {
    // Nothing changed since the last preview: keep it, and the choices made on it.
    if (preview) {
      setStep(3);
      return;
    }
    const pdfPayload = buildPdfPayload();
    const payload = pdfPayload ? null : buildPayload();
    if ((!payload && !pdfPayload) || previewBusy) return;
    if (!navigator.onLine) {
      setPreviewError(OFFLINE_TEXT);
      return;
    }

    const token = previewTokenRef.current;
    setPreviewBusy(true);
    setPreviewError(null);
    const response: Awaited<ReturnType<typeof previewStatement>> = pdfPayload
      ? await previewPdfStatement(pdfPayload)
      : await previewStatement(payload as StatementPayload);
    setPreviewBusy(false);
    // The settings changed while this was on its way: its answer is for a file read differently.
    if (token !== previewTokenRef.current) return;

    if (!response.ok) {
      if (response.code === 'migration_required') setMigrationNeeded(true);
      setPreviewError(response.message);
      return;
    }
    setPreview(response.data);
    setDecisions({});
    setStep(3);
  }

  async function runImport() {
    if (pdfFile) {
      await runPdfImport();
      return;
    }
    const payload = buildPayload();
    if (!payload || !preview || !settings || importBusy) return;
    if (!navigator.onLine) {
      setImportError(OFFLINE_TEXT);
      return;
    }

    setImportBusy(true);
    setImportError(null);
    setStatementNotice(null);
    const response = await commitStatement({ ...payload, actions: buildRowActions(preview.rows, decisions) });
    setImportBusy(false);

    if (!response.ok) {
      if (response.code === 'migration_required') setMigrationNeeded(true);
      setImportError(
        response.code === 'network'
          ? `${response.message} If the import did go through, importing this file again is safe: rows that are already in the account are skipped.`
          : response.message,
      );
      return;
    }

    const committed = response.data;
    setResult(committed);
    setResultAccountName(accountLabel(preview.account));
    setResultTitle(payload.file_name ?? 'Pasted text');
    setResultUndo(null);
    setHistoryUndo(null);
    setSettingsSaved(false);
    setSettingsError(null);
    setTransferCount(0);
    setStep(4);
    void loadBatches(true);

    if (settings.remember) {
      const saved: SavedCsvMapping = {
        mapping: payload.mapping,
        sign: payload.sign,
        dateOrder: payload.dateOrder,
        includePending: payload.include_pending,
        ...(payload.preset ? { preset: payload.preset } : {}),
      };
      void saveAccountMapping(payload.account_id, saved).then((savedResponse) => {
        if (!savedResponse.ok) {
          setSettingsError(savedResponse.message);
          return;
        }
        setSettingsSaved(true);
        setAccounts((current) =>
          current.map((candidate) =>
            candidate.id === payload.account_id ? { ...candidate, csv_import_mapping: saved } : candidate,
          ),
        );
      });
    }

    // Transfer tracking ships separately: where its route is missing this stays 0 and shows nothing.
    const range = importedDateRange(preview.rows, decisions);
    if (range && committed.inserted + committed.linked > 0) {
      void fetchTransferSuggestionCount(range.from, range.to).then(setTransferCount);
    }
  }

  async function runPdfImport() {
    const payload = buildPdfPayload();
    if (!payload || !preview || importBusy) return;
    if (!navigator.onLine) {
      setImportError(OFFLINE_TEXT);
      return;
    }

    setImportBusy(true);
    setImportError(null);
    const response = await commitPdfStatement({
      ...payload,
      actions: buildRowActions(preview.rows, decisions),
      confirm_unreconciled: confirmUnreconciled,
    });
    setImportBusy(false);

    if (!response.ok) {
      if (response.code === 'migration_required') setMigrationNeeded(true);
      setImportError(
        response.code === 'network'
          ? `${response.message} If the import did go through, importing this file again is safe: rows that are already in the account are skipped.`
          : response.message,
      );
      return;
    }

    const committed = response.data;
    setResult(committed);
    setResultAccountName(accountLabel(preview.account));
    setResultTitle(payload.file_name ?? 'PDF statement');
    setResultUndo(null);
    setHistoryUndo(null);
    setSettingsSaved(false);
    setSettingsError(null);
    setTransferCount(0);
    setStatementNotice({ saved: committed.statementSaved, error: committed.statementError });
    setStep(4);
    void loadBatches(true);

    const range = importedDateRange(preview.rows, decisions);
    if (range && committed.inserted + committed.linked > 0) {
      void fetchTransferSuggestionCount(range.from, range.to).then(setTransferCount);
    }
  }

  // ── Step 4 and undo ─────────────────────────────────────────────────────

  function startOver() {
    setFile(null);
    setPdfFile(null);
    setStatementNotice(null);
    setPasteText('');
    setSettings(null);
    setOrigin(null);
    settingsKeyRef.current = '';
    discardPreview();
    setResult(null);
    setResultUndo(null);
    setHistoryUndo(null);
    setSettingsSaved(false);
    setSettingsError(null);
    setTransferCount(0);
    setStep(1);
  }

  function askToUndo(id: string, label: string) {
    setUndoError(null);
    setUndoTarget({ id, label });
  }

  // Reads the ref, not state: the dialog keeps the function it was opened with.
  const cancelUndo = useCallback(() => {
    if (undoBusyRef.current) return;
    setUndoTarget(null);
    setUndoError(null);
  }, []);

  async function confirmUndo() {
    if (!undoTarget || undoBusyRef.current) return;
    if (!navigator.onLine) {
      setUndoError(OFFLINE_TEXT);
      return;
    }
    undoBusyRef.current = true;
    setUndoBusy(true);
    setUndoError(null);
    const response = await undoImportBatch(undoTarget.id);
    undoBusyRef.current = false;
    setUndoBusy(false);

    if (!response.ok) {
      if (response.code === 'migration_required') setMigrationNeeded(true);
      setUndoError(response.message);
      return;
    }
    if (result && undoTarget.id === result.batchId) {
      setResultUndo(response.data);
      setHistoryUndo(null);
    } else {
      setHistoryUndo(response.data);
    }
    setUndoTarget(null);
    void loadBatches(true);
  }

  const handleCategoryCreated = useCallback((category: BudgetCategory) => {
    setCategories((current) => [...current, category]);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:py-10">
      <header className="flex items-start gap-2">
        <Link
          href="/dashboard/finance"
          aria-label="Back to Finance"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg transition hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Upload className="h-6 w-6 shrink-0 text-fuchsia-600" aria-hidden="true" />
            Import bank statement
          </h1>
          <p className="mt-0.5 text-sm text-gray-600">
            Bring in a CSV or PDF statement you downloaded from your bank or card. PDFs are read inside CentenarianOS
            and never sent anywhere else. You check every row before anything is saved, and an import can be undone.
          </p>
        </div>
      </header>

      <StepIndicator current={step} />

      {!online && (
        <StatusNotice tone="warning">
          <p id="import-offline-note">{OFFLINE_TEXT}</p>
        </StatusNotice>
      )}

      {migrationNeeded && (
        <ErrorNotice>
          <p>{MIGRATION_REQUIRED_TEXT}</p>
        </ErrorNotice>
      )}

      <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-4 text-xl font-semibold text-gray-900">
        {STEP_HEADINGS[step]}
      </h2>

      {step === 1 && pdfFile && previewError && (
        <ErrorNotice>
          <p>{previewError}</p>
        </ErrorNotice>
      )}

      {step === 1 && previewBusy && (
        <p role="status" className="flex items-center gap-2 text-sm text-gray-700">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking the statement against your account...
        </p>
      )}

      {step === 1 && (
        <AccountFileStep
          accounts={accounts}
          accountsState={accountsState}
          accountsError={accountsError}
          onRetryAccounts={loadAccounts}
          accountId={accountId}
          onAccountChange={handleAccountChange}
          file={file}
          onFileRead={handleFileRead}
          pasteText={pasteText}
          onPasteTextChange={setPasteText}
          onContinue={goToColumns}
          pdfFile={pdfFile}
          onPdfRead={handlePdfRead}
          initialFile={handedOverFile}
          onInitialFileUsed={() => setHandedOverFile(null)}
          autoFocusFile={fromSettings}
        />
      )}

      {step === 2 && file && settings && origin && (
        <ColumnsStep
          file={file}
          account={account}
          settings={settings}
          origin={origin}
          onChange={handleSettingsChange}
          onBack={() => setStep(1)}
          onContinue={goToReview}
          busy={previewBusy}
          error={previewError}
          online={online}
        />
      )}

      {step === 3 && preview && (
        <ReviewStep
          preview={preview}
          decisions={decisions}
          onDecisionsChange={setDecisions}
          categories={categories}
          onCategoryCreated={handleCategoryCreated}
          onBack={() => setStep(pdfFile ? 1 : 2)}
          backLabel={pdfFile ? 'Back to the file' : undefined}
          onImport={runImport}
          busy={importBusy}
          error={importError}
          online={online}
          statement={preview.statement ?? null}
          accountMatchesStatement={preview.accountMatchesStatement ?? null}
          confirmUnreconciled={confirmUnreconciled}
          onConfirmUnreconciledChange={setConfirmUnreconciled}
        />
      )}

      {step === 4 && result && statementNotice && !resultUndo && (
        statementNotice.saved ? (
          <StatusNotice tone="success">
            <p>The statement summary, interest rates and any promotional balances were saved with this account.</p>
          </StatusNotice>
        ) : (
          <StatusNotice tone="warning">
            <p>{statementNotice.error ?? "The statement summary wasn't saved."}</p>
          </StatusNotice>
        )
      )}

      {step === 4 && result && (
        <DoneStep
          result={result}
          accountName={resultAccountName}
          undo={resultUndo}
          onUndo={() => askToUndo(result.batchId, `${resultTitle}, imported into ${resultAccountName}`)}
          onImportAnother={startOver}
          settingsSaved={settingsSaved}
          settingsError={settingsError}
          transferCount={transferCount}
          online={online}
        />
      )}

      {(step === 1 || step === 4) && (
        <ImportHistory
          batches={batches}
          state={batchesState}
          // The banner above already says the database needs its update.
          error={migrationNeeded ? 'Your imports will be listed here once the database is updated.' : batchesError}
          onRetry={() => void loadBatches()}
          onUndo={(batch) =>
            askToUndo(batch.id, `${batchTitle(batch)}, imported into ${accountLabel(batch.financial_accounts)}`)
          }
          undo={historyUndo}
          online={online}
        />
      )}

      <UndoImportDialog
        target={undoTarget?.label ?? null}
        busy={undoBusy}
        error={undoError}
        online={online}
        onConfirm={confirmUndo}
        onCancel={cancelUndo}
      />
    </div>
  );
}
