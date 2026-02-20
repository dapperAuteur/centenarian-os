// app/api/admin/feedback/[id]/route.ts
// GET: admin views single feedback with replies
// POST: admin replies to a feedback thread → emails user

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
  const [{ data: feedback }, { data: replies }] = await Promise.all([
    db.from('user_feedback').select('*, feedback_replies(*)').eq('id', id).maybeSingle(),
    db.from('feedback_replies').select('*').eq('feedback_id', id).order('created_at', { ascending: true }),
  ]);

  // Mark as read by admin
  await db.from('user_feedback').update({ is_read_by_admin: true }).eq('id', id);

  // Enrich replies with sender profile (sender_id === profiles.id)
  const senderIds = [...new Set((replies ?? []).map((r: { sender_id: string }) => r.sender_id).filter(Boolean))];
  const { data: profileRows } = senderIds.length > 0
    ? await db.from('profiles').select('id, username, display_name').in('id', senderIds)
    : { data: [] };
  const profileMap = Object.fromEntries(
    (profileRows ?? []).map((p: { id: string; username: string | null; display_name: string | null }) => [p.id, p])
  );
  const enrichedReplies = (replies ?? []).map((r: { sender_id: string }) => ({
    ...r,
    sender_username: (profileMap[r.sender_id] as { username?: string | null })?.username ?? null,
    sender_display_name: (profileMap[r.sender_id] as { display_name?: string | null })?.display_name ?? null,
  }));

  return NextResponse.json({ feedback, replies: enrichedReplies });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { body, media_url } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: 'body is required' }, { status: 400 });

  const db = getDb();

  const { data: feedback } = await db
    .from('user_feedback')
    .select('id, user_id, category, message')
    .eq('id', id)
    .maybeSingle();
  if (!feedback) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: reply, error } = await db
    .from('feedback_replies')
    .insert({ feedback_id: id, sender_id: admin.id, is_admin: true, body: body.trim(), media_url: media_url || null })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Email the user
  try {
    const { data: authUser } = await db.auth.admin.getUserById(feedback.user_id);
    const userEmail = authUser?.user?.email;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    if (userEmail) {
      const resend = getResend();
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'admin@centenarianos.com',
        to: userEmail,
        subject: 'CentenarianOS team replied to your feedback',
        html: `<p>The CentenarianOS team replied to your feedback submission:</p>
               <blockquote style="border-left:3px solid #c026d3;padding-left:12px;color:#374151;">${body}</blockquote>
               <p><a href="${siteUrl}/dashboard/feedback">View your feedback history →</a></p>
               <p style="color:#9ca3af;font-size:12px;">— CentenarianOS Team</p>`,
      });
    }
  } catch (e) {
    console.error('[admin-feedback-reply] Email failed:', e);
  }

  return NextResponse.json({ id: reply.id }, { status: 201 });
}
