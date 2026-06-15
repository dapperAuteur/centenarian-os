// app/api/academy/track/download/route.ts
// POST: record a lead-magnet document download. Best-effort and non-blocking — the
// download itself happens client-side regardless of this call. Anonymous visitors are
// tracked via the wl_sid session cookie; logged-in users also get user_id.

import { NextRequest, NextResponse, after } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { LEAD_SESSION_COOKIE } from '@/lib/lead/session';
import { notifyLead } from '@/lib/lead/notify';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getDb() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { /* tolerate empty body */ }

  const documentKey = String(body.document_key ?? '').slice(0, 200);
  if (!documentKey) return NextResponse.json({ error: 'document_key required' }, { status: 400 });

  const courseId = UUID.test(String(body.course_id ?? '')) ? String(body.course_id) : null;
  const documentTitle = body.document_title ? String(body.document_title).slice(0, 300) : null;
  const sessionId = request.cookies.get(LEAD_SESSION_COOKIE)?.value || (body.session_id ? String(body.session_id).slice(0, 100) : null);
  const referrer = request.headers.get('referer');

  let userId: string | null = null;
  try {
    const sb = await createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* anonymous is fine */ }

  const db = getDb();
  const { error } = await db.from('lead_download_events').insert({
    course_id: courseId, document_key: documentKey, document_title: documentTitle,
    session_id: sessionId, user_id: userId, referrer,
  });

  after(() => notifyLead('cent-lead-download', {
    document_key: documentKey, document_title: documentTitle, course_id: courseId, session_id: sessionId, user_id: userId,
  }));

  return NextResponse.json({ ok: !error });
}
