// app/api/auth/verify-turnstile/route.ts
// Validates a Cloudflare Turnstile token server-side before allowing signup.
// Requires TURNSTILE_SECRET_KEY in env. Get a free key at dash.cloudflare.com/turnstile

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  let token: string | undefined;
  try {
    const body = await request.json();
    token = body.token;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 });
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // If the secret isn't configured, skip verification (dev fallback)
    console.warn('[turnstile] TURNSTILE_SECRET_KEY not set — skipping verification');
    return NextResponse.json({ success: true });
  }

  const formData = new URLSearchParams({ secret, response: token });
  const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const data = await cfRes.json() as { success: boolean; 'error-codes'?: string[] };

  if (!data.success) {
    console.warn('[turnstile] Verification failed:', data['error-codes']);
    return NextResponse.json({ success: false, error: 'Verification failed. Please try again.' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
