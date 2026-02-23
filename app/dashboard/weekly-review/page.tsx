'use client';

// app/dashboard/weekly-review/page.tsx
// AI-generated weekly review page — shows personalized reviews and archive.

import { useEffect, useState, useCallback } from 'react';
import {
  FileText, Sparkles, ChevronLeft, ChevronRight,
  Clock, Loader2, RefreshCw, Calendar,
} from 'lucide-react';

interface ReviewMeta {
  id: string;
  week_start: string;
  created_at: string;
  updated_at: string;
}

interface Review extends ReviewMeta {
  content: string;
}

function getCurrentMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  return monday.toISOString().split('T')[0];
}

function shiftWeek(dateStr: string, direction: -1 | 1): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + direction * 7);
  return d.toISOString().split('T')[0];
}

function formatWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function WeeklyReviewPage() {
  const [selectedWeek, setSelectedWeek] = useState(getCurrentMonday());
  const [review, setReview] = useState<Review | null>(null);
  const [archive, setArchive] = useState<ReviewMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const currentMonday = getCurrentMonday();
  const isFutureWeek = selectedWeek > currentMonday;

  const loadReview = useCallback(async (weekStart: string) => {
    const res = await fetch(`/api/ai/weekly-review?week_start=${weekStart}`);
    const data = await res.json();
    setReview(data?.content ? data : null);
  }, []);

  const loadArchive = useCallback(async () => {
    const res = await fetch('/api/ai/weekly-review?all=true');
    const data = await res.json();
    setArchive(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    Promise.all([loadReview(selectedWeek), loadArchive()])
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) {
      loadReview(selectedWeek);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: selectedWeek }),
      });
      if (res.ok) {
        const data = await res.json();
        setReview(data);
        loadArchive();
      }
    } catch { /* ignore */ }
    setGenerating(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 flex items-center gap-3">
          <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-teal-600 shrink-0" />
          Weekly Review
        </h1>
        <p className="text-gray-600 text-sm sm:text-base mt-1">
          AI-generated insights from your week
        </p>
      </header>

      {/* Hero Stats */}
      <div className="bg-linear-to-r from-teal-500 to-cyan-600 rounded-2xl shadow-xl p-6 sm:p-8 mb-6 sm:mb-8 text-white">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white/20 backdrop-blur-sm p-3 sm:p-4 rounded-xl text-center">
            <div className="text-2xl sm:text-3xl font-bold">{archive.length}</div>
            <p className="text-xs sm:text-sm opacity-90">Reviews Generated</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm p-3 sm:p-4 rounded-xl text-center">
            <div className="text-sm sm:text-base font-bold leading-tight">{formatWeekLabel(selectedWeek).replace('Week of ', '')}</div>
            <p className="text-xs sm:text-sm opacity-90">Selected Week</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm p-3 sm:p-4 rounded-xl text-center">
            <div className="text-sm sm:text-base font-bold leading-tight">
              {archive.length > 0
                ? formatTimestamp(archive[0].created_at)
                : '—'}
            </div>
            <p className="text-xs sm:text-sm opacity-90">Last Generated</p>
          </div>
        </div>
      </div>

      {/* Week Picker + Generate */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 sm:mb-8">
        <div className="flex items-center gap-2 flex-1">
          <button
            type="button"
            onClick={() => setSelectedWeek(shiftWeek(selectedWeek, -1))}
            className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition min-h-11 min-w-11 flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 rounded-lg min-h-11">
            <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
            <span className="text-sm font-medium text-gray-900">{formatWeekLabel(selectedWeek)}</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedWeek(shiftWeek(selectedWeek, 1))}
            disabled={isFutureWeek}
            className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed min-h-11 min-w-11 flex items-center justify-center"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || isFutureWeek}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition disabled:opacity-50 font-medium text-sm min-h-11 shrink-0"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : review ? (
            <>
              <RefreshCw className="w-4 h-4" />
              Regenerate
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Review
            </>
          )}
        </button>
      </div>

      {/* Review Content */}
      {review ? (
        <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-8 mb-8 border-t-4 border-teal-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              {formatWeekLabel(selectedWeek)}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              {formatTimestamp(review.updated_at || review.created_at)}
            </div>
          </div>
          <div className="text-gray-700 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
            {review.content}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-12 mb-8 text-center">
          <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">No review yet</h3>
          <p className="text-gray-500 text-sm">
            {isFutureWeek
              ? 'This week hasn\'t happened yet.'
              : 'Click "Generate Review" to create your AI-powered weekly summary.'}
          </p>
        </div>
      )}

      {/* Archive */}
      {archive.length > 0 && (
        <section>
          <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            Past Reviews
          </h3>
          <div className="space-y-2">
            {archive.map((item) => {
              const isActive = item.week_start === selectedWeek;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedWeek(item.week_start)}
                  className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-xl transition min-h-11 ${
                    isActive
                      ? 'bg-teal-50 border border-teal-200 text-teal-900'
                      : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="text-sm font-medium">{formatWeekLabel(item.week_start)}</span>
                  <span className="text-xs text-gray-500">{formatTimestamp(item.created_at)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
