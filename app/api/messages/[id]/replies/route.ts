// app/api/messages/[id]/replies/route.ts
// GET: user views replies in a message thread
// POST: user sends a reply to an admin message → alerts admin

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getResend } from '@/lib/email/resend';
import { canSeeAdminMessage, escapeHtml, visibleReply } from '@/lib/messages/visibility';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Db = ReturnType<typeof getDb>;
type SignedInUser = { id: string; email?: string | null; created_at?: string | null };

/**
 * May this user use the thread? The admin always; anyone else only when the
 * message is in their inbox (lib/messages/visibility.ts). A message that does
 * not exist and one they cannot see get the same answer.
 */
async function canUseThread(db: Db, user: SignedInUser, messageId: string): Promise<{ ok: boolean; isAdmin: boolean; subject: string | null }> {
  const isAdmin = !!user.email && user.email === process.env.ADMIN_EMAIL;
  const { data: message } = await db
    .from('admin_messages')
    .select('subject, recipient_scope, recipient_user_id, created_at')
    .eq('id', messageId)
    .maybeSingle();
  if (!message) return { ok: false, isAdmin, subject: null };
  if (isAdmin) return { ok: true, isAdmin, subject: message.subject ?? null };
  const { data: profile } = await db
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .maybeSingle();
  const ok = canSeeAdminMessage(message, {
    id: user.id,
    status: profile?.subscription_status,
    createdAt: user.created_at,
  });
  return { ok, isAdmin, subject: message.subject ?? null };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const db = getDb();
  const thread = await canUseThread(db, user, id);
  if (!thread.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: replies, error } = await db
    .from('message_replies')
    .select('id, is_admin, body, media_url, created_at, sender_id')
    .eq('message_id', id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // On a broadcast, a user sees the admin's replies and their own only.
  const shown = thread.isAdmin ? replies : (replies ?? []).filter((r) => visibleReply(r, user.id));
  return NextResponse.json({ replies: shown });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { body, media_url } = await req.json();
  if (typeof body !== 'string' || !body.trim()) return NextResponse.json({ error: 'body is required' }, { status: 400 });
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const db = getDb();

  const thread = await canUseThread(db, user, id);
  if (!thread.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const isAdmin = thread.isAdmin;

  const { data: reply, error } = await db
    .from('message_replies')
    .insert({
      message_id: id,
      sender_id: user.id,
      is_admin: isAdmin,
      body: body.trim(),
      media_url: media_url || null,
      is_read_by_admin: isAdmin,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Email admin notification (only when a non-admin user replies)
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    if (adminEmail && !isAdmin) {
      const subject = thread.subject ?? '';
      const resend = getResend();
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'admin@centenarianos.com',
        to: adminEmail,
        subject: `[CentenarianOS] User replied to: ${subject || 'a message'}`,
        html: `<p><strong>${escapeHtml(user.email ?? '')}</strong> replied to your message "${escapeHtml(subject)}":</p>
               <blockquote style="border-left:3px solid #c026d3;padding-left:12px;color:#374151;">${escapeHtml(body)}</blockquote>
               <p><a href="${siteUrl}/admin/messages">View in Admin Dashboard →</a></p>`,
      });
    }
  } catch (e) {
    console.error('[message-reply] Email failed:', e);
  }

  return NextResponse.json({ id: reply.id }, { status: 201 });
}
