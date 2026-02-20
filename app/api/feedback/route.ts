// app/api/feedback/route.ts
// Accepts user feedback submissions and stores them in user_feedback table.
// Notifies admin via email when feedback is submitted.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getResend } from '@/lib/email/resend';

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const VALID_CATEGORIES = ['bug', 'feature', 'general'] as const;
type Category = typeof VALID_CATEGORIES[number];

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();
  const { data, error } = await db
    .from('user_feedback')
    .select('id, category, message, media_url, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { category?: string; message?: string; media_url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { category, message, media_url } = body;

  if (!category || !VALID_CATEGORIES.includes(category as Category)) {
    return NextResponse.json({ error: 'category must be one of: bug, feature, general' }, { status: 400 });
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  if (message.length > 2000) {
    return NextResponse.json({ error: 'message must be 2000 characters or fewer' }, { status: 400 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('user_feedback')
    .insert({
      user_id: user.id,
      category,
      message: message.trim(),
      media_url: media_url || null,
      is_read_by_admin: false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[feedback] Insert failed:', error);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }

  // Notify admin via email
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    if (adminEmail) {
      const resend = getResend();
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'admin@centenarianos.com',
        to: adminEmail,
        subject: `[CentenarianOS] New ${category} feedback from ${user.email}`,
        html: `<p><strong>${user.email}</strong> submitted a <strong>${category}</strong> report:</p>
               <blockquote style="border-left:3px solid #c026d3;padding-left:12px;color:#374151;">${message.trim()}</blockquote>
               ${media_url ? `<p>📎 <a href="${media_url}">View attachment</a></p>` : ''}
               <p><a href="${siteUrl}/admin/feedback">Reply in Admin Dashboard →</a></p>`,
      });
    }
  } catch (e) {
    console.error('[feedback] Admin email failed:', e);
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
