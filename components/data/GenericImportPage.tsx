'use client';

// components/data/GenericImportPage.tsx
// Reusable import page component for any module.

import { useState } from 'react';
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, Download, Loader2, Info } from 'lucide-react';
import Link from 'next/link';
import DataImporter from '@/components/ui/DataImporter';

interface ColumnDef {
  key: string;
  label: string;
  required?: boolean;
}

/** A yes/no choice sent to the import endpoint as `{ [key]: true | false }`. */
export interface ImportOption {
  key: string;
  label: string;
  description?: string;
}

interface GenericImportPageProps {
  moduleName: string;
  backHref: string;
  apiEndpoint: string;
  templateUrl: string;
  columns: ColumnDef[];
  instructions: string;
  previewColumns?: string[];
  maxRows?: number;
  /**
   * The endpoint accepts `dryRun: true` and answers what it would do (a
   * `message`) without writing. The page then asks for that check before
   * Import is enabled, so duplicates show up before anything is saved.
   */
  dryRun?: boolean;
  options?: ImportOption[];
}

interface ImportResult {
  imported?: number;
  skipped?: number;
  errors?: string[];
  message?: string;
}

export default function GenericImportPage({
  moduleName,
  backHref,
  apiEndpoint,
  templateUrl,
  columns,
  instructions,
  previewColumns,
  maxRows = 1000,
  dryRun = false,
  options = [],
}: GenericImportPageProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [choices, setChoices] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<{ key: string; result: ImportResult } | null>(null);

  const displayCols = previewColumns || columns.slice(0, 6).map((c) => c.key);

  const body = () => ({
    rows: rows.slice(0, maxRows),
    ...Object.fromEntries(options.map((option) => [option.key, choices[option.key] === true])),
  });
  const requestKey = dryRun && rows.length > 0 ? JSON.stringify(body()) : null;
  const previewIsCurrent = !dryRun || (preview !== null && preview.key === requestKey);

  function handleRows(next: Record<string, string>[]) {
    setRows(next);
    setPreview(null);
    setResult(null);
  }

  async function handleCheck() {
    if (rows.length === 0) return;
    setChecking(true);
    setResult(null);
    const payload = body();
    try {
      const r = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, dryRun: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not check the rows');
      setPreview({ key: JSON.stringify(payload), result: d });
    } catch (e) {
      setPreview(null);
      setResult({ errors: [e instanceof Error ? e.message : 'Could not check the rows'] });
    } finally {
      setChecking(false);
    }
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    setResult(null);
    try {
      const r = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body()),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Import failed');
      setResult(d);
      setPreview(null);
      if (d.imported > 0) setRows([]);
    } catch (e) {
      setResult({ errors: [e instanceof Error ? e.message : 'Import failed'] });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <Link href={backHref} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 text-sm mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <Upload className="w-6 h-6 text-fuchsia-600" />
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Import {moduleName}</h1>
      </div>

      {/* Template download callout */}
      <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-fuchsia-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-gray-700 mb-2">{instructions}</p>
            <a
              href={templateUrl}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs font-semibold hover:bg-fuchsia-700 transition"
            >
              <Download className="w-3 h-3" /> Download CSV Template
            </a>
          </div>
        </div>
      </div>

      {/* DataImporter */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <DataImporter
          label={`Upload ${moduleName} CSV`}
          columns={columns}
          onImport={handleRows}
          templateCsvUrl={templateUrl}
        />
      </div>

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm font-medium text-gray-700">
              Preview: {rows.length} row{rows.length !== 1 ? 's' : ''}{rows.length > maxRows ? ` (first ${maxRows} will be imported)` : ''}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              {dryRun && (
                <button
                  type="button"
                  onClick={handleCheck}
                  disabled={checking || importing}
                  className={`flex items-center justify-center gap-1.5 px-4 py-2 min-h-11 rounded-lg text-sm font-semibold transition disabled:opacity-50 ${
                    previewIsCurrent ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-sky-600 text-white hover:bg-sky-700'
                  }`}
                >
                  {checking && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                  {checking ? 'Checking...' : previewIsCurrent ? 'Check again' : 'Check rows'}
                </button>
              )}
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || checking || !previewIsCurrent}
                className="flex items-center justify-center gap-1.5 px-4 py-2 min-h-11 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 transition disabled:opacity-50"
              >
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Upload className="w-3.5 h-3.5" aria-hidden="true" />}
                {importing ? 'Importing...' : `Import ${Math.min(rows.length, maxRows)} Rows`}
              </button>
            </div>
          </div>
          {options.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-200 space-y-2">
              {options.map((option) => (
                <div key={option.key} className="flex items-start gap-3">
                  <input
                    id={`import-option-${option.key}`}
                    type="checkbox"
                    checked={choices[option.key] === true}
                    onChange={(e) => setChoices((prev) => ({ ...prev, [option.key]: e.target.checked }))}
                    className="mt-0.5 h-5 w-5 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                  />
                  <label htmlFor={`import-option-${option.key}`} className="text-sm text-gray-700">
                    <span className="font-medium">{option.label}</span>
                    {option.description && <span className="block text-xs text-gray-500">{option.description}</span>}
                  </label>
                </div>
              ))}
            </div>
          )}
          {dryRun && preview && previewIsCurrent && (
            <div role="status" className="px-4 py-3 border-b border-gray-200 bg-sky-50 text-sm text-gray-800">
              <p className="font-medium text-gray-900">Before you import</p>
              <p>{preview.result.message}</p>
            </div>
          )}
          {dryRun && !previewIsCurrent && (
            <p className="px-4 py-2 border-b border-gray-200 text-xs text-gray-500">
              Check the rows first: Import turns on once you have seen what is new and what is already there.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">#</th>
                  {displayCols.map((col) => (
                    <th key={col} className="px-3 py-2 text-left text-gray-500 font-medium">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                    {displayCols.map((col) => (
                      <td key={col} className="px-3 py-1.5 text-gray-700 max-w-[200px] truncate">{row[col] || ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && (
              <p className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
                Showing first 50 of {rows.length} rows
              </p>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (() => {
        // Failed = errors and nothing saved. Nothing saved without errors (every row was
        // already there) is still a successful run.
        const failed = Boolean(result.errors && result.errors.length > 0 && !result.imported);
        return (
        <div
          role={failed ? 'alert' : 'status'}
          className={`rounded-xl p-4 mb-6 ${failed ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}
        >
          <div className="flex items-start gap-3">
            {failed ? (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <div>
              {result.message && <p className="text-sm font-medium text-gray-900 mb-1">{result.message}</p>}
              {result.imported !== undefined && (
                <p className="text-sm text-gray-700">Imported: {result.imported}{result.skipped ? `, Skipped: ${result.skipped}` : ''}</p>
              )}
              {result.errors && result.errors.length > 0 && (
                <ul className="mt-2 space-y-0.5 max-h-32 overflow-y-auto">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <li key={i} className="text-xs text-red-600">{err}</li>
                  ))}
                  {result.errors.length > 10 && <li className="text-xs text-red-600">...and {result.errors.length - 10} more</li>}
                </ul>
              )}
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
