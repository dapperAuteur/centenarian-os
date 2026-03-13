// app/api/og/profile/[username]/route.tsx
// GET — generates a 1200×630 OG image for a user's public profile.
// Uses next/og ImageResponse (built into Next.js 13+, no extra package needed).

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'edge';

type Params = { params: Promise<{ username: string }> };

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { username } = await params;

  const db = getDb();

  // Fetch profile
  const { data: profile } = await db
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url')
    .eq('username', username)
    .maybeSingle();

  if (!profile) {
    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 630,
            background: '#030712',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            fontSize: 32,
            fontFamily: 'sans-serif',
          }}
        >
          Profile not found
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  const userId = profile.id;
  const name = profile.display_name || profile.username;

  // Log this render as a social share signal (fire-and-forget)
  db.from('og_image_requests')
    .insert({ profile_username: username, app: 'centenarian' })
    .then(() => {}, () => {});

  // Fetch stats
  const [achievementsRes, streakRes, courseCountRes, pathCountRes] = await Promise.all([
    db
      .from('user_achievements')
      .select('achievement_type')
      .eq('user_id', userId),
    db
      .from('user_health_metrics')
      .select('logged_date')
      .eq('user_id', userId)
      .order('logged_date', { ascending: false })
      .limit(120),
    db
      .from('user_achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('achievement_type', 'course_complete'),
    db
      .from('learning_path_completions')
      .select('id')
      .eq('user_id', userId),
  ]);

  const coursesCompleted = (courseCountRes.data || []).length;
  const pathsCompleted = (pathCountRes.data || []).length;

  // Calculate streak
  const logDates = (streakRes.data || []).map((r) => r.logged_date as string).sort().reverse();
  let streak = 0;
  if (logDates.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (logDates[0] === today || logDates[0] === yesterday) {
      let expected = logDates[0];
      for (const date of logDates) {
        if (date === expected) {
          streak++;
          const d = new Date(expected);
          d.setDate(d.getDate() - 1);
          expected = d.toISOString().split('T')[0];
        } else break;
      }
    }
  }

  // Unique badge types (non-course, non-path)
  const badges = Array.from(
    new Set(
      (achievementsRes.data || [])
        .map((a) => a.achievement_type)
        .filter((t) => !['course_complete', 'path_complete'].includes(t))
    )
  );

  const BADGE_LABELS: Record<string, string> = {
    streak_7: '🔥 7-Day Streak',
    streak_30: '🔥 30-Day Streak',
    streak_90: '🔥 90-Day Streak',
    first_log: '⚡ First Log',
    first_blog: '✍️ First Post',
    first_recipe: '🍳 First Recipe',
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: 'linear-gradient(135deg, #030712 0%, #1a0530 60%, #0f0520 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '60px 72px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Fuchsia accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: 'linear-gradient(90deg, #c026d3, #7c3aed)',
          }}
        />

        {/* Branding */}
        <div
          style={{
            color: '#a855f7',
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 40,
          }}
        >
          CentenarianOS
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 40, flex: 1 }}>
          {/* Avatar */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              background: profile.avatar_url ? 'transparent' : '#2d1048',
              border: '4px solid #a855f7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={name}
                width={120}
                height={120}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            ) : (
              <span style={{ color: '#c026d3', fontSize: 56, fontWeight: 700 }}>
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Name + bio + stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            <div>
              <div style={{ color: '#ffffff', fontSize: 48, fontWeight: 800, lineHeight: 1.1 }}>
                {name}
              </div>
              <div style={{ color: '#9ca3af', fontSize: 20, marginTop: 4 }}>
                @{profile.username}
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
              {[
                { label: 'Courses', value: coursesCompleted },
                { label: 'Paths', value: pathsCompleted },
                { label: 'Day Streak', value: streak },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    background: 'rgba(168, 85, 247, 0.15)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: 12,
                    padding: '12px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ color: '#e879f9', fontSize: 32, fontWeight: 800 }}>{value}</span>
                  <span style={{ color: '#9ca3af', fontSize: 14, marginTop: 2 }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Badges */}
            {badges.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {badges.slice(0, 4).map((b) => (
                  <span
                    key={b}
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 20,
                      padding: '4px 14px',
                      color: '#d8b4fe',
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    {BADGE_LABELS[b] ?? b}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            color: '#4b5563',
            fontSize: 16,
            marginTop: 32,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: 20,
          }}
        >
          centenarianos.com/profiles/{profile.username}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
