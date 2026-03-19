'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { offlineFetch } from '@/lib/offline/offline-fetch';

type ActivityCategory = 'AM' | 'PM' | 'WORKOUT_HOTEL' | 'WORKOUT_GYM' | 'friction' | 'general';
type Difficulty = 'easier' | 'just-right' | 'harder';
type InstructionPref = 'text-is-fine' | 'need-images' | 'need-video';

const MOOD_LABELS = ['', 'Awful', 'Hard', 'OK', 'Good', 'Great'];

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  AM: 'AM Priming',
  PM: 'PM Recovery',
  WORKOUT_HOTEL: 'Hotel Workout',
  WORKOUT_GYM: 'Full Gym Workout',
  friction: 'Friction Protocol',
  general: 'General Workout',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workoutLogId?: string;
  workoutName?: string;
  defaultCategory?: ActivityCategory;
  defaultDuration?: string;
  protocolVersion?: string;
}

export default function WorkoutFeedbackModal({
  isOpen,
  onClose,
  workoutLogId,
  workoutName,
  defaultCategory = 'general',
  defaultDuration,
  protocolVersion = '1.1',
}: Props) {
  const [category, setCategory] = useState<ActivityCategory>(defaultCategory);
  const [duration, setDuration] = useState(defaultDuration ?? '');
  const [moodBefore, setMoodBefore] = useState<number | null>(null);
  const [moodAfter, setMoodAfter] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [instructionPref, setInstructionPref] = useState<InstructionPref | null>(null);
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setCategory(defaultCategory);
    setDuration(defaultDuration ?? '');
    setMoodBefore(null);
    setMoodAfter(null);
    setDifficulty(null);
    setInstructionPref(null);
    setFeedback('');
    setEmail('');
    setSubmitting(false);
    setSubmitted(false);
    setError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moodBefore || !moodAfter || !difficulty || !instructionPref) {
      setError('Please complete all required fields.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const res = await offlineFetch('/api/workouts/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workout_log_id: workoutLogId ?? null,
          activity_category: category,
          activity_duration: duration || null,
          mood_before: moodBefore,
          mood_after: moodAfter,
          difficulty,
          instruction_preference: instructionPref,
          feedback: feedback || null,
          email: email || null,
          protocol_version: protocolVersion,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="How did it go?" size="md">
      {/* Reassurance banner — workout is already saved at this point */}
      {!submitted && (
        <div className="mx-1 mt-1 mb-0 bg-lime-50 border border-lime-200 rounded-lg px-4 py-2.5 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-lime-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-xs text-lime-800 font-medium">Workout saved! Feedback is optional.</p>
            {workoutName && (
              <p className="text-xs text-lime-700 mt-0.5">Feedback for: <span className="font-semibold">{workoutName}</span></p>
            )}
          </div>
        </div>
      )}
      {submitted ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-lime-500" aria-hidden="true" />
          <p className="text-lg font-semibold text-gray-900">Thanks for the feedback!</p>
          <p className="text-sm text-gray-700">Your response helps improve the Nomad program.</p>
          <button
            onClick={handleClose}
            className="mt-2 px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Scrollable content */}
          <div className="space-y-5 flex-1 px-1 pt-1">
          {/* Activity + Duration — stack on mobile, side-by-side on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="wf-category" className="block text-xs font-medium text-gray-700 mb-1">
                Activity
              </label>
              <select
                id="wf-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ActivityCategory)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
              >
                {(Object.entries(CATEGORY_LABELS) as [ActivityCategory, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="wf-duration" className="block text-xs font-medium text-gray-700 mb-1">
                Duration
              </label>
              <select
                id="wf-duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
              >
                <option value="">—</option>
                {['5', '15', '30', '45', '60'].map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mood Before — fieldset groups the buttons semantically */}
          <fieldset>
            <legend className="text-xs font-medium text-gray-700 mb-2">
              Mood before{' '}
              <span aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </legend>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={moodBefore === v}
                  onClick={() => setMoodBefore(moodBefore === v ? null : v)}
                  className={`py-2.5 rounded-lg border transition flex flex-col items-center gap-0.5 ${
                    moodBefore === v
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <span className="text-sm font-bold leading-none">{v}</span>
                  <span className="text-[10px] leading-none font-medium">{MOOD_LABELS[v]}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Mood After */}
          <fieldset>
            <legend className="text-xs font-medium text-gray-700 mb-2">
              Mood after{' '}
              <span aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </legend>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={moodAfter === v}
                  onClick={() => setMoodAfter(moodAfter === v ? null : v)}
                  className={`py-2.5 rounded-lg border transition flex flex-col items-center gap-0.5 ${
                    moodAfter === v
                      ? 'bg-lime-600 text-white border-lime-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <span className="text-sm font-bold leading-none">{v}</span>
                  <span className="text-[10px] leading-none font-medium">{MOOD_LABELS[v]}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Difficulty */}
          <fieldset>
            <legend className="text-xs font-medium text-gray-700 mb-2">
              Difficulty{' '}
              <span aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </legend>
            <div className="flex gap-2">
              {(['easier', 'just-right', 'harder'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={difficulty === d}
                  onClick={() => setDifficulty(difficulty === d ? null : d)}
                  className={`flex-1 py-3 rounded-lg text-xs font-medium border transition ${
                    difficulty === d
                      ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {d === 'just-right' ? 'Just Right' : d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Instruction Preference */}
          <fieldset>
            <legend className="text-xs font-medium text-gray-700 mb-2">
              Instructions preference{' '}
              <span aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </legend>
            <div className="flex gap-2">
              {([
                ['text-is-fine', 'Text is fine'],
                ['need-images', 'Need images'],
                ['need-video', 'Need video'],
              ] as [InstructionPref, string][]).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  aria-pressed={instructionPref === val}
                  onClick={() => setInstructionPref(instructionPref === val ? null : val)}
                  className={`flex-1 py-3 rounded-lg text-xs font-medium border transition ${
                    instructionPref === val
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Optional feedback */}
          <div>
            <label htmlFor="wf-feedback" className="block text-xs font-medium text-gray-700 mb-1">
              Anything else?{' '}
              <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <textarea
              id="wf-feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What worked? What didn't? Any questions?"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Optional email */}
          <div>
            <label htmlFor="wf-email" className="block text-xs font-medium text-gray-700 mb-1">
              Email for follow-up{' '}
              <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <input
              id="wf-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          </div>

          {/* Sticky button bar */}
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-1 pt-3 pb-3 flex gap-3 mt-2"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Skip Feedback
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
