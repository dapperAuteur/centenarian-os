// app/api/recipes/events/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const VALID_EVENT_TYPES = new Set([
  'view',
  'share_copy', 'share_email', 'share_linkedin',
  'blocked_visit',
]);

/**
 * POST /api/recipes/events
 * Log a recipe engagement event. No auth required.
 *
 * Body: { recipeId, eventType, sessionId?, referrer? }
 *
 * Country is extracted from Cloudflare/Vercel geo headers server-side.
 * Uses the log_recipe_event security-definer function to atomically
 * insert the event and bump view_count.
 */
export async function POST(request: NextRequest) {
  let body: { recipeId?: string; eventType?: string; sessionId?: string; referrer?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { recipeId, eventType, sessionId, referrer } = body;

  if (!recipeId || !eventType) {
    return NextResponse.json({ error: 'recipeId and eventType are required' }, { status: 400 });
  }

  if (!VALID_EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 });
  }

  const country =
    request.headers.get('cf-ipcountry') ||
    request.headers.get('x-vercel-ip-country') ||
    null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.rpc('log_recipe_event', {
    p_recipe_id: recipeId,
    p_event_type: eventType,
    p_session_id: sessionId || null,
    p_referrer: referrer || null,
    p_country: country,
    p_user_id: user?.id || null,
  });

  if (error) {
    console.error('[Recipe Events API] log_recipe_event RPC failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
