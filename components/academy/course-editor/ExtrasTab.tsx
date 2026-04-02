'use client';

import { useState } from 'react';
import { BookMarked, ChevronDown } from 'lucide-react';
import GlossaryEditor from '@/components/academy/GlossaryEditor';

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

interface TabProps {
  course: Course;
  courseId: string;
}

export default function ExtrasTab({ course, courseId }: TabProps) {
  const [showGlossary, setShowGlossary] = useState(true);

  const allLessons = course.course_modules?.flatMap((m) =>
    m.lessons.map((l) => ({ id: l.id, title: l.title }))
  ) ?? [];

  return (
    <div className="space-y-6">
      <div className="border border-gray-800 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowGlossary((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 bg-gray-800/50 text-sm font-semibold text-gray-300 hover:bg-gray-800 transition min-h-11"
        >
          <BookMarked className="w-4 h-4 text-fuchsia-400" />
          Glossary &amp; Phonetic Spelling
          <ChevronDown className={`w-4 h-4 ml-auto text-gray-600 transition-transform ${showGlossary ? 'rotate-180' : ''}`} />
        </button>
        {showGlossary && (
          <div className="p-4">
            <GlossaryEditor courseId={courseId} lessons={allLessons} />
          </div>
        )}
      </div>
      <p className="text-xs text-gray-600">
        Maps, documents, and podcast links are added per-lesson in the Curriculum tab.
      </p>
    </div>
  );
}
