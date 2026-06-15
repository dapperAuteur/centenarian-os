// app/api/academy/lead-email/route.ts
// POST: store an OPTIONAL, consented email left at a free download. The download never
// depends on this. Tied to the wl_sid session so it can be correlated with later signup.

import { NextRequest, NextResponse, after } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { LEAD_SESSION_COOKIE } from '@/lib/lead/session';
import { notifyLead } from '@/lib/lead/notify';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getDb() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { /* tolerate */ }

  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email || !EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }
  const sourceDocument = body.source_document ? String(body.source_document).slice(0, 200) : null;
  const courseId = UUID.test(String(body.course_id ?? '')) ? String(body.course_id) : null;
  const sessionId = request.cookies.get(LEAD_SESSION_COOKIE)?.value || (body.session_id ? String(body.session_id).slice(0, 100) : null);

  let userId: string | null = null;
  try {
    const sb = await createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* anonymous */ }

  const db = getDb();
  const { error } = await db.from('lead_emails').insert({
    email, source_document: sourceDocument, course_id: courseId, session_id: sessionId, user_id: userId, consented: true,
  });
  // 23505 = unique violation (already captured this email for this doc) — treat as success.
  const ok = !error || error.code === '23505';

  if (ok) after(() => notifyLead('cent-lead-email', { source_document: sourceDocument, course_id: courseId, session_id: sessionId }, email));

  return NextResponse.json({ ok });
}
