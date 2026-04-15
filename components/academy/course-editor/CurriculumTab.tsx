'use client';

// components/academy/course-editor/CurriculumTab.tsx
// Curriculum builder: modules, lessons (all types), bulk CSV import/export.
// Extracted from the monolithic course editor.

import { useState } from 'react';
import {
  Plus, Loader2, Trash2, Upload, Download, Play, FileText, Volume2,
  Presentation, GripVertical, HelpCircle, X, Map, ChevronDown, Paperclip,
  Compass, Image as ImageIcon, Pencil,
} from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import DataImporter from '@/components/academy/DataImporter';
import LessonDocumentEditor from '@/components/academy/LessonDocumentEditor';
import type { DocDraft } from '@/components/academy/LessonDocumentEditor';
import Cloudinary360Uploader from '@/components/academy/Cloudinary360Uploader';

interface Lesson {
  id: string;
  title: string;
  lesson_type: string;
  content_url: string | null;
  text_content: string | null;
  duration_seconds: number | null;
  order: number;
  is_free_preview: boolean;
  module_id: string | null;
  video_360_autoplay?: boolean | null;
}

interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  price: number;
  price_type: string;
  is_published: boolean;
  navigation_mode: 'linear' | 'cyoa';
  is_sequential: boolean;
  visibility: 'public' | 'members' | 'scheduled';
  published_at: string | null;
  trial_period_days: number;
  course_modules: Module[];
}

interface QuizQuestionDraft {
  id: string;
  questionText: string;
  questionType: 'multiple_choice' | 'true_false';
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
  explanation: string;
  citation: string;
}

const LESSON_TYPE_ICON: Record<string, React.ElementType> = {
  video: Play, text: FileText, audio: Volume2, slides: Presentation, quiz: HelpCircle,
  '360video': Compass, photo_360: ImageIcon,
};

interface TabProps {
  course: Course;
  courseId: string;
  onCourseUpdated: () => void;
  setFeedback: (msg: string) => void;
}

export default function CurriculumTab({ course, courseId, onCourseUpdated, setFeedback }: TabProps) {
  // Module state
  const [addingModule, setAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');

  // Lesson state
  const [addingLesson, setAddingLesson] = useState<string | null>(null);
  const [newLesson, setNewLesson] = useState({ title: '', lesson_type: 'video', content_url: '', is_free_preview: false, video_360_autoplay: false });

  // Inline lesson edit state
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<Partial<Lesson>>({});
  const [savingLesson, setSavingLesson] = useState(false);
  const [editingAudioChapters, setEditingAudioChapters] = useState<Array<{ id: string; title: string; startTime: number; endTime: number }>>([]);
  const [editingTranscriptText, setEditingTranscriptText] = useState('');

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionDraft[]>([]);
  const [quizPassingScore, setQuizPassingScore] = useState(80);
  const [quizAttemptsAllowed, setQuizAttemptsAllowed] = useState(-1);

  // Audio/video chapters & transcript
  const [audioChapters, setAudioChapters] = useState<Array<{ id: string; title: string; startTime: number; endTime: number }>>([]);
  const [transcriptText, setTranscriptText] = useState('');

  // Map editor state
  const [showMapSection, setShowMapSection] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 0, lng: 0 });
  const [mapZoom, setMapZoom] = useState(3);
  const [mapMarkers, setMapMarkers] = useState<Array<{ id: string; lat: number; lng: number; title: string; description: string; color: string }>>([]);
  const [mapLines, setMapLines] = useState<Array<{ id: string; coords: [number, number][]; title: string; color: string; description: string }>>([]);
  const [mapPolygons, setMapPolygons] = useState<Array<{ id: string; coords: [number, number][]; title: string; color: string; fillColor: string; description: string }>>([]);

  // Document & podcast state
  const [lessonDocuments, setLessonDocuments] = useState<Array<{ id: string; url: string; title: string; description: string; source_url: string }>>([]);
  const [podcastLinks, setPodcastLinks] = useState<Array<{ id: string; url: string; label: string }>>([]);

  // Bulk import state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState<{ message: string; errors?: string[] } | null>(null);
  const [bulkImportMode, setBulkImportMode] = useState<'create' | 'upsert' | 'replace'>('create');

  // Inline doc editing
  const [editingDocsLessonId, setEditingDocsLessonId] = useState<string | null>(null);
  const [editingDocs, setEditingDocs] = useState<DocDraft[]>([]);
  const [savingDocs, setSavingDocs] = useState(false);

  const modules = [...course.course_modules].sort((a, b) => a.order - b.order);

  // ── Handlers ──────────────────────────────────────────────────────────

  async function addModule() {
    if (!newModuleTitle.trim()) return;
    const r = await offlineFetch(`/api/academy/courses/${courseId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newModuleTitle.trim(), order: (course?.course_modules.length ?? 0) }),
    });
    if (r.ok) { setNewModuleTitle(''); setAddingModule(false); onCourseUpdated(); }
  }

  function parseTranscriptText(raw: string): Array<{ startTime: number; endTime: number; text: string }> {
    const lines = raw.split('\n').filter((l) => l.trim());
    const segments: Array<{ startTime: number; endTime: number; text: string }> = [];
    for (const line of lines) {
      const match = line.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(.+)$/);
      if (!match) continue;
      const [, h, m, s, text] = match;
      const startTime = s ? Number(h) * 3600 + Number(m) * 60 + Number(s) : Number(h) * 60 + Number(m);
      segments.push({ startTime, endTime: 0, text: text.trim() });
    }
    for (let i = 0; i < segments.length - 1; i++) {
      segments[i].endTime = segments[i + 1].startTime;
    }
    if (segments.length > 0) segments[segments.length - 1].endTime = segments[segments.length - 1].startTime + 30;
    return segments;
  }

  async function addLesson(moduleId: string) {
    if (!newLesson.title.trim()) return;
    const payload: Record<string, unknown> = {
      ...newLesson,
      module_id: moduleId,
      order: (course?.course_modules.find((m) => m.id === moduleId)?.lessons.length ?? 0),
    };
    if (newLesson.lesson_type !== '360video') {
      delete payload.video_360_autoplay;
    }
    if (newLesson.lesson_type === 'quiz' && quizQuestions.length > 0) {
      payload.quiz_content = { questions: quizQuestions, passingScore: quizPassingScore, attemptsAllowed: quizAttemptsAllowed };
    }
    if (newLesson.lesson_type === 'audio' || newLesson.lesson_type === 'video') {
      if (audioChapters.length > 0) payload.audio_chapters = audioChapters;
      if (transcriptText.trim()) payload.transcript_content = parseTranscriptText(transcriptText);
    }
    if (newLesson.lesson_type === 'audio') {
      const validLinks = podcastLinks.filter((l) => l.url.trim());
      if (validLinks.length > 0) payload.podcast_links = validLinks.map(({ url, label }) => ({ url, label }));
    }
    const hasMapData = mapMarkers.length > 0 || mapLines.length > 0 || mapPolygons.length > 0;
    if (hasMapData) {
      payload.map_content = {
        center: [mapCenter.lat, mapCenter.lng],
        zoom: mapZoom,
        ...(mapMarkers.length > 0 ? { markers: mapMarkers } : {}),
        ...(mapLines.length > 0 ? { lines: mapLines } : {}),
        ...(mapPolygons.length > 0 ? { polygons: mapPolygons } : {}),
      };
    }
    if (lessonDocuments.length > 0) {
      payload.documents = lessonDocuments.filter((d) => d.url.trim());
    }
    const r = await offlineFetch(`/api/academy/courses/${courseId}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      setNewLesson({ title: '', lesson_type: 'video', content_url: '', is_free_preview: false, video_360_autoplay: false });
      setQuizQuestions([]); setQuizPassingScore(80); setQuizAttemptsAllowed(-1);
      setAudioChapters([]); setTranscriptText('');
      setMapCenter({ lat: 0, lng: 0 }); setMapZoom(3); setMapMarkers([]); setMapLines([]); setMapPolygons([]);
      setShowMapSection(false); setLessonDocuments([]); setPodcastLinks([]);
      setAddingLesson(null);
      onCourseUpdated();
    }
  }

  // Quiz helpers
  function addQuizQuestion() {
    setQuizQuestions((prev) => [...prev, {
      id: crypto.randomUUID(), questionText: '', questionType: 'multiple_choice',
      options: [{ id: crypto.randomUUID(), text: '' }, { id: crypto.randomUUID(), text: '' }],
      correctOptionId: '', explanation: '', citation: '',
    }]);
  }
  function updateQuizQuestion(qId: string, updates: Partial<QuizQuestionDraft>) {
    setQuizQuestions((prev) => prev.map((q) => q.id === qId ? { ...q, ...updates } : q));
  }
  function removeQuizQuestion(qId: string) { setQuizQuestions((prev) => prev.filter((q) => q.id !== qId)); }
  function addQuizOption(qId: string) {
    setQuizQuestions((prev) => prev.map((q) => q.id !== qId ? q : { ...q, options: [...q.options, { id: crypto.randomUUID(), text: '' }] }));
  }
  function updateQuizOption(qId: string, optId: string, text: string) {
    setQuizQuestions((prev) => prev.map((q) => q.id !== qId ? q : { ...q, options: q.options.map((o) => o.id === optId ? { ...o, text } : o) }));
  }
  function removeQuizOption(qId: string, optId: string) {
    setQuizQuestions((prev) => prev.map((q) => q.id !== qId ? q : { ...q, options: q.options.filter((o) => o.id !== optId), correctOptionId: q.correctOptionId === optId ? '' : q.correctOptionId }));
  }

  // Chapter helpers
  function addAudioChapter() { setAudioChapters((prev) => [...prev, { id: crypto.randomUUID(), title: '', startTime: 0, endTime: 0 }]); }
  function updateAudioChapter(chId: string, updates: Partial<{ title: string; startTime: number; endTime: number }>) {
    setAudioChapters((prev) => prev.map((c) => c.id === chId ? { ...c, ...updates } : c));
  }
  function removeAudioChapter(chId: string) { setAudioChapters((prev) => prev.filter((c) => c.id !== chId)); }

  // Map import helpers
  function handleMarkerImport(rows: Record<string, string>[]) {
    const markers = rows.map((r) => ({ id: crypto.randomUUID(), lat: parseFloat(r.lat) || 0, lng: parseFloat(r.lng) || 0, title: r.title || '', description: r.description || '', color: r.color || '' }));
    setMapMarkers(markers);
    if (markers.length > 0 && mapCenter.lat === 0 && mapCenter.lng === 0) setMapCenter({ lat: markers[0].lat, lng: markers[0].lng });
  }
  function handleLineImport(rows: Record<string, string>[]) {
    const grouped: Record<string, { coords: [number, number][]; title: string; color: string; description: string }> = {};
    for (const r of rows) { const lid = r.line_id || 'default'; if (!grouped[lid]) grouped[lid] = { coords: [], title: r.title || '', color: r.color || '', description: r.description || '' }; grouped[lid].coords.push([parseFloat(r.lat) || 0, parseFloat(r.lng) || 0]); }
    setMapLines(Object.entries(grouped).map(([, v]) => ({ id: crypto.randomUUID(), ...v })));
  }
  function handlePolygonImport(rows: Record<string, string>[]) {
    const grouped: Record<string, { coords: [number, number][]; title: string; color: string; fillColor: string; description: string }> = {};
    for (const r of rows) { const pid = r.polygon_id || 'default'; if (!grouped[pid]) grouped[pid] = { coords: [], title: r.title || '', color: r.color || '', fillColor: r.fill_color || '', description: r.description || '' }; grouped[pid].coords.push([parseFloat(r.lat) || 0, parseFloat(r.lng) || 0]); }
    setMapPolygons(Object.entries(grouped).map(([, v]) => ({ id: crypto.randomUUID(), ...v })));
  }

  // Podcast helpers
  function addPodcastLink() { setPodcastLinks((prev) => [...prev, { id: crypto.randomUUID(), url: '', label: '' }]); }
  function updatePodcastLink(linkId: string, updates: Partial<{ url: string; label: string }>) {
    setPodcastLinks((prev) => prev.map((l) => l.id === linkId ? { ...l, ...updates } : l));
  }
  function removePodcastLink(linkId: string) { setPodcastLinks((prev) => prev.filter((l) => l.id !== linkId)); }

  // Bulk import
  async function handleBulkImport(rows: Record<string, string>[]) {
    setBulkImporting(true); setBulkImportResult(null);
    try {
      const r = await offlineFetch(`/api/academy/courses/${courseId}/import`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows, mode: bulkImportMode }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Import failed');
      setBulkImportResult({ message: d.message, errors: d.stats?.errors });
      onCourseUpdated();
    } catch (e) {
      setBulkImportResult({ message: e instanceof Error ? e.message : 'Import failed', errors: [] });
    } finally { setBulkImporting(false); }
  }

  async function deleteLesson(lessonId: string) {
    await offlineFetch(`/api/academy/courses/${courseId}/lessons/${lessonId}`, { method: 'DELETE' });
    onCourseUpdated();
  }

  // Inline lesson editing — edit existing lesson title/type/URL/autoplay/free-preview/chapters/transcript
  async function startEditingLesson(lesson: Lesson) {
    if (expandedLessonId === lesson.id) {
      setExpandedLessonId(null);
      setEditingLesson({});
      setEditingAudioChapters([]);
      setEditingTranscriptText('');
      return;
    }
    setExpandedLessonId(lesson.id);
    setEditingLesson({
      id: lesson.id,
      title: lesson.title,
      lesson_type: lesson.lesson_type,
      content_url: lesson.content_url,
      is_free_preview: lesson.is_free_preview,
      video_360_autoplay: lesson.video_360_autoplay ?? false,
    });
    // Fetch the full lesson to populate chapters + transcript, which
    // aren't present on the lightweight course tree payload.
    try {
      const r = await offlineFetch(`/api/academy/courses/${courseId}/lessons/${lesson.id}`);
      if (r.ok) {
        const data = await r.json();
        const chapters = Array.isArray(data.audio_chapters)
          ? data.audio_chapters.map((c: { id?: string; title: string; startTime: number; endTime: number }) => ({
              id: c.id || crypto.randomUUID(),
              title: c.title ?? '',
              startTime: Number(c.startTime ?? 0),
              endTime: Number(c.endTime ?? 0),
            }))
          : [];
        setEditingAudioChapters(chapters);
        const segments = Array.isArray(data.transcript_content) ? data.transcript_content : [];
        const formatted = segments
          .map((seg: { startTime: number; text: string }) => {
            const s = Number(seg.startTime ?? 0);
            const m = Math.floor(s / 60);
            const ss = Math.floor(s % 60).toString().padStart(2, '0');
            return `${m}:${ss} ${seg.text ?? ''}`;
          })
          .join('\n');
        setEditingTranscriptText(formatted);
      }
    } catch {
      /* user can still edit the surface-level fields without chapter/transcript prefill */
    }
  }

  // Edit-mode chapter helpers — mirror the add-mode ones but mutate editingAudioChapters
  function addEditingChapter() {
    setEditingAudioChapters((prev) => [...prev, { id: crypto.randomUUID(), title: '', startTime: 0, endTime: 0 }]);
  }
  function updateEditingChapter(chId: string, updates: Partial<{ title: string; startTime: number; endTime: number }>) {
    setEditingAudioChapters((prev) => prev.map((c) => c.id === chId ? { ...c, ...updates } : c));
  }
  function removeEditingChapter(chId: string) {
    setEditingAudioChapters((prev) => prev.filter((c) => c.id !== chId));
  }

  async function saveEditingLesson() {
    if (!expandedLessonId || !editingLesson.title?.trim()) return;
    setSavingLesson(true);
    try {
      const payload: Record<string, unknown> = {
        title: editingLesson.title.trim(),
        lesson_type: editingLesson.lesson_type,
        content_url: editingLesson.content_url ?? null,
        is_free_preview: editingLesson.is_free_preview ?? false,
      };
      if (editingLesson.lesson_type === '360video') {
        payload.video_360_autoplay = editingLesson.video_360_autoplay ?? false;
      }
      if (editingLesson.lesson_type === 'audio' || editingLesson.lesson_type === 'video') {
        payload.audio_chapters = editingAudioChapters.length > 0 ? editingAudioChapters : null;
        payload.transcript_content = editingTranscriptText.trim()
          ? parseTranscriptText(editingTranscriptText)
          : null;
      }
      const r = await offlineFetch(`/api/academy/courses/${courseId}/lessons/${expandedLessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        setExpandedLessonId(null);
        setEditingLesson({});
        setEditingAudioChapters([]);
        setEditingTranscriptText('');
        setFeedback('Lesson saved');
        setTimeout(() => setFeedback(''), 2000);
        onCourseUpdated();
      }
    } catch {
      /* swallow — user can retry */
    }
    setSavingLesson(false);
  }

  // Inline document editing
  async function startEditingDocs(lessonId: string) {
    if (editingDocsLessonId === lessonId) { setEditingDocsLessonId(null); return; }
    try {
      const r = await offlineFetch(`/api/academy/courses/${courseId}/lessons/${lessonId}`);
      const data = await r.json();
      const docs = (data.documents ?? []).map((d: { id?: string; url: string; title: string; description?: string; source_url?: string }) => ({
        id: d.id || crypto.randomUUID(), url: d.url || '', title: d.title || '', description: d.description || '', source_url: d.source_url || '',
      }));
      setEditingDocs(docs);
      setEditingDocsLessonId(lessonId);
    } catch { /* ignore */ }
  }

  async function saveEditingDocs() {
    if (!editingDocsLessonId) return;
    setSavingDocs(true);
    try {
      const payload = editingDocs.filter((d) => d.title.trim() || d.url.trim());
      await offlineFetch(`/api/academy/courses/${courseId}/lessons/${editingDocsLessonId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documents: payload }),
      });
      setEditingDocsLessonId(null); setEditingDocs([]);
      setFeedback('Documents saved'); setTimeout(() => setFeedback(''), 2000);
    } catch { /* ignore */ }
    setSavingDocs(false);
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-white text-sm">Curriculum</h3>
        <button
          type="button"
          onClick={() => setAddingModule(true)}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition min-h-11"
        >
          <Plus className="w-3.5 h-3.5" /> Add Module
        </button>
      </div>

      {addingModule && (
        <div className="dark-input flex gap-2 mb-4">
          <input
            autoFocus
            type="text"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addModule(); if (e.key === 'Escape') setAddingModule(false); }}
            placeholder="Module title…"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500 min-h-11"
          />
          <button onClick={addModule} className="px-4 py-2.5 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition min-h-11">Add</button>
          <button onClick={() => setAddingModule(false)} className="px-3 py-2.5 bg-gray-800 text-gray-400 rounded-xl text-sm hover:bg-gray-700 transition min-h-11">Cancel</button>
        </div>
      )}

      {/* Bulk CSV Import / Export */}
      <div className="mb-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setShowBulkImport(!showBulkImport)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-fuchsia-400 transition">
            <Upload className="w-3 h-3" /> {showBulkImport ? 'Hide' : 'Bulk Import from CSV'}
            <ChevronDown className={`w-3 h-3 transition-transform ${showBulkImport ? 'rotate-180' : ''}`} />
          </button>
          <a href={`/api/academy/courses/${courseId}/export`} download
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-fuchsia-400 transition">
            <Download className="w-3 h-3" /> Export as CSV
          </a>
        </div>
        {showBulkImport && (
          <div className="mt-3 p-4 bg-gray-800/40 border border-gray-700 rounded-xl space-y-3">
            <p className="text-xs text-gray-400">
              Import modules and lessons from a CSV file. Each row creates a lesson; modules are auto-created from the <code className="text-fuchsia-400">module_title</code> column.
            </p>
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-500">Mode:</label>
              <button type="button" onClick={() => setBulkImportMode('create')}
                className={`px-2 py-1 rounded text-xs font-medium transition ${bulkImportMode === 'create' ? 'bg-fuchsia-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                Create only
              </button>
              <button type="button" onClick={() => setBulkImportMode('upsert')}
                className={`px-2 py-1 rounded text-xs font-medium transition ${bulkImportMode === 'upsert' ? 'bg-fuchsia-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                Create + Update
              </button>
              <button type="button" onClick={() => setBulkImportMode('replace')}
                className={`px-2 py-1 rounded text-xs font-medium transition ${bulkImportMode === 'replace' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                Replace All
              </button>
            </div>
            {bulkImportMode === 'replace' && (
              <p className="text-xs text-amber-400">This will delete all existing modules and lessons before importing. Student progress will be reset.</p>
            )}
            <DataImporter
              label="Course CSV"
              columns={[
                { key: 'module_title', label: 'Module Title' },
                { key: 'module_order', label: 'Module Order' },
                { key: 'lesson_order', label: 'Lesson Order' },
                { key: 'title', label: 'Title', required: true },
                { key: 'lesson_type', label: 'Type' },
                { key: 'duration_seconds', label: 'Duration (sec)' },
                { key: 'is_free_preview', label: 'Free Preview' },
                { key: 'content_url', label: 'Content URL' },
                { key: 'text_content', label: 'Text Content' },
                { key: 'content_format', label: 'Format' },
                { key: 'audio_chapters', label: 'Chapters JSON' },
                { key: 'transcript_content', label: 'Transcript JSON' },
                { key: 'map_content', label: 'Map JSON' },
                { key: 'documents', label: 'Documents JSON' },
                { key: 'podcast_links', label: 'Podcast JSON' },
                { key: 'quiz_content', label: 'Quiz JSON' },
              ]}
              onImport={handleBulkImport}
              templateCsvUrl="/templates/course-import.csv"
            />
            {bulkImporting && <p className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Importing...</p>}
            {bulkImportResult && (
              <div className="space-y-1">
                <p className={`text-xs ${bulkImportResult.errors && bulkImportResult.errors.length > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {bulkImportResult.message}
                </p>
                {bulkImportResult.errors && bulkImportResult.errors.length > 0 && (
                  <ul className="text-xs text-red-400 space-y-0.5 max-h-32 overflow-y-auto">
                    {bulkImportResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modules & Lessons */}
      {modules.length === 0 ? (
        <div className="text-center py-10 text-gray-400 border border-dashed border-gray-800 rounded-xl">
          <p className="text-sm">No modules yet. Add a module to organize your lessons.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {modules.map((mod) => {
            const lessons = [...mod.lessons].sort((a, b) => a.order - b.order);
            return (
              <div key={mod.id} className="border border-gray-800 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/50">
                  <GripVertical className="w-4 h-4 text-gray-400 shrink-0" />
                  <p className="flex-1 font-medium text-white text-sm">{mod.title}</p>
                  <span className="text-gray-400 text-xs">{lessons.length} lesson{lessons.length !== 1 ? 's' : ''}</span>
                </div>

                {lessons.map((lesson) => {
                  const Icon = LESSON_TYPE_ICON[lesson.lesson_type] ?? Play;
                  const isEditingDocs = editingDocsLessonId === lesson.id;
                  const isEditingLesson = expandedLessonId === lesson.id;
                  return (
                    <div key={lesson.id} className="border-t border-gray-800">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <GripVertical className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <Icon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span className="flex-1 text-sm text-gray-300 min-w-0 truncate">{lesson.title}</span>
                        {lesson.is_free_preview && (
                          <span className="text-xs text-fuchsia-400 px-1.5 py-0.5 bg-fuchsia-900/30 rounded shrink-0">Preview</span>
                        )}
                        <button type="button" onClick={() => startEditingLesson(lesson)}
                          className={`p-2 transition shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center ${isEditingLesson ? 'text-fuchsia-400' : 'text-gray-400 hover:text-fuchsia-400'}`}
                          aria-label="Edit lesson details, content, chapters, and transcript"
                          title="Edit lesson (title, type, content URL, chapters, transcript)">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => startEditingDocs(lesson.id)}
                          className={`p-2 transition shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center ${isEditingDocs ? 'text-fuchsia-400' : 'text-gray-400 hover:text-fuchsia-400'}`}
                          aria-label="Edit attached documents"
                          title="Attach or edit documents">
                          <Paperclip className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => deleteLesson(lesson.id)}
                          className="p-2 text-gray-400 hover:text-red-400 transition shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
                          aria-label="Delete lesson"
                          title="Delete lesson">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {isEditingLesson && (
                        <div className="dark-input border-t border-gray-800 bg-gray-800/30 p-4 space-y-3">
                          <input
                            type="text"
                            value={editingLesson.title ?? ''}
                            onChange={(e) => setEditingLesson((l) => ({ ...l, title: e.target.value }))}
                            placeholder="Lesson title…"
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500 min-h-11"
                          />
                          <div className="flex flex-wrap gap-3 items-center">
                            <select
                              value={editingLesson.lesson_type ?? 'video'}
                              onChange={(e) => setEditingLesson((l) => ({ ...l, lesson_type: e.target.value }))}
                              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
                              aria-label="Lesson type"
                            >
                              <option value="video">Video</option>
                              <option value="text">Text</option>
                              <option value="audio">Audio</option>
                              <option value="slides">Slides</option>
                              <option value="quiz">Quiz</option>
                              <option value="360video">360° Video</option>
                              <option value="photo_360">360° Photo</option>
                            </select>
                            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer min-h-11">
                              <input
                                type="checkbox"
                                checked={editingLesson.is_free_preview ?? false}
                                onChange={(e) => setEditingLesson((l) => ({ ...l, is_free_preview: e.target.checked }))}
                                className="accent-fuchsia-500 w-4 h-4"
                              />
                              Free preview
                            </label>
                          </div>
                          {editingLesson.lesson_type !== 'text' && editingLesson.lesson_type !== 'quiz' && (
                            <>
                              <input
                                type="url"
                                value={editingLesson.content_url ?? ''}
                                onChange={(e) => setEditingLesson((l) => ({ ...l, content_url: e.target.value }))}
                                placeholder={
                                  editingLesson.lesson_type === '360video'
                                    ? 'Equirectangular MP4 URL (Cloudinary or external)…'
                                    : editingLesson.lesson_type === 'photo_360'
                                    ? 'Equirectangular JPG/PNG URL (Cloudinary or external)…'
                                    : 'Content URL (YouTube, Cloudinary, or external)…'
                                }
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500 min-h-11"
                              />
                              {editingLesson.lesson_type === '360video' && (
                                <>
                                  <Cloudinary360Uploader
                                    currentUrl={editingLesson.content_url}
                                    onUploadSuccess={(url) => setEditingLesson((l) => ({ ...l, content_url: url }))}
                                  />
                                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer min-h-11">
                                    <input
                                      type="checkbox"
                                      checked={editingLesson.video_360_autoplay ?? false}
                                      onChange={(e) => setEditingLesson((l) => ({ ...l, video_360_autoplay: e.target.checked }))}
                                      className="accent-fuchsia-500 w-4 h-4"
                                    />
                                    Autoplay (muted) when lesson opens
                                  </label>
                                </>
                              )}
                              {editingLesson.lesson_type === 'photo_360' && (
                                <Cloudinary360Uploader
                                  resourceType="image"
                                  currentUrl={editingLesson.content_url}
                                  onUploadSuccess={(url) => setEditingLesson((l) => ({ ...l, content_url: url }))}
                                />
                              )}
                            </>
                          )}
                          {/* Chapter + transcript editor — audio & video only */}
                          {(editingLesson.lesson_type === 'audio' || editingLesson.lesson_type === 'video') && (
                            <div className="space-y-4 border border-gray-700 rounded-xl p-3 bg-gray-800/30">
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-sm font-semibold text-gray-200">Chapter Markers</h4>
                                  <button type="button" onClick={addEditingChapter} className="flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition">
                                    <Plus className="w-3 h-3" /> Add Chapter
                                  </button>
                                </div>
                                {editingAudioChapters.length === 0 && (
                                  <p className="text-xs text-gray-500 text-center py-2">No chapters. Students can still watch without chapters.</p>
                                )}
                                <div className="space-y-2">
                                  {editingAudioChapters.map((ch, ci) => (
                                    <div key={ch.id} className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500 shrink-0 w-5">{ci + 1}</span>
                                      <input
                                        type="text"
                                        value={ch.title}
                                        onChange={(e) => updateEditingChapter(ch.id, { title: e.target.value })}
                                        placeholder="Chapter title…"
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500"
                                      />
                                      <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={ch.startTime}
                                        onChange={(e) => updateEditingChapter(ch.id, { startTime: Number(e.target.value) })}
                                        className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                                        title="Start time (seconds)"
                                        placeholder="Start"
                                      />
                                      <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={ch.endTime}
                                        onChange={(e) => updateEditingChapter(ch.id, { endTime: Number(e.target.value) })}
                                        className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                                        title="End time (seconds)"
                                        placeholder="End"
                                      />
                                      <button type="button" onClick={() => removeEditingChapter(ch.id)} className="text-gray-400 hover:text-red-400 transition p-1 shrink-0" aria-label="Remove chapter" title="Remove chapter">
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-200 mb-1.5">Transcript</label>
                                <p className="text-xs text-gray-500 mb-2">
                                  Paste timestamped transcript. Format: <code className="text-gray-400">MM:SS text</code> (one per line).
                                </p>
                                <textarea
                                  value={editingTranscriptText}
                                  onChange={(e) => setEditingTranscriptText(e.target.value)}
                                  rows={6}
                                  placeholder={'00:00 Introduction\n00:45 Today\'s topic\n03:20 First segment…'}
                                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 resize-none font-mono"
                                />
                              </div>
                            </div>
                          )}
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              type="button"
                              onClick={saveEditingLesson}
                              disabled={savingLesson || !editingLesson.title?.trim()}
                              className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50 min-h-11"
                            >
                              {savingLesson ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setExpandedLessonId(null); setEditingLesson({}); setEditingAudioChapters([]); setEditingTranscriptText(''); }}
                              className="px-4 py-2 bg-gray-800 text-gray-400 rounded-lg text-sm hover:bg-gray-700 transition min-h-11"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {isEditingDocs && (
                        <div className="px-4 pb-4 space-y-3">
                          <LessonDocumentEditor documents={editingDocs} onChange={setEditingDocs} defaultOpen />
                          <div className="flex gap-2">
                            <button type="button" onClick={saveEditingDocs} disabled={savingDocs}
                              className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-xs font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50 min-h-11">
                              {savingDocs ? 'Saving…' : 'Save Documents'}
                            </button>
                            <button type="button" onClick={() => setEditingDocsLessonId(null)}
                              className="px-4 py-2 bg-gray-800 text-gray-400 rounded-lg text-xs hover:bg-gray-700 transition min-h-11">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add lesson */}
                {addingLesson === mod.id ? (
                  <div className="dark-input border-t border-gray-800 p-4 space-y-3">
                    <input autoFocus type="text" value={newLesson.title}
                      onChange={(e) => setNewLesson((l) => ({ ...l, title: e.target.value }))}
                      placeholder="Lesson title…"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500 min-h-11" />
                    <div className="flex flex-wrap gap-3 items-center">
                      <select value={newLesson.lesson_type}
                        onChange={(e) => setNewLesson((l) => ({ ...l, lesson_type: e.target.value }))}
                        className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
                        aria-label="Lesson type">
                        <option value="video">Video</option>
                        <option value="text">Text</option>
                        <option value="audio">Audio</option>
                        <option value="slides">Slides</option>
                        <option value="quiz">Quiz</option>
                        <option value="360video">360° Video</option>
                        <option value="photo_360">360° Photo</option>
                      </select>
                      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer min-h-11">
                        <input type="checkbox" checked={newLesson.is_free_preview}
                          onChange={(e) => setNewLesson((l) => ({ ...l, is_free_preview: e.target.checked }))}
                          className="accent-fuchsia-500 w-4 h-4" />
                        Free preview
                      </label>
                    </div>

                    {/* Content URL / upload — all non-text, non-quiz types */}
                    {newLesson.lesson_type !== 'text' && newLesson.lesson_type !== 'quiz' && (
                      <>
                        <input
                          type="url"
                          value={newLesson.content_url}
                          onChange={(e) => setNewLesson((l) => ({ ...l, content_url: e.target.value }))}
                          placeholder={
                            newLesson.lesson_type === '360video'
                              ? 'Equirectangular MP4 URL (Cloudinary or external)…'
                              : newLesson.lesson_type === 'photo_360'
                              ? 'Equirectangular JPG/PNG URL (Cloudinary or external)…'
                              : 'Content URL (YouTube, Cloudinary, or external)…'
                          }
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500 min-h-11"
                        />
                        {newLesson.lesson_type === '360video' && (
                          <>
                            <Cloudinary360Uploader
                              currentUrl={newLesson.content_url}
                              onUploadSuccess={(url) => setNewLesson((l) => ({ ...l, content_url: url }))}
                            />
                            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer min-h-11">
                              <input
                                type="checkbox"
                                checked={newLesson.video_360_autoplay}
                                onChange={(e) => setNewLesson((l) => ({ ...l, video_360_autoplay: e.target.checked }))}
                                className="accent-fuchsia-500 w-4 h-4"
                              />
                              Autoplay (muted) when lesson opens
                            </label>
                          </>
                        )}
                        {newLesson.lesson_type === 'photo_360' && (
                          <Cloudinary360Uploader
                            resourceType="image"
                            currentUrl={newLesson.content_url}
                            onUploadSuccess={(url) => setNewLesson((l) => ({ ...l, content_url: url }))}
                          />
                        )}
                      </>
                    )}

                    {/* Chapter/transcript editor — audio & video */}
                    {(newLesson.lesson_type === 'audio' || newLesson.lesson_type === 'video') && (
                      <div className="space-y-4 border border-gray-700 rounded-xl p-3 bg-gray-800/30">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-gray-200">Chapter Markers</h4>
                            <button type="button" onClick={addAudioChapter} className="flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition">
                              <Plus className="w-3 h-3" /> Add Chapter
                            </button>
                          </div>
                          {audioChapters.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No chapters. Students can still watch without chapters.</p>}
                          <div className="space-y-2">
                            {audioChapters.map((ch, ci) => (
                              <div key={ch.id} className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 shrink-0 w-5">{ci + 1}</span>
                                <input type="text" value={ch.title} onChange={(e) => updateAudioChapter(ch.id, { title: e.target.value })}
                                  placeholder="Chapter title…" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500" />
                                <input type="number" min={0} step={1} value={ch.startTime} onChange={(e) => updateAudioChapter(ch.id, { startTime: Number(e.target.value) })}
                                  className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-500" title="Start time (seconds)" placeholder="Start (s)" />
                                <input type="number" min={0} step={1} value={ch.endTime} onChange={(e) => updateAudioChapter(ch.id, { endTime: Number(e.target.value) })}
                                  className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-500" title="End time (seconds)" placeholder="End (s)" />
                                <button type="button" onClick={() => removeAudioChapter(ch.id)} className="text-gray-400 hover:text-red-400 transition p-1 shrink-0">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-200 mb-1.5">Transcript</label>
                          <p className="text-xs text-gray-500 mb-2">Paste timestamped transcript. Format: <code className="text-gray-400">MM:SS text</code> (one per line). For YouTube videos, use the &quot;Pull Captions&quot; button after saving.</p>
                          <textarea value={transcriptText} onChange={(e) => setTranscriptText(e.target.value)} rows={6}
                            placeholder={"00:00 Introduction\n00:45 Today's topic\n03:20 First segment…"}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500 resize-none font-mono" />
                        </div>
                      </div>
                    )}

                    {/* Quiz editor */}
                    {newLesson.lesson_type === 'quiz' && (
                      <div className="space-y-3 border border-gray-700 rounded-xl p-3 bg-gray-800/30">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-200">Quiz Questions</h4>
                          <button type="button" onClick={addQuizQuestion} className="flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition">
                            <Plus className="w-3 h-3" /> Add Question
                          </button>
                        </div>
                        {quizQuestions.length === 0 && <p className="text-xs text-gray-400 text-center py-3">No questions yet. Add your first question above.</p>}
                        {quizQuestions.map((q, qi) => (
                          <div key={q.id} className="border border-gray-700 rounded-lg p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-gray-500 mt-3 shrink-0">Q{qi + 1}</span>
                              <div className="flex-1 space-y-2">
                                <input type="text" value={q.questionText} onChange={(e) => updateQuizQuestion(q.id, { questionText: e.target.value })}
                                  placeholder="Question text…" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500" />
                                <div className="space-y-1.5">
                                  {q.options.map((opt) => (
                                    <div key={opt.id} className="flex items-center gap-2">
                                      <input type="radio" name={`correct-${q.id}`} checked={q.correctOptionId === opt.id}
                                        onChange={() => updateQuizQuestion(q.id, { correctOptionId: opt.id })} className="accent-green-500 shrink-0" title="Mark as correct answer" />
                                      <input type="text" value={opt.text} onChange={(e) => updateQuizOption(q.id, opt.id, e.target.value)}
                                        placeholder="Option text…" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500" />
                                      {q.options.length > 2 && (
                                        <button type="button" onClick={() => removeQuizOption(q.id, opt.id)} className="text-gray-400 hover:text-red-400 transition p-1">
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  {q.options.length < 6 && (
                                    <button type="button" onClick={() => addQuizOption(q.id)} className="text-xs text-gray-500 hover:text-fuchsia-400 transition ml-6">+ Add option</button>
                                  )}
                                </div>
                                <input type="text" value={q.explanation} onChange={(e) => updateQuizQuestion(q.id, { explanation: e.target.value })}
                                  placeholder="Explanation (shown after answering)…" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500" />
                                <input type="text" value={q.citation} onChange={(e) => updateQuizQuestion(q.id, { citation: e.target.value })}
                                  placeholder="Citation (optional, APA format)…" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-400 placeholder-gray-600 focus:outline-none focus:border-fuchsia-500" />
                              </div>
                              <button type="button" onClick={() => removeQuizQuestion(q.id)} className="text-gray-400 hover:text-red-400 transition p-1 mt-2 shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <div className="flex flex-wrap gap-3 pt-1">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Passing Score (%)</label>
                            <input type="number" min={0} max={100} value={quizPassingScore} onChange={(e) => setQuizPassingScore(Number(e.target.value))}
                              className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Attempts (-1 = unlimited)</label>
                            <input type="number" min={-1} value={quizAttemptsAllowed} onChange={(e) => setQuizAttemptsAllowed(Number(e.target.value))}
                              className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-500" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Podcast links — audio only */}
                    {newLesson.lesson_type === 'audio' && (
                      <div className="space-y-2 border border-gray-700 rounded-xl p-3 bg-gray-800/30">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-200">Podcast Links</h4>
                          <button type="button" onClick={addPodcastLink} className="flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition">
                            <Plus className="w-3 h-3" /> Add Platform
                          </button>
                        </div>
                        {podcastLinks.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No podcast links. Add links to Spotify, Apple Podcasts, YouTube, etc.</p>}
                        <div className="space-y-2">
                          {podcastLinks.map((link, li) => (
                            <div key={link.id} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 shrink-0 w-5">{li + 1}</span>
                              <input type="url" value={link.url} onChange={(e) => updatePodcastLink(link.id, { url: e.target.value })}
                                placeholder="https://open.spotify.com/episode/..." className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500" />
                              <input type="text" value={link.label} onChange={(e) => updatePodcastLink(link.id, { label: e.target.value })}
                                placeholder="Label (auto-detected)" className="w-36 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500" />
                              <button type="button" onClick={() => removePodcastLink(link.id)} className="text-gray-400 hover:text-red-400 transition p-1 shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400">Leave label blank to auto-detect platform from URL (Spotify, Apple, YouTube, etc.)</p>
                      </div>
                    )}

                    {/* Interactive Map — any lesson type */}
                    <div className="border border-gray-700 rounded-xl overflow-hidden">
                      <button type="button" onClick={() => setShowMapSection((v) => !v)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-800/50 text-sm font-semibold text-gray-300 hover:bg-gray-800 transition">
                        <Map className="w-3.5 h-3.5 text-fuchsia-400" /> Interactive Map
                        <span className="text-xs text-gray-400 ml-1">
                          {mapMarkers.length > 0 || mapLines.length > 0 || mapPolygons.length > 0
                            ? `(${mapMarkers.length} markers, ${mapLines.length} lines, ${mapPolygons.length} polygons)` : '(optional)'}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 ml-auto text-gray-400 transition-transform ${showMapSection ? 'rotate-180' : ''}`} />
                      </button>
                      {showMapSection && (
                        <div className="p-3 space-y-3 bg-gray-800/20">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Center Lat</label>
                              <input type="number" step="any" value={mapCenter.lat} onChange={(e) => setMapCenter((c) => ({ ...c, lat: parseFloat(e.target.value) || 0 }))}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-500" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Center Lng</label>
                              <input type="number" step="any" value={mapCenter.lng} onChange={(e) => setMapCenter((c) => ({ ...c, lng: parseFloat(e.target.value) || 0 }))}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-500" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Zoom (1-18)</label>
                              <input type="number" min={1} max={18} value={mapZoom} onChange={(e) => setMapZoom(Number(e.target.value) || 3)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-500" />
                            </div>
                          </div>
                          <DataImporter label="Markers" columns={[
                            { key: 'lat', label: 'Lat', required: true }, { key: 'lng', label: 'Lng', required: true },
                            { key: 'title', label: 'Title', required: true }, { key: 'description', label: 'Description' }, { key: 'color', label: 'Color' },
                          ]} onImport={handleMarkerImport} templateCsvUrl="/templates/map-markers.csv" />
                          <DataImporter label="Lines (trade routes, paths)" columns={[
                            { key: 'line_id', label: 'Line ID', required: true }, { key: 'lat', label: 'Lat', required: true },
                            { key: 'lng', label: 'Lng', required: true }, { key: 'title', label: 'Title' }, { key: 'color', label: 'Color' }, { key: 'description', label: 'Description' },
                          ]} onImport={handleLineImport} templateCsvUrl="/templates/map-lines.csv" />
                          <DataImporter label="Polygons (regions, territories)" columns={[
                            { key: 'polygon_id', label: 'Polygon ID', required: true }, { key: 'lat', label: 'Lat', required: true },
                            { key: 'lng', label: 'Lng', required: true }, { key: 'title', label: 'Title' }, { key: 'color', label: 'Color' },
                            { key: 'fill_color', label: 'Fill Color' }, { key: 'description', label: 'Description' },
                          ]} onImport={handlePolygonImport} templateCsvUrl="/templates/map-polygons.csv" />
                          {(mapMarkers.length > 0 || mapLines.length > 0 || mapPolygons.length > 0) && (
                            <div className="flex items-center gap-3 pt-1">
                              <p className="text-xs text-green-400">{mapMarkers.length} markers, {mapLines.length} lines, {mapPolygons.length} polygons loaded</p>
                              <button type="button" onClick={() => { setMapMarkers([]); setMapLines([]); setMapPolygons([]); }}
                                className="text-xs text-red-400 hover:text-red-300 transition">Clear all</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Documents */}
                    <LessonDocumentEditor documents={lessonDocuments} onChange={setLessonDocuments} />

                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => addLesson(mod.id)} className="px-4 py-2.5 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition min-h-11">Add Lesson</button>
                      <button onClick={() => setAddingLesson(null)} className="px-4 py-2.5 bg-gray-800 text-gray-400 rounded-xl text-sm hover:bg-gray-700 transition min-h-11">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAddingLesson(mod.id)}
                    className="w-full flex items-center gap-2 px-4 py-3 border-t border-gray-800 text-gray-400 hover:text-fuchsia-400 text-sm hover:bg-gray-800/30 transition min-h-11">
                    <Plus className="w-3.5 h-3.5" /> Add Lesson
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
