// lib/trackUsage.ts
// Fire-and-forget usage event tracking for analytics.
// Classifies user type at write time for fast query filtering.

import { createClient } from '@supabase/supabase-js';

interface TrackOptions {
  userId?: string | null;
  userEmail?: string | null;
  subscriptionType?: string | null;
  module: string;
  action: string;
  detail?: string;
}

function classifyUser(userId?: string | null, userEmail?: string | null): 'admin' | 'demo' | 'tutorial' | 'real' {
  if (userEmail && userEmail === process.env.ADMIN_EMAIL) return 'admin';
  if (userId && userId === process.env.DEMO_TUTORIAL_USER_ID) return 'tutorial';
  if (userId && userId === process.env.DEMO_VISITOR_USER_ID) return 'demo';
  return 'real';
}

let _db: ReturnType<typeof createClient> | null = null;
function getDb() {
  if (!_db) {
    _db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _db;
}

export function trackUsage(opts: TrackOptions): void {
  const userType = classifyUser(opts.userId, opts.userEmail);
  getDb()
    .from('usage_events')
    .insert({
      user_id: opts.userId ?? null,
      user_type: userType,
      subscription_type: opts.subscriptionType ?? null,
      module: opts.module,
      action: opts.action,
      detail: opts.detail ?? null,
    } as never)
    .then(({ error }) => {
      if (error) console.error('[trackUsage] insert failed:', error.message);
    });
}
