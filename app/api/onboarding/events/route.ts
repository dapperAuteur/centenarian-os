import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

// Service role client for inserting events (works for both auth and anon visitors)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const VALID_EVENT_TYPES = [
  'tour_started', 'tour_completed', 'tour_skipped', 'tour_exited',
  'step_completed', 'step_skipped',
  'demo_login', 'demo_feature_view',
  'feature_page_view', 'cta_signup_click', 'cta_demo_click',
  'tour_restarted',
];

export async function POST(req: Request) {
  const body = await req.json();

  if (!body.event_type || !VALID_EVENT_TYPES.includes(body.event_type)) {
    return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 });
  }
  if (!body.module_slug) {
    return NextResponse.json({ error: 'module_slug required' }, { status: 400 });
  }

  // Try to get authenticated user (optional — feature page views may be anonymous)
  let userId: string | null = null;
  let publicAlias: string | null = null;

  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      // Fetch public alias
      const { data: profile } = await supabase
        .from('profiles')
        .select('public_alias')
        .eq('id', user.id)
        .maybeSingle();
      publicAlias = profile?.public_alias || null;
    }
  } catch {
    // Not authenticated — that's fine for anonymous events
  }

  const db = getServiceClient();
  const { error } = await db.from('tour_events').insert({
    user_id: userId,
    public_alias: publicAlias,
    app: body.app || 'main',
    module_slug: body.module_slug,
    event_type: body.event_type,
    step_index: body.step_index ?? null,
    step_title: body.step_title ?? null,
    metadata: body.metadata ?? {},
  });

  if (error) {
    console.error('[tour_events] insert failed:', error.message);
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
