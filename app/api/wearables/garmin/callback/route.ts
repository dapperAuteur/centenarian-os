// app/api/wearables/garmin/callback/route.ts
// GET: handle Garmin OAuth callback, exchange code for token

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state'); // user_id
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings/wearables?error=missing_code`);
  }

  const clientId = process.env.GARMIN_CLIENT_ID!;
  const clientSecret = process.env.GARMIN_CLIENT_SECRET!;
  const redirectUri = `${appUrl}/api/wearables/garmin/callback`;

  const tokenRes = await fetch('https://connectapi.garmin.com/oauth-service/oauth/token', {
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
    user_id: state,
    provider: 'garmin',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null,
    sync_status: 'idle',
  }, { onConflict: 'user_id,provider' });

  return NextResponse.redirect(`${appUrl}/dashboard/settings/wearables?connected=garmin`);
}
