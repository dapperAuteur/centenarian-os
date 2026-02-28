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

interface GenericImportPageProps {
  moduleName: string;
  backHref: string;
  apiEndpoint: string;
  templateUrl: string;
  columns: ColumnDef[];
  instructions: string;
  previewColumns?: string[];
  maxRows?: number;
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
}: GenericImportPageProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported?: number; skipped?: number; errors?: string[]; message?: string } | null>(null);

  const displayCols = previewColumns || columns.slice(0, 6).map((c) => c.key);

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    setResult(null);
    try {
      const r = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rows.slice(0, maxRows) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Import failed');
      setResult(d);
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
          onImport={setRows}
          templateCsvUrl={templateUrl}
        />
      </div>

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Preview: {rows.length} row{rows.length !== 1 ? 's' : ''}{rows.length > maxRows ? ` (first ${maxRows} will be imported)` : ''}
            </p>
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-1.5 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {importing ? 'Importing...' : `Import ${Math.min(rows.length, maxRows)} Rows`}
            </button>
          </div>
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
      {result && (
        <div className={`rounded-xl p-4 mb-6 ${result.errors && result.errors.length > 0 && !result.imported ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <div className="flex items-start gap-3">
            {result.imported ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
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
                  {result.errors.length > 10 && <li className="text-xs text-red-400">...and {result.errors.length - 10} more</li>}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
