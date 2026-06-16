// app/api/og/page/route.tsx
// GET — a parameterized 1200x630 OG card for any public page.
// Query: ?eyebrow=&title=&subtitle=  (all optional). Mirrors /api/og/default's style.
// One route serves every non-DB public page so each gets a page-specific share image.

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const clamp = (s: string | null, max: number) => (s ? s.slice(0, max) : '');

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const eyebrow = clamp(p.get('eyebrow'), 60);
  const title = clamp(p.get('title'), 110) || 'CentenarianOS';
  const subtitle = clamp(p.get('subtitle'), 200);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #030712 0%, #1a0a2e 50%, #030712 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 6,
            background: 'linear-gradient(90deg, #d946ef 0%, #0ea5e9 100%)',
          }}
        />
        <div
          style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            flex: 1, padding: '0 90px',
          }}
        >
          <div
            style={{
              width: 60, height: 60, borderRadius: 14,
              background: 'linear-gradient(135deg, #d946ef, #0ea5e9)', marginBottom: 28,
            }}
          />
          {eyebrow ? (
            <p
              style={{
                fontSize: 22, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase',
                color: '#0ea5e9', margin: '0 0 18px',
              }}
            >
              {eyebrow}
            </p>
          ) : null}
          <h1
            style={{
              fontSize: title.length > 48 ? 60 : 74, fontWeight: 800, color: '#ffffff',
              margin: 0, lineHeight: 1.08, maxWidth: 1020,
            }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p style={{ fontSize: 30, color: '#9ca3af', margin: '24px 0 0', maxWidth: 980, lineHeight: 1.4 }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '24px 90px', borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span style={{ color: '#6b7280', fontSize: 20, fontWeight: 700 }}>CentenarianOS</span>
          <span style={{ color: '#4b5563', fontSize: 18 }}>centenarianos.com</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
