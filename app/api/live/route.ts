// app/api/live/route.ts
// GET: list live sessions (filtered by visibility + auth status)
// POST: create a live session — admin only
// DELETE: ?id=<id> — admin only

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getResend } from '@/lib/email/resend';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('course_id');
  const hostType = searchParams.get('host_type');

  // Determine auth status to decide which visibility levels to expose
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const db = getDb();
  const now = new Date().toISOString();

  let query = db
    .from('live_sessions')
    .select('id, host_type, teacher_id, course_id, title, description, scheduled_at, embed_code, is_live, is_public, visibility, published_at, created_at')
    .order('scheduled_at', { ascending: false });

  if (courseId) query = query.eq('course_id', courseId);
  if (hostType) query = query.eq('host_type', hostType);

  const { data, error } = await query.limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter by visibility in JS (service role bypasses RLS)
  const filtered = (data ?? []).filter((s) => {
    if (s.visibility === 'public') return true;
    if (s.visibility === 'scheduled') return s.published_at && s.published_at <= now;
    if (s.visibility === 'members') return !!user; // authenticated only
    return false;
  });

  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Admin only until Mux integration for teachers
  if (user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const db = getDb();
  const body = await request.json();
  const {
    title, description, scheduled_at, embed_code,
    is_live = false, visibility = 'public', published_at,
  } = body;

  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  if (!embed_code?.trim()) return NextResponse.json({ error: 'Embed code required' }, { status: 400 });

  const { data: session, error } = await db
    .from('live_sessions')
    .insert({
      host_type: 'centos_team',
      teacher_id: null,
      course_id: null,
      title: title.trim(),
      description: description ?? null,
      scheduled_at: scheduled_at ?? null,
      embed_code: embed_code.trim(),
      is_live,
      is_public: visibility === 'public',
      visibility,
      published_at: published_at ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send email notification to all active members (fire-and-forget)
  notifyMembers(db, session).catch((e) => console.error('[live/notify] Email failed:', e));

  return NextResponse.json(session, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.email !== process.env.ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const allowed = ['is_live', 'title', 'description', 'scheduled_at', 'embed_code', 'visibility', 'published_at'];
  const filtered = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));

  const db = getDb();
  const { data, error } = await db.from('live_sessions').update(filtered).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.email !== process.env.ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = getDb();
  const { error } = await db.from('live_sessions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

async function notifyMembers(
  db: ReturnType<typeof createServiceClient>,
  session: { title: string; description: string | null; scheduled_at: string | null },
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  // Get all active subscribers
  const { data: profiles } = await db
    .from('profiles')
    .select('id')
    .in('subscription_status', ['monthly', 'lifetime']);

  if (!profiles?.length) return;
  const userIds = profiles.map((p: { id: string }) => p.id);

  // Get emails from auth
  const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 });
  const emails = users
    .filter((u) => userIds.includes(u.id) && u.email)
    .map((u) => u.email as string);

  if (!emails.length) return;

  const resend = getResend();
  const scheduledText = session.scheduled_at
    ? `<p><strong>When:</strong> ${new Date(session.scheduled_at).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>`
    : '';

  // Send in batches of 50 (Resend batch limit)
  for (let i = 0; i < emails.length; i += 50) {
    const batch = emails.slice(i, i + 50);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@centenarianos.com',
      to: batch,
      subject: `Live Session: ${session.title}`,
      html: `
        <h2>New Live Session Scheduled</h2>
        <p><strong>${session.title}</strong></p>
        ${session.description ? `<p>${session.description}</p>` : ''}
        ${scheduledText}
        <p><a href="${siteUrl}/live" style="color:#c026d3;">Join the session →</a></p>
        <p style="color:#9ca3af;font-size:12px;">— CentenarianOS Team</p>
      `,
    });
  }
}
