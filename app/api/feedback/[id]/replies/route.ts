// app/api/feedback/[id]/replies/route.ts
// GET: user views replies to their feedback
// POST: user adds a reply to their own feedback thread

import { NextRequest, NextResponse, after } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getResend } from '@/lib/email/resend';
import { mirrorFeedbackToInbox } from '@/lib/feedback/inbox-mirror';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify ownership
  const { data: feedback } = await db
    .from('user_feedback')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!feedback) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: replies, error } = await db
    .from('feedback_replies')
    .select('id, is_admin, body, media_url, created_at, kind')
    .eq('feedback_id', id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ replies });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { body, media_url } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: 'body is required' }, { status: 400 });

  const db = getDb();

  // Verify ownership
  const { data: feedback } = await db
    .from('user_feedback')
    .select('id, category, message')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!feedback) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = user.email === process.env.ADMIN_EMAIL;

  const { data: reply, error } = await db
    .from('feedback_replies')
    .insert({ feedback_id: id, sender_id: user.id, is_admin: isAdmin, body: body.trim(), media_url: media_url || null })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify admin via email (only when a non-admin user replies)
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    if (adminEmail && !isAdmin) {
      const resend = getResend();
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'admin@centenarianos.com',
        to: adminEmail,
        subject: `[CentenarianOS] User replied to feedback`,
        html: `<p><strong>${user.email}</strong> replied to a feedback thread:</p>
               <blockquote style="border-left:3px solid #c026d3;padding-left:12px;color:#374151;">${body}</blockquote>
               <p><a href="${siteUrl}/admin/feedback">View in Admin Dashboard →</a></p>`,
      });
    }
  } catch (e) {
    console.error('[feedback-reply] Email failed:', e);
  }

  // Mirror user (not admin) replies to the WitUS Inbox, non-blocking, so the
  // follow-up reaches BAM's triage view. Admin replies are BAM's own.
  if (!isAdmin) {
    after(() =>
      mirrorFeedbackToInbox({
        category: feedback.category,
        message: body.trim(),
        feedbackId: id,
        kind: 'reply',
        submitterEmail: user.email,
      })
    );
  }

  return NextResponse.json({ id: reply.id }, { status: 201 });
}

// PATCH: the user confirms a resolved report is fixed, or reopens it. Posts a
// status event into the conversation.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, body } = await req.json().catch(() => ({}));
  if (action !== 'confirm' && action !== 'reopen') return NextResponse.json({ error: "action must be 'confirm' or 'reopen'" }, { status: 400 });

  const db = getDb();
  const { data: feedback } = await db
    .from('user_feedback')
    .select('id, category, resolution_status')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!feedback) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = user.email === process.env.ADMIN_EMAIL;
  const note = body?.trim();

  if (action === 'confirm') {
    const text = note || 'Confirmed — this is fixed for me. Thank you!';
    const { error: upErr } = await db.from('user_feedback')
      .update({ resolution_status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    const { data: ev } = await db.from('feedback_replies')
      .insert({ feedback_id: id, sender_id: user.id, is_admin: isAdmin, kind: 'confirmed', body: text })
      .select('id').single();
    return NextResponse.json({ id: ev?.id ?? null, resolution_status: 'confirmed' });
  }

  // reopen
  const text = note || "This still isn't working for me.";
  const { error: upErr } = await db.from('user_feedback')
    .update({ resolution_status: 'reopened', is_read_by_admin: false })
    .eq('id', id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: ev } = await db.from('feedback_replies')
    .insert({ feedback_id: id, sender_id: user.id, is_admin: isAdmin, kind: 'reopened', body: text })
    .select('id').single();

  // Notify admin + mirror to the inbox so it re-enters triage.
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    if (adminEmail && !isAdmin) {
      const resend = getResend();
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'admin@centenarianos.com',
        to: adminEmail,
        subject: `[CentenarianOS] User reopened a resolved feedback`,
        html: `<p><strong>${user.email}</strong> reopened a report that was marked resolved:</p>
               <blockquote style="border-left:3px solid #dc2626;padding-left:12px;color:#374151;">${text}</blockquote>
               <p><a href="${siteUrl}/admin/feedback">View in Admin Dashboard →</a></p>`,
      });
    }
  } catch (e) {
    console.error('[feedback-reopen] Email failed:', e);
  }
  if (!isAdmin) {
    after(() => mirrorFeedbackToInbox({ category: feedback.category, message: `[REOPENED] ${text}`, feedbackId: id, kind: 'reply', submitterEmail: user.email }));
  }

  return NextResponse.json({ id: ev?.id ?? null, resolution_status: 'reopened' });
}
