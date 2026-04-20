'use client';

// components/academy/DocumentViewer.tsx
// Gallery of primary source documents (PDFs, images, inline text) with "View Original" links.
// Supports inline_content for documents that don't require external URLs (e.g. transcripts).

import { useEffect, useRef, useState } from 'react';
import { FileText, ExternalLink, ChevronLeft, ChevronRight, X, AlertTriangle } from 'lucide-react';

export interface DocumentItem {
  id: string;
  url: string;
  title: string;
  description?: string;
  source_url?: string;
  /** When set, renders this text directly instead of loading url in iframe/img. */
  inline_content?: string;
}

interface DocumentViewerProps {
  documents: DocumentItem[];
}

/**
 * Iframe with load-failure fallback. Browsers don't fire `onerror` on
 * 404 navigations inside an iframe, so we treat "didn't fire onload
 * within N seconds" as a likely embed failure and surface a friendly
 * panel with an "open in new tab" escape. The user still gets the
 * iframe if it eventually loads — state only flips on timeout, not on
 * successful load.
 */
function IframeWithFallback({ src, title }: { src: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    loadedRef.current = false;
    setFailed(false);
    const timer = setTimeout(() => {
      if (!loadedRef.current) setFailed(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [src]);

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-center h-full min-h-[50vh] px-6">
        <AlertTriangle className="w-10 h-10 text-amber-500/70" aria-hidden="true" />
        <p className="text-sm text-gray-300 max-w-md">
          This document didn&apos;t load inside the viewer. The link may be
          broken, or the source site may not allow embedding.
        </p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 transition min-h-11"
        >
          <ExternalLink className="w-4 h-4" aria-hidden="true" /> Open in a new tab
        </a>
        <p className="text-xs text-gray-500 max-w-md">
          If the link 404s in the new tab too, tell your teacher — the
          document needs to be re-uploaded.
        </p>
      </div>
    );
  }

  return (
    <iframe
      src={src}
      onLoad={() => { loadedRef.current = true; }}
      className="w-full h-full min-h-[60vh] bg-white rounded-lg"
      title={title}
    />
  );
}

function isPdf(url: string): boolean {
  return url.toLowerCase().endsWith('.pdf') || url.includes('/pdf');
}

function isImage(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(url);
}

function hasValidUrl(url: string | undefined | null): boolean {
  if (!url || url === '#') return false;
  const trimmed = url.trim();
  if (trimmed === '' || trimmed.startsWith('#')) return false;
  // Require an absolute http/https URL. Anything else — bare filenames,
  // "REPLACE_WITH_…" placeholders, paths starting with "/", mailto:, etc. —
  // is treated as missing so the viewer shows its "not available" fallback
  // instead of loading a broken iframe that 404s silently.
  try {
    const u = new URL(trimmed);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function DocumentViewer({ documents }: DocumentViewerProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (documents.length === 0) return null;

  const selected = selectedIdx !== null ? documents[selectedIdx] : null;

  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4 text-fuchsia-400" aria-hidden="true" /> Primary Sources
      </h3>

      {/* Document cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {documents.map((doc, idx) => (
          <button
            key={doc.id}
            type="button"
            onClick={() => setSelectedIdx(idx)}
            className="flex items-start gap-3 p-3 bg-gray-900 border border-gray-800 rounded-xl hover:border-fuchsia-700/50 transition text-left group"
          >
            <FileText className="w-5 h-5 text-gray-400 group-hover:text-fuchsia-400 transition shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 group-hover:text-white transition truncate">{doc.title}</p>
              {doc.description && (
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{doc.description}</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Document viewer modal/overlay */}
      {selected && selectedIdx !== null && (
        <div className="fixed inset-0 bg-black/80 z-60 flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800">
            <button
              type="button"
              onClick={() => setSelectedIdx(null)}
              className="min-h-11 min-w-11 flex items-center justify-center text-gray-300 hover:text-white transition"
              aria-label="Close document viewer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{selected.title}</p>
              {selected.description && (
                <p className="text-xs text-gray-400 truncate">{selected.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selected.source_url && hasValidUrl(selected.source_url) && (
                <a
                  href={selected.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700 transition"
                >
                  <ExternalLink className="w-3 h-3" aria-hidden="true" /> View Original
                </a>
              )}
              {documents.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={selectedIdx === 0}
                    onClick={() => setSelectedIdx(selectedIdx - 1)}
                    className="min-h-11 min-w-11 flex items-center justify-center text-gray-300 hover:text-white transition disabled:opacity-30"
                    aria-label="Previous document"
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <span className="text-xs text-gray-400">{selectedIdx + 1}/{documents.length}</span>
                  <button
                    type="button"
                    disabled={selectedIdx === documents.length - 1}
                    onClick={() => setSelectedIdx(selectedIdx + 1)}
                    className="min-h-11 min-w-11 flex items-center justify-center text-gray-300 hover:text-white transition disabled:opacity-30"
                    aria-label="Next document"
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            {selected.inline_content ? (
              /* Inline text content — rendered directly, works offline */
              <article className="max-w-2xl mx-auto bg-gray-900 border border-gray-800 rounded-xl px-6 py-8 sm:px-10 sm:py-12">
                <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">
                  {selected.title}
                </h2>
                {selected.description && (
                  <p className="text-sm text-gray-400 mb-6">{selected.description}</p>
                )}
                <div
                  className="
                    text-gray-200 whitespace-pre-wrap
                    text-[15px] sm:text-base
                    leading-7 sm:leading-8
                    font-normal tracking-[0.005em]
                    [&>p]:mb-4
                  "
                >
                  {selected.inline_content}
                </div>
              </article>
            ) : !hasValidUrl(selected.url) ? (
              /* No valid URL and no inline content */
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                <AlertTriangle className="w-10 h-10 text-amber-500/70" aria-hidden="true" />
                <p className="text-sm text-gray-300 max-w-md">This document hasn&apos;t been uploaded yet.</p>
                <p className="text-xs text-gray-500 max-w-md">
                  The teacher has listed it as a resource but the file URL is
                  missing. Let them know so they can finish the upload.
                </p>
              </div>
            ) : isPdf(selected.url) ? (
              <IframeWithFallback src={selected.url} title={selected.title} />
            ) : isImage(selected.url) ? (
              <div className="flex items-center justify-center h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.url}
                  alt={selected.title}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                />
              </div>
            ) : (
              /* Unknown file type — try iframe, fall back if load fails */
              <IframeWithFallback src={selected.url} title={selected.title} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
