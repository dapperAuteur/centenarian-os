// app/api/og/course/[id]/route.tsx
// GET — generates a 1200x630 OG image for an academy course.

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'edge';

type Params = { params: Promise<{ id: string }> };

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();

  const { data: course } = await db
    .from('courses')
    .select('title, description, category, avg_rating, review_count, teacher_id')
    .eq('id', id)
    .maybeSingle();

  // Get teacher name
  let teacherName = 'CentenarianOS';
  if (course?.teacher_id) {
    const { data: profile } = await db
      .from('profiles')
      .select('display_name, username')
      .eq('id', course.teacher_id)
      .maybeSingle();
    teacherName = profile?.display_name || profile?.username || teacherName;
  }

  // Log render (fire-and-forget)
  db.from('og_image_requests')
    .insert({ profile_username: `course:${id}`, app: 'centenarian' })
    .then(() => {}, () => {});

  const title = course?.title ?? 'Academy Course';
  const displayTitle = title.length > 60 ? title.slice(0, 57) + '...' : title;
  const category = course?.category ?? null;
  const rating = course?.avg_rating ? Number(course.avg_rating).toFixed(1) : null;
  const reviewCount = course?.review_count ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #030712 0%, #1a0a2e 60%, #030712 100%)',
          padding: '0',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: 'linear-gradient(90deg, #d946ef 0%, #0ea5e9 100%)',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
            padding: '60px 80px',
          }}
        >
          {/* Category badge */}
          {category && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  background: 'rgba(217, 70, 239, 0.2)',
                  color: '#e879f9',
                  padding: '6px 16px',
                  borderRadius: 999,
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {category}
              </span>
            </div>
          )}

          {/* Title */}
          <h1
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.15,
              margin: '0 0 20px',
            }}
          >
            {displayTitle}
          </h1>

          {/* Teacher + rating */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              marginTop: 8,
            }}
          >
            <span style={{ color: '#9ca3af', fontSize: 22 }}>by {teacherName}</span>
            {rating && reviewCount > 0 && (
              <span style={{ color: '#fbbf24', fontSize: 22 }}>
                {'★'} {rating} ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 80px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #d946ef, #0ea5e9)',
              }}
            />
            <span style={{ color: '#9ca3af', fontSize: 18, fontWeight: 600 }}>
              CentenarianOS Academy
            </span>
          </div>
          <span style={{ color: '#4b5563', fontSize: 16 }}>centenarianos.com/academy</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
