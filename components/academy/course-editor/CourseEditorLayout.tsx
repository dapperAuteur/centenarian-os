'use client';

// components/academy/course-editor/CourseEditorLayout.tsx
// Tabbed wizard layout for the course editor. Replaces the monolithic [id]/page.tsx.
// Each tab is an independent component with focused state.

import { useEffect, useState, useCallback } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import Link from 'next/link';
import {
  ChevronLeft, Loader2, Save, Globe, EyeOff, GitBranch,
  ClipboardList,
} from 'lucide-react';

import CourseInfoTab from './CourseInfoTab';
import PricingAccessTab from './PricingAccessTab';
import NavigationStructureTab from './NavigationStructureTab';
import CurriculumTab from './CurriculumTab';
import ExtrasTab from './ExtrasTab';
import PrerequisitesTab from './PrerequisitesTab';
import ReviewPublishTab from './ReviewPublishTab';

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

const TABS = [
  { label: 'Info', shortLabel: 'Info' },
  { label: 'Pricing', shortLabel: 'Price' },
  { label: 'Structure', shortLabel: 'Nav' },
  { label: 'Curriculum', shortLabel: 'Lessons' },
  { label: 'Extras', shortLabel: 'Extras' },
  { label: 'Prerequisites', shortLabel: 'Prereqs' },
  { label: 'Review', shortLabel: 'Review' },
] as const;

interface Props {
  courseId: string;
}

export default function CourseEditorLayout({ courseId }: Props) {
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  const fetchCourse = useCallback(() => {
    offlineFetch(`/api/academy/courses/${courseId}`)
      .then((r) => r.json())
      .then((d) => { setCourse(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [courseId]);

  useEffect(() => { fetchCourse(); }, [fetchCourse]);

  const saveCourseField = useCallback(async (updates: Partial<Course>) => {
    if (!course) return;
    setSaving(true);
    try {
      const r = await offlineFetch(`/api/academy/courses/${courseId}`, {
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
  }, [course, courseId]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" /></div>;
  }

  if (!course) {
    return <div className="text-center py-20 text-gray-500">Course not found.</div>;
  }

  const tabProps = { course, courseId, saveCourseField, saving, feedback };

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <Link href="/dashboard/teaching" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-6 transition">
        <ChevronLeft className="w-4 h-4" /> Teaching Dashboard
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
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

      {/* Tab bar — scrollable on mobile */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {TABS.map((tab, i) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActiveTab(i)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap min-h-11 ${
              activeTab === i
                ? 'bg-fuchsia-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.shortLabel}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
        {activeTab === 0 && <CourseInfoTab {...tabProps} />}
        {activeTab === 1 && <PricingAccessTab {...tabProps} />}
        {activeTab === 2 && <NavigationStructureTab {...tabProps} />}
        {activeTab === 3 && <CurriculumTab course={course} courseId={courseId} onCourseUpdated={fetchCourse} setFeedback={setFeedback} />}
        {activeTab === 4 && <ExtrasTab course={course} courseId={courseId} />}
        {activeTab === 5 && <PrerequisitesTab {...tabProps} setFeedback={setFeedback} />}
        {activeTab === 6 && <ReviewPublishTab {...tabProps} />}
      </div>

      {/* Save reminder */}
      <div className="mt-6 flex items-center gap-2">
        <Save className="w-4 h-4 text-gray-400" />
        <p className="text-gray-400 text-xs">Changes are saved automatically on blur.</p>
      </div>
    </div>
  );
}
