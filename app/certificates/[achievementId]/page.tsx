import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Award, CheckCircle } from 'lucide-react';
import PrintButton from './PrintButton';

type Params = { params: Promise<{ achievementId: string }> };

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { achievementId } = await params;
  return {
    title: `Certificate of Completion — CentenarianOS`,
    description: `Verified certificate of completion #${achievementId}`,
  };
}

export default async function CertificatePage({ params }: Params) {
  const { achievementId } = await params;
  const db = getDb();

  // Fetch the achievement
  const { data: achievement } = await db
    .from('user_achievements')
    .select('id, achievement_type, ref_id, earned_at, user_id')
    .eq('id', achievementId)
    .in('achievement_type', ['course_complete', 'path_complete'])
    .maybeSingle();

  if (!achievement) notFound();

  // Fetch the user's profile
  const { data: profile } = await db
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('id', achievement.user_id)
    .maybeSingle();

  if (!profile) notFound();

  const recipientName = profile.display_name || profile.username;
  const isCourse = achievement.achievement_type === 'course_complete';
  const completedAt = new Date(achievement.earned_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Fetch the course or path name
  let subjectTitle = 'Unknown';
  let teacherName: string | null = null;

  if (achievement.ref_id) {
    if (isCourse) {
      const { data: course } = await db
        .from('courses')
        .select('title, profiles(display_name, username)')
        .eq('id', achievement.ref_id)
        .maybeSingle();
      if (course) {
        subjectTitle = course.title;
        const teacher = Array.isArray(course.profiles) ? course.profiles[0] : course.profiles;
        teacherName = (teacher as { display_name?: string | null; username?: string } | null)?.display_name
          || (teacher as { username?: string } | null)?.username
          || null;
      }
    } else {
      const { data: path } = await db
        .from('learning_paths')
        .select('title, profiles(display_name, username)')
        .eq('id', achievement.ref_id)
        .maybeSingle();
      if (path) {
        subjectTitle = path.title;
        const teacher = Array.isArray(path.profiles) ? path.profiles[0] : path.profiles;
        teacherName = (teacher as { display_name?: string | null; username?: string } | null)?.display_name
          || (teacher as { username?: string } | null)?.username
          || null;
      }
    }
  }

  const shortId = achievementId.slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Print toolbar — hidden when printing */}
      <div className="print:hidden bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <Link href="/" className="text-sm font-bold text-gray-700 hover:text-fuchsia-700 transition">
          CentenarianOS
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/profiles/${profile.username}`}
            className="text-sm text-gray-500 hover:text-gray-700 transition"
          >
            ← Back to Profile
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* Certificate */}
      <div className="flex-1 flex items-center justify-center p-8 print:p-0 print:block">
        <div
          className="bg-white shadow-2xl print:shadow-none"
          style={{
            width: '816px',
            minHeight: '576px',
            position: 'relative',
            padding: '64px 72px',
            border: '1px solid #e5e7eb',
          }}
        >
          {/* Decorative border */}
          <div
            style={{
              position: 'absolute',
              inset: '16px',
              border: '2px solid #f0abfc',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: '20px',
              border: '1px solid #e879f9',
              opacity: 0.4,
              pointerEvents: 'none',
            }}
          />

          <div className="relative z-10 flex flex-col items-center text-center space-y-6">
            {/* Logo / Issuer */}
            <div className="flex items-center gap-2">
              <Award className="w-7 h-7 text-fuchsia-600" />
              <span className="text-lg font-bold text-gray-800 tracking-wide">CentenarianOS</span>
            </div>

            {/* Certificate title */}
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-500 mb-2">
                Certificate of Completion
              </p>
              <p className="text-sm text-gray-500">This certifies that</p>
            </div>

            {/* Recipient name */}
            <div
              style={{
                borderBottom: '2px solid #e879f9',
                paddingBottom: '8px',
                width: '100%',
                maxWidth: '480px',
              }}
            >
              <p className="text-5xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif', letterSpacing: '-0.02em' }}>
                {recipientName}
              </p>
            </div>

            {/* Achievement text */}
            <div className="max-w-lg space-y-2">
              <p className="text-gray-500 text-base">
                has successfully completed the{' '}
                {isCourse ? 'course' : 'learning path'}
              </p>
              <p className="text-2xl font-bold text-gray-900 leading-snug">
                &ldquo;{subjectTitle}&rdquo;
              </p>
              {teacherName && (
                <p className="text-gray-400 text-sm">instructed by {teacherName}</p>
              )}
            </div>

            {/* Date and verification */}
            <div className="flex items-center justify-between w-full max-w-lg pt-6 mt-4 border-t border-gray-100">
              <div className="text-left">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Completed</p>
                <p className="text-sm font-semibold text-gray-700">{completedAt}</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-fuchsia-100 mb-1">
                  <CheckCircle className="w-6 h-6 text-fuchsia-600" />
                </div>
                <p className="text-xs text-gray-400">Verified</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Certificate ID</p>
                <p className="text-sm font-mono font-semibold text-gray-700">{shortId}</p>
              </div>
            </div>

            {/* CentenarianOS footer */}
            <p className="text-xs text-gray-300 pt-2">
              centenarianos.com · B4C LLC · AwesomeWebStore.com
            </p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: letter landscape; margin: 0; }
          body { margin: 0; }
        }
      `}</style>
    </div>
  );
}
