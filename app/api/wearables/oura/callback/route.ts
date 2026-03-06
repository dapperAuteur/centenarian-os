// app/api/wearables/oura/callback/route.ts
// GET: handle Oura OAuth callback, exchange code for token

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { verifyOAuthState } from '@/lib/oauth-state';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const rawState = request.nextUrl.searchParams.get('state');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  if (!code || !rawState) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings/wearables?error=missing_code`);
  }

  const userId = verifyOAuthState(rawState);
  if (!userId) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings/wearables?error=invalid_state`);
  }

  const clientId = process.env.OURA_CLIENT_ID!;
  const clientSecret = process.env.OURA_CLIENT_SECRET!;
  const redirectUri = `${appUrl}/api/wearables/oura/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings/wearables?error=token_exchange`);
  }

  const tokens = await tokenRes.json();
  const db = getDb();

  await db.from('wearable_connections').upsert({
    user_id: userId,
    provider: 'oura',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null,
    sync_status: 'idle',
  }, { onConflict: 'user_id,provider' });

  return NextResponse.redirect(`${appUrl}/dashboard/settings/wearables?connected=oura`);
}
