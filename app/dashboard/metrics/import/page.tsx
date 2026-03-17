'use client';

// app/dashboard/metrics/import/page.tsx
// Manual health data import — paste CSV, enter manually, or upload file
// Supports: Garmin, Apple Health, Oura, Whoop, Google Health, InBody, Hume Health, generic

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Upload, Plus, Trash2, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, FileDown } from 'lucide-react';

interface MetricRow {
  logged_date: string;
  resting_hr: string;
  steps: string;
  sleep_hours: string;
  activity_min: string;
  sleep_score: string;
  hrv_ms: string;
  spo2_pct: string;
  active_calories: string;
  stress_score: string;
  recovery_score: string;
  weight_lbs: string;
  notes: string;
}

const EMPTY_ROW: MetricRow = {
  logged_date: '',
  resting_hr: '',
  steps: '',
  sleep_hours: '',
  activity_min: '',
  sleep_score: '',
  hrv_ms: '',
  spo2_pct: '',
  active_calories: '',
  stress_score: '',
  recovery_score: '',
  weight_lbs: '',
  notes: '',
};

const METRIC_LABELS: Record<string, string> = {
  resting_hr: 'RHR (bpm)',
  steps: 'Steps',
  sleep_hours: 'Sleep (hrs)',
  activity_min: 'Activity (min)',
  sleep_score: 'Sleep Score',
  hrv_ms: 'HRV (ms)',
  spo2_pct: 'SpO2 (%)',
  active_calories: 'Active Cal',
  stress_score: 'Stress',
  recovery_score: 'Recovery',
  weight_lbs: 'Weight (lbs)',
};

const CORE_FIELDS = ['resting_hr', 'steps', 'sleep_hours', 'activity_min'] as const;
const ENRICHMENT_FIELDS = ['sleep_score', 'hrv_ms', 'spo2_pct', 'active_calories', 'stress_score', 'recovery_score', 'weight_lbs'] as const;

type Source = 'manual' | 'garmin' | 'apple_health' | 'oura' | 'whoop' | 'google_health' | 'inbody' | 'hume_health' | 'csv';

const SOURCE_LABELS: Record<Source, string> = {
  manual: 'Manual Entry',
  garmin: 'Garmin',
  apple_health: 'Apple Health',
  oura: 'Oura',
  whoop: 'Whoop',
  google_health: 'Google Health',
  inbody: 'InBody',
  hume_health: 'Hume Health',
  csv: 'Generic CSV',
};

const SOURCE_TEMPLATES: Partial<Record<Source, string>> = {
  garmin: '/templates/garmin-import-template.csv',
  apple_health: '/templates/apple-health-import-template.csv',
  hume_health: '/templates/hume-health-import-template.csv',
  csv: '/templates/health-metrics-import-template.csv',
  google_health: '/templates/health-metrics-import-template.csv',
  inbody: '/templates/inbody-import-template.csv',
};

// CSV column name mappings per source
const CSV_MAPPINGS: Record<string, Record<string, string>> = {
  garmin: {
    'Date': 'logged_date',
    'Resting Heart Rate': 'resting_hr',
    'Steps': 'steps',
    'Total Sleep Time': 'sleep_hours',
    'Active Minutes': 'activity_min',
    'Calories': 'active_calories',
    'Average Stress': 'stress_score',
    'Body Battery': 'recovery_score',
  },
  apple_health: {
    'Date': 'logged_date',
    'Resting Heart Rate': 'resting_hr',
    'Steps': 'steps',
    'Sleep Hours': 'sleep_hours',
    'Exercise Minutes': 'activity_min',
    'Active Energy': 'active_calories',
    'HRV': 'hrv_ms',
    'SpO2': 'spo2_pct',
    'Weight': 'weight_lbs',
  },
  oura: {
    'date': 'logged_date',
    'Resting Heart Rate': 'resting_hr',
    'Total Steps': 'steps',
    'Total Sleep Duration': 'sleep_hours',
    'Activity Score': 'activity_min',
    'Sleep Score': 'sleep_score',
    'Average HRV': 'hrv_ms',
    'Readiness Score': 'recovery_score',
    'Average SpO2': 'spo2_pct',
  },
  whoop: {
    'Date': 'logged_date',
    'Resting Heart Rate': 'resting_hr',
    'Step count': 'steps',
    'Sleep Performance': 'sleep_score',
    'HRV': 'hrv_ms',
    'Recovery Score': 'recovery_score',
    'Strain': 'stress_score',
    'Calories': 'active_calories',
  },
  inbody: {
    'date': 'logged_date',                   // YYYYMMDDHHmmss — normalized below
    'Weight(lb)': 'weight_lbs',
    'Percent Body Fat(%)': 'body_fat_pct',
    'Skeletal Muscle Mass(lb)': 'muscle_mass_lbs',
    'BMI(kg/m²)': 'bmi',
  },
  csv: {
    'date': 'logged_date',
    'logged_date': 'logged_date',
    'resting_hr': 'resting_hr',
    'steps': 'steps',
    'sleep_hours': 'sleep_hours',
    'activity_min': 'activity_min',
    'sleep_score': 'sleep_score',
    'hrv_ms': 'hrv_ms',
    'spo2_pct': 'spo2_pct',
    'active_calories': 'active_calories',
    'stress_score': 'stress_score',
    'recovery_score': 'recovery_score',
    'weight_lbs': 'weight_lbs',
    'notes': 'notes',
  },
};

function parseCSV(text: string, source: Source): MetricRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const mapping = CSV_MAPPINGS[source] || CSV_MAPPINGS.csv;

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: MetricRow = { ...EMPTY_ROW };

    headers.forEach((header, i) => {
      const mapped = mapping[header];
      if (mapped && mapped in row) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (row as any)[mapped] = values[i] || '';
      }
    });

    // InBody date format: YYYYMMDDHHmmss → YYYY-MM-DD
    if (row.logged_date && /^\d{14}$/.test(row.logged_date)) {
      const d = row.logged_date;
      row.logged_date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    }
    // Try to normalize date formats (MM/DD/YYYY → YYYY-MM-DD)
    if (row.logged_date && !row.logged_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const d = new Date(row.logged_date);
      if (!isNaN(d.getTime())) {
        row.logged_date = d.toISOString().split('T')[0];
      }
    }

    return row;
  }).filter((r) => r.logged_date);
}

// Parse InBody CSV preserving all raw columns for the dedicated import endpoint
function parseInBodyCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).flatMap((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const raw: Record<string, string> = {};
    headers.forEach((h, i) => { raw[h] = values[i] ?? ''; });
    // Normalize date (YYYYMMDDHHmmss → YYYY-MM-DD)
    if (raw['date'] && /^\d{14}$/.test(raw['date'])) {
      const d = raw['date'];
      raw['date'] = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    }
    return raw['date'] ? [raw] : [];
  });
}

export default function MetricsImportPage() {
  const searchParams = useSearchParams();
  const initialSource = (searchParams.get('source') as Source) || 'manual';
  const [source, setSource] = useState<Source>(initialSource);
  const [rows, setRows] = useState<MetricRow[]>([{ ...EMPTY_ROW, logged_date: new Date().toISOString().split('T')[0] }]);
  const [rawInBodyRows, setRawInBodyRows] = useState<Record<string, string>[]>([]);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors?: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEnrichment, setShowEnrichment] = useState(false);

  const addRow = () => setRows((prev) => [...prev, { ...EMPTY_ROW }]);

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof MetricRow, value: string) => {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      if (source === 'inbody') {
        const raw = parseInBodyCSV(text);
        setRawInBodyRows(raw);
        // Also populate summary rows for preview table
        const parsed = parseCSV(text, source);
        if (parsed.length > 0) setRows(parsed);
      } else {
        const parsed = parseCSV(text, source);
        if (parsed.length > 0) setRows(parsed);
      }
    };
    reader.readAsText(file);
  };

  const handlePasteCSV = () => {
    if (!csvText.trim()) return;
    if (source === 'inbody') {
      const raw = parseInBodyCSV(csvText);
      if (raw.length > 0) {
        setRawInBodyRows(raw);
        const parsed = parseCSV(csvText, source);
        if (parsed.length > 0) setRows(parsed);
        setError(null);
      } else {
        setError('Could not parse any rows from the CSV. Check the format.');
      }
      return;
    }
    const parsed = parseCSV(csvText, source);
    if (parsed.length > 0) {
      setRows(parsed);
      setError(null);
    } else {
      setError('Could not parse any rows from the CSV. Check the format.');
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setResult(null);

    // For InBody: send all raw columns to dedicated endpoint
    if (source === 'inbody') {
      const inBodyImportRows = rawInBodyRows.filter((r) => r['date']);
      if (inBodyImportRows.length === 0) {
        setError('No InBody rows parsed. Upload or paste your InBody CSV first.');
        setImporting(false);
        return;
      }
      try {
        const res = await fetch('/api/health-metrics/inbody/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: inBodyImportRows }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Import failed');
        } else {
          setResult(data);
        }
      } catch {
        setError('Network error');
      } finally {
        setImporting(false);
      }
      return;
    }

    // Clean rows: remove empty ones, convert to import format
    const importRows = rows
      .filter((r) => r.logged_date)
      .map((r) => {
        const clean: Record<string, string | number | null> = { logged_date: r.logged_date };
        for (const key of [...CORE_FIELDS, ...ENRICHMENT_FIELDS]) {
          if (r[key] !== '') clean[key] = r[key];
        }
        if (r.notes) clean.notes = r.notes;
        return clean;
      });

    if (importRows.length === 0) {
      setError('No rows with dates to import');
      setImporting(false);
      return;
    }

    try {
      const res = await fetch('/api/health-metrics/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, rows: importRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Import failed');
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 flex items-center gap-3">
          <Upload className="w-7 h-7 sm:w-8 sm:h-8 text-fuchsia-600 shrink-0" />
          Import Health Data
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Manually enter data or import from your wearable device exports
        </p>
      </header>

      {/* Source Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Data Source</label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(SOURCE_LABELS) as [Source, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSource(key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition min-h-10 ${
                source === key
                  ? 'bg-fuchsia-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* CSV Upload / Paste (non-manual sources) */}
      {source !== 'manual' && (
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-fuchsia-600" />
            Import from {SOURCE_LABELS[source]}
          </h2>

          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 transition text-sm font-medium min-h-11">
              <Upload className="w-4 h-4" />
              Upload CSV
              <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
            </label>
            {SOURCE_TEMPLATES[source] && (
              <a
                href={SOURCE_TEMPLATES[source]}
                download
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition text-sm font-medium min-h-11"
              >
                <FileDown className="w-4 h-4" />
                Download Template
              </a>
            )}
            <span className="text-sm text-gray-400 self-center">or</span>
          </div>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Paste CSV data here (first row should be column headers)..."
            rows={6}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
          />

          <button
            onClick={handlePasteCSV}
            className="px-4 py-2 bg-fuchsia-100 text-fuchsia-700 rounded-lg text-sm font-medium hover:bg-fuchsia-200 transition min-h-10"
          >
            Parse CSV
          </button>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">
            {rows.length} {rows.length === 1 ? 'Row' : 'Rows'}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEnrichment(!showEnrichment)}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition min-h-10"
            >
              {showEnrichment ? 'Hide Enrichment' : 'Show All Metrics'}
            </button>
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 px-3 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 transition min-h-10"
            >
              <Plus className="w-4 h-4" />
              Add Row
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Date</th>
                {CORE_FIELDS.map((f) => (
                  <th key={f} className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">{METRIC_LABELS[f]}</th>
                ))}
                {showEnrichment && ENRICHMENT_FIELDS.map((f) => (
                  <th key={f} className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">{METRIC_LABELS[f]}</th>
                ))}
                <th className="px-3 py-2 font-medium text-gray-600">Notes</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      value={row.logged_date}
                      onChange={(e) => updateRow(i, 'logged_date', e.target.value)}
                      className="w-36 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                    />
                  </td>
                  {CORE_FIELDS.map((f) => (
                    <td key={f} className="px-2 py-1.5">
                      <input
                        type="number"
                        step={f === 'sleep_hours' ? '0.1' : '1'}
                        value={row[f]}
                        onChange={(e) => updateRow(i, f, e.target.value)}
                        placeholder="—"
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                      />
                    </td>
                  ))}
                  {showEnrichment && ENRICHMENT_FIELDS.map((f) => (
                    <td key={f} className="px-2 py-1.5">
                      <input
                        type="number"
                        step={f === 'spo2_pct' || f === 'weight_lbs' ? '0.1' : '1'}
                        value={row[f]}
                        onChange={(e) => updateRow(i, f, e.target.value)}
                        placeholder="—"
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) => updateRow(i, 'notes', e.target.value)}
                      placeholder="—"
                      className="w-32 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    {rows.length > 1 && (
                      <button
                        onClick={() => removeRow(i)}
                        className="p-1 text-gray-400 hover:text-red-500 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex items-start gap-2 bg-lime-50 border border-lime-200 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-lime-600 shrink-0 mt-0.5" />
          <div className="text-sm text-lime-800">
            <p>Imported {result.imported} days of data{result.skipped > 0 && `, skipped ${result.skipped}`}</p>
            {result.errors && result.errors.length > 0 && (
              <ul className="mt-1 text-xs text-lime-700 list-disc pl-4">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Import Button */}
      <button
        onClick={handleImport}
        disabled={importing || rows.length === 0}
        className="flex items-center gap-2 px-6 py-3 bg-fuchsia-600 text-white rounded-xl font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50 min-h-12"
      >
        {importing ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Importing...</>
        ) : (
          <><Upload className="w-5 h-5" /> Import {rows.filter((r) => r.logged_date).length} Rows</>
        )}
      </button>
    </div>
  );
}
