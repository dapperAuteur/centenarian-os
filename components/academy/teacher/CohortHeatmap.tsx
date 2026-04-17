'use client';

// components/academy/teacher/CohortHeatmap.tsx
// Students × lessons grid for the teacher cohort view (plan 36).
//
// Rows = enrolled students (sorted by enrollment date), columns =
// lessons (sorted by `order`). Cells are color-coded by completion
// state: gray (not started), amber (in progress), green (completed),
// with an optional quiz-score overlay. Student-name column is sticky
// left; on mobile the body scrolls horizontally while names stay pinned.
//
// Accessibility: each cell has an aria-label spelling out
// "{student}: {lesson} — {state}" so screen readers work.

import { useMemo } from 'react';
import { CheckCircle2, Circle, Clock, Award } from 'lucide-react';

export interface CohortStudent {
  user_id: string;
  display_name: string;
  username: string | null;
  enrolled_at: string;
  status: 'active' | 'cancelled';
  attempt_number: number;
  last_content_seen_at: string | null;
}

export interface CohortLesson {
  id: string;
  title: string;
  order: number;
  lesson_type: string;
}

export interface CohortProgress {
  user_id: string;
  lesson_id: string;
  state: 'not_started' | 'in_progress' | 'completed';
  completed_at: string | null;
  quiz_score: number | null;
}

export interface CohortSummary {
  enrolled_count: number;
  active_count: number;
  avg_completion_pct: number;
  median_time_to_complete_days: number | null;
  most_stuck_lesson_id: string | null;
}

export interface CohortData {
  course: { id: string; title: string | null };
  students: CohortStudent[];
  lessons: CohortLesson[];
  progress: CohortProgress[];
  summary: CohortSummary;
}

interface Props {
  data: CohortData;
}

function stateColors(state: CohortProgress['state']) {
  switch (state) {
    case 'completed':
      return 'bg-green-500 hover:bg-green-400 text-white';
    case 'in_progress':
      return 'bg-amber-500 hover:bg-amber-400 text-white';
    default:
      return 'bg-gray-200 hover:bg-gray-300 text-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-400';
  }
}

function stateIcon(state: CohortProgress['state']) {
  switch (state) {
    case 'completed':
      return CheckCircle2;
    case 'in_progress':
      return Clock;
    default:
      return Circle;
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function CohortHeatmap({ data }: Props) {
  const { students, lessons, progress, summary } = data;

  // O(students × lessons) lookup table built once from the flat
  // progress array. Avoids repeated .find() in the render loop.
  const progressMap = useMemo(() => {
    const m = new Map<string, CohortProgress>();
    for (const row of progress) m.set(`${row.user_id}::${row.lesson_id}`, row);
    return m;
  }, [progress]);

  const mostStuckLessonTitle = summary.most_stuck_lesson_id
    ? lessons.find((l) => l.id === summary.most_stuck_lesson_id)?.title ?? null
    : null;

  if (students.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <Award className="w-10 h-10 text-gray-700 mx-auto mb-3" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-gray-200 mb-2">No enrolled students yet</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Once someone enrolls, the cohort heatmap will show their progress across every lesson.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Enrolled" value={String(summary.enrolled_count)} sub={`${summary.active_count} active`} />
        <SummaryCard label="Avg completion" value={`${summary.avg_completion_pct}%`} sub="across all students" />
        <SummaryCard
          label="Median time to complete"
          value={summary.median_time_to_complete_days !== null ? `${summary.median_time_to_complete_days} days` : '—'}
          sub="among finishers"
        />
        <SummaryCard
          label="Most-stuck lesson"
          value={mostStuckLessonTitle ? truncate(mostStuckLessonTitle, 24) : '—'}
          sub={mostStuckLessonTitle ? 'fewest completions' : 'no data yet'}
        />
      </div>

      {/* The heatmap */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse" role="grid" aria-label="Student progress grid">
            <thead>
              <tr className="bg-gray-800/60">
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-gray-800/60 text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-800"
                >
                  Student
                </th>
                {lessons.map((lesson) => (
                  <th
                    key={lesson.id}
                    scope="col"
                    className={`text-center px-2 py-3 text-xs font-medium text-gray-400 border-b border-gray-800 min-w-[80px] ${
                      lesson.id === summary.most_stuck_lesson_id ? 'bg-red-900/30' : ''
                    }`}
                    title={lesson.title}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-fuchsia-400 font-semibold">#{lesson.order}</span>
                      <span className="text-[10px] text-gray-500 max-w-[80px] truncate block">
                        {lesson.title}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.user_id} className={student.status !== 'active' ? 'opacity-50' : ''}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-gray-900 text-left px-4 py-2 border-b border-gray-800 min-w-[180px]"
                  >
                    <div className="text-sm text-gray-200 font-medium truncate max-w-[220px]">
                      {student.display_name}
                    </div>
                    <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
                      <span>{formatDateTime(student.enrolled_at)}</span>
                      {student.status !== 'active' && (
                        <span className="text-red-400">cancelled</span>
                      )}
                      {student.attempt_number > 1 && (
                        <span className="text-gray-400">attempt {student.attempt_number}</span>
                      )}
                    </div>
                  </th>
                  {lessons.map((lesson) => {
                    const row = progressMap.get(`${student.user_id}::${lesson.id}`);
                    const state = row?.state ?? 'not_started';
                    const Icon = stateIcon(state);
                    const score = row?.quiz_score;
                    const label = score !== null && score !== undefined
                      ? `${student.display_name}: ${lesson.title} — ${state}, quiz ${score}%`
                      : `${student.display_name}: ${lesson.title} — ${state}${row?.completed_at ? ` on ${formatDateTime(row.completed_at)}` : ''}`;
                    return (
                      <td
                        key={lesson.id}
                        className="border-b border-gray-800 p-1 text-center"
                      >
                        <div
                          role="gridcell"
                          aria-label={label}
                          title={label}
                          className={`inline-flex items-center justify-center w-9 h-9 rounded-md transition cursor-default ${stateColors(state)}`}
                        >
                          {score !== null && score !== undefined && lesson.lesson_type === 'quiz' ? (
                            <span className="text-[10px] font-bold tabular-nums">{Math.round(score)}</span>
                          ) : (
                            <Icon className="w-4 h-4" aria-hidden="true" />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
        <LegendSwatch color="bg-gray-800" label="Not started" />
        <LegendSwatch color="bg-amber-500" label="In progress" />
        <LegendSwatch color="bg-green-500" label="Completed" />
        <span className="text-gray-500">· Quiz cells show the score.</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-white truncate" title={value}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-sm ${color}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
