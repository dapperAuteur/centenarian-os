'use client';

// components/academy/LessonDocumentEditor.tsx
// Reusable document editor for adding/removing/uploading primary source documents on a lesson.

import { useState } from 'react';
import { Plus, X, Paperclip, ChevronDown } from 'lucide-react';
import MediaUploader from '@/components/ui/MediaUploader';

export interface DocDraft {
  id: string;
  url: string;
  title: string;
  description: string;
  source_url: string;
}

interface LessonDocumentEditorProps {
  documents: DocDraft[];
  onChange: (docs: DocDraft[]) => void;
  /** Start expanded (default false) */
  defaultOpen?: boolean;
}

export default function LessonDocumentEditor({ documents, onChange, defaultOpen = false }: LessonDocumentEditorProps) {
  const [open, setOpen] = useState(defaultOpen);

  function add() {
    onChange([...documents, { id: crypto.randomUUID(), url: '', title: '', description: '', source_url: '' }]);
  }

  function update(docId: string, updates: Partial<DocDraft>) {
    onChange(documents.map((d) => d.id === docId ? { ...d, ...updates } : d));
  }

  function remove(docId: string) {
    onChange(documents.filter((d) => d.id !== docId));
  }

  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-800/50 text-sm font-semibold text-gray-300 hover:bg-gray-800 transition"
      >
        <Paperclip className="w-3.5 h-3.5 text-fuchsia-400" />
        Documents
        <span className="text-xs text-gray-600 ml-1">
          {documents.length > 0 ? `(${documents.length} docs)` : '(optional)'}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 ml-auto text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="p-3 space-y-3 bg-gray-800/20">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Documents</p>
            <button type="button" onClick={add} className="flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition">
              <Plus className="w-3 h-3" /> Add Document
            </button>
          </div>
          {documents.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-2">No documents. Click &quot;Add Document&quot; to attach PDFs or images.</p>
          )}
          <div className="space-y-2">
            {documents.map((doc, di) => (
              <div key={doc.id} className="border border-gray-700 rounded-lg p-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0 w-5">{di + 1}</span>
                  <input
                    type="text"
                    value={doc.title}
                    onChange={(e) => update(doc.id, { title: e.target.value })}
                    placeholder="Document title…"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-fuchsia-500"
                  />
                  <button type="button" onClick={() => remove(doc.id)} className="text-gray-600 hover:text-red-400 transition p-1 shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="ml-7">
                  <MediaUploader
                    dark
                    accept="image/*,.pdf,application/pdf"
                    onUpload={(url) => update(doc.id, { url })}
                    onRemove={() => update(doc.id, { url: '' })}
                    currentUrl={doc.url || undefined}
                    label="Upload PDF or image"
                  />
                </div>
                <div className="ml-7 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={doc.description}
                    onChange={(e) => update(doc.id, { description: e.target.value })}
                    placeholder="Description…"
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-fuchsia-500"
                  />
                  <input
                    type="url"
                    value={doc.source_url}
                    onChange={(e) => update(doc.id, { source_url: e.target.value })}
                    placeholder="Original source URL…"
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-fuchsia-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
