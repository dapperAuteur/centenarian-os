'use client';

// components/academy/DocumentViewer.tsx
// Gallery of primary source documents (PDFs, images, inline text) with "View Original" links.
// Supports inline_content for documents that don't require external URLs (e.g. transcripts).

import { useState } from 'react';
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

function isPdf(url: string): boolean {
  return url.toLowerCase().endsWith('.pdf') || url.includes('/pdf');
}

function isImage(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(url);
}

function hasValidUrl(url: string | undefined | null): boolean {
  if (!url || url.trim() === '' || url === '#') return false;
  try {
    new URL(url, 'https://placeholder.com');
    return !url.startsWith('#');
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
        <FileText className="w-4 h-4 text-fuchsia-400" /> Primary Sources
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
            <FileText className="w-5 h-5 text-gray-600 group-hover:text-fuchsia-400 transition shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 group-hover:text-white transition truncate">{doc.title}</p>
              {doc.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{doc.description}</p>
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
              className="p-1.5 text-gray-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{selected.title}</p>
              {selected.description && (
                <p className="text-xs text-gray-500 truncate">{selected.description}</p>
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
                  <ExternalLink className="w-3 h-3" /> View Original
                </a>
              )}
              {documents.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={selectedIdx === 0}
                    onClick={() => setSelectedIdx(selectedIdx - 1)}
                    className="p-1.5 text-gray-400 hover:text-white transition disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-gray-500">{selectedIdx + 1}/{documents.length}</span>
                  <button
                    type="button"
                    disabled={selectedIdx === documents.length - 1}
                    onClick={() => setSelectedIdx(selectedIdx + 1)}
                    className="p-1.5 text-gray-400 hover:text-white transition disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            {selected.inline_content ? (
              /* Inline text content — rendered directly, works offline */
              <div className="max-w-3xl mx-auto bg-gray-900 border border-gray-800 rounded-xl p-6 sm:p-8">
                <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-gray-200 leading-relaxed">
                  {selected.inline_content}
                </div>
              </div>
            ) : !hasValidUrl(selected.url) ? (
              /* No valid URL and no inline content */
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
                <AlertTriangle className="w-8 h-8 text-amber-500/60" />
                <p className="text-sm">This document is not available yet.</p>
                <p className="text-xs text-gray-600">The content URL has not been set up.</p>
              </div>
            ) : isPdf(selected.url) ? (
              <iframe
                src={selected.url}
                className="w-full h-full min-h-[60vh] bg-white rounded-lg"
                title={selected.title}
              />
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
              /* Unknown file type — try iframe, show helpful message if it fails */
              <iframe
                src={selected.url}
                className="w-full h-full min-h-[60vh] bg-white rounded-lg"
                title={selected.title}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
