'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import Link from 'next/link';

interface ParsedRow {
  transaction_date: string;
  amount: string;
  type: string;
  description: string;
  vendor: string;
  category_name: string;
}

export default function FinanceImportPage() {
  const [rawCsv, setRawCsv] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported?: number; skipped?: number; errors?: string[] } | null>(null);

  const parseCsv = useCallback((text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
    const parsed: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim(); });

      // Normalize date — handle MM/DD/YYYY or YYYY-MM-DD
      let date = row.date || row.transaction_date || '';
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) {
        const [m, d, y] = date.split('/');
        date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }

      // Determine type from amount sign or explicit column
      const rawAmount = row.amount || row.total || '0';
      const numAmount = parseFloat(rawAmount.replace(/[$,]/g, ''));
      const type = row.type || (numAmount < 0 ? 'expense' : 'income');

      parsed.push({
        transaction_date: date,
        amount: String(Math.abs(numAmount)),
        type,
        description: row.description || row.memo || row.name || '',
        vendor: row.vendor || row.payee || row.merchant || '',
        category_name: row.category || row.category_name || '',
      });
    }

    setRows(parsed);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRawCsv(text);
      parseCsv(text);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handlePaste = () => {
    if (rawCsv.trim()) {
      parseCsv(rawCsv);
      setResult(null);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch('/api/finance/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      setResult(data);
      if (res.ok) setRows([]);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/finance" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Upload className="w-6 h-6 text-fuchsia-600" />
            Import Transactions
          </h1>
          <p className="text-sm text-gray-500">Upload or paste a CSV file to bulk import</p>
        </div>
      </div>

      {/* Template download */}
      <div className="bg-fuchsia-50 border border-fuchsia-100 rounded-xl p-4 flex items-start gap-3">
        <FileText className="w-5 h-5 text-fuchsia-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-fuchsia-800 font-medium">CSV Format</p>
          <p className="text-xs text-fuchsia-600 mt-1">
            Required columns: <code className="bg-fuchsia-100 px-1 rounded">date</code>, <code className="bg-fuchsia-100 px-1 rounded">amount</code>.
            Optional: <code className="bg-fuchsia-100 px-1 rounded">type</code>, <code className="bg-fuchsia-100 px-1 rounded">description</code>,
            <code className="bg-fuchsia-100 px-1 rounded"> vendor</code>, <code className="bg-fuchsia-100 px-1 rounded">category</code>.
            Negative amounts are auto-classified as expenses.
          </p>
          <a
            href="/templates/finance-import-template.csv"
            download
            className="inline-flex items-center gap-1 mt-2 text-xs text-fuchsia-700 font-medium hover:underline"
          >
            <Download className="w-3 h-3" />
            Download template
          </a>
        </div>
      </div>

      {/* Upload / Paste */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="font-medium text-gray-900 text-sm">Upload File</h3>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-fuchsia-50 file:text-fuchsia-700 hover:file:bg-fuchsia-100"
          />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="font-medium text-gray-900 text-sm">Or Paste CSV</h3>
          <textarea
            rows={4}
            value={rawCsv}
            onChange={(e) => setRawCsv(e.target.value)}
            className="w-full text-xs font-mono border border-gray-200 rounded-lg p-2 resize-none"
            placeholder="date,amount,description,vendor,category"
          />
          <button
            onClick={handlePaste}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            Parse
          </button>
        </div>
      </div>

      {/* Preview Table */}
      {rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{rows.length} rows parsed</span>
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-50 transition"
            >
              {importing ? 'Importing...' : `Import ${rows.length} Transactions`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-left">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">{row.transaction_date}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        row.type === 'income' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">${parseFloat(row.amount).toFixed(2)}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate">{row.description || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{row.vendor || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{row.category_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && (
              <div className="px-4 py-2 text-xs text-gray-400 text-center border-t">
                Showing first 50 of {rows.length} rows
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl ${
          result.imported ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          {result.imported ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <div className="text-sm">
            {result.imported && (
              <p className="text-green-800 font-medium">{result.imported} transactions imported</p>
            )}
            {result.skipped ? (
              <p className="text-amber-700">{result.skipped} rows skipped</p>
            ) : null}
            {result.errors?.map((err, i) => (
              <p key={i} className="text-red-600 text-xs">{err}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Simple CSV line parser that handles quoted fields */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
