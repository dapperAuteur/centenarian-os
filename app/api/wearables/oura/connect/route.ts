// app/api/wearables/oura/connect/route.ts
// GET: redirect to Oura OAuth authorization

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL));

  const clientId = process.env.OURA_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: 'Oura not configured' }, { status: 500 });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/wearables/oura/callback`;
  const state = user.id; // Simple state — in production, use a signed token

  const url = new URL('https://cloud.ouraring.com/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'daily heartrate personal session workout');
  url.searchParams.set('state', state);

  return NextResponse.redirect(url.toString());
}
