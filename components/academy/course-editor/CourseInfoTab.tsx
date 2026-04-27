'use client';

import { useEffect, useState } from 'react';
import { Star, Sparkles, BookOpenCheck } from 'lucide-react';
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
  bvc_season: 1 | 2 | 3 | null;
  is_featured: boolean;
  is_app_tutorial: boolean;
  featured_order: number;
  teacher_is_featured: boolean;
  teacher_featured_order: number;
  course_modules: Array<{ id: string; title: string; order: number; lessons: Array<{ id: string; title: string; lesson_type: string; content_url: string | null; text_content: string | null; duration_seconds: number | null; order: number; is_free_preview: boolean; module_id: string | null }> }>;
}

interface TabProps {
  course: Course;
  courseId: string;
  saveCourseField: (updates: Partial<Course>) => Promise<void>;
  saving: boolean;
  feedback: string;
  isAdmin?: boolean;
  isOwner?: boolean;
}

const CATEGORY_OPTIONS = [
  'Better Vice Club',
  'Health & Wellness', 'Finance & Money', 'Longevity', 'Fitness', 'Nutrition',
  'Mental Health', 'Career', 'Technology', 'Travel', 'Cooking',
  'Platform Guide', 'Other',
];
const CATEGORY_PRESET_SET = new Set(CATEGORY_OPTIONS);

export default function CourseInfoTab({ course, saveCourseField, isAdmin, isOwner }: TabProps) {
  // Single-control category picker. The original <input list> + <datalist>
  // had a UX trap (filters suggestions to options starting with the current
  // value); the previous fix introduced a select + text-input pair which
  // teachers found cluttered. This version shows ONE control at a time:
  // either the preset <select> or a free-text input, with a small toggle
  // to switch modes. A "Custom (type your own)..." sentinel option in
  // the select also flips into custom mode so users can discover it
  // without the toggle.
  const isCategoryCustom = !!course.category && !CATEGORY_PRESET_SET.has(course.category);
  const [customMode, setCustomMode] = useState(isCategoryCustom);
  useEffect(() => { setCustomMode(isCategoryCustom); }, [isCategoryCustom]);

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
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm text-gray-200" htmlFor="course-category">Category</label>
          <button
            type="button"
            onClick={() => setCustomMode((m) => !m)}
            className="text-xs text-fuchsia-400 hover:text-fuchsia-300 transition"
          >
            {customMode ? 'Pick from preset list' : 'Type a custom category'}
          </button>
        </div>
        {!customMode ? (
          // colorScheme: 'dark' tells the browser to render native form
          // primitives (including the <option> dropdown popup) using its
          // dark-mode palette, so options aren't dark-on-dark on macOS /
          // Linux dark themes. Combined with explicit per-option classes
          // as a belt-and-suspenders fallback for older browsers.
          <select
            id="course-category"
            value={course.category && CATEGORY_PRESET_SET.has(course.category) ? course.category : ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '__custom__') {
                setCustomMode(true);
                return;
              }
              saveCourseField({ category: v || null });
            }}
            style={{ colorScheme: 'dark' }}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
          >
            <option value="" className="bg-gray-800 text-white">— Pick a preset category —</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c} className="bg-gray-800 text-white">{c}</option>
            ))}
            <option value="__custom__" className="bg-gray-800 text-white">Custom (type your own)…</option>
          </select>
        ) : (
          <input
            id="course-category"
            type="text"
            defaultValue={course.category ?? ''}
            onBlur={(e) => {
              const trimmed = e.target.value.trim();
              if (trimmed !== (course.category ?? '')) {
                saveCourseField({ category: trimmed || null });
              }
            }}
            placeholder="Type a custom category…"
            autoFocus
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 min-h-11"
          />
        )}
        <p className="text-xs text-gray-400 mt-1.5">
          {customMode
            ? 'Saves on blur. Use the toggle above to return to the preset list.'
            : 'Pick a preset, or use the toggle above to type your own category.'}
        </p>
      </div>
      <div>
        <label className="block text-sm text-gray-200 mb-1.5" htmlFor="course-bvc-season">
          BVC Season <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <select
          id="course-bvc-season"
          value={course.bvc_season ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            const parsed = v === '' ? null : (Number(v) as 1 | 2 | 3);
            saveCourseField({ bvc_season: parsed });
          }}
          style={{ colorScheme: 'dark' }}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
        >
          <option value="" className="bg-gray-800 text-white">Not a BVC course</option>
          <option value="1" className="bg-gray-800 text-white">Season 1 — Daily Rituals</option>
          <option value="2" className="bg-gray-800 text-white">Season 2 — The Oldest Toast</option>
          <option value="3" className="bg-gray-800 text-white">Season 3 — The Forbidden Leaf</option>
        </select>
        <p className="text-xs text-gray-400 mt-1.5">
          Better Vice Club season. When set, every lesson in this course shows an embedded world map filtered to this season&apos;s commodities only. Leave unset for non-BVC courses.
        </p>
      </div>

      {/* Teacher-controlled: feature this course on the teacher's own profile page. */}
      {(isOwner || isAdmin) && (
        <div className="border border-gray-700 rounded-xl p-4 bg-gray-800/30 space-y-3">
          <div className="flex items-start gap-2">
            <Star className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-100">Featured on your teacher profile</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Pin this course to the top of your <code className="text-fuchsia-400">/academy/teachers/&hellip;</code> profile page. Only affects your own profile, not the main academy catalog.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer min-h-11">
            <input
              type="checkbox"
              checked={course.teacher_is_featured}
              onChange={(e) => saveCourseField({ teacher_is_featured: e.target.checked })}
              className="accent-fuchsia-500 w-4 h-4"
            />
            Feature on my profile
          </label>
          {course.teacher_is_featured && (
            <div>
              <label className="block text-xs text-gray-400 mb-1" htmlFor="teacher-featured-order">
                Position (lower numbers appear first)
              </label>
              <input
                id="teacher-featured-order"
                type="number"
                min={0}
                defaultValue={course.teacher_featured_order ?? 0}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  const next = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
                  if (next !== course.teacher_featured_order) saveCourseField({ teacher_featured_order: next });
                }}
                className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500"
              />
            </div>
          )}
        </div>
      )}

      {/* Admin-only: site-wide visibility flags for the /academy catalog. */}
      {isAdmin && (
        <div className="border border-amber-800/40 rounded-xl p-4 bg-amber-900/10 space-y-4">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-200">Admin: site-wide catalog placement</p>
              <p className="text-xs text-amber-100/70 mt-0.5">
                Controls how this course is grouped on <code className="text-fuchsia-400">/academy</code>. Visible to admins only.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-100 cursor-pointer">
            <input
              type="checkbox"
              checked={course.is_featured}
              onChange={(e) => saveCourseField({ is_featured: e.target.checked })}
              className="accent-fuchsia-500 w-4 h-4 mt-0.5 shrink-0"
            />
            <span className="flex-1">
              <span className="block">Featured on the academy catalog</span>
              <span className="block text-xs text-gray-400 mt-0.5">Pins this course to the Featured strip at the top of /academy.</span>
            </span>
          </label>

          {course.is_featured && (
            <div className="pl-6">
              <label className="block text-xs text-gray-400 mb-1" htmlFor="featured-order">
                Featured position (lower numbers appear first)
              </label>
              <input
                id="featured-order"
                type="number"
                min={0}
                defaultValue={course.featured_order ?? 0}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  const next = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
                  if (next !== course.featured_order) saveCourseField({ featured_order: next });
                }}
                className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500"
              />
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-gray-100 cursor-pointer">
            <input
              type="checkbox"
              checked={course.is_app_tutorial}
              onChange={(e) => saveCourseField({ is_app_tutorial: e.target.checked })}
              className="accent-fuchsia-500 w-4 h-4 mt-0.5 shrink-0"
            />
            <span className="flex-1">
              <span className="flex items-center gap-1.5">
                <BookOpenCheck className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                About the app
              </span>
              <span className="block text-xs text-gray-400 mt-0.5">Groups this course into the collapsible &ldquo;Learn the App&rdquo; section so it doesn&apos;t crowd the main subject-matter grid. Can be combined with Featured.</span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
