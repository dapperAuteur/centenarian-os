// app/api/academy/courses/[id]/complete/route.ts
//
// POST — idempotent: when every lesson in the course has completed_at
// set for the authenticated user, insert a course_completions row
// (ON CONFLICT DO NOTHING) and fire the congratulations email.
// Returns { completed: true, token, completionAlreadyExisted } or
// { completed: false, remainingLessons } when the course isn't done.
//
// Safe to call on every lesson completion — the endpoint decides whether
// the course is done. No client-side "is this the last lesson" logic.
//
// Email dispatch is fire-and-forget (won't block the HTTP response on
// Resend latency), errors logged via existing logging module.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getResend } from '@/lib/email/resend';
import { logError, logInfo } from '@/lib/logging';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string }> };

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? 'https://centenarianos.com';
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // 1. Confirm enrollment (and that the course exists).
  const { data: enrollment } = await db
    .from('enrollments')
    .select('status')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle();
  if (enrollment?.status !== 'active') {
    return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });
  }

  // 2. Count lessons vs. completed lessons. If any lesson lacks
  //    completed_at, the course isn't done.
  const { data: lessons } = await db
    .from('lessons')
    .select('id, title')
    .eq('course_id', courseId);
  const lessonIds = (lessons ?? []).map((l) => l.id);
  if (lessonIds.length === 0) {
    return NextResponse.json({ error: 'Course has no lessons' }, { status: 400 });
  }

  const { data: progress } = await db
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', user.id)
    .in('lesson_id', lessonIds)
    .not('completed_at', 'is', null);
  const completedSet = new Set((progress ?? []).map((p) => p.lesson_id));
  const remaining = lessonIds.filter((id) => !completedSet.has(id));

  if (remaining.length > 0) {
    return NextResponse.json({
      completed: false,
      remainingLessons: remaining.length,
      totalLessons: lessonIds.length,
    });
  }

  // 3. Idempotent insert. Race-safe via UNIQUE (user_id, course_id).
  const { data: existing } = await db
    .from('course_completions')
    .select('id, verification_token, completed_at')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      completed: true,
      token: existing.verification_token,
      completionAlreadyExisted: true,
      completedAt: existing.completed_at,
    });
  }

  const { data: inserted, error: insErr } = await db
    .from('course_completions')
    .insert({ user_id: user.id, course_id: courseId })
    .select('id, verification_token, completed_at')
    .single();

  if (insErr || !inserted) {
    // If the insert raced (another request inserted first), re-fetch.
    const { data: existingRace } = await db
      .from('course_completions')
      .select('id, verification_token, completed_at')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle();
    if (existingRace) {
      return NextResponse.json({
        completed: true,
        token: existingRace.verification_token,
        completionAlreadyExisted: true,
        completedAt: existingRace.completed_at,
      });
    }
    logError({ source: 'api', module: 'academy-complete', message: 'Insert failed', metadata: { error: insErr?.message ?? 'unknown' }, userId: user.id });
    return NextResponse.json({ error: 'Could not record completion' }, { status: 500 });
  }

  // 4. Fire congratulations email (fire-and-forget).
  //    Pull course + student info for the email body.
  const [{ data: course }, { data: profile }] = await Promise.all([
    db.from('courses').select('title, profiles(display_name, username)').eq('id', courseId).single(),
    db.from('profiles').select('display_name, username').eq('id', user.id).maybeSingle(),
  ]);

  if (course && user.email) {
    sendCompletionEmail({
      to: user.email,
      studentName: profile?.display_name ?? profile?.username ?? 'Congratulations',
      courseTitle: course.title ?? 'Your course',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      teacherName: (course as any).profiles?.display_name ?? (course as any).profiles?.username ?? 'CentenarianOS Academy',
      verificationUrl: `${siteUrl()}/academy/verify/${inserted.verification_token}`,
    }).catch((err) => {
      logError({ source: 'api', module: 'academy-complete', message: 'Email send failed', metadata: { error: err instanceof Error ? err.message : String(err) }, userId: user.id });
    });
  }

  logInfo({ source: 'api', module: 'academy-complete', message: 'Course completion recorded', metadata: { courseId, lessons: lessonIds.length }, userId: user.id });

  return NextResponse.json({
    completed: true,
    token: inserted.verification_token,
    completionAlreadyExisted: false,
    completedAt: inserted.completed_at,
  });
}

interface CompletionEmailArgs {
  to: string;
  studentName: string;
  courseTitle: string;
  teacherName: string;
  verificationUrl: string;
}

async function sendCompletionEmail(args: CompletionEmailArgs): Promise<void> {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL ?? 'admin@centenarianos.com';
  await resend.emails.send({
    from,
    to: args.to,
    subject: `Congratulations — you completed ${args.courseTitle}`,
    html: renderCompletionHtml(args),
  });
}

function renderCompletionHtml(a: CompletionEmailArgs): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
    <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;">Congratulations, ${escapeHtml(a.studentName)} 🎓</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 12px;">You finished <strong>${escapeHtml(a.courseTitle)}</strong>, taught by ${escapeHtml(a.teacherName)}. That's real work — thank you for sticking with it.</p>
    <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">Your certificate is ready. You can view it, download a PDF, or share the public verification link with schools, employers, or wherever it's useful:</p>
    <p style="margin:24px 0;"><a href="${a.verificationUrl}" style="display:inline-block;background:#c026d3;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">View your certificate</a></p>
    <p style="font-size:13px;color:#6b7280;line-height:1.5;margin:0 0 8px;">The verification URL is unique to you and confirms the certificate is authentic:<br/><a href="${a.verificationUrl}" style="color:#c026d3;word-break:break-all;">${a.verificationUrl}</a></p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <p style="font-size:12px;color:#9ca3af;">CentenarianOS Academy · <a href="${siteUrl()}/academy/my-courses" style="color:#9ca3af;">My courses</a></p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
