'use client';

// app/dashboard/teaching/courses/[id]/page.tsx
// Course editor: settings, modules, lessons, publish toggle, CYOA embed generation.

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Plus, Loader2, Save, Globe, EyeOff, Trash2,
  GitBranch, Sparkles, Play, FileText, Volume2, Presentation, GripVertical,
  CheckCircle, ClipboardList, HelpCircle, X, Map, ChevronDown, Paperclip,
} from 'lucide-react';
import MediaUploader from '@/components/ui/MediaUploader';
import DataImporter from '@/components/academy/DataImporter';

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

const LESSON_TYPE_ICON: Record<string, React.ElementType> = {
  video: Play, text: FileText, audio: Volume2, slides: Presentation, quiz: HelpCircle,
};

interface QuizQuestionDraft {
  id: string;
  questionText: string;
  questionType: 'multiple_choice' | 'true_false';
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
  explanation: string;
  citation: string;
}

export default function CourseEditorPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishingToggle, setPublishingToggle] = useState(false);
  const [generatingEmbeddings, setGeneratingEmbeddings] = useState(false);
  const [embeddingResult, setEmbeddingResult] = useState('');
  const [addingModule, setAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [addingLesson, setAddingLesson] = useState<string | null>(null); // module_id
  const [newLesson, setNewLesson] = useState({ title: '', lesson_type: 'video', content_url: '', is_free_preview: false });
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionDraft[]>([]);
  const [quizPassingScore, setQuizPassingScore] = useState(80);
  const [quizAttemptsAllowed, setQuizAttemptsAllowed] = useState(-1);
  const [audioChapters, setAudioChapters] = useState<Array<{ id: string; title: string; startTime: number; endTime: number }>>([]);
  const [transcriptText, setTranscriptText] = useState('');
  // Map editor state
  const [showMapSection, setShowMapSection] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 0, lng: 0 });
  const [mapZoom, setMapZoom] = useState(3);
  const [mapMarkers, setMapMarkers] = useState<Array<{ id: string; lat: number; lng: number; title: string; description: string; color: string }>>([]);
  const [mapLines, setMapLines] = useState<Array<{ id: string; coords: [number, number][]; title: string; color: string; description: string }>>([]);
  const [mapPolygons, setMapPolygons] = useState<Array<{ id: string; coords: [number, number][]; title: string; color: string; fillColor: string; description: string }>>([]);
  // Document editor state
  const [showDocSection, setShowDocSection] = useState(false);
  const [lessonDocuments, setLessonDocuments] = useState<Array<{ id: string; url: string; title: string; description: string; source_url: string }>>([]);
  // Podcast links state
  const [podcastLinks, setPodcastLinks] = useState<Array<{ id: string; url: string; label: string }>>([]);
  const [feedback, setFeedback] = useState('');

  const fetchCourse = useCallback(() => {
    fetch(`/api/academy/courses/${courseId}`)
      .then((r) => r.json())
      .then((d) => { setCourse(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [courseId]);

  useEffect(() => { fetchCourse(); }, [fetchCourse]);

  async function saveCourseField(updates: Partial<Course>) {
    if (!course) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/academy/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      setCourse((c) => c ? { ...c, ...updates } : c);
      setFeedback('Saved');
      setTimeout(() => setFeedback(''), 2000);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    if (!course) return;
    setPublishingToggle(true);
    await saveCourseField({ is_published: !course.is_published });
    setPublishingToggle(false);
  }

  async function addModule() {
    if (!newModuleTitle.trim()) return;
    const r = await fetch(`/api/academy/courses/${courseId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newModuleTitle.trim(), order: (course?.course_modules.length ?? 0) }),
    });
    if (r.ok) { setNewModuleTitle(''); setAddingModule(false); fetchCourse(); }
  }

  async function addLesson(moduleId: string) {
    if (!newLesson.title.trim()) return;
    const payload: Record<string, unknown> = {
      ...newLesson,
      module_id: moduleId,
      order: (course?.course_modules.find((m) => m.id === moduleId)?.lessons.length ?? 0),
    };
    if (newLesson.lesson_type === 'quiz' && quizQuestions.length > 0) {
      payload.quiz_content = {
        questions: quizQuestions,
        passingScore: quizPassingScore,
        attemptsAllowed: quizAttemptsAllowed,
      };
    }
    if (newLesson.lesson_type === 'audio') {
      if (audioChapters.length > 0) payload.audio_chapters = audioChapters;
      if (transcriptText.trim()) payload.transcript_content = parseTranscriptText(transcriptText);
      const validLinks = podcastLinks.filter((l) => l.url.trim());
      if (validLinks.length > 0) payload.podcast_links = validLinks.map(({ url, label }) => ({ url, label }));
    }
    // Map content (any lesson type)
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
    // Documents (any lesson type)
    if (lessonDocuments.length > 0) {
      payload.documents = lessonDocuments.filter((d) => d.url.trim());
    }
    const r = await fetch(`/api/academy/courses/${courseId}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      setNewLesson({ title: '', lesson_type: 'video', content_url: '', is_free_preview: false });
      setQuizQuestions([]);
      setQuizPassingScore(80);
      setQuizAttemptsAllowed(-1);
      setAudioChapters([]);
      setTranscriptText('');
      setMapCenter({ lat: 0, lng: 0 });
      setMapZoom(3);
      setMapMarkers([]);
      setMapLines([]);
      setMapPolygons([]);
      setShowMapSection(false);
      setLessonDocuments([]);
      setShowDocSection(false);
      setPodcastLinks([]);
      setAddingLesson(null);
      fetchCourse();
    }
  }

  function addQuizQuestion() {
    const id = crypto.randomUUID();
    setQuizQuestions((prev) => [...prev, {
      id,
      questionText: '',
      questionType: 'multiple_choice',
      options: [
        { id: crypto.randomUUID(), text: '' },
        { id: crypto.randomUUID(), text: '' },
      ],
      correctOptionId: '',
      explanation: '',
      citation: '',
    }]);
  }

  function updateQuizQuestion(qId: string, updates: Partial<QuizQuestionDraft>) {
    setQuizQuestions((prev) => prev.map((q) => q.id === qId ? { ...q, ...updates } : q));
  }

  function removeQuizQuestion(qId: string) {
    setQuizQuestions((prev) => prev.filter((q) => q.id !== qId));
  }

  function addQuizOption(qId: string) {
    setQuizQuestions((prev) => prev.map((q) => {
      if (q.id !== qId) return q;
      return { ...q, options: [...q.options, { id: crypto.randomUUID(), text: '' }] };
    }));
  }

  function updateQuizOption(qId: string, optId: string, text: string) {
    setQuizQuestions((prev) => prev.map((q) => {
      if (q.id !== qId) return q;
      return { ...q, options: q.options.map((o) => o.id === optId ? { ...o, text } : o) };
    }));
  }

  function removeQuizOption(qId: string, optId: string) {
    setQuizQuestions((prev) => prev.map((q) => {
      if (q.id !== qId) return q;
      return {
        ...q,
        options: q.options.filter((o) => o.id !== optId),
        correctOptionId: q.correctOptionId === optId ? '' : q.correctOptionId,
      };
    }));
  }

  function addAudioChapter() {
    setAudioChapters((prev) => [...prev, { id: crypto.randomUUID(), title: '', startTime: 0, endTime: 0 }]);
  }

  function updateAudioChapter(chId: string, updates: Partial<{ title: string; startTime: number; endTime: number }>) {
    setAudioChapters((prev) => prev.map((c) => c.id === chId ? { ...c, ...updates } : c));
  }

  function removeAudioChapter(chId: string) {
    setAudioChapters((prev) => prev.filter((c) => c.id !== chId));
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
    // Fill endTime from next segment's startTime
    for (let i = 0; i < segments.length - 1; i++) {
      segments[i].endTime = segments[i + 1].startTime;
    }
    if (segments.length > 0) segments[segments.length - 1].endTime = segments[segments.length - 1].startTime + 30;
    return segments;
  }

  function handleMarkerImport(rows: Record<string, string>[]) {
    const markers = rows.map((r) => ({
      id: crypto.randomUUID(),
      lat: parseFloat(r.lat) || 0,
      lng: parseFloat(r.lng) || 0,
      title: r.title || '',
      description: r.description || '',
      color: r.color || '',
    }));
    setMapMarkers(markers);
    if (markers.length > 0 && mapCenter.lat === 0 && mapCenter.lng === 0) {
      setMapCenter({ lat: markers[0].lat, lng: markers[0].lng });
    }
  }

  function handleLineImport(rows: Record<string, string>[]) {
    const grouped: Record<string, { coords: [number, number][]; title: string; color: string; description: string }> = {};
    for (const r of rows) {
      const lid = r.line_id || 'default';
      if (!grouped[lid]) grouped[lid] = { coords: [], title: r.title || '', color: r.color || '', description: r.description || '' };
      grouped[lid].coords.push([parseFloat(r.lat) || 0, parseFloat(r.lng) || 0]);
    }
    setMapLines(Object.entries(grouped).map(([, v]) => ({ id: crypto.randomUUID(), ...v })));
  }

  function handlePolygonImport(rows: Record<string, string>[]) {
    const grouped: Record<string, { coords: [number, number][]; title: string; color: string; fillColor: string; description: string }> = {};
    for (const r of rows) {
      const pid = r.polygon_id || 'default';
      if (!grouped[pid]) grouped[pid] = { coords: [], title: r.title || '', color: r.color || '', fillColor: r.fill_color || '', description: r.description || '' };
      grouped[pid].coords.push([parseFloat(r.lat) || 0, parseFloat(r.lng) || 0]);
    }
    setMapPolygons(Object.entries(grouped).map(([, v]) => ({ id: crypto.randomUUID(), ...v })));
  }

  function handleDocumentImport(rows: Record<string, string>[]) {
    setLessonDocuments(rows.map((r) => ({
      id: crypto.randomUUID(),
      url: r.url || '',
      title: r.title || '',
      description: r.description || '',
      source_url: r.source_url || '',
    })));
  }

  function addDocument() {
    setLessonDocuments((prev) => [...prev, { id: crypto.randomUUID(), url: '', title: '', description: '', source_url: '' }]);
  }

  function updateDocument(docId: string, updates: Partial<{ url: string; title: string; description: string; source_url: string }>) {
    setLessonDocuments((prev) => prev.map((d) => d.id === docId ? { ...d, ...updates } : d));
  }

  function removeDocument(docId: string) {
    setLessonDocuments((prev) => prev.filter((d) => d.id !== docId));
  }

  function addPodcastLink() {
    setPodcastLinks((prev) => [...prev, { id: crypto.randomUUID(), url: '', label: '' }]);
  }

  function updatePodcastLink(linkId: string, updates: Partial<{ url: string; label: string }>) {
    setPodcastLinks((prev) => prev.map((l) => l.id === linkId ? { ...l, ...updates } : l));
  }

  function removePodcastLink(linkId: string) {
    setPodcastLinks((prev) => prev.filter((l) => l.id !== linkId));
  }

  async function deleteLesson(lessonId: string) {
    await fetch(`/api/academy/courses/${courseId}/lessons/${lessonId}`, { method: 'DELETE' });
    fetchCourse();
  }

  async function generateEmbeddings() {
    setGeneratingEmbeddings(true);
    setEmbeddingResult('');
    try {
      const r = await fetch(`/api/academy/courses/${courseId}/generate-embeddings`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setEmbeddingResult(`Generated embeddings for ${d.processed} lessons.`);
    } catch (e) {
      setEmbeddingResult(e instanceof Error ? e.message : 'Failed');
    } finally {
      setGeneratingEmbeddings(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" /></div>;
  }

  if (!course) {
    return <div className="text-center py-20 text-gray-500">Course not found.</div>;
  }

  const modules = [...course.course_modules].sort((a, b) => a.order - b.order);

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <Link href="/dashboard/teaching" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-6 transition">
        <ChevronLeft className="w-4 h-4" /> Teaching Dashboard
      </Link>

      {/* Header — stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{course.title}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              course.is_published ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'
            }`}>
              {course.is_published ? 'Published' : 'Draft'}
            </span>
            {course.navigation_mode === 'cyoa' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-fuchsia-900/30 text-fuchsia-400">
                <GitBranch className="w-2.5 h-2.5" /> CYOA
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
          {feedback && <p className="text-sm text-green-400">{feedback}</p>}
          <button
            type="button"
            onClick={togglePublish}
            disabled={publishingToggle}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 min-h-11 ${
              course.is_published
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'bg-fuchsia-600 text-white hover:bg-fuchsia-700'
            }`}
          >
            {publishingToggle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : course.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
            {course.is_published ? 'Unpublish' : 'Publish'}
          </button>
          <Link
            href={`/dashboard/teaching/courses/${courseId}/assignments`}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm hover:bg-gray-700 transition min-h-11"
          >
            <ClipboardList className="w-3.5 h-3.5" /> Assignments
          </Link>
          <Link
            href={`/academy/${courseId}`}
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm hover:bg-gray-700 transition min-h-11"
          >
            Preview
          </Link>
        </div>
      </div>

      {/* Course settings */}
      <div className="dark-input bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6 mb-6">
        <h2 className="font-semibold text-white mb-4">Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-200 mb-1.5">Cover Image</label>
            <MediaUploader
              dark
              onUpload={(url) => saveCourseField({ cover_image_url: url })}
              onRemove={() => saveCourseField({ cover_image_url: null })}
              currentUrl={course.cover_image_url}
              label="Upload cover image"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-200 mb-1.5">Description</label>
            <textarea
              defaultValue={course.description ?? ''}
              onBlur={(e) => { if (e.target.value !== course.description) saveCourseField({ description: e.target.value }); }}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500 resize-none"
            />
          </div>
          {/* Price — stacks on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-200 mb-1.5">Price Type</label>
              <select
                value={course.price_type}
                onChange={(e) => saveCourseField({ price_type: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
              >
                <option value="free">Free</option>
                <option value="one_time">One-time</option>
                <option value="subscription">Subscription (monthly)</option>
              </select>
            </div>
            {course.price_type !== 'free' && (
              <div>
                <label className="block text-sm text-gray-200 mb-1.5">Price ($)</label>
                <input
                  type="number"
                  defaultValue={course.price}
                  onBlur={(e) => saveCourseField({ price: Number(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
                />
              </div>
            )}
          </div>
          {course.price_type === 'subscription' && (
            <div>
              <label className="block text-sm text-gray-200 mb-1.5">Free Trial (days)</label>
              <input
                type="number"
                min={0}
                max={30}
                defaultValue={course.trial_period_days ?? 0}
                onBlur={(e) => {
                  const val = Number(e.target.value);
                  if (val !== (course.trial_period_days ?? 0)) saveCourseField({ trial_period_days: val } as Partial<Course>);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
                placeholder="0 = no trial"
              />
              <p className="text-gray-600 text-xs mt-1">0 = no trial. Max 30 days.</p>
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-200 mb-1.5">Navigation Mode</label>
            <div className="flex flex-wrap gap-2">
              {(['linear', 'cyoa'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => saveCourseField({ navigation_mode: mode })}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition min-h-11 ${
                    course.navigation_mode === mode
                      ? 'bg-fuchsia-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {mode === 'linear' ? 'Linear' : 'Adventure (CYOA)'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer min-h-11">
              <input
                type="checkbox"
                checked={course.is_sequential}
                onChange={(e) => saveCourseField({ is_sequential: e.target.checked } as Partial<Course>)}
                className="accent-fuchsia-500 w-4 h-4"
              />
              <div>
                <span className="text-sm text-gray-200">Sequential Modules</span>
                <p className="text-xs text-gray-500">Students must complete all lessons in a module before unlocking the next.</p>
              </div>
            </label>
          </div>
          <div>
            <label className="block text-sm text-gray-200 mb-1.5">Visibility</label>
            <div className="flex flex-wrap gap-2">
              {(['public', 'members', 'scheduled'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => saveCourseField({ visibility: v })}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition min-h-11 ${
                    course.visibility === v
                      ? 'bg-fuchsia-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {v === 'public' ? 'Public (anyone)' : v === 'members' ? 'Members only' : 'Scheduled'}
                </button>
              ))}
            </div>
            {course.visibility === 'scheduled' && (
              <div className="mt-2">
                <label className="block text-xs text-gray-400 mb-1">Publish At</label>
                <input
                  type="datetime-local"
                  defaultValue={course.published_at ? course.published_at.slice(0, 16) : ''}
                  onBlur={(e) => saveCourseField({ published_at: e.target.value || null })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CYOA: generate embeddings */}
      {course.navigation_mode === 'cyoa' && (
        <div className="bg-fuchsia-950/30 border border-fuchsia-800/50 rounded-2xl p-4 sm:p-5 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-5 h-5 text-fuchsia-400" />
            <h2 className="font-semibold text-white">AI Adventure Paths</h2>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Generate AI embeddings for all lessons to power semantic &quot;Choose Your Own Adventure&quot; navigation.
            Run this after adding or editing lessons.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={generateEmbeddings}
              disabled={generatingEmbeddings}
              className="flex items-center gap-2 px-4 py-2.5 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50 min-h-11"
            >
              {generatingEmbeddings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {generatingEmbeddings ? 'Generating…' : 'Generate AI Paths'}
            </button>
            {embeddingResult && (
              <p className={`text-sm flex items-center gap-1 ${embeddingResult.startsWith('Generated') ? 'text-green-400' : 'text-red-400'}`}>
                {embeddingResult.startsWith('Generated') && <CheckCircle className="w-3.5 h-3.5" />}
                {embeddingResult}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Curriculum builder */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-white">Curriculum</h2>
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

        {modules.length === 0 ? (
          <div className="text-center py-10 text-gray-600 border border-dashed border-gray-800 rounded-xl">
            <p className="text-sm">No modules yet. Add a module to organize your lessons.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {modules.map((mod) => {
              const lessons = [...mod.lessons].sort((a, b) => a.order - b.order);
              return (
                <div key={mod.id} className="border border-gray-800 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/50">
                    <GripVertical className="w-4 h-4 text-gray-600 shrink-0" />
                    <p className="flex-1 font-medium text-white text-sm">{mod.title}</p>
                    <span className="text-gray-600 text-xs">{lessons.length} lesson{lessons.length !== 1 ? 's' : ''}</span>
                  </div>

                  {lessons.map((lesson) => {
                    const Icon = LESSON_TYPE_ICON[lesson.lesson_type] ?? Play;
                    return (
                      <div key={lesson.id} className="flex items-center gap-3 px-4 py-3 border-t border-gray-800">
                        <GripVertical className="w-3.5 h-3.5 text-gray-700 shrink-0" />
                        <Icon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span className="flex-1 text-sm text-gray-300 min-w-0 truncate">{lesson.title}</span>
                        {lesson.is_free_preview && (
                          <span className="text-xs text-fuchsia-400 px-1.5 py-0.5 bg-fuchsia-900/30 rounded shrink-0">Preview</span>
                        )}
                        {/* Delete always visible — hover:opacity trick is invisible on mobile */}
                        <button
                          type="button"
                          onClick={() => deleteLesson(lesson.id)}
                          className="p-2 text-gray-600 hover:text-red-400 transition shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
                          aria-label="Delete lesson"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Add lesson */}
                  {addingLesson === mod.id ? (
                    <div className="dark-input border-t border-gray-800 p-4 space-y-3">
                      <input
                        autoFocus
                        type="text"
                        value={newLesson.title}
                        onChange={(e) => setNewLesson((l) => ({ ...l, title: e.target.value }))}
                        placeholder="Lesson title…"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500 min-h-11"
                      />
                      <div className="flex flex-wrap gap-3 items-center">
                        <select
                          value={newLesson.lesson_type}
                          onChange={(e) => setNewLesson((l) => ({ ...l, lesson_type: e.target.value }))}
                          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
                        >
                          <option value="video">Video</option>
                          <option value="text">Text</option>
                          <option value="audio">Audio</option>
                          <option value="slides">Slides</option>
                          <option value="quiz">Quiz</option>
                        </select>
                        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer min-h-11">
                          <input
                            type="checkbox"
                            checked={newLesson.is_free_preview}
                            onChange={(e) => setNewLesson((l) => ({ ...l, is_free_preview: e.target.checked }))}
                            className="accent-fuchsia-500 w-4 h-4"
                          />
                          Free preview
                        </label>
                      </div>
                      {/* Quiz editor — shown when lesson_type is quiz */}
                      {/* Audio chapter/transcript editor */}
                      {newLesson.lesson_type === 'audio' && (
                        <div className="space-y-4 border border-gray-700 rounded-xl p-3 bg-gray-800/30">
                          {/* Chapter markers */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-gray-200">Chapter Markers</h4>
                              <button type="button" onClick={addAudioChapter} className="flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition">
                                <Plus className="w-3 h-3" /> Add Chapter
                              </button>
                            </div>
                            {audioChapters.length === 0 && (
                              <p className="text-xs text-gray-600 text-center py-2">No chapters. Students can still listen without chapters.</p>
                            )}
                            <div className="space-y-2">
                              {audioChapters.map((ch, ci) => (
                                <div key={ch.id} className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 shrink-0 w-5">{ci + 1}</span>
                                  <input
                                    type="text"
                                    value={ch.title}
                                    onChange={(e) => updateAudioChapter(ch.id, { title: e.target.value })}
                                    placeholder="Chapter title…"
                                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
                                  />
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={ch.startTime}
                                    onChange={(e) => updateAudioChapter(ch.id, { startTime: Number(e.target.value) })}
                                    className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                                    title="Start time (seconds)"
                                    placeholder="Start (s)"
                                  />
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={ch.endTime}
                                    onChange={(e) => updateAudioChapter(ch.id, { endTime: Number(e.target.value) })}
                                    className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                                    title="End time (seconds)"
                                    placeholder="End (s)"
                                  />
                                  <button type="button" onClick={() => removeAudioChapter(ch.id)} className="text-gray-600 hover:text-red-400 transition p-1 shrink-0">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Transcript */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-200 mb-1.5">Transcript</label>
                            <p className="text-xs text-gray-500 mb-2">Paste timestamped transcript. Format: <code className="text-gray-400">MM:SS text</code> (one per line). e.g. <code className="text-gray-400">01:30 Welcome back to the show</code></p>
                            <textarea
                              value={transcriptText}
                              onChange={(e) => setTranscriptText(e.target.value)}
                              rows={6}
                              placeholder={"00:00 Introduction\n00:45 Today's topic\n03:20 First segment…"}
                              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500 resize-none font-mono"
                            />
                          </div>
                        </div>
                      )}
                      {newLesson.lesson_type === 'quiz' && (
                        <div className="space-y-3 border border-gray-700 rounded-xl p-3 bg-gray-800/30">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-200">Quiz Questions</h4>
                            <button type="button" onClick={addQuizQuestion} className="flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition">
                              <Plus className="w-3 h-3" /> Add Question
                            </button>
                          </div>
                          {quizQuestions.length === 0 && (
                            <p className="text-xs text-gray-600 text-center py-3">No questions yet. Add your first question above.</p>
                          )}
                          {quizQuestions.map((q, qi) => (
                            <div key={q.id} className="border border-gray-700 rounded-lg p-3 space-y-2">
                              <div className="flex items-start gap-2">
                                <span className="text-xs text-gray-500 mt-3 shrink-0">Q{qi + 1}</span>
                                <div className="flex-1 space-y-2">
                                  <input
                                    type="text"
                                    value={q.questionText}
                                    onChange={(e) => updateQuizQuestion(q.id, { questionText: e.target.value })}
                                    placeholder="Question text…"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
                                  />
                                  <div className="space-y-1.5">
                                    {q.options.map((opt) => (
                                      <div key={opt.id} className="flex items-center gap-2">
                                        <input
                                          type="radio"
                                          name={`correct-${q.id}`}
                                          checked={q.correctOptionId === opt.id}
                                          onChange={() => updateQuizQuestion(q.id, { correctOptionId: opt.id })}
                                          className="accent-green-500 shrink-0"
                                          title="Mark as correct answer"
                                        />
                                        <input
                                          type="text"
                                          value={opt.text}
                                          onChange={(e) => updateQuizOption(q.id, opt.id, e.target.value)}
                                          placeholder="Option text…"
                                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
                                        />
                                        {q.options.length > 2 && (
                                          <button type="button" onClick={() => removeQuizOption(q.id, opt.id)} className="text-gray-600 hover:text-red-400 transition p-1">
                                            <X className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                    {q.options.length < 6 && (
                                      <button type="button" onClick={() => addQuizOption(q.id)} className="text-xs text-gray-500 hover:text-fuchsia-400 transition ml-6">
                                        + Add option
                                      </button>
                                    )}
                                  </div>
                                  <input
                                    type="text"
                                    value={q.explanation}
                                    onChange={(e) => updateQuizQuestion(q.id, { explanation: e.target.value })}
                                    placeholder="Explanation (shown after answering)…"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
                                  />
                                  <input
                                    type="text"
                                    value={q.citation}
                                    onChange={(e) => updateQuizQuestion(q.id, { citation: e.target.value })}
                                    placeholder="Citation (optional, APA format)…"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-400 placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
                                  />
                                </div>
                                <button type="button" onClick={() => removeQuizQuestion(q.id)} className="text-gray-600 hover:text-red-400 transition p-1 mt-2 shrink-0">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="flex flex-wrap gap-3 pt-1">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Passing Score (%)</label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={quizPassingScore}
                                onChange={(e) => setQuizPassingScore(Number(e.target.value))}
                                className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Attempts (-1 = unlimited)</label>
                              <input
                                type="number"
                                min={-1}
                                value={quizAttemptsAllowed}
                                onChange={(e) => setQuizAttemptsAllowed(Number(e.target.value))}
                                className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Podcast links — audio lessons only */}
                      {newLesson.lesson_type === 'audio' && (
                        <div className="space-y-2 border border-gray-700 rounded-xl p-3 bg-gray-800/30">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-200">Podcast Links</h4>
                            <button type="button" onClick={addPodcastLink} className="flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition">
                              <Plus className="w-3 h-3" /> Add Platform
                            </button>
                          </div>
                          {podcastLinks.length === 0 && (
                            <p className="text-xs text-gray-600 text-center py-2">No podcast links. Add links to Spotify, Apple Podcasts, YouTube, etc.</p>
                          )}
                          <div className="space-y-2">
                            {podcastLinks.map((link, li) => (
                              <div key={link.id} className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 shrink-0 w-5">{li + 1}</span>
                                <input
                                  type="url"
                                  value={link.url}
                                  onChange={(e) => updatePodcastLink(link.id, { url: e.target.value })}
                                  placeholder="https://open.spotify.com/episode/..."
                                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
                                />
                                <input
                                  type="text"
                                  value={link.label}
                                  onChange={(e) => updatePodcastLink(link.id, { label: e.target.value })}
                                  placeholder="Label (auto-detected)"
                                  className="w-36 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
                                />
                                <button type="button" onClick={() => removePodcastLink(link.id)} className="text-gray-600 hover:text-red-400 transition p-1 shrink-0">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-600">Leave label blank to auto-detect platform from URL (Spotify, Apple, YouTube, etc.)</p>
                        </div>
                      )}

                      {/* Interactive Map — any lesson type */}
                      <div className="border border-gray-700 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setShowMapSection((v) => !v)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-800/50 text-sm font-semibold text-gray-300 hover:bg-gray-800 transition"
                        >
                          <Map className="w-3.5 h-3.5 text-fuchsia-400" />
                          Interactive Map
                          <span className="text-xs text-gray-600 ml-1">
                            {mapMarkers.length > 0 || mapLines.length > 0 || mapPolygons.length > 0
                              ? `(${mapMarkers.length} markers, ${mapLines.length} lines, ${mapPolygons.length} polygons)`
                              : '(optional)'}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 ml-auto text-gray-600 transition-transform ${showMapSection ? 'rotate-180' : ''}`} />
                        </button>
                        {showMapSection && (
                          <div className="p-3 space-y-3 bg-gray-800/20">
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Center Lat</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={mapCenter.lat}
                                  onChange={(e) => setMapCenter((c) => ({ ...c, lat: parseFloat(e.target.value) || 0 }))}
                                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Center Lng</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={mapCenter.lng}
                                  onChange={(e) => setMapCenter((c) => ({ ...c, lng: parseFloat(e.target.value) || 0 }))}
                                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Zoom (1-18)</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={18}
                                  value={mapZoom}
                                  onChange={(e) => setMapZoom(Number(e.target.value) || 3)}
                                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                                />
                              </div>
                            </div>
                            <DataImporter
                              label="Markers"
                              columns={[
                                { key: 'lat', label: 'Lat', required: true },
                                { key: 'lng', label: 'Lng', required: true },
                                { key: 'title', label: 'Title', required: true },
                                { key: 'description', label: 'Description' },
                                { key: 'color', label: 'Color' },
                              ]}
                              onImport={handleMarkerImport}
                              templateCsvUrl="/templates/map-markers.csv"
                            />
                            <DataImporter
                              label="Lines (trade routes, paths)"
                              columns={[
                                { key: 'line_id', label: 'Line ID', required: true },
                                { key: 'lat', label: 'Lat', required: true },
                                { key: 'lng', label: 'Lng', required: true },
                                { key: 'title', label: 'Title' },
                                { key: 'color', label: 'Color' },
                                { key: 'description', label: 'Description' },
                              ]}
                              onImport={handleLineImport}
                              templateCsvUrl="/templates/map-lines.csv"
                            />
                            <DataImporter
                              label="Polygons (regions, territories)"
                              columns={[
                                { key: 'polygon_id', label: 'Polygon ID', required: true },
                                { key: 'lat', label: 'Lat', required: true },
                                { key: 'lng', label: 'Lng', required: true },
                                { key: 'title', label: 'Title' },
                                { key: 'color', label: 'Color' },
                                { key: 'fill_color', label: 'Fill Color' },
                                { key: 'description', label: 'Description' },
                              ]}
                              onImport={handlePolygonImport}
                              templateCsvUrl="/templates/map-polygons.csv"
                            />
                            {(mapMarkers.length > 0 || mapLines.length > 0 || mapPolygons.length > 0) && (
                              <div className="flex items-center gap-3 pt-1">
                                <p className="text-xs text-green-400">
                                  {mapMarkers.length} markers, {mapLines.length} lines, {mapPolygons.length} polygons loaded
                                </p>
                                <button
                                  type="button"
                                  onClick={() => { setMapMarkers([]); setMapLines([]); setMapPolygons([]); }}
                                  className="text-xs text-red-400 hover:text-red-300 transition"
                                >
                                  Clear all
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Documents — any lesson type */}
                      <div className="border border-gray-700 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setShowDocSection((v) => !v)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-800/50 text-sm font-semibold text-gray-300 hover:bg-gray-800 transition"
                        >
                          <Paperclip className="w-3.5 h-3.5 text-fuchsia-400" />
                          Documents
                          <span className="text-xs text-gray-600 ml-1">
                            {lessonDocuments.length > 0 ? `(${lessonDocuments.length} docs)` : '(optional)'}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 ml-auto text-gray-600 transition-transform ${showDocSection ? 'rotate-180' : ''}`} />
                        </button>
                        {showDocSection && (
                          <div className="p-3 space-y-3 bg-gray-800/20">
                            <DataImporter
                              label="Batch import from CSV"
                              columns={[
                                { key: 'url', label: 'URL', required: true },
                                { key: 'title', label: 'Title', required: true },
                                { key: 'description', label: 'Description' },
                                { key: 'source_url', label: 'Source URL' },
                              ]}
                              onImport={handleDocumentImport}
                              templateCsvUrl="/templates/documents.csv"
                            />
                            <div className="border-t border-gray-700 pt-3">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Manual entry</p>
                                <button type="button" onClick={addDocument} className="flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition">
                                  <Plus className="w-3 h-3" /> Add Document
                                </button>
                              </div>
                              {lessonDocuments.length === 0 && (
                                <p className="text-xs text-gray-600 text-center py-2">No documents. Import via CSV or add manually.</p>
                              )}
                              <div className="space-y-2">
                                {lessonDocuments.map((doc, di) => (
                                  <div key={doc.id} className="border border-gray-700 rounded-lg p-2 space-y-1.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500 shrink-0 w-5">{di + 1}</span>
                                      <input
                                        type="text"
                                        value={doc.title}
                                        onChange={(e) => updateDocument(doc.id, { title: e.target.value })}
                                        placeholder="Document title…"
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
                                      />
                                      <button type="button" onClick={() => removeDocument(doc.id)} className="text-gray-600 hover:text-red-400 transition p-1 shrink-0">
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <div className="ml-7">
                                      <MediaUploader
                                        dark
                                        onUpload={(url) => updateDocument(doc.id, { url })}
                                        onRemove={() => updateDocument(doc.id, { url: '' })}
                                        currentUrl={doc.url || undefined}
                                        label="Upload PDF or image"
                                      />
                                    </div>
                                    <div className="ml-7 grid grid-cols-2 gap-2">
                                      <input
                                        type="text"
                                        value={doc.description}
                                        onChange={(e) => updateDocument(doc.id, { description: e.target.value })}
                                        placeholder="Description…"
                                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
                                      />
                                      <input
                                        type="url"
                                        value={doc.source_url}
                                        onChange={(e) => updateDocument(doc.id, { source_url: e.target.value })}
                                        placeholder="Original source URL…"
                                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => addLesson(mod.id)} className="px-4 py-2.5 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition min-h-11">Add Lesson</button>
                        <button onClick={() => setAddingLesson(null)} className="px-4 py-2.5 bg-gray-800 text-gray-400 rounded-xl text-sm hover:bg-gray-700 transition min-h-11">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingLesson(mod.id)}
                      className="w-full flex items-center gap-2 px-4 py-3 border-t border-gray-800 text-gray-600 hover:text-fuchsia-400 text-sm hover:bg-gray-800/30 transition min-h-11"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Lesson
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save reminder */}
      <div className="mt-6 flex items-center gap-2">
        <Save className="w-4 h-4 text-gray-600" />
        <p className="text-gray-600 text-xs">Changes are saved automatically on blur.</p>
      </div>
    </div>
  );
}
