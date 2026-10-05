'use client';

import { useCallback, useEffect, useState } from 'react';
import { TaskTag } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import GoalChipPicker, { type GoalSelection } from '@/components/planner/GoalChipPicker';
import { TAGS, TAG_COLORS } from '@/lib/constants/tags';
import { offlineFetch, isQueuedResponse } from '@/lib/offline/offline-fetch';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate: string;
  /**
   * Called after a save. `notice` is a message for the planner to show when the save needs
   * explaining (queued offline, or filed in the Inbox because the chosen goal was gone), and
   * null when it saved normally.
   */
  onCreated: (notice: string | null) => void;
}

// ── Last-used defaults (per-viewer convenience, so localStorage) ──────────
const LAST_USED_KEY = 'centos.planner.createTask.lastUsed';

interface LastUsed {
  goal: GoalSelection | null;
  tag: TaskTag;
  priority: 1 | 2 | 3;
}

const DEFAULTS: LastUsed = { goal: null, tag: 'LIFESTYLE', priority: 2 };

function readLastUsed(): LastUsed {
  try {
    const raw = localStorage.getItem(LAST_USED_KEY);
    if (!raw) return DEFAULTS;
    const v = JSON.parse(raw) as Partial<LastUsed>;
    const goal = v.goal && typeof v.goal.milestoneId === 'string' && typeof v.goal.label === 'string'
      ? { milestoneId: v.goal.milestoneId, label: v.goal.label }
      : null;
    const tag = (TAGS as string[]).includes(v.tag as string) ? (v.tag as TaskTag) : DEFAULTS.tag;
    const priority = v.priority === 1 || v.priority === 2 || v.priority === 3 ? v.priority : DEFAULTS.priority;
    return { goal, tag, priority };
  } catch {
    return DEFAULTS;
  }
}

function writeLastUsed(value: LastUsed) {
  try {
    localStorage.setItem(LAST_USED_KEY, JSON.stringify(value));
  } catch {
    // Private mode or storage blocked: defaults just won't be remembered.
  }
}

/** The next quarter-hour from now, as HH:MM. Stays on today's clock (23:45 at the latest). */
function nextQuarterHour(now = new Date()): string {
  const total = now.getHours() * 60 + now.getMinutes();
  const next = Math.min(Math.floor(total / 15) * 15 + 15, 23 * 60 + 45);
  const h = String(Math.floor(next / 60)).padStart(2, '0');
  const m = String(next % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** Client id that makes the create idempotent across offline replay and retries. */
function newDraftId(): string {
  try {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : '';
  } catch {
    return '';
  }
}

const PRIORITY_LABEL: Record<1 | 2 | 3, string> = { 1: 'High', 2: 'Medium', 3: 'Low' };

export default function CreateTaskModal({ isOpen, onClose, defaultDate, onCreated }: CreateTaskModalProps) {
  const [goal, setGoal] = useState<GoalSelection | null>(null);
  const [activity, setActivity] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(() => nextQuarterHour());
  const [tag, setTag] = useState<TaskTag>(DEFAULTS.tag);
  const [priority, setPriority] = useState<1 | 2 | 3>(DEFAULTS.priority);
  const [showMore, setShowMore] = useState(false);
  const [draftId, setDraftId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // The modal stays mounted, so useState(defaultDate) only captured the date
  // from first render. Resync each time it opens or the planner date changes.
  useEffect(() => {
    if (isOpen) setDate(defaultDate);
  }, [isOpen, defaultDate]);

  // Fresh defaults on every open: next quarter-hour, last-used goal/tag/priority, new draft id.
  useEffect(() => {
    if (!isOpen) return;
    const last = readLastUsed();
    setGoal(last.goal);
    setTag(last.tag);
    setPriority(last.priority);
    setTime(nextQuarterHour());
    setDraftId(newDraftId());
    setError('');
  }, [isOpen]);

  const handleGoalChange = useCallback((value: GoalSelection | null) => setGoal(value), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!activity.trim()) {
      setError('Activity is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await offlineFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(draftId ? { id: draftId } : {}),
          // Omitted = Inbox. The server creates the Inbox on first use, including on offline replay.
          ...(goal ? { milestone_id: goal.milestoneId } : {}),
          date,
          time,
          activity: activity.trim(),
          description: description.trim() || null,
          tag,
          priority,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(typeof body?.error === 'string'
          ? `Couldn't save the task: ${body.error}`
          : `Couldn't save the task (error ${res.status}). Please try again.`);
        return;
      }

      const destination = goal ? goal.label : 'your Inbox';
      let notice: string | null = null;
      let rememberedGoal = goal;
      if (isQueuedResponse(res)) {
        // Queued offline: the row won't show until it syncs, so say so rather
        // than leaving the user to wonder (and enter it twice).
        notice = `You're offline. The task is queued and will be added to ${destination} when you reconnect.`;
      } else {
        const body = await res.json().catch(() => null);
        if (body?.milestone_fallback === 'inbox') {
          notice = 'That goal no longer exists, so the task went to your Inbox.';
          rememberedGoal = null;
        }
      }

      writeLastUsed({ goal: rememberedGoal, tag, priority });

      // Reset the draft and close
      setActivity('');
      setDescription('');
      setShowMore(false);
      setError('');
      onCreated(notice);
      onClose();
    } catch (err) {
      console.error('Create task error:', err);
      setError("Couldn't save the task. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Task" size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Activity: the only field a task needs */}
        <div>
          <label htmlFor="task-activity" className="block text-sm font-medium text-gray-700 mb-1">
            Activity *
          </label>
          <input
            id="task-activity"
            type="text"
            value={activity}
            onChange={e => setActivity(e.target.value)}
            required
            autoFocus
            placeholder="What needs to be done?"
            className="w-full min-h-11 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          />
        </div>

        {/* Where it goes: Inbox unless a goal is picked */}
        <GoalChipPicker value={goal} onChange={handleGoalChange} />

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="task-date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              id="task-date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className="w-full min-h-11 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="task-time" className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <input
              id="task-time"
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              required
              className="w-full min-h-11 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* More: description, tag, priority */}
        <div>
          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            aria-expanded={showMore}
            aria-controls="task-more-fields"
            className="min-h-11 inline-flex items-center gap-2 px-1 text-sm font-medium text-sky-700 hover:text-sky-800 rounded-lg"
          >
            <svg className={`w-4 h-4 transition-transform ${showMore ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
            {showMore ? 'Less' : 'More'}
            {!showMore && (
              <span className="font-normal text-gray-500">
                {tag} · {PRIORITY_LABEL[priority]}{description.trim() ? ' · note' : ''}
              </span>
            )}
          </button>

          {showMore && (
            <div id="task-more-fields" className="mt-2 space-y-4">
              {/* Description */}
              <div>
                <label htmlFor="task-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="task-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Optional details..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>

              {/* Tag */}
              <fieldset>
                <legend className="block text-sm font-medium text-gray-700 mb-1">Tag</legend>
                <div className="flex flex-wrap gap-2">
                  {TAGS.map(t => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={tag === t}
                      onClick={() => setTag(t)}
                      className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        tag === t
                          ? TAG_COLORS[t]
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Priority */}
              <fieldset>
                <legend className="block text-sm font-medium text-gray-700 mb-1">Priority</legend>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={priority === p}
                      onClick={() => setPriority(p)}
                      className={`min-h-11 px-4 py-2 rounded-lg text-sm font-medium border transition ${
                        priority === p
                          ? p === 1 ? 'bg-red-100 text-red-700 border-red-300'
                            : p === 2 ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                            : 'bg-green-100 text-green-700 border-green-300'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 min-h-11 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !activity.trim()}
            className="flex-1 min-h-11 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
