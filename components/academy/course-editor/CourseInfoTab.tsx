'use client';

import { useState } from 'react';
import MediaUploader from '@/components/ui/MediaUploader';

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

const CATEGORY_OPTIONS = [
  'Health & Wellness', 'Finance & Money', 'Longevity', 'Fitness', 'Nutrition',
  'Mental Health', 'Career', 'Technology', 'Travel', 'Cooking',
  'Platform Guide', 'Other',
];

export default function CourseInfoTab({ course, saveCourseField }: TabProps) {
  const [categoryInput, setCategoryInput] = useState(course.category ?? '');

  return (
    <div className="space-y-5">
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
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 resize-none"
          placeholder="What will students learn in this course?"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-200 mb-1.5" htmlFor="course-category">Category</label>
        <input
          id="course-category"
          list="category-options"
          value={categoryInput}
          onChange={(e) => setCategoryInput(e.target.value)}
          onBlur={(e) => { if (e.target.value !== (course.category ?? '')) saveCourseField({ category: e.target.value || null }); }}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 min-h-11"
          placeholder="Select or type a category…"
        />
        <datalist id="category-options">
          {CATEGORY_OPTIONS.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>
    </div>
  );
}
