// File: app/api/health/route.ts
// Public, unauthenticated liveness probe for uptime monitors (Better Stack).
//
// Why it exists: a monitor pointed at the homepage can get a cached 200 while
// Supabase is down, so a green check means nothing. This route always does a
// real round trip to Postgres before it answers.
//
// Safety rules this file must keep (see CLAUDE.md; this app holds health data):
//   1. Anon/publishable key only. Never the service-role key on a public route.
//   2. Never echo a raw error. A Supabase/Postgres error can carry connection
//      details, host names, or key context. Only a fixed reason token escapes.
//   3. Never return, count, or hint at a row of user data. The probe targets
//      `metric_config`, a seeded configuration table (metric labels and unlock
//      rules, no user rows at all), and it is issued as a HEAD request
//      (`head: true`) so PostgREST returns no body and no count. Under the anon
//      role RLS also denies the read outright, so the result set is empty by
//      construction. What is being asserted is only "Postgres answered".
//   4. Never cached: force-dynamic plus Cache-Control: no-store.

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// A hung database must fail fast, not hold the monitor's connection open.
const TIMEOUT_MS = 4000;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

// The only failure vocabulary this endpoint speaks. Nothing derived from an
// exception, a driver message, or a stack ever reaches the response.
type FailureReason = 'not_configured' | 'database_unreachable';

function healthy(startedAt: number) {
  return NextResponse.json(
    {
      ok: true,
      service: 'centenarian-os',
      checks: { database: 'ok' },
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}

function unhealthy(reason: FailureReason, startedAt: number) {
  return NextResponse.json(
    {
      ok: false,
      service: 'centenarian-os',
      error: reason,
      checks: { database: 'fail' },
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    },
    { status: 503, headers: NO_STORE_HEADERS }
  );
}

export async function GET() {
  const startedAt = Date.now();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Public/anon key by design. A public unauthenticated endpoint must never
  // run with elevated credentials.
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return unhealthy('not_configured', startedAt);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    // head: true -> HEAD request, no body, no count. limit(1) keeps the plan
    // trivial. The only thing inspected is whether an error came back.
    const { error } = await supabase
      .from('metric_config')
      .select('metric_key', { head: true })
      .limit(1)
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS));

    if (error) {
      // Deliberately discarded: `error` may contain host or credential context.
      return unhealthy('database_unreachable', startedAt);
    }

    return healthy(startedAt);
  } catch {
    // Covers the abort/timeout path and anything else thrown. No rethrow, no
    // logging of the raw error, so nothing can leak through an error reporter.
    return unhealthy('database_unreachable', startedAt);
  }
}
