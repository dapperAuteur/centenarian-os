// app/api/admin/messages/[id]/route.ts
// GET: admin views replies for a message thread
// POST: admin sends a reply to a user in the thread → emails user

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getResend } from '@/lib/email/resend';

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function getAdminUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => { try { cookieStore.set({ name, value, ...options }); } catch {} },
        remove: (name: string, options: CookieOptions) => { try { cookieStore.set({ name, value: '', ...options }); } catch {} },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = getDb();

  const [{ data: replies }, markRead] = await Promise.all([
    db.from('message_replies').select('id, is_admin, body, media_url, created_at, sender_id')
      .eq('message_id', id).order('created_at', { ascending: true }),
    // Mark all non-admin replies as read
    db.from('message_replies').update({ is_read_by_admin: true }).eq('message_id', id).eq('is_admin', false),
  ]);
  void markRead;

  return NextResponse.json({ replies: replies ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { body, media_url } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: 'body is required' }, { status: 400 });

  const db = getDb();

  const { data: reply, error } = await db
    .from('message_replies')
    .insert({ message_id: id, sender_id: admin.id, is_admin: true, body: body.trim(), media_url: media_url || null, is_read_by_admin: true })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get the original message to find recipients + email them
  try {
    const { data: msg } = await db.from('admin_messages').select('subject, recipient_scope, recipient_user_id').eq('id', id).maybeSingle();
    if (msg?.recipient_user_id) {
      const { data: authUser } = await db.auth.admin.getUserById(msg.recipient_user_id);
      const userEmail = authUser?.user?.email;
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
      if (userEmail) {
        const resend = getResend();
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? 'admin@centenarianos.com',
          to: userEmail,
          subject: `Re: ${msg.subject}`,
          html: `<p>The CentenarianOS team replied to your message thread:</p>
                 <blockquote style="border-left:3px solid #c026d3;padding-left:12px;color:#374151;">${body}</blockquote>
                 <p><a href="${siteUrl}/dashboard/messages">View in your inbox →</a></p>
                 <p style="color:#9ca3af;font-size:12px;">— CentenarianOS Team</p>`,
        });
      }
    }
  } catch (e) {
    console.error('[admin-message-reply] Email failed:', e);
  }

  return NextResponse.json({ id: reply.id }, { status: 201 });
}
