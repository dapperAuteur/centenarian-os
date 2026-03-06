'use client';

// components/academy/QuizPlayer.tsx
// Interactive quiz component: one question at a time, immediate feedback,
// score summary, retry support. Used within the lesson player for quiz-type lessons.

import { useState } from 'react';
import { CheckCircle, XCircle, RotateCcw, ChevronRight, Award, BookOpen } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

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
}

interface QuizContent {
  questions: QuizQuestion[];
  passingScore: number;
  attemptsAllowed: number; // -1 = unlimited
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
  const { questions, passingScore, attemptsAllowed } = quizContent;

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
      if (data.passed) onComplete();
    } catch {
      // Silently handle — user can retry
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetry() {
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

      {/* Question text */}
      <p className="text-white font-semibold text-base sm:text-lg mb-5">{currentQuestion.questionText}</p>

      {/* Options */}
      <div className="space-y-2 mb-5">
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
