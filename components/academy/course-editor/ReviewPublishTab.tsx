'use client';

import { useState } from 'react';
import {
  CheckCircle, AlertTriangle, Globe, EyeOff, Loader2, Play, FileText,
  Volume2, HelpCircle,
} from 'lucide-react';
import Link from 'next/link';

interface Lesson {
  id: string; title: string; lesson_type: string; content_url: string | null;
  text_content: string | null; duration_seconds: number | null; order: number;
  is_free_preview: boolean; module_id: string | null;
}
interface Module { id: string; title: string; order: number; lessons: Lesson[]; }
interface Course {
  id: string; title: string; description: string | null; cover_image_url: string | null;
  category: string | null; price: number; price_type: string; is_published: boolean;
  navigation_mode: 'linear' | 'cyoa'; is_sequential: boolean;
  visibility: 'public' | 'members' | 'scheduled'; published_at: string | null;
  trial_period_days: number; course_modules: Module[];
}

interface TabProps {
  course: Course;
  courseId: string;
  saveCourseField: (updates: Partial<Course>) => Promise<void>;
  saving: boolean;
  feedback: string;
}

interface HealthCheck {
  label: string;
  passed: boolean;
  detail: string;
}

function getHealthChecks(course: Course): HealthCheck[] {
  const allLessons = course.course_modules.flatMap((m) => m.lessons);
  const checks: HealthCheck[] = [];

  // Has modules
  checks.push({
    label: 'Has modules',
    passed: course.course_modules.length > 0,
    detail: course.course_modules.length > 0
      ? `${course.course_modules.length} module${course.course_modules.length > 1 ? 's' : ''}`
      : 'No modules — add at least one in the Curriculum tab',
  });

  // Has lessons
  checks.push({
    label: 'Has lessons',
    passed: allLessons.length > 0,
    detail: allLessons.length > 0
      ? `${allLessons.length} lesson${allLessons.length > 1 ? 's' : ''}`
      : 'No lessons — add content in the Curriculum tab',
  });

  // No empty modules
  const emptyModules = course.course_modules.filter((m) => m.lessons.length === 0);
  checks.push({
    label: 'No empty modules',
    passed: emptyModules.length === 0,
    detail: emptyModules.length === 0
      ? 'All modules have lessons'
      : `${emptyModules.length} empty: ${emptyModules.map((m) => m.title).join(', ')}`,
  });

  // Has description
  checks.push({
    label: 'Has description',
    passed: !!(course.description && course.description.trim().length > 10),
    detail: course.description ? `${course.description.length} characters` : 'Missing — add in the Info tab',
  });

  // Has cover image
  checks.push({
    label: 'Has cover image',
    passed: !!course.cover_image_url,
    detail: course.cover_image_url ? 'Set' : 'Missing — upload in the Info tab',
  });

  // Video/audio lessons have content URLs
  const mediaLessons = allLessons.filter((l) => l.lesson_type === 'video' || l.lesson_type === 'audio');
  const missingMedia = mediaLessons.filter((l) => !l.content_url);
  checks.push({
    label: 'Media lessons have content',
    passed: missingMedia.length === 0,
    detail: missingMedia.length === 0
      ? mediaLessons.length > 0 ? `${mediaLessons.length} media lessons all have URLs` : 'No media lessons'
      : `${missingMedia.length} missing: ${missingMedia.map((l) => l.title).join(', ')}`,
  });

  return checks;
}

const LESSON_TYPE_ICON: Record<string, React.ElementType> = {
  video: Play, text: FileText, audio: Volume2, quiz: HelpCircle,
};

export default function ReviewPublishTab({ course, courseId, saveCourseField }: TabProps) {
  const [publishingToggle, setPublishingToggle] = useState(false);

  const checks = getHealthChecks(course);
  const allPassed = checks.every((c) => c.passed);
  const passedCount = checks.filter((c) => c.passed).length;

  const allLessons = course.course_modules.flatMap((m) => m.lessons);
  const totalDuration = allLessons.reduce((sum, l) => sum + (l.duration_seconds ?? 0), 0);

  async function togglePublish() {
    setPublishingToggle(true);
    await saveCourseField({ is_published: !course.is_published });
    setPublishingToggle(false);
  }

  return (
    <div className="space-y-6">
      {/* Course Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-white">{course.course_modules.length}</p>
          <p className="text-xs text-gray-500">Modules</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-white">{allLessons.length}</p>
          <p className="text-xs text-gray-500">Lessons</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-white">
            {totalDuration > 0 ? `${Math.round(totalDuration / 60)}m` : '—'}
          </p>
          <p className="text-xs text-gray-500">Duration</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-white">
            {course.price_type === 'free' ? 'Free' : `$${course.price}`}
          </p>
          <p className="text-xs text-gray-500">Price</p>
        </div>
      </div>

      {/* Content Health */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          {allPassed ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          )}
          <h3 className="font-semibold text-white text-sm">
            Content Health — {passedCount}/{checks.length} checks passed
          </h3>
        </div>
        <div className="space-y-2">
          {checks.map((check) => (
            <div key={check.label} className="flex items-start gap-3 px-3 py-2 bg-gray-800 rounded-lg">
              {check.passed ? (
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${check.passed ? 'text-gray-300' : 'text-white font-medium'}`}>{check.label}</p>
                <p className="text-xs text-gray-500 truncate">{check.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lesson Breakdown */}
      {allLessons.length > 0 && (
        <div>
          <h3 className="font-semibold text-white text-sm mb-2">Lesson Types</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(
              allLessons.reduce<Record<string, number>>((acc, l) => {
                acc[l.lesson_type] = (acc[l.lesson_type] || 0) + 1;
                return acc;
              }, {})
            ).map(([type, count]) => {
              const Icon = LESSON_TYPE_ICON[type] ?? FileText;
              return (
                <span key={type} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 rounded-lg text-xs text-gray-300">
                  <Icon className="w-3 h-3 text-gray-500" />
                  {count} {type}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Publish / Unpublish */}
      <div className="border-t border-gray-800 pt-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button
            type="button"
            onClick={togglePublish}
            disabled={publishingToggle}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition disabled:opacity-50 min-h-11 ${
              course.is_published
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'bg-fuchsia-600 text-white hover:bg-fuchsia-700'
            }`}
          >
            {publishingToggle ? <Loader2 className="w-4 h-4 animate-spin" /> : course.is_published ? <EyeOff className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
            {course.is_published ? 'Unpublish Course' : 'Publish Course'}
          </button>
          <div className="text-sm">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              course.is_published ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'
            }`}>
              {course.is_published ? 'Published' : 'Draft'}
            </span>
          </div>
          <Link
            href={`/academy/${courseId}`}
            target="_blank"
            className="text-sm text-fuchsia-400 hover:text-fuchsia-300 transition"
          >
            Preview course →
          </Link>
        </div>
        {!allPassed && !course.is_published && (
          <p className="text-xs text-amber-400 mt-2">Some health checks failed. You can still publish, but consider fixing them first.</p>
        )}
      </div>
    </div>
  );
}
