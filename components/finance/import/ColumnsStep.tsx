'use client';

// components/finance/import/ColumnsStep.tsx
// Step 2 of the statement import: confirm which column is which, how the file
// signs its amounts, and how it writes dates. A sample of the first rows,
// read with the current settings, updates as anything changes, so a wrong
// sign or date order shows before the file is sent.

import { useMemo, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import {
  cardKindFor,
  cardKindLabel,
  cardKindSummary,
  countCardKinds,
  importExplanation,
  isDebtAccountType,
  signOptionText,
} from '@/lib/finance/csv-import/card-terms';
import { detectDateOrder, parseDate } from '@/lib/finance/csv-import/parse';
import type { ColumnRole, DateOrder, SignConvention } from '@/lib/finance/csv-import/types';
import {
  ROLE_LABELS,
  accountLabel,
  formatCents,
  formatIsoDate,
  mappingProblems,
  moneyRoles,
  previewMapping,
  type ImportAccount,
  type ImportSettings,
  type InitialSettings,
} from '@/lib/finance/csv-import/ui-helpers';
import {
  ErrorNotice,
  StatusChip,
  StatusNotice,
  ToneIcon,
  card,
  fieldHint,
  fieldLabel,
  primaryButton,
  secondaryButton,
  selectInput,
  type ParsedFile,
} from './shared';

interface ColumnsStepProps {
  file: ParsedFile;
  account: ImportAccount | null;
  settings: ImportSettings;
  /** Where the starting settings came from, for the notes at the top. */
  origin: Pick<InitialSettings, 'mappingSource' | 'signSource' | 'savedIgnored'>;
  onChange: (settings: ImportSettings) => void;
  onBack: () => void;
  onContinue: () => void;
  /** True while the preview request is running. */
  busy: boolean;
  /** What the server said about the last preview request, if it failed. */
  error: string | null;
  online: boolean;
}

/** The sign conventions, in the order shown. Their words depend on the account (see signOptionText). */
const SIGN_VALUES: readonly SignConvention[] = ['negative_is_expense', 'positive_is_expense', 'split_columns', 'type_column'];

const DATE_OPTIONS: readonly { value: DateOrder; label: string; example: string }[] = [
  { value: 'MDY', label: 'Month / Day / Year (MM/DD)', example: 'January 31 is written 01/31/2026' },
  { value: 'DMY', label: 'Day / Month / Year (DD/MM)', example: 'January 31 is written 31/01/2026' },
  { value: 'YMD', label: 'Year - Month - Day (YYYY-MM-DD)', example: 'January 31 is written 2026-01-31' },
];

const ROLE_HINTS: Partial<Record<ColumnRole, string>> = {
  postDate: 'Used only for a row that has no date.',
  merchant: 'A clean store name, when the file has one.',
  memo: 'Used as the description when a row has none.',
  detail: 'Added after the description, and the store name is read from it (for banks that put the store in a memo).',
  debit: 'The column that holds money going out.',
  credit: 'The column that holds money coming in.',
  type: 'The column that says debit or credit for each row.',
  category: "Matched by name to your budget categories.",
  bankId: "The bank's own transaction or reference number.",
  status: 'A column that says Pending or Posted.',
};

const SIGN_SOURCE_NOTE: Record<InitialSettings['signSource'], string> = {
  saved: 'Started from the settings saved for this account.',
  detected: 'Started from what this file looks like.',
  account_type:
    "The file doesn't show which way it signs amounts, so this started from the account type. Check the sample below.",
};

const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Column tracks of the sample, shared by its caption row and its rows from the sm breakpoint up. */
const SAMPLE_GRID = 'sm:grid-cols-[4rem_7.5rem_6.5rem_8.5rem_1fr] sm:gap-x-3';

export default function ColumnsStep({
  file,
  account,
  settings,
  origin,
  onChange,
  onBack,
  onContinue,
  busy,
  error,
  online,
}: ColumnsStepProps) {
  const [attempted, setAttempted] = useState(false);
  const { table } = file;
  const accountType = account?.account_type ?? null;
  const debt = isDebtAccountType(accountType);

  // Each column, with a value from the file so a numbered column can be told from its neighbors.
  const columnOptions = useMemo(
    () =>
      table.headers.map((key, index) => {
        const label = table.headerLabels[index] ?? key;
        const example = table.rows.find((row) => row.cells[key]?.trim())?.cells[key]?.trim() ?? '';
        return { key, label: example ? `${label} (for example: ${clip(example, 28)})` : label };
      }),
    [table],
  );

  const problems = useMemo(
    () => mappingProblems(settings.mapping, settings.sign, table.headers),
    [settings.mapping, settings.sign, table.headers],
  );

  const sample = useMemo(
    () =>
      problems.length === 0 && settings.dateOrder
        ? previewMapping(table.rows, settings.mapping, settings.sign, settings.dateOrder, undefined, file.detected.preset)
        : null,
    [problems, settings.mapping, settings.sign, settings.dateOrder, table.rows, file.detected.preset],
  );
  const kindCounts = useMemo(() => (sample && debt ? countCardKinds(sample.rows) : null), [sample, debt]);

  // Whether the chosen date column settles day-first against month-first.
  const dateHeader = settings.mapping.date;
  const dateCheck = useMemo(
    () => detectDateOrder(dateHeader ? table.rows.map((row) => row.cells[dateHeader]) : []),
    [dateHeader, table.rows],
  );
  const exampleDate = dateHeader
    ? (table.rows.find((row) => row.cells[dateHeader]?.trim())?.cells[dateHeader]?.trim() ?? '')
    : '';
  const exampleAsMDY = parseDate(exampleDate, 'MDY');
  const exampleAsDMY = parseDate(exampleDate, 'DMY');
  const exampleReadsBothWays = Boolean(exampleAsMDY && exampleAsDMY && exampleAsMDY !== exampleAsDMY);

  const blockers = [...problems];
  if (!settings.dateOrder) blockers.push('Choose how this file writes its dates.');
  if (sample && sample.readable === 0) {
    blockers.push('No row can be read with these settings. Check the date order and the amount column.');
  }

  function setRole(role: ColumnRole, header: string) {
    const mapping = { ...settings.mapping };
    if (header) mapping[role] = header;
    else delete mapping[role];
    let dateOrder = settings.dateOrder;
    // A newly chosen date column may settle the date order on its own.
    if (role === 'date' && dateOrder === null && header) {
      const check = detectDateOrder(table.rows.map((row) => row.cells[header]));
      if (!check.ambiguous) dateOrder = check.order;
    }
    onChange({ ...settings, mapping, dateOrder });
  }

  function handleContinue() {
    setAttempted(true);
    if (blockers.length > 0) return;
    onContinue();
  }

  const moneyColumns = moneyRoles(settings.sign);
  const requiredRole = (role: ColumnRole): boolean =>
    role === 'date' || role === 'description' || moneyColumns.includes(role);

  const roleSelect = (role: ColumnRole) => {
    const id = `import-column-${role}`;
    const required = requiredRole(role);
    const value = settings.mapping[role] ?? '';
    const invalid = attempted && required && !value;
    const hint = ROLE_HINTS[role];
    return (
      <div key={role}>
        <label htmlFor={id} className={fieldLabel}>
          {ROLE_LABELS[role]}
          {required ? (
            <span className="font-normal text-gray-600"> (required)</span>
          ) : (
            <span className="font-normal text-gray-600"> (optional)</span>
          )}
        </label>
        <select
          id={id}
          value={value}
          required={required}
          aria-required={required}
          aria-invalid={invalid}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => setRole(role, event.target.value)}
          className={selectInput}
        >
          <option value="">{required ? 'Choose a column' : 'Not in this file'}</option>
          {columnOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        {hint && (
          <p id={`${id}-hint`} className={fieldHint}>
            {hint}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {origin.mappingSource === 'saved' && (
        <StatusNotice>
          <p>
            These are the settings saved for {accountLabel(account)} from an earlier import. Change anything that no
            longer fits this file.
          </p>
        </StatusNotice>
      )}
      {origin.savedIgnored && (
        <StatusNotice tone="attention">
          <p>
            The settings saved for this account don&apos;t fit this file&apos;s columns, so the columns were worked
            out again from the file. Check them below.
          </p>
        </StatusNotice>
      )}

      {/* What and when */}
      <section className={card} aria-labelledby="import-columns-heading">
        <h3 id="import-columns-heading" className="text-base font-semibold text-gray-900">
          Which column is which?
        </h3>
        <p className="mt-1 text-sm text-gray-700">
          Each list shows this file&apos;s columns with a value from the file.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(['date', 'postDate', 'description', 'merchant', 'memo', 'detail'] as const).map(roleSelect)}
        </div>
      </section>

      {/* Money */}
      <section className={card} aria-labelledby="import-money-heading">
        <h3 id="import-money-heading" className="text-base font-semibold text-gray-900">
          Amounts
        </h3>
        <p className="mt-1 text-sm text-gray-700">{importExplanation(accountType)}</p>
        <fieldset className="mt-3">
          <legend className="text-sm font-medium text-gray-800">
            {debt ? 'How does this file show a charge?' : 'How does this file show a purchase?'}
          </legend>
          <p className={fieldHint}>{SIGN_SOURCE_NOTE[origin.signSource]}</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SIGN_VALUES.map((value) => {
              const option = { value, ...signOptionText(value, accountType) };
              const id = `import-sign-${option.value}`;
              const checked = settings.sign === option.value;
              return (
                <label
                  key={option.value}
                  htmlFor={id}
                  className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                    checked ? 'border-sky-700 bg-sky-50' : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <input
                    id={id}
                    type="radio"
                    name="import-sign"
                    value={option.value}
                    checked={checked}
                    onChange={() => onChange({ ...settings, sign: option.value })}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-sky-700"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                    <span className="block text-xs text-gray-600">{option.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{moneyColumns.map(roleSelect)}</div>
      </section>

      {/* Dates */}
      <section className={card} aria-labelledby="import-dates-heading">
        <h3 id="import-dates-heading" className="text-base font-semibold text-gray-900">
          Dates
        </h3>
        {dateCheck.ambiguous && (
          <StatusNotice tone="attention" alert={!settings.dateOrder} className="mt-3">
            <p className="font-medium">
              {settings.dateOrder
                ? 'Every date in this file can be read two ways, so check the dates in the sample below.'
                : 'Every date in this file can be read two ways. Choose the order your bank uses.'}
            </p>
            {exampleReadsBothWays && (
              <p className="mt-1">
                For example, &quot;{exampleDate}&quot; is {formatIsoDate(exampleAsMDY)} as month/day, or{' '}
                {formatIsoDate(exampleAsDMY)} as day/month.
              </p>
            )}
          </StatusNotice>
        )}
        <fieldset className="mt-3">
          <legend className="text-sm font-medium text-gray-800">
            How does this file write dates? <span className="font-normal text-gray-600">(required)</span>
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {DATE_OPTIONS.map((option) => {
              const id = `import-date-order-${option.value}`;
              const checked = settings.dateOrder === option.value;
              return (
                <label
                  key={option.value}
                  htmlFor={id}
                  className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                    checked ? 'border-sky-700 bg-sky-50' : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <input
                    id={id}
                    type="radio"
                    name="import-date-order"
                    value={option.value}
                    checked={checked}
                    onChange={() => onChange({ ...settings, dateOrder: option.value })}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-sky-700"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                    <span className="block text-xs text-gray-600">{option.example}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      {/* Optional columns and switches */}
      <section className={card} aria-labelledby="import-more-heading">
        <h3 id="import-more-heading" className="text-base font-semibold text-gray-900">
          More columns and options
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(['category', 'bankId', 'status'] as const).map(roleSelect)}
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex min-h-11 items-start gap-3">
            <input
              id="import-include-pending"
              type="checkbox"
              checked={settings.includePending}
              onChange={(event) => onChange({ ...settings, includePending: event.target.checked })}
              aria-describedby="import-include-pending-hint"
              className="mt-0.5 h-5 w-5 shrink-0 accent-sky-700"
            />
            <div>
              <label htmlFor="import-include-pending" className="text-sm font-medium text-gray-900">
                Include pending transactions
              </label>
              <p id="import-include-pending-hint" className="text-xs text-gray-600">
                Rows the Status column marks as pending are left out unless this is on. A pending charge can change
                before it posts.
              </p>
            </div>
          </div>

          <div className="flex min-h-11 items-start gap-3">
            <input
              id="import-remember"
              type="checkbox"
              checked={settings.remember}
              onChange={(event) => onChange({ ...settings, remember: event.target.checked })}
              aria-describedby="import-remember-hint"
              className="mt-0.5 h-5 w-5 shrink-0 accent-sky-700"
            />
            <div>
              <label htmlFor="import-remember" className="text-sm font-medium text-gray-900">
                Remember these settings for this account
              </label>
              <p id="import-remember-hint" className="text-xs text-gray-600">
                Saved after a successful import and filled in the next time you import into {accountLabel(account)}.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sample */}
      <section className={card} aria-labelledby="import-sample-heading">
        <h3 id="import-sample-heading" className="text-base font-semibold text-gray-900">
          How the first rows will be read
        </h3>

        {problems.length > 0 && (
          <div className="mt-2 text-sm text-gray-700">
            <p>The sample appears once these are chosen:</p>
            <ul className="list-disc pl-5">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        )}
        {problems.length === 0 && !settings.dateOrder && (
          <p className="mt-2 text-sm text-gray-700">Choose how this file writes dates to see the sample.</p>
        )}

        {sample && (
          <>
            {/*
              A list, not a <table>: the app's global CSS turns every table into a
              block, which stops its columns from filling the card. Each item reads
              as one sentence, so the column captions are for sighted users only.
            */}
            <div className="mt-3 text-sm">
              <div
                aria-hidden="true"
                className={`hidden border-b border-gray-200 pb-2 text-xs font-medium text-gray-600 sm:grid ${SAMPLE_GRID}`}
              >
                <span>Row</span>
                <span>Date</span>
                <span className="text-right">Amount</span>
                <span>{debt ? 'What it is' : 'Expense or income'}</span>
                <span>Description</span>
              </div>
              <ul role="list" aria-label="The first rows of the file as they will be imported" className="divide-y divide-gray-100">
                {sample.sample.map((row) =>
                  row.ok ? (
                    <li key={row.rowNumber} className={`py-2 sm:grid sm:items-center ${SAMPLE_GRID}`}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:contents">
                        <span className="text-gray-600">Row {row.rowNumber}</span>
                        <span className="whitespace-nowrap text-gray-900">{formatIsoDate(row.date)}</span>
                        <span className="font-medium tabular-nums text-gray-900 sm:text-right">
                          {formatCents(row.amountCents ?? 0)}
                        </span>
                        <span>
                          {/* A direction, not a judgment: neutral, in the account's own words. */}
                          <StatusChip tone="neutral">
                            {debt
                              ? cardKindLabel(
                                  cardKindFor({ type: row.type ?? 'expense', description: row.description ?? '' }),
                                  accountType,
                                )
                              : row.type === 'income'
                                ? 'Income'
                                : 'Expense'}
                          </StatusChip>
                        </span>
                      </div>
                      <p className="mt-0.5 min-w-0 wrap-break-word text-gray-800 sm:mt-0">{row.description}</p>
                    </li>
                  ) : row.skipped ? (
                    <li key={row.rowNumber} className={`py-2 sm:grid sm:items-center ${SAMPLE_GRID}`}>
                      <span className="text-gray-600">Row {row.rowNumber}</span>
                      <p className="mt-0.5 flex items-start gap-1.5 text-gray-700 sm:col-span-4 sm:mt-0">
                        <ToneIcon tone="neutral" className="mt-0.5 h-4 w-4" />
                        <span>Left out (moves no money): {row.reason}</span>
                      </p>
                    </li>
                  ) : (
                    <li key={row.rowNumber} className={`py-2 sm:grid sm:items-center ${SAMPLE_GRID}`}>
                      <span className="text-gray-600">Row {row.rowNumber}</span>
                      <p className="mt-0.5 flex items-start gap-1.5 text-red-800 sm:col-span-4 sm:mt-0">
                        <ToneIcon tone="error" className="mt-0.5 h-4 w-4" />
                        <span>Can&apos;t be read: {row.reason}</span>
                      </p>
                    </li>
                  ),
                )}
              </ul>
            </div>
            <p role="status" className="mt-3 text-sm text-gray-800">
              With these settings, {sample.readable.toLocaleString('en-US')} of{' '}
              {table.rows.length.toLocaleString('en-US')} rows can be read:{' '}
              {kindCounts
                ? `${cardKindSummary(kindCounts, accountType)}.`
                : `${sample.expenses.toLocaleString('en-US')} as expenses and ${sample.income.toLocaleString('en-US')} as income.`}
              {sample.skipped > 0 &&
                ` ${sample.skipped.toLocaleString('en-US')} ${sample.skipped === 1 ? 'is' : 'are'} left out because ${sample.skipped === 1 ? 'it moves' : 'they move'} no money (holds, authorizations, item lines).`}
              {sample.unreadable > 0 &&
                ` ${sample.unreadable.toLocaleString('en-US')} can't be read; the next step lists each one with the reason.`}
            </p>
          </>
        )}
      </section>

      {attempted && blockers.length > 0 && (
        <ErrorNotice>
          <p className="font-medium">Before you continue:</p>
          <ul className="list-disc pl-5">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </ErrorNotice>
      )}

      {error && (
        <ErrorNotice>
          <p>{error}</p>
        </ErrorNotice>
      )}

      {busy && (
        <p role="status" className="flex items-center gap-2 text-sm text-gray-700">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking the statement against this account...
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button type="button" onClick={onBack} disabled={busy} className={secondaryButton}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={busy || !online}
          aria-describedby={!online ? 'import-offline-note' : undefined}
          className={primaryButton}
        >
          {busy ? 'Checking...' : 'Continue to review'}
        </button>
      </div>
    </div>
  );
}
