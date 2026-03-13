// app/api/og/blog/[username]/[slug]/route.tsx
// GET — generates a 1200×630 OG image for a public blog post.
// Logs each render to og_image_requests with app='centenarian' for analytics.

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'edge';

type Params = { params: Promise<{ username: string; slug: string }> };

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { username, slug } = await params;
  const db = getDb();

  const [profileRes, postRes] = await Promise.all([
    db.from('profiles').select('display_name, username').eq('username', username).maybeSingle(),
    db.from('blog_posts')
      .select('title, excerpt, tags')
      .eq('slug', slug)
      .eq('visibility', 'public')
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const post = postRes.data;

  // Log this render (fire-and-forget)
  db.from('og_image_requests')
    .insert({ profile_username: `blog:${username}/${slug}`, app: 'centenarian' })
    .then(() => {}, () => {});

  const name = profile?.display_name || profile?.username || username;
  const title = post?.title ?? 'Blog Post';
  const tag = post?.tags?.[0] ?? null;

  // Truncate long titles to 2 lines (~70 chars)
  const displayTitle = title.length > 70 ? title.slice(0, 67) + '…' : title;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #030712 0%, #0c1a2e 60%, #030712 100%)',
          padding: '0',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Sky-to-fuchsia top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: 'linear-gradient(90deg, #0ea5e9, #c026d3)',
          }}
        />

        {/* Main content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '60px 72px 40px',
          }}
        >
          {/* Tag badge */}
          {tag && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'rgba(14, 165, 233, 0.15)',
                border: '1px solid rgba(14, 165, 233, 0.3)',
                borderRadius: 20,
                padding: '4px 14px',
                color: '#7dd3fc',
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                marginBottom: 24,
                width: 'fit-content',
              }}
            >
              {tag}
            </div>
          )}

          {/* Post title */}
          <div
            style={{
              color: '#ffffff',
              fontSize: 52,
              fontWeight: 800,
              lineHeight: 1.15,
              marginBottom: 32,
              maxWidth: '900px',
            }}
          >
            {displayTitle}
          </div>

          {/* Author row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                background: 'linear-gradient(135deg, #0ea5e9, #c026d3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {name.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#e2e8f0', fontSize: 18, fontWeight: 600 }}>{name}</span>
              <span style={{ color: '#64748b', fontSize: 14 }}>@{username}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 72px 24px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span style={{ color: '#c026d3', fontSize: 16, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            CentenarianOS
          </span>
          <span style={{ color: '#334155', fontSize: 14 }}>centenarianos.com/blog/{username}/{slug}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
