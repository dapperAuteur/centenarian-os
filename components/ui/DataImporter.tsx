'use client';

// components/ui/DataImporter.tsx
// Reusable CSV / Google Sheets import component.
// Accepts CSV file upload or Google Sheets published URL, parses via papaparse.

import { useState, useRef } from 'react';
import { Upload, Link2, FileSpreadsheet, Download, Loader2, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';

interface ColumnDef {
  key: string;
  label: string;
  required?: boolean;
}

interface DataImporterProps {
  columns: ColumnDef[];
  onImport: (rows: Record<string, string>[]) => void;
  templateCsvUrl?: string;
  label?: string;
}

function convertGoogleSheetsUrl(url: string): string | null {
  // Convert various Google Sheets URL formats to CSV export
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const sheetId = match[1];
  // Extract gid if present
  const gidMatch = url.match(/gid=(\d+)/);
  const gid = gidMatch ? `&gid=${gidMatch[1]}` : '';
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid}`;
}

export default function DataImporter({ columns, onImport, templateCsvUrl, label }: DataImporterProps) {
  const [mode, setMode] = useState<'file' | 'sheets'>('file');
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rowCount, setRowCount] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function parseCsv(text: string) {
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
    });

    if (result.errors.length > 0) {
      setError(`CSV parse error: ${result.errors[0].message}`);
      return;
    }

    const rows = result.data.filter((row) =>
      columns.some((col) => col.required ? row[col.key]?.trim() : true),
    );

    if (rows.length === 0) {
      setError('No valid rows found. Check that column headers match the template.');
      return;
    }

    setError('');
    setRowCount(rows.length);
    onImport(rows);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    setRowCount(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      parseCsv(text);
      setLoading(false);
    };
    reader.onerror = () => {
      setError('Failed to read file');
      setLoading(false);
    };
    reader.readAsText(file);
    // Reset file input
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSheetsImport() {
    if (!sheetsUrl.trim()) return;
    setLoading(true);
    setError('');
    setRowCount(null);

    const csvUrl = convertGoogleSheetsUrl(sheetsUrl.trim());
    if (!csvUrl) {
      setError('Invalid Google Sheets URL. Use the share link from your spreadsheet.');
      setLoading(false);
      return;
    }

    try {
      const r = await fetch(csvUrl);
      if (!r.ok) throw new Error('Failed to fetch sheet. Make sure it is published to the web.');
      const text = await r.text();
      parseCsv(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import from Google Sheets');
    }
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>}

      {/* Mode tabs */}
      <div className="flex gap-1" role="tablist" aria-label="Import method">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'file'}
          onClick={() => setMode('file')}
          className={`flex items-center gap-1.5 px-3 min-h-11 rounded-lg text-xs font-medium transition ${
            mode === 'file' ? 'bg-fuchsia-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Upload className="w-3 h-3" aria-hidden="true" /> CSV File
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'sheets'}
          onClick={() => setMode('sheets')}
          className={`flex items-center gap-1.5 px-3 min-h-11 rounded-lg text-xs font-medium transition ${
            mode === 'sheets' ? 'bg-fuchsia-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <FileSpreadsheet className="w-3 h-3" aria-hidden="true" /> Google Sheets
        </button>
        {templateCsvUrl && (
          <a
            href={templateCsvUrl}
            download
            className="flex items-center gap-1.5 px-3 min-h-11 rounded-lg text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition ml-auto"
          >
            <Download className="w-3 h-3" aria-hidden="true" /> Template
          </a>
        )}
      </div>

      {/* CSV file upload */}
      {mode === 'file' && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700 file:cursor-pointer file:transition"
          />
        </div>
      )}

      {/* Google Sheets URL */}
      {mode === 'sheets' && (
        <div className="flex gap-2">
          <input
            type="url"
            value={sheetsUrl}
            onChange={(e) => setSheetsUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
          />
          <button
            type="button"
            onClick={handleSheetsImport}
            disabled={loading || !sheetsUrl.trim()}
            className="min-h-11 min-w-11 flex items-center justify-center bg-fuchsia-600 text-white rounded-lg text-xs font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50"
            aria-label="Import from Google Sheets"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Link2 className="w-3.5 h-3.5" aria-hidden="true" />}
          </button>
        </div>
      )}

      {/* Expected columns hint */}
      <p className="text-[10px] text-gray-400">
        Columns: {columns.map((c) => `${c.label}${c.required ? '*' : ''}`).join(', ')}
      </p>

      {/* Status */}
      {loading && <p className="text-xs text-gray-400 flex items-center gap-1" role="status"><Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> Importing...</p>}
      {error && <p className="text-xs text-red-400 flex items-center gap-1" role="alert"><AlertCircle className="w-3 h-3" aria-hidden="true" /> {error}</p>}
      {rowCount !== null && !error && <p className="text-xs text-green-400">Imported {rowCount} rows</p>}
    </div>
  );
}
