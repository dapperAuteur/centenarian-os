// app/api/og/certificate/[achievementId]/route.tsx
// GET — generates a 1200×630 OG image for a certificate of completion.
// Designed to look celebratory and shareable (LinkedIn, Twitter).
// Logs each render to og_image_requests with app='centenarian' for analytics.

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'edge';

type Params = { params: Promise<{ achievementId: string }> };

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { achievementId } = await params;
  const db = getDb();

  // Fetch achievement + profile
  const { data: achievement } = await db
    .from('user_achievements')
    .select('achievement_type, ref_id, earned_at, user_id')
    .eq('id', achievementId)
    .in('achievement_type', ['course_complete', 'path_complete'])
    .maybeSingle();

  const { data: profile } = achievement
    ? await db
        .from('profiles')
        .select('display_name, username')
        .eq('id', achievement.user_id)
        .maybeSingle()
    : { data: null };

  // Log this render (fire-and-forget)
  db.from('og_image_requests')
    .insert({ profile_username: `cert:${achievementId}`, app: 'centenarian' })
    .then(() => {}, () => {});

  const recipientName = profile?.display_name || profile?.username || 'A Member';
  const isCourse = achievement?.achievement_type === 'course_complete';
  const completedAt = achievement
    ? new Date(achievement.earned_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null;

  // Fetch subject title
  let subjectTitle = 'A Course';
  if (achievement?.ref_id) {
    if (isCourse) {
      const { data: course } = await db
        .from('courses')
        .select('title')
        .eq('id', achievement.ref_id)
        .maybeSingle();
      if (course?.title) subjectTitle = course.title;
    } else {
      const { data: path } = await db
        .from('learning_paths')
        .select('title')
        .eq('id', achievement.ref_id)
        .maybeSingle();
      if (path?.title) subjectTitle = path.title;
    }
  }

  // Truncate long titles
  const displayTitle = subjectTitle.length > 60 ? subjectTitle.slice(0, 57) + '…' : subjectTitle;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0ea5e9 0%, #7c3aed 55%, #c026d3 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Decorative white border inset */}
        <div
          style={{
            position: 'absolute',
            inset: '20px',
            border: '2px solid rgba(255,255,255,0.35)',
            borderRadius: 16,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: '28px',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 12,
            pointerEvents: 'none',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            padding: '0 80px',
            gap: 0,
          }}
        >
          {/* Header label */}
          <div
            style={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginBottom: 20,
            }}
          >
            CentenarianOS · Certificate of Completion
          </div>

          {/* Recipient name */}
          <div
            style={{
              color: '#ffffff',
              fontSize: 58,
              fontWeight: 800,
              lineHeight: 1.1,
              marginBottom: 20,
              textShadow: '0 2px 12px rgba(0,0,0,0.2)',
            }}
          >
            {recipientName}
          </div>

          {/* Descriptor */}
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 20, marginBottom: 12 }}>
            successfully completed the {isCourse ? 'course' : 'learning path'}
          </div>

          {/* Course/path title */}
          <div
            style={{
              color: '#ffffff',
              fontSize: 30,
              fontWeight: 700,
              lineHeight: 1.2,
              marginBottom: 28,
              maxWidth: '800px',
            }}
          >
            &ldquo;{displayTitle}&rdquo;
          </div>

          {/* Date */}
          {completedAt && (
            <div
              style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: 16,
                letterSpacing: '0.05em',
              }}
            >
              Completed {completedAt}
            </div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
