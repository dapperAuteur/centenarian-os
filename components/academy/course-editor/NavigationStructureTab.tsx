'use client';

import { useState } from 'react';
import { Sparkles, CheckCircle, Loader2 } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

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
  course_modules: Array<{ id: string; title: string; order: number; lessons: Array<{ id: string; title: string; lesson_type: string; content_url: string | null; text_content: string | null; duration_seconds: number | null; order: number; is_free_preview: boolean; module_id: string | null }> }>;
}

interface TabProps {
  course: Course;
  courseId: string;
  saveCourseField: (updates: Partial<Course>) => Promise<void>;
  saving: boolean;
  feedback: string;
}

export default function NavigationStructureTab({ course, courseId, saveCourseField }: TabProps) {
  const [generatingEmbeddings, setGeneratingEmbeddings] = useState(false);
  const [embeddingResult, setEmbeddingResult] = useState('');

  async function generateEmbeddings() {
    setGeneratingEmbeddings(true);
    setEmbeddingResult('');
    try {
      const r = await offlineFetch(`/api/academy/courses/${courseId}/generate-embeddings`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setEmbeddingResult(`Generated embeddings for ${d.processed} lessons.`);
    } catch (e) {
      setEmbeddingResult(e instanceof Error ? e.message : 'Failed');
    } finally {
      setGeneratingEmbeddings(false);
    }
  }

  return (
    <div className="space-y-6">
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
        <p className="text-xs text-gray-500 mt-1.5">
          {course.navigation_mode === 'linear'
            ? 'Students progress through lessons in order with Previous/Next buttons.'
            : 'After each lesson, students choose their next path based on AI-powered semantic similarity.'}
        </p>
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

      {course.navigation_mode === 'cyoa' && (
        <>
          <div>
            <label className="flex items-center gap-3 cursor-pointer min-h-11">
              <input
                type="checkbox"
                checked={!!(course as Course & { allow_cross_course_cyoa?: boolean }).allow_cross_course_cyoa}
                onChange={(e) => saveCourseField({ allow_cross_course_cyoa: e.target.checked } as Partial<Course>)}
                className="accent-fuchsia-500 w-4 h-4"
              />
              <div>
                <span className="text-sm text-gray-200">Cross-Course Adventure Paths</span>
                <p className="text-xs text-gray-500">Allow this course&apos;s lessons to appear in other courses&apos; CYOA crossroads, and vice versa.</p>
              </div>
            </label>
          </div>

          <div className="bg-fuchsia-950/30 border border-fuchsia-800/50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-5 h-5 text-fuchsia-400" />
              <h3 className="font-semibold text-white text-sm">AI Adventure Paths</h3>
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
        </>
      )}
    </div>
  );
}
