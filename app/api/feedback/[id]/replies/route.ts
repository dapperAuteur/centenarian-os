// app/api/feedback/[id]/replies/route.ts
// GET: user views replies to their feedback
// POST: user adds a reply to their own feedback thread

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getResend } from '@/lib/email/resend';

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
    .select('id, is_admin, body, media_url, created_at')
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

  return NextResponse.json({ id: reply.id }, { status: 201 });
}
