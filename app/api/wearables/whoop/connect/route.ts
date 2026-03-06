// app/api/wearables/whoop/connect/route.ts
// GET: redirect to Whoop OAuth authorization

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { signOAuthState } from '@/lib/oauth-state';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL));

  const clientId = process.env.WHOOP_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: 'Whoop not configured' }, { status: 500 });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/wearables/whoop/callback`;
  const state = signOAuthState(user.id);

  const url = new URL('https://api.prod.whoop.com/oauth/oauth2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'read:recovery read:cycles read:sleep read:workout read:body_measurement');
  url.searchParams.set('state', state);

  return NextResponse.redirect(url.toString());
}
