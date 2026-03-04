'use client';

// app/dashboard/data/import/google-calendar/page.tsx
// Import Google Calendar .ics exports as planner tasks.
// "future money" events also generate draft invoices from the PPI CBS template.

import { useRef, useState } from 'react';
import { Calendar, Upload, Check, Loader2, AlertCircle, FileText, Tag, X } from 'lucide-react';
import Link from 'next/link';
import { parseIcs, extractCalendarName, getEventDateRange } from '@/lib/calendar/ics-parser';

const VALID_TAGS = ['personal', 'work', 'health', 'finance', 'travel', 'errands', 'fitness'] as const;
type Tag = typeof VALID_TAGS[number] | '';

interface FilePreview {
  file: File;
  content: string;
  calendarName: string;
  eventCount: number;
  cancelledCount: number;
  dateRange: { from: string; to: string } | null;
  detectedTag: Tag;
  tagOverride: Tag;
  isFutureMoney: boolean;
}

interface ImportResult {
  file: string;
  imported: number;
  skipped: number;
  invoices_created: number;
  calendar_name: string;
  message: string;
  error?: string;
}

function detectTagForCalendar(name: string): Tag {
  const lower = name.toLowerCase();
  if (lower.includes('money') || lower.includes('finance') || lower.includes('business')) return 'finance';
  if (lower.includes('health') || lower.includes('fitness') || lower.includes('gym')) return 'health';
  if (lower.includes('travel') || lower.includes('trip')) return 'travel';
  if (lower.includes('work') || lower.includes('project')) return 'work';
  return 'personal';
}

function isFutureMoneyCalendar(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('future money') || (lower.includes('money') && lower.includes('future'));
}

function formatDate(d: string): string {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

export default function GoogleCalendarImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setParseError(null);
    setResults([]);

    const newPreviews: FilePreview[] = [];

    for (const file of Array.from(files)) {
      if (!file.name.endsWith('.ics') && !file.name.endsWith('.ical')) {
        setParseError(`"${file.name}" is not an .ics file.`);
        continue;
      }
      try {
        const content = await file.text();
        const calendarName = extractCalendarName(content);
        const events = parseIcs(content);
        const cancelledCount = events.filter((e) => e.status === 'CANCELLED').length;
        const validEvents = events.filter((e) => e.status !== 'CANCELLED' && e.dtstart);
        const dateRange = getEventDateRange(validEvents);
        const detectedTag = detectTagForCalendar(calendarName);

        newPreviews.push({
          file,
          content,
          calendarName,
          eventCount: validEvents.length,
          cancelledCount,
          dateRange,
          detectedTag,
          tagOverride: '',
          isFutureMoney: isFutureMoneyCalendar(calendarName),
        });
      } catch {
        setParseError(`Failed to read "${file.name}".`);
      }
    }

    setPreviews((prev) => {
      // Avoid duplicate file names
      const existing = new Set(prev.map((p) => p.file.name));
      return [...prev, ...newPreviews.filter((p) => !existing.has(p.file.name))];
    });
  }

  function updateTagOverride(index: number, tag: Tag) {
    setPreviews((prev) => prev.map((p, i) => i === index ? { ...p, tagOverride: tag } : p));
  }

  function removeFile(index: number) {
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImport() {
    if (previews.length === 0) return;
    setImporting(true);
    setResults([]);

    const newResults: ImportResult[] = [];

    for (const preview of previews) {
      try {
        const res = await fetch('/api/calendar/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ics_content: preview.content,
            calendar_name: preview.calendarName,
            tag_override: preview.tagOverride || undefined,
          }),
        });

        const data = await res.json();
        newResults.push({
          file: preview.file.name,
          imported: data.imported ?? 0,
          skipped: data.skipped ?? 0,
          invoices_created: data.invoices_created ?? 0,
          calendar_name: data.calendar_name ?? preview.calendarName,
          message: data.message ?? '',
          error: res.ok ? undefined : (data.error ?? 'Unknown error'),
        });
      } catch {
        newResults.push({
          file: preview.file.name,
          imported: 0,
          skipped: 0,
          invoices_created: 0,
          calendar_name: preview.calendarName,
          message: '',
          error: 'Network error',
        });
      }
    }

    setResults(newResults);
    setImporting(false);
    if (newResults.every((r) => !r.error)) {
      setPreviews([]);
    }
  }

  const totalEvents = previews.reduce((s, p) => s + p.eventCount, 0);
  const hasResults = results.length > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard/data" className="text-xs text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center gap-1">
          ← Data Hub
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mt-1">
          <Calendar className="w-6 h-6 text-fuchsia-600" />
          Import Google Calendar
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload one or more .ics files exported from Google Calendar. Events are imported as planner tasks.
          &ldquo;Future money&rdquo; events also create draft invoices from the PPI CBS template.
        </p>
      </div>

      {/* Upload zone */}
      {!hasResults && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-fuchsia-400 transition"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        >
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">Drop .ics files here or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">Supports multiple files at once</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics,.ical"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {parseError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {parseError}
        </div>
      )}

      {/* File previews */}
      {previews.length > 0 && !hasResults && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">
            {previews.length} file{previews.length !== 1 ? 's' : ''} · {totalEvents} events to import
          </h2>

          {previews.map((preview, idx) => (
            <div key={preview.file.name} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-fuchsia-50 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-fuchsia-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm truncate">{preview.calendarName}</span>
                    {preview.isFutureMoney && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                        future money → invoices
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{preview.file.name}</p>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-600">
                    <span><strong>{preview.eventCount}</strong> events</span>
                    {preview.cancelledCount > 0 && (
                      <span className="text-gray-400">{preview.cancelledCount} cancelled (skipped)</span>
                    )}
                    {preview.dateRange && (
                      <span>{formatDate(preview.dateRange.from)} → {formatDate(preview.dateRange.to)}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="p-1 text-gray-400 hover:text-gray-600 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tag override */}
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-500">Tag:</span>
                {(['', ...VALID_TAGS] as Tag[]).map((t) => {
                  const label = t === '' ? `Auto (${preview.detectedTag})` : t;
                  return (
                    <button
                      key={t}
                      onClick={() => updateTagOverride(idx, t)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${
                        (t === '' ? preview.tagOverride === '' : preview.tagOverride === t)
                          ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Add more files */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium"
          >
            + Add more files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics,.ical"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {/* Import button */}
          <div className="pt-2">
            <button
              onClick={handleImport}
              disabled={importing || totalEvents === 0}
              className="w-full py-3 bg-fuchsia-600 text-white rounded-xl font-semibold text-sm hover:bg-fuchsia-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {importing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
              ) : (
                <><Upload className="w-4 h-4" /> Import {totalEvents} Events</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Import Complete</h2>
          {results.map((r) => (
            <div
              key={r.file}
              className={`border rounded-xl p-4 ${r.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}
            >
              <div className="flex items-start gap-2">
                {r.error
                  ? <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  : <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                }
                <div>
                  <p className="text-sm font-semibold text-gray-900">{r.calendar_name}</p>
                  <p className="text-xs text-gray-500">{r.file}</p>
                  {r.error ? (
                    <p className="text-sm text-red-600 mt-1">{r.error}</p>
                  ) : (
                    <p className="text-sm text-gray-700 mt-1">{r.message}</p>
                  )}
                  {r.invoices_created > 0 && (
                    <p className="text-xs text-green-700 mt-1 font-medium">
                      {r.invoices_created} draft invoice{r.invoices_created !== 1 ? 's' : ''} created
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <Link
              href="/dashboard/planner"
              className="flex-1 py-2.5 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold text-center hover:bg-fuchsia-700 transition"
            >
              View in Planner
            </Link>
            {results.some((r) => r.invoices_created > 0) && (
              <Link
                href="/dashboard/finance?tab=invoices"
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold text-center hover:bg-indigo-700 transition"
              >
                View Invoices
              </Link>
            )}
            <button
              onClick={() => { setResults([]); setPreviews([]); }}
              className="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition"
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
