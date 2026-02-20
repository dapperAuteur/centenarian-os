'use client';

// app/dashboard/teaching/courses/[id]/page.tsx
// Course editor: settings, modules, lessons, publish toggle, CYOA embed generation.

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Plus, Loader2, Save, Globe, EyeOff, Trash2,
  GitBranch, Sparkles, Play, FileText, Volume2, Presentation, GripVertical,
  CheckCircle,
} from 'lucide-react';
import MediaUploader from '@/components/ui/MediaUploader';

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
  visibility: 'public' | 'members' | 'scheduled';
  published_at: string | null;
  course_modules: Module[];
}

const LESSON_TYPE_ICON: Record<string, React.ElementType> = {
  video: Play, text: FileText, audio: Volume2, slides: Presentation,
};

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
    const r = await fetch(`/api/academy/courses/${courseId}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newLesson,
        module_id: moduleId,
        order: (course?.course_modules.find((m) => m.id === moduleId)?.lessons.length ?? 0),
      }),
    });
    if (r.ok) {
      setNewLesson({ title: '', lesson_type: 'video', content_url: '', is_free_preview: false });
      setAddingLesson(null);
      fetchCourse();
    }
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
    <div className="p-8 max-w-3xl">
      <Link href="/dashboard/teaching" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-6 transition">
        <ChevronLeft className="w-4 h-4" /> Teaching Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{course.title}</h1>
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
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
          {feedback && <p className="text-sm text-green-400">{feedback}</p>}
          <button
            type="button"
            onClick={togglePublish}
            disabled={publishingToggle}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${
              course.is_published
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'bg-fuchsia-600 text-white hover:bg-fuchsia-700'
            }`}
          >
            {publishingToggle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : course.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
            {course.is_published ? 'Unpublish' : 'Publish'}
          </button>
          <Link
            href={`/academy/${courseId}`}
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-300 rounded-xl text-sm hover:bg-gray-700 transition"
          >
            Preview
          </Link>
        </div>
      </div>

      {/* Course settings */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-200 mb-1.5">Price Type</label>
              <select
                value={course.price_type}
                onChange={(e) => saveCourseField({ price_type: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500"
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
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-200 mb-1.5">Navigation Mode</label>
            <div className="flex gap-2">
              {(['linear', 'cyoa'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => saveCourseField({ navigation_mode: mode })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
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
            <label className="block text-sm text-gray-200 mb-1.5">Visibility</label>
            <div className="flex gap-2 flex-wrap">
              {(['public', 'members', 'scheduled'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => saveCourseField({ visibility: v })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
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
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CYOA: generate embeddings */}
      {course.navigation_mode === 'cyoa' && (
        <div className="bg-fuchsia-950/30 border border-fuchsia-800/50 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-5 h-5 text-fuchsia-400" />
            <h2 className="font-semibold text-white">AI Adventure Paths</h2>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Generate AI embeddings for all lessons to power semantic &quot;Choose Your Own Adventure&quot; navigation.
            Run this after adding or editing lessons.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={generateEmbeddings}
              disabled={generatingEmbeddings}
              className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50"
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
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-white">Curriculum</h2>
          <button
            type="button"
            onClick={() => setAddingModule(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add Module
          </button>
        </div>

        {addingModule && (
          <div className="flex gap-2 mb-4">
            <input
              autoFocus
              type="text"
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addModule(); if (e.key === 'Escape') setAddingModule(false); }}
              placeholder="Module title…"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
            />
            <button onClick={addModule} className="px-3 py-2 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition">Add</button>
            <button onClick={() => setAddingModule(false)} className="px-3 py-2 bg-gray-800 text-gray-400 rounded-xl text-sm hover:bg-gray-700 transition">Cancel</button>
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
                    <span className="text-gray-600 text-xs">{lessons.length} lessons</span>
                  </div>

                  {lessons.map((lesson) => {
                    const Icon = LESSON_TYPE_ICON[lesson.lesson_type] ?? Play;
                    return (
                      <div key={lesson.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-800 group">
                        <GripVertical className="w-3.5 h-3.5 text-gray-700 shrink-0" />
                        <Icon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span className="flex-1 text-sm text-gray-300">{lesson.title}</span>
                        {lesson.is_free_preview && (
                          <span className="text-xs text-fuchsia-400 px-1.5 py-0.5 bg-fuchsia-900/30 rounded">Preview</span>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteLesson(lesson.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Add lesson */}
                  {addingLesson === mod.id ? (
                    <div className="border-t border-gray-800 p-4 space-y-3">
                      <input
                        autoFocus
                        type="text"
                        value={newLesson.title}
                        onChange={(e) => setNewLesson((l) => ({ ...l, title: e.target.value }))}
                        placeholder="Lesson title…"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
                      />
                      <div className="flex gap-2">
                        <select
                          value={newLesson.lesson_type}
                          onChange={(e) => setNewLesson((l) => ({ ...l, lesson_type: e.target.value }))}
                          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                        >
                          <option value="video">Video</option>
                          <option value="text">Text</option>
                          <option value="audio">Audio</option>
                          <option value="slides">Slides</option>
                        </select>
                        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newLesson.is_free_preview}
                            onChange={(e) => setNewLesson((l) => ({ ...l, is_free_preview: e.target.checked }))}
                            className="accent-fuchsia-500"
                          />
                          Free preview
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => addLesson(mod.id)} className="px-3 py-1.5 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition">Add Lesson</button>
                        <button onClick={() => setAddingLesson(null)} className="px-3 py-1.5 bg-gray-800 text-gray-400 rounded-xl text-sm hover:bg-gray-700 transition">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingLesson(mod.id)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-gray-800 text-gray-600 hover:text-fuchsia-400 text-sm hover:bg-gray-800/30 transition"
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
