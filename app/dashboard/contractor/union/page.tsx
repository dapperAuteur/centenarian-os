'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Loader2, Upload, FileText, Trash2, Globe, Lock, AlertTriangle, CheckCircle, Clock, X,
} from 'lucide-react';

interface UnionDoc {
  id: string;
  name: string;
  union_local: string | null;
  doc_type: string;
  is_shared: boolean;
  status: string;
  error_msg: string | null;
  page_count: number | null;
  created_at: string;
  author?: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  contract: 'Contract',
  bylaws: 'Bylaws',
  rate_sheet: 'Rate Sheet',
  rules: 'Work Rules',
  other: 'Other',
};

const STATUS_STYLES: Record<string, { icon: typeof CheckCircle; color: string }> = {
  ready: { icon: CheckCircle, color: 'text-green-400' },
  processing: { icon: Clock, color: 'text-yellow-400' },
  pending: { icon: Clock, color: 'text-neutral-500' },
  error: { icon: AlertTriangle, color: 'text-red-400' },
};

export default function UnionDocumentsPage() {
  const [docs, setDocs] = useState<UnionDoc[]>([]);
  const [shared, setShared] = useState<UnionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [tab, setTab] = useState<'mine' | 'shared'>('mine');
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    union_local: '',
    doc_type: 'contract',
    is_shared: false,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/contractor/union/documents')
      .then((r) => r.json())
      .then((d) => {
        setDocs(d.documents ?? []);
        setShared(d.shared ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function uploadDoc() {
    if (!selectedFile || !form.name.trim()) return;
    setUploading(true);

    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('name', form.name.trim());
    fd.append('doc_type', form.doc_type);
    fd.append('is_shared', String(form.is_shared));
    if (form.union_local.trim()) fd.append('union_local', form.union_local.trim());

    const res = await fetch('/api/contractor/union/documents', { method: 'POST', body: fd });
    setUploading(false);

    if (res.ok) {
      setShowUpload(false);
      setForm({ name: '', union_local: '', doc_type: 'contract', is_shared: false });
      setSelectedFile(null);
      load();
    }
  }

  async function deleteDoc(id: string) {
    setDeletingId(id);
    await fetch(`/api/contractor/union/documents/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    load();
  }

  const list = tab === 'mine' ? docs : shared;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      {/* Disclaimer banner */}
      <div className="rounded-xl border border-yellow-700/50 bg-yellow-900/20 p-3 flex gap-2" role="alert">
        <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-yellow-300">
          AI-generated summaries are for reference only. They are not legal advice.
          Always consult your union representative or the official contract document for authoritative answers.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-neutral-100">Union Documents</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
        >
          <Upload size={14} /> Upload
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-800" role="tablist" aria-label="Document views">
        {[
          { id: 'mine' as const, label: 'My Documents' },
          { id: 'shared' as const, label: `Community (${shared.length})` },
        ].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500 ${
              tab === t.id
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Upload form */}
      {showUpload && (
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-100">Upload Document</h2>
            <button
              onClick={() => setShowUpload(false)}
              className="rounded p-1 text-neutral-500 hover:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label="Close upload form"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Document Name *</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                placeholder="IATSE Local 317 Contract 2025-2028"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Union Local</span>
              <input
                type="text"
                value={form.union_local}
                onChange={(e) => setForm({ ...form, union_local: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                placeholder="IATSE 317"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Document Type *</span>
              <select
                value={form.doc_type}
                onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <div>
              <span className="text-xs font-medium text-neutral-400">File (PDF, TXT, MD) *</span>
              <div className="mt-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.txt,.md"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-neutral-400 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-700 file:px-3 file:py-2 file:text-sm file:text-neutral-200 hover:file:bg-neutral-600 focus:outline-none"
                  aria-label="Select file to upload"
                />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_shared}
              onChange={(e) => setForm({ ...form, is_shared: e.target.checked })}
              className="rounded border-neutral-600 bg-neutral-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-neutral-900"
            />
            Share with community (others in same union can search this document)
          </label>

          <div className="flex gap-2 pt-1">
            <button
              onClick={uploadDoc}
              disabled={uploading || !form.name.trim() || !selectedFile}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Processing...' : 'Upload & Process'}
            </button>
            <button
              onClick={() => { setShowUpload(false); setSelectedFile(null); }}
              className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-400 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              Cancel
            </button>
          </div>

          {uploading && (
            <p className="text-xs text-neutral-500">
              Extracting text, chunking, and generating embeddings. This may take a moment for large documents.
            </p>
          )}
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-neutral-500" size={24} aria-label="Loading" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          {tab === 'mine'
            ? 'No documents yet. Upload a union contract, bylaws, or rate sheet to get started.'
            : 'No shared documents from the community yet.'}
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label={tab === 'mine' ? 'My documents' : 'Shared documents'}>
          {list.map((doc) => {
            const statusInfo = STATUS_STYLES[doc.status] ?? STATUS_STYLES.pending;
            const StatusIcon = statusInfo.icon;

            return (
              <article
                key={doc.id}
                role="listitem"
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText size={14} className="text-amber-400 shrink-0" aria-hidden="true" />
                      <span className="font-medium text-neutral-100 text-sm">{doc.name}</span>
                      <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                        {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                      </span>
                      <span className={`flex items-center gap-1 text-xs ${statusInfo.color}`}>
                        <StatusIcon size={12} aria-hidden="true" />
                        {doc.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500 flex-wrap">
                      {doc.union_local && <span>{doc.union_local}</span>}
                      {doc.page_count != null && <span>· {doc.page_count} chunks</span>}
                      <span>· {new Date(doc.created_at).toLocaleDateString()}</span>
                      {doc.is_shared ? (
                        <span className="flex items-center gap-0.5 text-green-400">
                          <Globe size={10} /> Shared
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5">
                          <Lock size={10} /> Private
                        </span>
                      )}
                      {doc.author && <span>· by {doc.author}</span>}
                    </div>
                    {doc.error_msg && (
                      <p className="mt-1 text-xs text-red-400">{doc.error_msg}</p>
                    )}
                  </div>

                  {tab === 'mine' && (
                    <button
                      onClick={() => deleteDoc(doc.id)}
                      disabled={deletingId === doc.id}
                      className="rounded p-1.5 text-neutral-500 hover:text-red-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      aria-label={`Delete ${doc.name}`}
                    >
                      {deletingId === doc.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
