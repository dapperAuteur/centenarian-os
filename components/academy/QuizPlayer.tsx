'use client';

// components/academy/QuizPlayer.tsx
// Interactive quiz component: one question at a time, immediate feedback,
// score summary, retry support. Used within the lesson player for quiz-type lessons.

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RotateCcw, ChevronRight, Award, BookOpen } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

// Fisher-Yates shuffle, returns a new array (does not mutate input).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface QuizOption {
  id: string;
  text: string;
}

interface QuizQuestion {
  id: string;
  questionText: string;
  questionType: 'multiple_choice' | 'true_false';
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
  citation?: string;
  imageUrl?: string; // optional figure (e.g. a Cloudinary-hosted FAA chart) shown above the question
  lessonRef?: { title: string; href: string }; // "where to find this in the curriculum" link shown under the explanation
}

interface QuizContent {
  questions: QuizQuestion[]; // the full question pool
  passingScore: number;
  attemptsAllowed: number; // -1 = unlimited
  questionsPerAttempt?: number; // if set and < pool size, draw this many at random each attempt
  shuffleOptions?: boolean; // shuffle the answer-option order within each question
}

interface QuizExplanation {
  questionId: string;
  correct: boolean;
  explanation: string;
  citation?: string;
}

interface QuizPlayerProps {
  quizContent: QuizContent;
  courseId: string;
  lessonId: string;
  onComplete: () => void;
}

export default function QuizPlayer({ quizContent, courseId, lessonId, onComplete }: QuizPlayerProps) {
  const { passingScore, attemptsAllowed } = quizContent;

  // Per-question history for spaced recall: stats[questionId] = { seen, wrong }.
  // Loaded from the student's saved progress, updated after each attempt.
  const [quizStats, setQuizStats] = useState<Record<string, { seen: number; wrong: number }> | null>(null);

  // Spaced-recall weight: unseen questions are favored so every item gets shown,
  // and questions the student misses more often are weighted higher so they come
  // back around sooner.
  function weightFor(q: QuizQuestion, stats: Record<string, { seen: number; wrong: number }> | null): number {
    const s = stats?.[q.id];
    if (!s || s.seen === 0) return 3;
    return 1 + 3 * (s.wrong / s.seen);
  }

  // Rotating question library: draw a fresh subset each attempt so the quiz is
  // not identical every time. Selection is weighted toward missed/unseen items
  // (spaced recall). If questionsPerAttempt is unset or >= the pool size, all
  // questions are used. When shuffleOptions is true, option order is randomized.
  // Scoring is by question id (see the progress route), so any subset scores.
  function buildAttempt(stats: Record<string, { seen: number; wrong: number }> | null): QuizQuestion[] {
    const pool = quizContent.questions;
    const n = quizContent.questionsPerAttempt && quizContent.questionsPerAttempt > 0
      ? Math.min(quizContent.questionsPerAttempt, pool.length)
      : pool.length;
    // Weighted sampling without replacement.
    const remaining = [...pool];
    const picked: QuizQuestion[] = [];
    while (picked.length < n && remaining.length > 0) {
      const weights = remaining.map((q) => weightFor(q, stats));
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < remaining.length - 1; idx++) {
        r -= weights[idx];
        if (r <= 0) break;
      }
      picked.push(remaining.splice(idx, 1)[0]);
    }
    return quizContent.shuffleOptions
      ? picked.map((q) => ({ ...q, options: shuffle(q.options) }))
      : picked;
  }

  const [questions, setQuestions] = useState<QuizQuestion[]>(() => buildAttempt(null));

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState<Array<{ questionId: string; selectedOptionId: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  // Results state (after submission)
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    explanations: QuizExplanation[];
    attempts: number;
  } | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);

  // Load this student's per-question history once, then rebuild the opening
  // attempt to favor questions they have missed before (spaced recall). Only
  // rebuilds if the quiz has not been started yet, so it never reshuffles a
  // quiz in progress.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await offlineFetch(`/api/academy/courses/${courseId}/lessons/${lessonId}/progress`);
        const data = await r.json();
        if (cancelled || !data?.quiz_stats) return;
        setQuizStats(data.quiz_stats);
        setQuestions((prev) =>
          answers.length === 0 && !answered && currentIndex === 0 && !result
            ? buildAttempt(data.quiz_stats)
            : prev,
        );
      } catch {
        // No saved stats available; keep the uniform rotation.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, lessonId]);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  function handleSelectOption(optionId: string) {
    if (answered) return;
    setSelectedOptionId(optionId);
  }

  function handleConfirmAnswer() {
    if (!selectedOptionId || answered) return;
    setAnswered(true);
    setAnswers((prev) => [...prev, { questionId: currentQuestion.id, selectedOptionId }]);
  }

  function handleNext() {
    if (isLastQuestion) {
      submitQuiz();
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedOptionId(null);
      setAnswered(false);
    }
  }

  async function submitQuiz() {
    setSubmitting(true);
    const finalAnswers = [...answers];
    // Include current answer if not already added
    if (answered && !finalAnswers.some((a) => a.questionId === currentQuestion.id)) {
      finalAnswers.push({ questionId: currentQuestion.id, selectedOptionId: selectedOptionId! });
    }

    try {
      const r = await offlineFetch(`/api/academy/courses/${courseId}/lessons/${lessonId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz_answers: finalAnswers }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setResult(data);
      // Update local spaced-recall stats so the next attempt favors what was missed.
      if (Array.isArray(data.explanations)) {
        setQuizStats((prev) => {
          const next: Record<string, { seen: number; wrong: number }> = { ...(prev ?? {}) };
          for (const e of data.explanations as Array<{ questionId: string; correct: boolean }>) {
            const s = next[e.questionId] ?? { seen: 0, wrong: 0 };
            next[e.questionId] = { seen: s.seen + 1, wrong: s.wrong + (e.correct ? 0 : 1) };
          }
          return next;
        });
      }
      if (data.passed) onComplete();
    } catch {
      // Silently handle — user can retry
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetry() {
    setQuestions(buildAttempt(quizStats)); // draw a fresh, spaced-recall-weighted rotation
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setAnswered(false);
    setAnswers([]);
    setResult(null);
    setReviewMode(false);
    setReviewIndex(0);
  }

  // ── Results Screen ──
  if (result) {
    const canRetry = attemptsAllowed === -1 || result.attempts < attemptsAllowed;

    if (reviewMode) {
      const q = questions[reviewIndex];
      const expl = result.explanations.find((e) => e.questionId === q.id);
      const userAnswer = answers.find((a) => a.questionId === q.id);

      return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm text-gray-400 font-medium">
              Review: Question {reviewIndex + 1} of {questions.length}
            </h3>
            <button
              onClick={() => setReviewMode(false)}
              className="text-sm text-fuchsia-400 hover:text-fuchsia-300 transition"
            >
              Back to Results
            </button>
          </div>
          {q.imageUrl && (
            <img
              src={q.imageUrl}
              alt="Reference figure for this question"
              className="w-full max-h-80 object-contain rounded-xl border border-gray-700 bg-white mb-4"
            />
          )}
          <p className="text-white font-semibold mb-4">{q.questionText}</p>
          <div className="space-y-2 mb-4">
            {q.options.map((opt) => {
              const isCorrect = opt.id === q.correctOptionId;
              const isSelected = opt.id === userAnswer?.selectedOptionId;
              let border = 'border-gray-700';
              let bg = 'bg-gray-800';
              if (isCorrect) { border = 'border-green-600'; bg = 'bg-green-900/20'; }
              else if (isSelected && !isCorrect) { border = 'border-red-600'; bg = 'bg-red-900/20'; }
              return (
                <div key={opt.id} className={`px-4 py-3 rounded-xl border ${border} ${bg} text-sm flex items-center gap-3`}>
                  {isCorrect && <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />}
                  {isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  {!isCorrect && !isSelected && <div className="w-4 h-4 shrink-0" />}
                  <span className={isCorrect ? 'text-green-300' : isSelected ? 'text-red-300' : 'text-gray-400'}>{opt.text}</span>
                </div>
              );
            })}
          </div>
          {expl && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-4">
              <p className="text-sm text-gray-300">{expl.explanation}</p>
              {expl.citation && (
                <p className="text-xs text-gray-500 mt-2 italic">{expl.citation}</p>
              )}
              {q.lessonRef?.href && (
                <a
                  href={q.lessonRef.href}
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-sky-400 hover:text-sky-300 min-h-11"
                >
                  <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Where to find this: {q.lessonRef.title}</span>
                </a>
              )}
            </div>
          )}
          <div className="flex gap-2">
            {reviewIndex > 0 && (
              <button onClick={() => setReviewIndex((i) => i - 1)} className="px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm hover:bg-gray-700 transition min-h-11">
                Previous
              </button>
            )}
            {reviewIndex < questions.length - 1 && (
              <button onClick={() => setReviewIndex((i) => i + 1)} className="px-4 py-2.5 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition min-h-11">
                Next <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-8 text-center">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
          result.passed ? 'bg-green-900/30' : 'bg-amber-900/30'
        }`}>
          {result.passed
            ? <Award className="w-8 h-8 text-green-400" />
            : <BookOpen className="w-8 h-8 text-amber-400" />
          }
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {result.passed ? 'Quiz Passed!' : 'Not Quite — Keep Going!'}
        </h2>
        <p className="text-3xl font-bold mb-1">
          <span className={result.passed ? 'text-green-400' : 'text-amber-400'}>{result.score}%</span>
        </p>
        <p className="text-sm text-gray-400 mb-1">
          {result.explanations.filter((e) => e.correct).length} of {questions.length} correct
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Passing score: {passingScore}% &middot; Attempt {result.attempts}
          {attemptsAllowed > 0 ? ` of ${attemptsAllowed}` : ''}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => { setReviewMode(true); setReviewIndex(0); }}
            className="flex items-center gap-2 px-5 py-3 bg-gray-800 text-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-700 transition min-h-11"
          >
            <BookOpen className="w-4 h-4" /> Review Answers
          </button>
          {!result.passed && canRetry && (
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-5 py-3 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition min-h-11"
            >
              <RotateCcw className="w-4 h-4" /> Try Again
            </button>
          )}
          {!result.passed && !canRetry && (
            <p className="text-sm text-gray-500 self-center">No attempts remaining.</p>
          )}
        </div>
      </div>
    );
  }

  // ── Question Screen ──
  const isCorrect = answered && selectedOptionId === currentQuestion.correctOptionId;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-8">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-gray-400 shrink-0">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-fuchsia-500 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + (answered ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Optional reference figure (e.g. an FAA chart) */}
      {currentQuestion.imageUrl && (
        <img
          src={currentQuestion.imageUrl}
          alt="Reference figure for this question"
          className="w-full max-h-80 object-contain rounded-xl border border-gray-700 bg-white mb-4"
        />
      )}

      {/* Question text */}
      <p className="text-white font-semibold text-base sm:text-lg mb-5">{currentQuestion.questionText}</p>

      {/* Options */}
      <div className="space-y-2 mb-5" role="radiogroup" aria-label="Answer options">
        {currentQuestion.options.map((opt) => {
          let border = 'border-gray-700 hover:border-gray-600';
          let bg = 'bg-gray-800 hover:bg-gray-750';
          let textColor = 'text-gray-200';

          if (selectedOptionId === opt.id && !answered) {
            border = 'border-fuchsia-500';
            bg = 'bg-fuchsia-900/20';
            textColor = 'text-white';
          }

          if (answered) {
            if (opt.id === currentQuestion.correctOptionId) {
              border = 'border-green-600';
              bg = 'bg-green-900/20';
              textColor = 'text-green-300';
            } else if (opt.id === selectedOptionId) {
              border = 'border-red-600';
              bg = 'bg-red-900/20';
              textColor = 'text-red-300';
            } else {
              border = 'border-gray-800';
              bg = 'bg-gray-800/50';
              textColor = 'text-gray-500';
            }
          }

          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selectedOptionId === opt.id}
              onClick={() => handleSelectOption(opt.id)}
              disabled={answered}
              className={`w-full text-left px-4 py-3 rounded-xl border ${border} ${bg} ${textColor} text-sm transition flex items-center gap-3 min-h-11 disabled:cursor-default`}
            >
              {answered && opt.id === currentQuestion.correctOptionId && (
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
              )}
              {answered && opt.id === selectedOptionId && opt.id !== currentQuestion.correctOptionId && (
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{opt.text}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback after answering */}
      {answered && (
        <div className={`rounded-xl p-4 mb-5 border ${isCorrect ? 'bg-green-900/10 border-green-800/50' : 'bg-amber-900/10 border-amber-800/50'}`}>
          <p className={`text-sm font-semibold mb-1 ${isCorrect ? 'text-green-400' : 'text-amber-400'}`}>
            {isCorrect ? 'Correct!' : 'Not quite.'}
          </p>
          <p className="text-sm text-gray-300">{currentQuestion.explanation}</p>
          {currentQuestion.citation && (
            <p className="text-xs text-gray-500 mt-2 italic">{currentQuestion.citation}</p>
          )}
          {currentQuestion.lessonRef?.href && (
            <a
              href={currentQuestion.lessonRef.href}
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-sky-400 hover:text-sky-300 min-h-11"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Where to find this: {currentQuestion.lessonRef.title}</span>
            </a>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!answered ? (
          <button
            type="button"
            onClick={handleConfirmAnswer}
            disabled={!selectedOptionId}
            className="px-5 py-3 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-40 disabled:cursor-not-allowed min-h-11"
          >
            Check Answer
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-3 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50 min-h-11"
          >
            {submitting ? 'Submitting…' : isLastQuestion ? 'See Results' : 'Next Question'}
            {!isLastQuestion && !submitting && <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
