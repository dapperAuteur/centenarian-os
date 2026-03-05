// app/api/track/route.ts
// Lightweight POST endpoint for client-side usage event tracking.
// Resolves user from session, classifies user type, inserts fire-and-forget.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { trackUsage } from '@/lib/trackUsage';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.module || !body?.action) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Look up subscription status for analytics segmentation
  let subscriptionType: string | null = null;
  if (user) {
    const { data: profile } = await getDb()
      .from('profiles')
      .select('subscription_status, role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile) {
      subscriptionType = profile.role === 'teacher' ? 'teacher' : (profile.subscription_status || 'free');
    }
  }

  trackUsage({
    userId: user?.id,
    userEmail: user?.email,
    subscriptionType,
    module: body.module,
    action: body.action,
    detail: body.detail,
  });

  return NextResponse.json({ ok: true });
}
