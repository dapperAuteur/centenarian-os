'use client';

// components/ai/GemKnowledgeBase.tsx
// Collapsible sidebar panel for managing a gem's persistent knowledge base documents.

import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Upload, Trash2, Loader2, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface GemDocument {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

interface Props {
  gemId: string;
}

const ACCEPTED_TYPES = '.csv,.txt,.md,.pdf,.json';

export default function GemKnowledgeBase({ gemId }: Props) {
  const [docs, setDocs] = useState<GemDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await offlineFetch(`/api/coach/documents?gem_persona_id=${gemId}`);
      if (res.ok) setDocs(await res.json());
    } finally {
      setLoading(false);
    }
  }, [gemId]);

  useEffect(() => {
    if (gemId) loadDocs();
  }, [gemId, loadDocs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('gem_persona_id', gemId);
      formData.append('file', file);

      const res = await fetch('/api/coach/documents', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Upload failed');
      }

      await loadDocs();
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    const res = await fetch(`/api/coach/documents/${docId}`, { method: 'DELETE' });
    if (res.ok) setDocs(prev => prev.filter(d => d.id !== docId));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="border-t pt-3">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900 transition"
      >
        <span className="flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-fuchsia-500" />
          Knowledge Base
          {docs.length > 0 && (
            <span className="text-xs bg-fuchsia-100 text-fuchsia-700 px-1.5 py-0.5 rounded-full font-semibold">
              {docs.length}
            </span>
          )}
        </span>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {loading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          ) : docs.length === 0 ? (
            <p className="text-xs text-gray-400 py-1">
              No documents yet. Upload files for this gem to reference across all chats.
            </p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {docs.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-1.5 px-2 py-1.5 bg-gray-50 rounded-lg text-xs group"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate text-gray-700">{doc.name}</span>
                    <span className="text-gray-400 shrink-0">{formatSize(doc.size_bytes)}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 shrink-0"
                    title="Remove document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>
          )}

          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-xs font-medium text-fuchsia-700 bg-fuchsia-50 rounded-lg hover:bg-fuchsia-100 transition disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
