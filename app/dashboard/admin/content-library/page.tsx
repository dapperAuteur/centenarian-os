'use client';

// app/dashboard/admin/content-library/page.tsx
// Admin content library: view available tutorial series, import into Academy, manage status.

import { useState, useEffect, useCallback } from 'react';
import {
  Library,
  Loader2,
  RefreshCw,
  Upload,
  CheckCircle2,
  XCircle,
  BookOpen,
  ExternalLink,
  FileText,
  Layers,
} from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface ContentItem {
  slug: string;
  title: string;
  description: string;
  type: 'academy';
  lessonCount: number;
  moduleCount: number;
  hasFiles: boolean;
  imported: boolean;
  courseId: string | null;
  isPublished: boolean;
  importedAt: string | null;
}

function statusBadge(item: ContentItem) {
  if (!item.hasFiles) return { label: 'No Files', cls: 'bg-gray-100 text-gray-500' };
  if (item.imported && item.isPublished) return { label: 'Published', cls: 'bg-green-100 text-green-700' };
  if (item.imported) return { label: 'Imported (Draft)', cls: 'bg-blue-100 text-blue-700' };
  return { label: 'Available', cls: 'bg-amber-100 text-amber-700' };
}

export default function ContentLibraryPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [result, setResult] = useState<{ slug: string; success: boolean; message: string } | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await offlineFetch('/api/admin/content-library');
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function handleImport(slug: string) {
    setImporting(slug);
    setResult(null);
    try {
      const res = await offlineFetch('/api/admin/content-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult({
          slug,
          success: true,
          message: `Imported "${data.title}" — ${data.modulesCreated} modules, ${data.lessonsCreated} lessons${data.errors.length ? ` (${data.errors.length} errors)` : ''}`,
        });
        loadItems();
      } else {
        setResult({
          slug,
          success: false,
          message: data.error ?? 'Import failed',
        });
      }
    } catch {
      setResult({ slug, success: false, message: 'Network error' });
    } finally {
      setImporting(null);
    }
  }

  const available = items.filter((i) => i.hasFiles && !i.imported);
  const imported = items.filter((i) => i.imported);
  const noFiles = items.filter((i) => !i.hasFiles);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-fuchsia-100 flex items-center justify-center">
            <Library className="w-5 h-5 text-fuchsia-600" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Content Library</h1>
            <p className="text-sm text-gray-500">Import tutorial courses into the Academy</p>
          </div>
        </div>
        <button
          onClick={loadItems}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition min-h-11"
          aria-label="Refresh content list"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Result banner */}
      {result && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
            result.success
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
          role="alert"
        >
          {result.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
          {result.message}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" aria-label="Loading..." />
        </div>
      ) : (
        <>
          {/* Available for import */}
          {available.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-500" aria-hidden="true" />
                Available to Import ({available.length})
              </h2>
              <div className="grid gap-4">
                {available.map((item) => (
                  <ContentCard
                    key={item.slug}
                    item={item}
                    importing={importing === item.slug}
                    onImport={() => handleImport(item.slug)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Already imported */}
          {imported.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" aria-hidden="true" />
                Imported ({imported.length})
              </h2>
              <div className="grid gap-4">
                {imported.map((item) => (
                  <ContentCard key={item.slug} item={item} imported />
                ))}
              </div>
            </section>
          )}

          {/* No files yet */}
          {noFiles.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" aria-hidden="true" />
                No Content Files ({noFiles.length})
              </h2>
              <div className="grid gap-3">
                {noFiles.map((item) => (
                  <div key={item.slug} className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-500">
                    {item.title} — <span className="italic">no markdown files in content/tutorials/{item.slug}/</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Import all button */}
          {available.length > 1 && (
            <div className="mt-8 text-center">
              <ImportAllButton items={available} importing={importing} onImport={handleImport} onDone={loadItems} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ContentCard({
  item,
  importing,
  imported,
  onImport,
}: {
  item: ContentItem;
  importing?: boolean;
  imported?: boolean;
  onImport?: () => void;
}) {
  const badge = statusBadge(item);

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <p className="text-sm text-gray-500 line-clamp-1 mb-2">{item.description}</p>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" aria-hidden="true" />
            {item.moduleCount} modules
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            {item.lessonCount} lessons
          </span>
          {item.importedAt && (
            <span>
              Imported {new Date(item.importedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {imported && item.courseId && (
          <a
            href={`/dashboard/teaching/courses/${item.courseId}`}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-fuchsia-600 bg-fuchsia-50 border border-fuchsia-200 rounded-lg hover:bg-fuchsia-100 transition min-h-11"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            Edit Course
          </a>
        )}
        {!imported && onImport && (
          <button
            onClick={onImport}
            disabled={importing}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-fuchsia-600 rounded-lg hover:bg-fuchsia-700 transition disabled:opacity-60 disabled:cursor-not-allowed min-h-11"
          >
            {importing ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="w-4 h-4" aria-hidden="true" />
            )}
            {importing ? 'Importing...' : 'Import'}
          </button>
        )}
      </div>
    </div>
  );
}

function ImportAllButton({
  items,
  importing,
  onImport,
  onDone,
}: {
  items: ContentItem[];
  importing: string | null;
  onImport: (slug: string) => Promise<void>;
  onDone: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleImportAll() {
    setRunning(true);
    setProgress(0);
    for (let i = 0; i < items.length; i++) {
      await onImport(items[i].slug);
      setProgress(i + 1);
    }
    setRunning(false);
    onDone();
  }

  if (running) {
    return (
      <div className="inline-flex items-center gap-3 px-6 py-3 bg-fuchsia-50 border border-fuchsia-200 rounded-xl text-sm font-medium text-fuchsia-700">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        Importing {progress} of {items.length}...
      </div>
    );
  }

  return (
    <button
      onClick={handleImportAll}
      disabled={!!importing}
      className="inline-flex items-center gap-2 px-6 py-3 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-60 min-h-11"
    >
      <Upload className="w-4 h-4" aria-hidden="true" />
      Import All ({items.length} courses)
    </button>
  );
}
