'use client';

import { useState } from 'react';
import StripeFeeBreakdown from '@/components/ui/StripeFeeBreakdown';

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

export default function PricingAccessTab({ course, saveCourseField }: TabProps) {
  // Local state drives the live fee breakdown as the user types.
  // Save still happens on blur via the existing saveCourseField path;
  // this state is preview-only and re-syncs to the server value on mount.
  const [priceDraft, setPriceDraft] = useState<string>(String(course.price ?? 0));
  const draftAmount = Number.parseFloat(priceDraft);
  const cycle: 'one_time' | 'monthly' = course.price_type === 'subscription' ? 'monthly' : 'one_time';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-200 mb-1.5">Price Type</label>
          <select
            value={course.price_type}
            onChange={(e) => saveCourseField({ price_type: e.target.value })}
            style={{ colorScheme: 'dark' }}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
          >
            <option value="free" className="bg-gray-800 text-white">Free</option>
            <option value="one_time" className="bg-gray-800 text-white">One-time</option>
            <option value="subscription" className="bg-gray-800 text-white">Subscription (monthly)</option>
          </select>
        </div>
        {course.price_type !== 'free' && (
          <div>
            <label className="block text-sm text-gray-200 mb-1.5" htmlFor="course-price-input">Price ($)</label>
            <input
              id="course-price-input"
              type="number"
              step="0.01"
              min="0"
              value={priceDraft}
              onChange={(e) => setPriceDraft(e.target.value)}
              onBlur={(e) => saveCourseField({ price: Number(e.target.value) })}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-fuchsia-500 min-h-11"
            />
            <StripeFeeBreakdown amount={draftAmount} cycle={cycle} theme="dark" />
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
          <p className="text-gray-400 text-xs mt-1">0 = no trial. Max 30 days.</p>
        </div>
      )}
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
  );
}
