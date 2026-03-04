'use client';

// app/academy/[courseId]/page.tsx
// Course detail: overview, module/lesson list, enrollment CTA, reviews, DM teacher.

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  BookOpen, Play, Lock, CheckCircle, Clock, Loader2, ArrowRight, Share2,
  GitBranch, ClipboardList, Star, MessageCircle, Send, Shield, AlertTriangle,
} from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Lesson {
  id: string;
  title: string;
  lesson_type: string;
  duration_seconds: number | null;
  order: number;
  is_free_preview: boolean;
  locked: boolean;
  module_locked?: boolean;
}

interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Assignment {
  id: string;
  title: string;
  due_date: string | null;
  scope: 'course' | 'module' | 'lesson';
  module_id: string | null;
  lesson_id: string | null;
}

interface PrerequisiteCourse {
  id: string;
  prerequisite_course_id: string;
  enforcement: 'required' | 'recommended';
  title: string;
  cover_image_url: string | null;
  completed: boolean;
}

interface RecommendedCourse {
  id: string;
  recommended_course_id: string;
  direction: 'before' | 'after';
  title: string;
  cover_image_url: string | null;
  notes: string | null;
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  price: number;
  price_type: string;
  navigation_mode: 'linear' | 'cyoa';
  is_sequential: boolean;
  enrolled: boolean;
  teacher_id: string;
  avg_rating: number;
  review_count: number;
  trial_period_days: number;
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
  course_modules: Module[];
  prerequisites?: PrerequisiteCourse[];
  recommendations?: RecommendedCourse[];
  has_prerequisite_override?: boolean;
  pending_override_request?: { id: string; status: string; created_at: string } | null;
  override_questions?: Array<{ id: string; question: string; type: 'text' | 'rating' | 'select'; options?: string[]; required: boolean }>;
}

interface Review {
  id: string;
  student_id: string;
  rating: number;
  body: string | null;
  created_at: string;
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
}

function formatDuration(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function StarRating({ rating, interactive, onRate }: { rating: number; interactive?: boolean; onRate?: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= (hover || rating);
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => onRate?.(i)}
            onMouseEnter={() => interactive && setHover(i)}
            onMouseLeave={() => interactive && setHover(0)}
            className={`${interactive ? 'cursor-pointer' : 'cursor-default'} transition`}
          >
            <Star className={`w-5 h-5 ${filled ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} />
          </button>
        );
      })}
    </div>
  );
}

function CourseDetailContent() {
  const { courseId } = useParams<{ courseId: string }>();
  const searchParams = useSearchParams();
  const justEnrolled = searchParams.get('enrolled') === 'true';

  const [course, setCourse] = useState<Course | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState('');

  // Review form state
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewBody, setReviewBody] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [myExistingReview, setMyExistingReview] = useState<Review | null>(null);

  // Override request state
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideAnswers, setOverrideAnswers] = useState<Record<string, string>>({});
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // AI recommendations state
  const [aiRecs, setAiRecs] = useState<{ before: Array<{ course_id: string; title: string; reason: string; cover_image_url: string | null }>; after: Array<{ course_id: string; title: string; reason: string; cover_image_url: string | null }> } | null>(null);

  useEffect(() => {
    offlineFetch(`/api/academy/courses/${courseId}`)
      .then((r) => r.json())
      .then((d) => { setCourse(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [courseId, justEnrolled]);

  // Fetch AI recommendations
  useEffect(() => {
    fetch(`/api/academy/courses/${courseId}/ai-recommendations`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setAiRecs(d); })
      .catch(() => {});
  }, [courseId]);

  useEffect(() => {
    offlineFetch(`/api/academy/courses/${courseId}/assignments`)
      .then((r) => r.json())
      .then((d) => setAssignments(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [courseId]);

  useEffect(() => {
    offlineFetch(`/api/academy/courses/${courseId}/reviews`)
      .then((r) => r.json())
      .then((d) => {
        setReviews(d.reviews ?? []);
        if (d.avg_rating !== undefined && course) {
          setCourse((c) => c ? { ...c, avg_rating: d.avg_rating, review_count: d.review_count } : c);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Detect user's existing review
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((me) => {
        if (me?.id) {
          const mine = reviews.find((r) => r.student_id === me.id);
          if (mine) {
            setMyExistingReview(mine);
            setReviewRating(mine.rating);
            setReviewBody(mine.body ?? '');
          }
        }
      })
      .catch(() => {});
  }, [reviews]);

  async function handleEnroll() {
    if (!course) return;
    setEnrolling(true);
    setEnrollError('');
    try {
      const r = await fetch(`/api/academy/courses/${courseId}/enroll`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Failed to enroll');
      if (d.url) {
        window.location.href = d.url;
      } else {
        setCourse((c) => c ? { ...c, enrolled: true } : c);
      }
    } catch (e) {
      setEnrollError(e instanceof Error ? e.message : 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  }

  async function handleRequestOverride() {
    setSubmittingOverride(true);
    try {
      const r = await fetch(`/api/academy/courses/${courseId}/prerequisites/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: overrideReason.trim() || null, answers: overrideAnswers }),
      });
      if (r.ok) {
        setShowOverrideForm(false);
        setCourse((c) => c ? { ...c, pending_override_request: { id: '', status: 'pending', created_at: new Date().toISOString() } } : c);
      } else {
        const d = await r.json();
        setEnrollError(d.error || 'Failed to submit request');
      }
    } catch {
      setEnrollError('Failed to submit request');
    } finally {
      setSubmittingOverride(false);
    }
  }

  async function handleShare() {
    const url = window.location.href;
    try {
      await navigator.share({ title: course?.title, url });
    } catch {
      await navigator.clipboard.writeText(url);
    }
  }

  async function handleSubmitReview() {
    if (!reviewRating) return;
    setSubmittingReview(true);
    setReviewFeedback('');
    try {
      const r = await fetch(`/api/academy/courses/${courseId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: reviewRating, body: reviewBody }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Failed to submit review');
      setCourse((c) => c ? { ...c, avg_rating: d.avg_rating, review_count: d.review_count } : c);
      setReviewFeedback(myExistingReview ? 'Review updated!' : 'Review submitted!');
      // Refresh reviews
      const refreshRes = await fetch(`/api/academy/courses/${courseId}/reviews`);
      const refreshData = await refreshRes.json();
      setReviews(refreshData.reviews ?? []);
    } catch (e) {
      setReviewFeedback(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmittingReview(false);
      setTimeout(() => setReviewFeedback(''), 3000);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!course) {
    return <div className="text-center py-20 text-gray-500">Course not found.</div>;
  }

  const allLessons = course.course_modules.flatMap((m) => m.lessons);
  const totalDuration = allLessons.reduce((sum, l) => sum + (l.duration_seconds ?? 0), 0);
  const modules = [...course.course_modules].sort((a, b) => a.order - b.order);

  return (
    <div className="text-white">
      {justEnrolled && (
        <div className="bg-green-900/20 border-b border-green-700/40 px-4 sm:px-6 py-3 text-center text-green-300 text-sm">
          <CheckCircle className="inline w-4 h-4 mr-1.5" />
          You&apos;re enrolled! Start learning below.
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
          {/* Left: Course info */}
          <div className="lg:col-span-2">
            {course.category && (
              <p className="text-fuchsia-400 text-xs font-semibold uppercase tracking-wide mb-3">{course.category}</p>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold mb-4">{course.title}</h1>

            {course.description && (
              <p className="text-gray-300 mb-6 leading-relaxed">{course.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-gray-500 mb-8">
              <span>by {course.profiles?.display_name ?? course.profiles?.username ?? 'Instructor'}</span>
              {totalDuration > 0 && (
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDuration(totalDuration)}</span>
              )}
              <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{allLessons.length} lessons</span>
              {course.navigation_mode === 'cyoa' && (
                <span className="flex items-center gap-1 text-fuchsia-400"><GitBranch className="w-3.5 h-3.5" />Adventure paths</span>
              )}
              {course.review_count > 0 && (
                <span className="flex items-center gap-1 text-yellow-400">
                  <Star className="w-3.5 h-3.5 fill-yellow-400" />
                  {Number(course.avg_rating).toFixed(1)} ({course.review_count})
                </span>
              )}
            </div>

            {/* Prerequisites */}
            {(course.prerequisites?.length ?? 0) > 0 && (
              <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-fuchsia-400" /> Prerequisites
                </h3>
                <div className="space-y-2">
                  {course.prerequisites!.map((p) => (
                    <div key={p.id} className="flex items-center gap-3">
                      {p.completed ? (
                        <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                      ) : p.enforcement === 'required' ? (
                        <Lock className="w-4 h-4 text-red-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <Link
                        href={`/academy/${p.prerequisite_course_id}`}
                        className="text-sm text-gray-300 hover:text-fuchsia-300 transition flex-1 truncate"
                      >
                        {p.title}
                      </Link>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        p.enforcement === 'required'
                          ? 'bg-red-900/30 text-red-400'
                          : 'bg-amber-900/30 text-amber-400'
                      }`}>
                        {p.enforcement === 'required' ? 'Required' : 'Recommended'}
                      </span>
                      {p.completed && (
                        <span className="text-xs text-green-400">Completed</span>
                      )}
                    </div>
                  ))}
                </div>
                {course.has_prerequisite_override && (
                  <p className="text-xs text-fuchsia-400 mt-2 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Override granted by teacher
                  </p>
                )}
              </div>
            )}

            {/* Recommended before */}
            {(course.recommendations?.filter((r) => r.direction === 'before').length ?? 0) > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Recommended Before This Course</h3>
                <div className="flex flex-wrap gap-2">
                  {course.recommendations!.filter((r) => r.direction === 'before').map((r) => (
                    <Link
                      key={r.id}
                      href={`/academy/${r.recommended_course_id}`}
                      className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 hover:border-fuchsia-700/50 transition"
                    >
                      {r.cover_image_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={r.cover_image_url} alt="" className="w-8 h-8 rounded object-cover" />
                      )}
                      <div>
                        <span className="text-sm text-gray-200">{r.title}</span>
                        {r.notes && <p className="text-xs text-gray-500">{r.notes}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Curriculum */}
            <h2 className="text-lg font-bold mb-4">Curriculum</h2>
            <div className="space-y-3">
              {modules.map((mod) => {
                const modLessons = [...mod.lessons].sort((a, b) => a.order - b.order);
                const isModuleLocked = modLessons.some((l) => l.module_locked);
                return (
                <div key={mod.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-4 sm:px-5 py-3 bg-gray-800/50 flex items-center gap-2">
                    {isModuleLocked && <Lock className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
                    <div className="flex-1">
                      <p className="font-semibold text-white text-sm">{mod.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {mod.lessons.length} lessons
                        {isModuleLocked && <span className="ml-1.5 text-gray-600">· Complete previous modules to unlock</span>}
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {modLessons.map((lesson) => {
                      const canAccess = (course.enrolled || lesson.is_free_preview) && !lesson.locked;
                      const lessonHref = `/academy/${courseId}/lessons/${lesson.id}`;
                      return (
                        <div key={lesson.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                          {canAccess
                            ? <Play className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                            : <Lock className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                          }
                          {canAccess ? (
                            <Link
                              href={lessonHref}
                              className="flex-1 text-sm min-w-0 text-gray-200 hover:text-fuchsia-300 transition"
                            >
                              {lesson.title}
                              {lesson.is_free_preview && !course.enrolled && (
                                <span className="ml-2 text-xs text-fuchsia-400">Free preview</span>
                              )}
                            </Link>
                          ) : (
                            <span className="flex-1 text-sm min-w-0 text-gray-600">
                              {lesson.title}
                            </span>
                          )}
                          {lesson.duration_seconds && (
                            <span className="text-gray-600 text-xs shrink-0">{formatDuration(lesson.duration_seconds)}</span>
                          )}
                          {canAccess && (
                            <Link
                              href={lessonHref}
                              className="text-xs text-fuchsia-400 hover:text-fuchsia-300 shrink-0"
                            >
                              Start
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>

            {/* Assignments — visible to enrolled students */}
            {course.enrolled && assignments.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-fuchsia-400" /> Assignments
                </h2>
                <div className="space-y-2">
                  {assignments.map((a) => {
                    let scopeLabel = '';
                    if (a.scope === 'module' && a.module_id) {
                      const mod = modules.find((m) => m.id === a.module_id);
                      scopeLabel = mod ? mod.title : 'Module';
                    } else if (a.scope === 'lesson' && a.lesson_id) {
                      for (const mod of modules) {
                        const les = mod.lessons.find((l) => l.id === a.lesson_id);
                        if (les) { scopeLabel = les.title; break; }
                      }
                    }
                    return (
                      <Link
                        key={a.id}
                        href={`/academy/${courseId}/assignments/${a.id}`}
                        className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 sm:px-5 py-3.5 hover:border-fuchsia-700/50 transition group"
                      >
                        <ClipboardList className="w-4 h-4 text-fuchsia-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-200 group-hover:text-white">{a.title}</span>
                          {scopeLabel && (
                            <span className="block text-xs text-gray-500 mt-0.5">{scopeLabel}</span>
                          )}
                        </div>
                        {a.due_date && (
                          <span className="text-xs text-gray-500 flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" />
                            {new Date(a.due_date).toLocaleDateString()}
                          </span>
                        )}
                        <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-fuchsia-400 transition shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recommended after */}
            {(course.recommendations?.filter((r) => r.direction === 'after').length ?? 0) > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-bold mb-4">Up Next</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {course.recommendations!.filter((r) => r.direction === 'after').map((r) => (
                    <Link
                      key={r.id}
                      href={`/academy/${r.recommended_course_id}`}
                      className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-fuchsia-700/50 transition group"
                    >
                      {r.cover_image_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={r.cover_image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-200 group-hover:text-white">{r.title}</span>
                        {r.notes && <p className="text-xs text-gray-500 mt-0.5">{r.notes}</p>}
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-fuchsia-400 transition shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* AI Recommendations */}
            {aiRecs && (aiRecs.before.length > 0 || aiRecs.after.length > 0) && (
              <div className="mt-8">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="text-fuchsia-400">✦</span> AI Suggested Courses
                </h2>
                {aiRecs.before.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Take Before</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {aiRecs.before.map((r) => (
                        <Link
                          key={r.course_id}
                          href={`/academy/${r.course_id}`}
                          className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-fuchsia-700/50 transition group"
                        >
                          {r.cover_image_url && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={r.cover_image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-200 group-hover:text-white block truncate">{r.title}</span>
                            <span className="text-xs text-gray-500 block truncate">{r.reason}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {aiRecs.after.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Take After</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {aiRecs.after.map((r) => (
                        <Link
                          key={r.course_id}
                          href={`/academy/${r.course_id}`}
                          className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-fuchsia-700/50 transition group"
                        >
                          {r.cover_image_url && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={r.cover_image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-200 group-hover:text-white block truncate">{r.title}</span>
                            <span className="text-xs text-gray-500 block truncate">{r.reason}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reviews */}
            <div className="mt-8">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" /> Reviews
                {course.review_count > 0 && (
                  <span className="text-sm font-normal text-gray-500">({course.review_count})</span>
                )}
              </h2>

              {/* Write a review — enrolled students only */}
              {course.enrolled && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5 mb-4">
                  <p className="text-sm text-gray-300 mb-3">
                    {myExistingReview ? 'Update your review' : 'Leave a review'}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="shrink-0">
                      <StarRating rating={reviewRating} interactive onRate={setReviewRating} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <textarea
                        value={reviewBody}
                        onChange={(e) => setReviewBody(e.target.value)}
                        placeholder="Share your experience (optional)..."
                        rows={2}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500 resize-none"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleSubmitReview}
                          disabled={!reviewRating || submittingReview}
                          className="flex items-center gap-2 px-4 py-2.5 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50 min-h-11"
                        >
                          {submittingReview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          {myExistingReview ? 'Update' : 'Submit'}
                        </button>
                        {reviewFeedback && (
                          <p className={`text-sm ${reviewFeedback.includes('!') ? 'text-green-400' : 'text-red-400'}`}>
                            {reviewFeedback}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Review list */}
              {reviews.length === 0 ? (
                <div className="text-center py-8 bg-gray-900 border border-dashed border-gray-800 rounded-xl">
                  <Star className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                  <p className="text-gray-500 text-sm">No reviews yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        {review.profiles?.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={review.profiles.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 text-xs font-bold">
                            {(review.profiles?.display_name ?? review.profiles?.username ?? '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {review.profiles?.display_name ?? review.profiles?.username ?? 'Student'}
                          </p>
                          <p className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${i <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'}`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.body && (
                        <p className="text-sm text-gray-300 leading-relaxed">{review.body}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Enrollment card */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {course.cover_image_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={course.cover_image_url} alt={course.title} className="w-full aspect-video object-cover" />
              )}
              <div className="p-5 sm:p-6">
                <div className="mb-4">
                  {course.price_type === 'free' ? (
                    <p className="text-2xl font-bold text-green-400">Free</p>
                  ) : (
                    <p className="text-2xl font-bold text-white">${course.price}</p>
                  )}
                  {course.price_type === 'subscription' && (
                    <p className="text-gray-500 text-sm">per month</p>
                  )}
                  {course.price_type === 'subscription' && course.trial_period_days > 0 && !course.enrolled && (
                    <p className="text-green-400 text-sm font-medium mt-1">
                      {course.trial_period_days}-day free trial
                    </p>
                  )}
                </div>

                {(() => {
                  const requiredPrereqs = (course.prerequisites ?? []).filter((p) => p.enforcement === 'required');
                  const allRequiredMet = requiredPrereqs.every((p) => p.completed);
                  const canEnroll = allRequiredMet || course.has_prerequisite_override;

                  if (course.enrolled) {
                    return (
                      <Link
                        href={`/academy/${courseId}/lessons/${allLessons[0]?.id ?? ''}`}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-fuchsia-600 text-white rounded-xl font-semibold hover:bg-fuchsia-700 transition min-h-11"
                      >
                        <Play className="w-4 h-4" /> Continue Learning
                      </Link>
                    );
                  }

                  return (
                    <>
                      <button
                        type="button"
                        onClick={handleEnroll}
                        disabled={enrolling || !canEnroll}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-fuchsia-600 text-white rounded-xl font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50 mb-3 min-h-11"
                      >
                        {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : !canEnroll ? <Lock className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                        {enrolling ? 'Loading...' : !canEnroll ? 'Complete Prerequisites' : course.price_type === 'free' ? 'Enroll Free' : 'Enroll Now'}
                      </button>
                      {!canEnroll && requiredPrereqs.length > 0 && (
                        <div className="mb-2 space-y-2">
                          <p className="text-amber-400 text-xs text-center">
                            Complete required prerequisites to enroll.
                          </p>
                          {course.pending_override_request ? (
                            <div className="flex items-center justify-center gap-2 bg-amber-900/20 border border-amber-800/40 rounded-xl px-3 py-2.5">
                              <Shield className="w-4 h-4 text-amber-400" />
                              <span className="text-amber-300 text-xs font-medium">Override Requested — Pending</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowOverrideForm(!showOverrideForm)}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm hover:bg-gray-700 transition min-h-11"
                            >
                              <Shield className="w-4 h-4" /> Request Override
                            </button>
                          )}
                          {showOverrideForm && (
                            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                              <p className="text-xs text-gray-400">Ask the teacher to let you skip prerequisites.</p>
                              {(course.override_questions ?? []).map((q) => (
                                <div key={q.id}>
                                  <label className="text-xs font-medium text-gray-300 block mb-1">
                                    {q.question}{q.required && <span className="text-red-400 ml-0.5">*</span>}
                                  </label>
                                  {q.type === 'select' && q.options ? (
                                    <select
                                      value={overrideAnswers[q.id] ?? ''}
                                      onChange={(e) => setOverrideAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                                    >
                                      <option value="">Select...</option>
                                      {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                  ) : q.type === 'rating' ? (
                                    <div className="flex items-center gap-1">
                                      {[1, 2, 3, 4, 5].map((v) => (
                                        <button
                                          key={v}
                                          type="button"
                                          onClick={() => setOverrideAnswers((a) => ({ ...a, [q.id]: String(v) }))}
                                          className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                                            Number(overrideAnswers[q.id]) === v
                                              ? 'bg-fuchsia-600 text-white'
                                              : 'bg-gray-900 text-gray-400 hover:bg-gray-700'
                                          }`}
                                        >
                                          {v}
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <input
                                      type="text"
                                      value={overrideAnswers[q.id] ?? ''}
                                      onChange={(e) => setOverrideAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
                                    />
                                  )}
                                </div>
                              ))}
                              <textarea
                                value={overrideReason}
                                onChange={(e) => setOverrideReason(e.target.value)}
                                placeholder="Additional reason (optional)..."
                                rows={2}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500 resize-none"
                              />
                              <button
                                type="button"
                                onClick={handleRequestOverride}
                                disabled={submittingOverride}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50 min-h-11"
                              >
                                {submittingOverride ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Submit Request
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {enrollError && <p className="text-red-400 text-sm text-center">{enrollError}</p>}
                    </>
                  );
                })()}

                <button
                  type="button"
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm hover:bg-gray-700 transition mt-3 min-h-11"
                >
                  <Share2 className="w-4 h-4" /> Share Course
                </button>

                {course.enrolled && (
                  <Link
                    href={`/academy/my-courses/messages?course=${courseId}&partner=${course.teacher_id}`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm hover:bg-gray-700 transition mt-2 min-h-11"
                  >
                    <MessageCircle className="w-4 h-4" /> Message Teacher
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CourseDetailPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" /></div>}>
      <CourseDetailContent />
    </Suspense>
  );
}
