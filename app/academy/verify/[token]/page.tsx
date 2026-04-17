// app/academy/verify/[token]/page.tsx
//
// Public certificate-verification page. Anyone with the URL can see:
// the student's display name, the course title, the teacher, and the
// completion date. No auth required — the token itself is the access
// control (32 hex chars from gen_random_bytes, unguessable).
//
// Server-rendered because SEO isn't a concern but simple HTML is
// easiest for scraping + sharing. Client-only chrome (download PDF
// button) lives in the sibling CertificateDownloadButton component.
//
// Plan 35.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import CertificateDownloadButton from '@/components/academy/CertificateDownloadButton';

type Params = { params: Promise<{ token: string }> };

interface CompletionRecord {
  id: string;
  completed_at: string;
  studentName: string;
  courseTitle: string;
  teacherName: string;
}

async function loadCompletion(token: string): Promise<CompletionRecord | null> {
  // Service-role fetch — RLS is user-scoped but verification URLs are public.
  // The token is already the access check.
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: completion } = await db
    .from('course_completions')
    .select('id, completed_at, user_id, course_id')
    .eq('verification_token', token)
    .maybeSingle();

  if (!completion) return null;

  const [{ data: student }, { data: course }] = await Promise.all([
    db.from('profiles').select('display_name, username').eq('id', completion.user_id).maybeSingle(),
    db
      .from('courses')
      .select('title, profiles(display_name, username)')
      .eq('id', completion.course_id)
      .maybeSingle(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teacherProfile = (course as any)?.profiles;

  return {
    id: completion.id,
    completed_at: completion.completed_at,
    studentName: student?.display_name ?? student?.username ?? 'Anonymous learner',
    courseTitle: course?.title ?? 'CentenarianOS Academy course',
    teacherName: teacherProfile?.display_name ?? teacherProfile?.username ?? 'CentenarianOS Academy',
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const cert = await loadCompletion(token);
  if (!cert) return { title: 'Certificate not found — CentenarianOS' };
  return {
    title: `${cert.studentName} — ${cert.courseTitle} · Certificate`,
    description: `Certificate of completion for ${cert.courseTitle}, earned by ${cert.studentName}.`,
    openGraph: {
      title: `${cert.studentName} earned a certificate`,
      description: `${cert.courseTitle} · CentenarianOS Academy`,
      type: 'website',
    },
    robots: { index: false, follow: false },
  };
}

export default async function VerifyCertificatePage({ params }: Params) {
  const { token } = await params;
  const cert = await loadCompletion(token);
  if (!cert) notFound();

  const completedDate = new Date(cert.completed_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-linear-to-b from-fuchsia-50 via-white to-sky-50 py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* The certificate itself — also what jspdf captures for the PDF. */}
        <div
          id="certificate-card"
          className="bg-white border-4 border-fuchsia-600 rounded-2xl p-8 sm:p-12 shadow-xl"
        >
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-600 font-semibold mb-2">
              Certificate of Completion
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-6">
              CentenarianOS Academy
            </h1>

            <p className="text-sm text-gray-500 mb-2">This certifies that</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 wrap-break-word">
              {cert.studentName}
            </p>

            <p className="text-sm text-gray-500 mb-2">has successfully completed</p>
            <p className="text-xl sm:text-2xl font-semibold text-fuchsia-700 mb-6 wrap-break-word">
              {cert.courseTitle}
            </p>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-gray-200 text-sm text-gray-600">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Completed</p>
                <p className="font-semibold text-gray-900">{completedDate}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Instructor</p>
                <p className="font-semibold text-gray-900">{cert.teacherName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions (outside the card so they don't appear in the downloaded PDF) */}
        <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-3">
          <CertificateDownloadButton
            studentName={cert.studentName}
            courseTitle={cert.courseTitle}
            teacherName={cert.teacherName}
            completedDate={completedDate}
            verificationUrl={`${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/academy/verify/${token}`}
          />
          <Link
            href="/academy"
            className="min-h-11 inline-flex items-center justify-center px-5 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium transition"
          >
            Browse Academy
          </Link>
        </div>

        <p className="mt-8 text-center text-xs text-gray-500 max-w-md mx-auto">
          This certificate's authenticity can be verified by visiting the URL in a browser.
          The token is unique and unguessable — seeing this page means the record exists in
          CentenarianOS Academy's database.
        </p>
      </div>
    </div>
  );
}
