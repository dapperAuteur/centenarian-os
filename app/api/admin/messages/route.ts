// app/api/admin/messages/route.ts
// Admin: send messages to users and list sent messages

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getResend } from '@/lib/email/resend';
import { adminMessageTemplate } from '@/lib/email/adminMessageTemplate';

function getServiceClient() {
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
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(_request: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser || adminUser.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServiceClient();
  const { data: messages, error } = await db
    .from('admin_messages')
    .select('*, message_reads(count)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser || adminUser.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { subject, body, recipient_scope, recipient_user_id } = await request.json();

  if (!subject || !body || !recipient_scope) {
    return NextResponse.json({ error: 'subject, body, and recipient_scope are required' }, { status: 400 });
  }

  const db = getServiceClient();

  // Save message to DB
  const { data: message, error: insertError } = await db
    .from('admin_messages')
    .insert({
      subject,
      body,
      recipient_scope,
      recipient_user_id: recipient_scope === 'user' ? recipient_user_id : null,
    })
    .select()
    .single();

  if (insertError || !message) {
    return NextResponse.json({ error: insertError?.message ?? 'Insert failed' }, { status: 500 });
  }

  // Gather target user emails
  let emails: string[] = [];
  const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 1000 });
  const allUsers = authUsers?.users ?? [];

  if (recipient_scope === 'all') {
    emails = allUsers.map((u) => u.email).filter(Boolean) as string[];
  } else if (recipient_scope === 'user') {
    const target = allUsers.find((u) => u.id === recipient_user_id);
    if (target?.email) emails = [target.email];
  } else {
    // free | monthly | lifetime — filter by subscription_status
    const { data: profiles } = await db
      .from('profiles')
      .select('id, subscription_status')
      .eq('subscription_status', recipient_scope);
    const ids = new Set((profiles ?? []).map((p) => p.id));
    emails = allUsers.filter((u) => ids.has(u.id) && u.email).map((u) => u.email as string);
  }

  // Send emails via Resend in batches
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const html = adminMessageTemplate({ subject, body, siteUrl });
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'admin@centenarianos.com';
  const resend = getResend();

  let sent = 0;
  for (const email of emails) {
    try {
      await resend.emails.send({
        from: fromEmail,
        to: email,
        subject,
        html,
      });
      sent++;
    } catch (e) {
      console.error('Failed to send email to', email, e);
    }
  }

  return NextResponse.json({ ok: true, messageId: message.id, sent, total: emails.length });
}
