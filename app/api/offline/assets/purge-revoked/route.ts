// app/api/offline/assets/purge-revoked/route.ts
//
// POST — for the authenticated user, find every offline_assets row whose
// course_id no longer has an active enrollment (teacher revoked access,
// Stripe cancellation, user unenrolled, course deleted) and delete those
// ledger rows. Returns the list of asset_urls that were purged so the
// client can also delete the local blobs from IndexedDB.
//
// Why server-side: trust boundary. A client-side enrollment check can be
// bypassed — the ledger is the authoritative record of what the user
// claims to be entitled to cache, so the server is where revocation is
// enforced. The blob itself is local to the browser; we can only ask
// the client to delete it. That's acceptable because the asset URL is
// still hosted on Cloudinary and the player guards access at fetch
// time; a stubborn learner with a cached blob past revocation only has
// the one copy they already had.

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const [ledgerRes, enrollmentsRes] = await Promise.all([
    db
      .from('offline_assets')
      .select('id, asset_url, course_id')
      .eq('user_id', user.id),
    db
      .from('enrollments')
      .select('course_id')
      .eq('user_id', user.id)
      .eq('status', 'active'),
  ]);

  if (ledgerRes.error) {
    return NextResponse.json({ error: ledgerRes.error.message }, { status: 500 });
  }
  if (enrollmentsRes.error) {
    return NextResponse.json({ error: enrollmentsRes.error.message }, { status: 500 });
  }

  const activeCourseIds = new Set((enrollmentsRes.data ?? []).map((e) => e.course_id));
  // Rows with a null course_id aren't enrollment-gated (posters unlinked
  // from a lesson, stray uploads) — leave those alone. Purge only when
  // course_id is set AND the user is no longer actively enrolled.
  const revoked = (ledgerRes.data ?? []).filter(
    (row) => row.course_id && !activeCourseIds.has(row.course_id),
  );

  if (revoked.length === 0) {
    return NextResponse.json({ revoked_urls: [], count: 0 });
  }

  const ids = revoked.map((r) => r.id);
  const { error: delErr } = await db
    .from('offline_assets')
    .delete()
    .eq('user_id', user.id)
    .in('id', ids);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({
    revoked_urls: revoked.map((r) => r.asset_url),
    count: revoked.length,
  });
}
