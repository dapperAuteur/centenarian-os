// app/api/academy/courses/[id]/lessons/[lessonId]/progress/route.ts
// POST: upsert lesson progress for the current user

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string; lessonId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id: courseId, lessonId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify enrollment
  const { data: enrollment } = await db
    .from('enrollments')
    .select('status')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle();

  if (enrollment?.status !== 'active') {
    // Also allow teachers/admin to mark progress
    const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
    if (course?.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });
    }
  }

  const body = await request.json();
  const { completed = false, watch_seconds = 0, quiz_answers } = body;

  // Quiz scoring: if quiz_answers provided, fetch lesson quiz_content and auto-score
  if (quiz_answers && Array.isArray(quiz_answers)) {
    const { data: lesson } = await db
      .from('lessons')
      .select('quiz_content, lesson_type')
      .eq('id', lessonId)
      .single();

    if (!lesson?.quiz_content || lesson.lesson_type !== 'quiz') {
      return NextResponse.json({ error: 'Not a quiz lesson' }, { status: 400 });
    }

    const quizData = lesson.quiz_content as {
      questions: Array<{ id: string; correctOptionId: string; explanation: string; citation?: string }>;
      passingScore: number;
      attemptsAllowed: number;
    };

    // Check attempt limit
    if (quizData.attemptsAllowed > 0) {
      const { data: existing } = await db
        .from('lesson_progress')
        .select('quiz_answers')
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId)
        .maybeSingle();

      const previousAttempts = existing?.quiz_answers?.attempts ?? 0;
      if (previousAttempts >= quizData.attemptsAllowed) {
        return NextResponse.json({ error: 'No attempts remaining' }, { status: 400 });
      }
    }

    // Score the quiz
    let correct = 0;
    const explanations: Array<{ questionId: string; correct: boolean; explanation: string; citation?: string }> = [];

    for (const question of quizData.questions) {
      const answer = quiz_answers.find((a: { questionId: string }) => a.questionId === question.id);
      const isCorrect = answer?.selectedOptionId === question.correctOptionId;
      if (isCorrect) correct++;
      explanations.push({
        questionId: question.id,
        correct: isCorrect,
        explanation: question.explanation,
        citation: question.citation,
      });
    }

    const score = quizData.questions.length > 0
      ? Math.round((correct / quizData.questions.length) * 100 * 100) / 100
      : 0;
    const passed = score >= quizData.passingScore;

    // Get previous attempt count
    const { data: prev } = await db
      .from('lesson_progress')
      .select('quiz_answers')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)
      .maybeSingle();

    const attempts = (prev?.quiz_answers?.attempts ?? 0) + 1;

    const { error } = await db
      .from('lesson_progress')
      .upsert({
        user_id: user.id,
        lesson_id: lessonId,
        watch_seconds: 0,
        quiz_score: score,
        quiz_answers: { answers: quiz_answers, attempts },
        completed_at: passed ? new Date().toISOString() : null,
      }, { onConflict: 'user_id,lesson_id' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ score, passed, explanations, attempts });
  }

  // Standard (non-quiz) progress tracking
  const { error } = await db
    .from('lesson_progress')
    .upsert({
      user_id: user.id,
      lesson_id: lessonId,
      watch_seconds,
      completed_at: completed ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,lesson_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
