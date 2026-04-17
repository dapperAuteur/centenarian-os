'use client';

// app/dashboard/teaching/courses/[id]/cohort/page.tsx
// Teacher cohort heatmap — students × lessons grid for a single course.
// Fetches /api/academy/courses/[id]/cohort and renders via
// <CohortHeatmap/>. Includes CSV export of the raw grid for offline
// analysis.
//
// Plan 36.

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, Loader2, AlertTriangle } from 'lucide-react';
import CohortHeatmap, { type CohortData } from '@/components/academy/teacher/CohortHeatmap';

function csvEscape(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function buildCsv(data: CohortData): string {
  const { students, lessons, progress } = data;
  const progressMap = new Map(progress.map((p) => [`${p.user_id}::${p.lesson_id}`, p]));
  const header = [
    'student', 'enrolled_at', 'status', 'attempt_number',
    ...lessons.map((l) => `L${l.order} ${l.title}`),
  ];
  const rows: string[][] = [header.map(String)];
  for (const s of students) {
    const row = [
      s.display_name,
      s.enrolled_at,
      s.status,
      String(s.attempt_number),
      ...lessons.map((l) => {
        const p = progressMap.get(`${s.user_id}::${l.id}`);
        if (!p || p.state === 'not_started') return '';
        if (p.state === 'in_progress') return 'in_progress';
        if (p.quiz_score !== null && p.quiz_score !== undefined) return `completed (${p.quiz_score}%)`;
        return 'completed';
      }),
    ];
    rows.push(row);
  }
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n') + '\n';
}

export default function CohortPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const [data, setData] = useState<CohortData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/academy/courses/${courseId}/cohort`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [courseId]);

  const handleExport = useCallback(() => {
    if (!data) return;
    const csv = buildCsv(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (data.course.title ?? 'course').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    a.download = `${safeTitle}-cohort-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <Link
        href={`/dashboard/teaching/courses/${courseId}`}
        className="min-h-11 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-4"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to course editor
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
            Cohort progress
            {data?.course.title && (
              <span className="text-gray-400 font-normal text-base ml-2">· {data.course.title}</span>
            )}
          </h1>
          <p className="text-sm text-gray-400">
            Students × lessons heatmap. Hover any cell for details; click Export CSV for offline analysis.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={!data || data.students.length === 0}
          className="min-h-11 inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          Export CSV
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" aria-hidden="true" />
          Loading cohort…
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 p-4 bg-red-900/20 border border-red-900/40 rounded-xl text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">Could not load cohort data</p>
            <p className="text-red-400/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {data && !loading && !error && <CohortHeatmap data={data} />}
    </div>
  );
}
