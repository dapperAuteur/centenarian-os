// app/api/blog/events/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const VALID_EVENT_TYPES = new Set([
  'view',
  'read_25', 'read_50', 'read_75', 'read_100',
  'share_copy', 'share_email', 'share_linkedin',
]);

/**
 * POST /api/blog/events
 * Log a blog engagement event. No auth required.
 *
 * Body: { postId, eventType, sessionId?, referrer? }
 *
 * Country is extracted from Cloudflare/Vercel geo headers server-side.
 * Uses the log_blog_event security-definer function to atomically
 * insert the event and bump view_count.
 */
export async function POST(request: NextRequest) {
  let body: { postId?: string; eventType?: string; sessionId?: string; referrer?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { postId, eventType, sessionId, referrer } = body;

  if (!postId || !eventType) {
    return NextResponse.json({ error: 'postId and eventType are required' }, { status: 400 });
  }

  if (!VALID_EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 });
  }

  // Extract country from Cloudflare or Vercel geo headers
  const country =
    request.headers.get('cf-ipcountry') ||
    request.headers.get('x-vercel-ip-country') ||
    null;

  const supabase = await createClient();

  // Get user if logged in (optional)
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.rpc('log_blog_event', {
    p_post_id: postId,
    p_event_type: eventType,
    p_session_id: sessionId || null,
    p_referrer: referrer || null,
    p_country: country,
    p_user_id: user?.id || null,
  });

  if (error) {
    console.error('[Blog Events API] log_blog_event RPC failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
