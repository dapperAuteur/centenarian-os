// app/api/wearables/garmin/connect/route.ts
// GET: redirect to Garmin OAuth authorization

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { signOAuthState } from '@/lib/oauth-state';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL));

  const clientId = process.env.GARMIN_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: 'Garmin not configured' }, { status: 500 });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/wearables/garmin/callback`;
  const state = signOAuthState(user.id);

  const url = new URL('https://connect.garmin.com/oauthConfirm');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'activity_read health_read sleep_read');
  url.searchParams.set('state', state);

  return NextResponse.redirect(url.toString());
}
