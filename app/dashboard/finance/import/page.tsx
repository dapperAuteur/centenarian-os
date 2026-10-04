'use client';

// app/dashboard/finance/import/page.tsx
// Import a bank or card statement (CSV) into one account, in four steps:
//   1 Account and file  -> AccountFileStep (the file is parsed in the browser)
//   2 Columns           -> ColumnsStep (mapping, sign convention, date order)
//   3 Review            -> ReviewStep (POST /api/finance/import/preview)
//   4 Done              -> DoneStep (POST /api/finance/import), with Undo
// plus the Import history list under steps 1 and 4.
//
// All state lives here so Back keeps what was entered. The server parses the
// file again itself: this page only ever sends the file text, the settings,
// and what to do with each spreadsheet row number.

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
  commitStatement,
  fetchTransferSuggestionCount,
  listImportBatches,
  previewStatement,
  saveAccountMapping,
  undoImportBatch,
  type StatementPayload,
} from '@/components/finance/import/api';
import { ErrorNotice, StatusNotice, type ParsedFile } from '@/components/finance/import/shared';
import { useOnline } from '@/components/finance/import/useOnline';
import type { ImportBatchSummary, PreviewResponse } from '@/lib/finance/csv-import/service';
import type { CommitResult, SavedCsvMapping, UndoResult } from '@/lib/finance/csv-import/types';
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
  const requestedAccountId = useSearchParams().get('account') ?? '';
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
  const [settings, setSettings] = useState<ImportSettings | null>(null);
  const [origin, setOrigin] = useState<SettingsOrigin | null>(null);
  /** The account and file the settings were built for: a new pair gets fresh settings. */
  const settingsKeyRef = useRef('');
  const fileVersionRef = useRef(0);

  // Step 3: the server's plan and the changes made to it.
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
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

  // Undo, from step 4 or from the history list.
  const [undoTarget, setUndoTarget] = useState<{ id: string; label: string } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const undoBusyRef = useRef(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [resultUndo, setResultUndo] = useState<UndoResult | null>(null);
  const [historyUndo, setHistoryUndo] = useState<UndoResult | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRenderRef = useRef(true);

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

  // Moving to another step puts focus on its heading, so a screen reader starts at the top of it.
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
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
  }

  function handleAccountChange(nextAccountId: string) {
    setAccountId(nextAccountId);
    discardPreview();
  }

  function handleFileRead(next: Omit<ParsedFile, 'version'> | null) {
    if (next) {
      fileVersionRef.current += 1;
      setFile({ ...next, version: fileVersionRef.current });
    } else {
      setFile(null);
    }
    discardPreview();
  }

  function goToColumns() {
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

  // ── Step 3 ──────────────────────────────────────────────────────────────

  async function goToReview() {
    // Nothing changed since the last preview: keep it, and the choices made on it.
    if (preview) {
      setStep(3);
      return;
    }
    const payload = buildPayload();
    if (!payload || previewBusy) return;
    if (!navigator.onLine) {
      setPreviewError(OFFLINE_TEXT);
      return;
    }

    const token = previewTokenRef.current;
    setPreviewBusy(true);
    setPreviewError(null);
    const response = await previewStatement(payload);
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
    const payload = buildPayload();
    if (!payload || !preview || !settings || importBusy) return;
    if (!navigator.onLine) {
      setImportError(OFFLINE_TEXT);
      return;
    }

    setImportBusy(true);
    setImportError(null);
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

  // ── Step 4 and undo ─────────────────────────────────────────────────────

  function startOver() {
    setFile(null);
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
            Bring in a CSV file you downloaded from your bank or card. You check every row before anything is saved,
            and an import can be undone.
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

      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-gray-900 outline-none">
        {STEP_HEADINGS[step]}
      </h2>

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
          onBack={() => setStep(2)}
          onImport={runImport}
          busy={importBusy}
          error={importError}
          online={online}
        />
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
