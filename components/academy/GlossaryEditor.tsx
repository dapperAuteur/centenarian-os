'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Pencil, Loader2, Upload, HelpCircle } from 'lucide-react';
import DataImporter from '@/components/academy/DataImporter';
import LessonTextEditor from '@/components/academy/LessonTextEditor';
import PhoneticGuideModal from '@/components/academy/PhoneticGuideModal';
import { renderTextContent } from '@/lib/academy/renderTextContent';
import type { GlossaryTerm } from '@/components/academy/GlossaryTermRow';

interface Props {
  courseId: string;
  lessons: Array<{ id: string; title: string }>;
}

const IMPORT_COLUMNS = [
  { key: 'term', label: 'Term', required: true },
  { key: 'phonetic', label: 'Phonetic' },
  { key: 'definition', label: 'Definition' },
  { key: 'lesson_title', label: 'Lesson Title' },
];

export default function GlossaryEditor({ courseId, lessons }: Props) {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [showPhoneticGuide, setShowPhoneticGuide] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  const [draft, setDraft] = useState({
    term: '',
    phonetic: '',
    definition: '',
    definition_format: 'markdown' as 'markdown' | 'tiptap',
    sort_order: 0,
    lesson_id: '',
  });

  const fetchTerms = useCallback(async () => {
    const res = await fetch(`/api/academy/courses/${courseId}/glossary`);
    if (res.ok) {
      const data = await res.json();
      setTerms(data);
    }
    setLoading(false);
  }, [courseId]);

  useEffect(() => { fetchTerms(); }, [fetchTerms]);

  function resetDraft() {
    setDraft({ term: '', phonetic: '', definition: '', definition_format: 'markdown', sort_order: terms.length, lesson_id: '' });
  }

  function startAdd() {
    setEditingId(null);
    resetDraft();
    setDraft((d) => ({ ...d, sort_order: terms.length }));
    setAddingNew(true);
  }

  function startEdit(t: GlossaryTerm) {
    setAddingNew(false);
    setEditingId(t.id);
    setDraft({
      term: t.term,
      phonetic: t.phonetic ?? '',
      definition: t.definition ?? '',
      definition_format: t.definition_format,
      sort_order: t.sort_order,
      lesson_id: t.lesson_id ?? '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setAddingNew(false);
  }

  async function saveTerm() {
    if (!draft.term.trim()) return;
    setSaving(true);

    const body = {
      term: draft.term.trim(),
      phonetic: draft.phonetic.trim() || null,
      definition: draft.definition || null,
      definition_format: draft.definition_format,
      sort_order: draft.sort_order,
      lesson_id: draft.lesson_id || null,
    };

    if (addingNew) {
      const res = await fetch(`/api/academy/courses/${courseId}/glossary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchTerms();
        setAddingNew(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add term');
      }
    } else if (editingId) {
      const res = await fetch(`/api/academy/courses/${courseId}/glossary/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchTerms();
        setEditingId(null);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update term');
      }
    }

    setSaving(false);
  }

  async function deleteTerm(id: string) {
    if (!confirm('Delete this glossary term?')) return;
    await fetch(`/api/academy/courses/${courseId}/glossary/${id}`, { method: 'DELETE' });
    setTerms((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
  }

  async function handleImport(rows: Record<string, string>[]) {
    setImportResult(null);
    const res = await fetch(`/api/academy/courses/${courseId}/glossary/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    setImportResult(data);
    if (data.imported > 0) fetchTerms();
  }

  const lessonName = (lessonId: string | null) => {
    if (!lessonId) return 'Course-wide';
    return lessons.find((l) => l.id === lessonId)?.title ?? 'Unknown lesson';
  };

  if (loading) return <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading glossary...</div>;

  const isEditing = addingNew || editingId !== null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-400">{terms.length} term{terms.length !== 1 ? 's' : ''}</span>
        <button type="button" onClick={startAdd} disabled={isEditing} className="flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50">
          <Plus className="w-3 h-3" /> Add Term
        </button>
        <button type="button" onClick={() => setShowImporter((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700 transition">
          <Upload className="w-3 h-3" /> {showImporter ? 'Hide' : 'CSV'} Import
        </button>
      </div>

      {/* CSV Importer */}
      {showImporter && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <DataImporter
            label="Import Glossary Terms"
            columns={IMPORT_COLUMNS}
            onImport={handleImport}
            templateCsvUrl="/templates/glossary-import-template.csv"
          />
          {importResult && (
            <div className="text-xs space-y-1">
              <p className="text-green-400">Imported {importResult.imported} term{importResult.imported !== 1 ? 's' : ''}{importResult.skipped > 0 ? `, skipped ${importResult.skipped}` : ''}</p>
              {importResult.errors.map((e, i) => <p key={i} className="text-amber-400">{e}</p>)}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Form */}
      {isEditing && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-white">{addingNew ? 'New Term' : 'Edit Term'}</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Term *</label>
              <input
                type="text"
                value={draft.term}
                onChange={(e) => setDraft((d) => ({ ...d, term: e.target.value }))}
                placeholder="e.g. Synapse"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                Phonetic
                <button type="button" onClick={() => setShowPhoneticGuide(true)} className="text-fuchsia-400 hover:text-fuchsia-300" title="Phonetic guide">
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </label>
              <input
                type="text"
                value={draft.phonetic}
                onChange={(e) => setDraft((d) => ({ ...d, phonetic: e.target.value }))}
                placeholder="e.g. SY-naps"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Lesson (optional)</label>
              <select
                value={draft.lesson_id}
                onChange={(e) => setDraft((d) => ({ ...d, lesson_id: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500"
              >
                <option value="">Course-wide</option>
                {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Sort Order</label>
              <input
                type="number"
                value={draft.sort_order}
                onChange={(e) => setDraft((d) => ({ ...d, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500"
              />
            </div>
          </div>

          {/* Definition */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs text-gray-500">Definition</label>
              <div className="flex text-xs rounded-lg overflow-hidden border border-gray-700">
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, definition_format: 'markdown' }))}
                  className={`px-2.5 py-1 transition ${draft.definition_format !== 'tiptap' ? 'bg-fuchsia-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                >
                  Markdown
                </button>
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, definition_format: 'tiptap' }))}
                  className={`px-2.5 py-1 transition ${draft.definition_format === 'tiptap' ? 'bg-fuchsia-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                >
                  Rich Text
                </button>
              </div>
            </div>
            {draft.definition_format === 'tiptap' ? (
              <LessonTextEditor
                content={draft.definition || null}
                onChange={(json) => setDraft((d) => ({ ...d, definition: json }))}
                placeholder="Definition…"
              />
            ) : (
              <textarea
                value={draft.definition}
                onChange={(e) => setDraft((d) => ({ ...d, definition: e.target.value }))}
                placeholder="Definition (markdown supported)…"
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
              />
            )}
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={saveTerm} disabled={saving || !draft.term.trim()} className="px-4 py-2 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50 min-h-10">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : addingNew ? 'Add Term' : 'Save Changes'}
            </button>
            <button type="button" onClick={cancelEdit} className="px-4 py-2 bg-gray-800 text-gray-400 rounded-xl text-sm hover:bg-gray-700 transition min-h-10">Cancel</button>
          </div>
        </div>
      )}

      {/* Term List */}
      {terms.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800 overflow-hidden">
          {terms.map((t) => (
            <div key={t.id} className="px-4 py-3 flex items-start gap-3 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">{t.term}</span>
                  {t.phonetic && <span className="text-xs text-gray-500 italic">({t.phonetic})</span>}
                  {t.lesson_id && (
                    <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">{lessonName(t.lesson_id)}</span>
                  )}
                </div>
                {t.definition && (
                  <div
                    className="mt-1 text-xs text-gray-400 line-clamp-2 prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderTextContent(t.definition, t.definition_format) }}
                  />
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                <button type="button" onClick={() => startEdit(t)} className="p-1.5 text-gray-500 hover:text-fuchsia-400 transition" title="Edit">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => deleteTerm(t.id)} className="p-1.5 text-gray-500 hover:text-red-400 transition" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {terms.length === 0 && !addingNew && (
        <p className="text-xs text-gray-600">No glossary terms yet. Add terms individually or import from CSV.</p>
      )}

      <PhoneticGuideModal isOpen={showPhoneticGuide} onClose={() => setShowPhoneticGuide(false)} />
    </div>
  );
}
