'use client';

// components/finance/import/ColumnsStep.tsx
// Step 2 of the statement import: confirm which column is which, how the file
// signs its amounts, and how it writes dates. A sample of the first rows,
// read with the current settings, updates as anything changes, so a wrong
// sign or date order shows before the file is sent.

import { useMemo, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
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
  StatusNotice,
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

const SIGN_OPTIONS: readonly { value: SignConvention; label: string; hint: string }[] = [
  {
    value: 'negative_is_expense',
    label: 'Purchases are negative numbers',
    hint: 'One amount column. Money coming in is positive.',
  },
  {
    value: 'positive_is_expense',
    label: 'Purchases are positive numbers',
    hint: 'One amount column. Payments and refunds are negative.',
  },
  {
    value: 'split_columns',
    label: 'Separate debit and credit columns',
    hint: 'Money out is in one column and money in is in another.',
  },
  {
    value: 'type_column',
    label: 'A type column says debit or credit',
    hint: 'Amounts have no sign. Another column says which way the money went.',
  },
];

const DATE_OPTIONS: readonly { value: DateOrder; label: string; example: string }[] = [
  { value: 'MDY', label: 'Month / Day / Year (MM/DD)', example: 'January 31 is written 01/31/2026' },
  { value: 'DMY', label: 'Day / Month / Year (DD/MM)', example: 'January 31 is written 31/01/2026' },
  { value: 'YMD', label: 'Year - Month - Day (YYYY-MM-DD)', example: 'January 31 is written 2026-01-31' },
];

const ROLE_HINTS: Partial<Record<ColumnRole, string>> = {
  postDate: 'Used only for a row that has no date.',
  merchant: 'A clean store name, when the file has one.',
  memo: 'Used as the description when a row has none.',
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
        ? previewMapping(table.rows, settings.mapping, settings.sign, settings.dateOrder)
        : null,
    [problems, settings.mapping, settings.sign, settings.dateOrder, table.rows],
  );

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
        <StatusNotice tone="warning">
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
          {(['date', 'postDate', 'description', 'merchant', 'memo'] as const).map(roleSelect)}
        </div>
      </section>

      {/* Money */}
      <section className={card} aria-labelledby="import-money-heading">
        <h3 id="import-money-heading" className="text-base font-semibold text-gray-900">
          Amounts
        </h3>
        <fieldset className="mt-3">
          <legend className="text-sm font-medium text-gray-800">How does this file show a purchase?</legend>
          <p className={fieldHint}>{SIGN_SOURCE_NOTE[origin.signSource]}</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SIGN_OPTIONS.map((option) => {
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
          <div
            role={settings.dateOrder ? 'status' : 'alert'}
            className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
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
          </div>
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
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <caption className="sr-only">
                  The first {sample.sample.length} rows of the file as they will be imported
                </caption>
                <thead className="border-b border-gray-200 text-xs text-gray-600">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-medium">Row</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Date</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Amount</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Expense or income</th>
                    <th scope="col" className="py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sample.sample.map((row) =>
                    row.ok ? (
                      <tr key={row.rowNumber}>
                        <td className="py-2 pr-3 text-gray-600">{row.rowNumber}</td>
                        <td className="py-2 pr-3 whitespace-nowrap text-gray-900">{formatIsoDate(row.date)}</td>
                        <td className="py-2 pr-3 text-right font-medium tabular-nums text-gray-900">
                          {formatCents(row.amountCents ?? 0)}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              row.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-800'
                            }`}
                          >
                            {row.type === 'income' ? 'Income' : 'Expense'}
                          </span>
                        </td>
                        <td className="py-2 text-gray-800">{row.description}</td>
                      </tr>
                    ) : (
                      <tr key={row.rowNumber}>
                        <td className="py-2 pr-3 text-gray-600">{row.rowNumber}</td>
                        <td colSpan={4} className="py-2 text-red-800">
                          Can&apos;t be read: {row.reason}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <p role="status" className="mt-3 text-sm text-gray-800">
              With these settings, {sample.readable.toLocaleString('en-US')} of{' '}
              {table.rows.length.toLocaleString('en-US')} rows can be read:{' '}
              {sample.expenses.toLocaleString('en-US')} as expenses and {sample.income.toLocaleString('en-US')} as
              income.
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
