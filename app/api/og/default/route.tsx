// app/api/og/default/route.tsx
// GET — generates the default 1200x630 OG image for CentenarianOS.
// Used as fallback when no page-specific OG image is available.

import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
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

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            padding: '0 80px',
            textAlign: 'center',
          }}
        >
          {/* Logo */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #d946ef, #0ea5e9)',
              marginBottom: 32,
            }}
          />

          {/* Title */}
          <h1
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: '#ffffff',
              margin: '0 0 16px',
              lineHeight: 1.1,
            }}
          >
            CentenarianOS
          </h1>

          {/* Tagline */}
          <p
            style={{
              fontSize: 24,
              color: '#9ca3af',
              margin: 0,
              maxWidth: 700,
              lineHeight: 1.5,
            }}
          >
            Multi-decade personal operating system for executing audacious goals through data-driven daily habits
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '24px 80px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span style={{ color: '#4b5563', fontSize: 18 }}>centenarianos.com</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
