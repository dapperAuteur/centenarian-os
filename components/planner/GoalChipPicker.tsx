'use client';

// components/planner/GoalChipPicker.tsx
// One optional chip, "Goal: Inbox ▾", for the Create Task form. It replaces the three cascading
// roadmap/goal/milestone selects: tapping it opens a searchable list of
// "Roadmap › Goal › Milestone" paths (fuse.js). Leaving it alone files the task in the Inbox,
// which the server creates on first use (POST /api/tasks). Building or deleting roadmaps, goals
// and milestones happens on the Roadmap page, not here.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Fuse, { type IFuseOptions } from 'fuse.js';
import { ChevronDown, Inbox, Target } from 'lucide-react';
import { useMilestoneHierarchy } from '@/lib/hooks/useMilestoneHierarchy';
import { systemKindOf } from '@/lib/planner/system-roadmaps';
import type { Roadmap, Goal, Milestone } from '@/lib/types';

export interface GoalSelection {
  milestoneId: string;
  /** "Goal › Milestone", shown on the chip. Stored with the id so the chip reads right offline. */
  label: string;
}

interface MilestonePath {
  id: string;
  roadmap: string;
  goal: string;
  milestone: string;
  label: string;
}

interface GoalChipPickerProps {
  /** null = Inbox (the default). */
  value: GoalSelection | null;
  onChange: (value: GoalSelection | null) => void;
}

const FUSE_OPTIONS: IFuseOptions<MilestonePath> = {
  keys: [
    { name: 'milestone', weight: 2 },
    { name: 'goal', weight: 1.5 },
    { name: 'roadmap', weight: 1 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
};

const MAX_RESULTS = 50;

/** Every active Roadmap › Goal › Milestone path, minus the Inbox milestone itself. */
function buildPaths(roadmaps: Roadmap[], goals: Goal[], milestones: Milestone[]): MilestonePath[] {
  const roadmapById = new Map(roadmaps.map(r => [r.id, r]));
  const goalById = new Map(goals.map(g => [g.id, g]));
  const paths: MilestonePath[] = [];
  for (const m of milestones) {
    const g = goalById.get(m.goal_id);
    const r = g ? roadmapById.get(g.roadmap_id) : undefined;
    if (!g || !r) continue;
    // The Inbox milestone is the "Inbox" option at the top, so don't list it twice.
    if (systemKindOf(r) === 'inbox' && g.title === 'Inbox' && m.title === 'Inbox') continue;
    paths.push({
      id: m.id,
      roadmap: r.title,
      goal: g.title,
      milestone: m.title,
      label: `${g.title} › ${m.title}`,
    });
  }
  return paths;
}

export default function GoalChipPicker({ value, onChange }: GoalChipPickerProps) {
  const { roadmaps, goals, milestones, loading, error } = useMilestoneHierarchy();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const chipRef = useRef<HTMLButtonElement>(null);

  const paths = useMemo(() => buildPaths(roadmaps, goals, milestones), [roadmaps, goals, milestones]);
  const fuse = useMemo(() => new Fuse(paths, FUSE_OPTIONS), [paths]);
  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return paths.slice(0, MAX_RESULTS);
    return fuse.search(q).slice(0, MAX_RESULTS).map(r => r.item);
  }, [fuse, paths, query]);

  // A remembered milestone that no longer exists (deleted, archived) falls back to the Inbox.
  // Only once the list has loaded: offline the list is empty, and the server checks anyway.
  useEffect(() => {
    if (loading || error || !value) return;
    if (!paths.some(p => p.id === value.milestoneId)) onChange(null);
  }, [loading, error, value, paths, onChange]);

  const close = () => {
    setOpen(false);
    setQuery('');
    chipRef.current?.focus();
  };

  const choose = (selection: GoalSelection | null) => {
    onChange(selection);
    close();
  };

  return (
    <div>
      <button
        ref={chipRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls="goal-chip-panel"
        className="min-h-11 max-w-full inline-flex items-center gap-2 px-3 py-2 rounded-full border border-gray-300 bg-gray-50 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
      >
        {value ? (
          <Target className="w-4 h-4 shrink-0 text-sky-600" aria-hidden="true" />
        ) : (
          <Inbox className="w-4 h-4 shrink-0 text-sky-600" aria-hidden="true" />
        )}
        <span className="truncate min-w-0">
          Goal: <span className="font-semibold text-gray-900">{value ? value.label : 'Inbox'}</span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          id="goal-chip-panel"
          className="mt-2 border border-gray-200 rounded-lg bg-white p-2 space-y-2"
          onKeyDown={e => {
            // Escape closes this list, not the whole modal (and the draft with it).
            if (e.key === 'Escape') {
              e.stopPropagation();
              close();
            }
          }}
        >
          <label htmlFor="goal-chip-search" className="sr-only">Search roadmaps, goals and milestones</label>
          <input
            id="goal-chip-search"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              // Enter picks the top match instead of submitting the task form.
              if (e.key === 'Enter') {
                e.preventDefault();
                const top = results[0];
                if (top) choose({ milestoneId: top.id, label: top.label });
              }
            }}
            placeholder="Search roadmap, goal or milestone"
            autoFocus
            className="w-full min-h-11 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          />

          <ul className="max-h-60 overflow-y-auto space-y-1" aria-label="Where to file the task">
            {!query.trim() && (
              <li>
                <button
                  type="button"
                  onClick={() => choose(null)}
                  aria-pressed={value === null}
                  className={`w-full min-h-11 flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition ${
                    value === null ? 'bg-sky-50 text-sky-800 ring-1 ring-sky-300' : 'hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <Inbox className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="font-semibold">Inbox</span>
                    <span className="block text-xs text-gray-500">Sort it into a goal later</span>
                  </span>
                </button>
              </li>
            )}
            {results.map(p => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => choose({ milestoneId: p.id, label: p.label })}
                  aria-pressed={value?.milestoneId === p.id}
                  className={`w-full min-h-11 px-3 py-2 rounded-lg text-left text-sm transition ${
                    value?.milestoneId === p.id ? 'bg-sky-50 text-sky-800 ring-1 ring-sky-300' : 'hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <span className="block text-xs text-gray-500">{p.roadmap} › {p.goal} ›</span>
                  <span className="block font-medium">{p.milestone}</span>
                </button>
              </li>
            ))}
          </ul>

          {loading && (
            <p role="status" className="px-1 text-xs text-gray-500">Loading your goals…</p>
          )}
          {!loading && error && (
            <p className="px-1 text-xs text-gray-600">
              Your goals can&apos;t load right now (you may be offline). The task will still save to the goal shown on the chip.
            </p>
          )}
          {!loading && !error && query.trim() && results.length === 0 && (
            <p className="px-1 text-xs text-gray-600">No matches. Clear the search to file it in the Inbox.</p>
          )}
          {!loading && !error && paths.length === 0 && (
            <p className="px-1 text-xs text-gray-600">
              No goals yet, so tasks go to your Inbox. Build goals on the{' '}
              <Link href="/dashboard/roadmap" className="text-sky-700 underline">Roadmap</Link> page.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
