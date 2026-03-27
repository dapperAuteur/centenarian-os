// app/api/admin/cashapp/route.ts
// GET: List all CashApp payments (admin only).
// PATCH: Approve or reject a CashApp payment.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createShopifyPromoCode } from '@/lib/shopify/createPromoCode';
import { getResend } from '@/lib/email/resend';
import { logInfo, logError } from '@/lib/logging';

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('cashapp_payments')
    .select(`
      id, user_id, amount, cashapp_name, screenshot_url, status,
      admin_notes, verified_at, created_at
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with user emails
  const userIds = [...new Set((data ?? []).map((p) => p.user_id))];
  const { data: profiles } = await db
    .from('profiles')
    .select('id, email, subscription_status')
    .in('id', userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const enriched = (data ?? []).map((p) => ({
    ...p,
    email: profileMap.get(p.user_id)?.email ?? null,
    current_status: profileMap.get(p.user_id)?.subscription_status ?? 'free',
  }));

  return NextResponse.json(enriched);
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, action, admin_notes } = await request.json();
  if (!id || !['verify', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const db = getServiceClient();

  // Fetch the payment
  const { data: payment } = await db
    .from('cashapp_payments')
    .select('id, user_id, status')
    .eq('id', id)
    .maybeSingle();

  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  if (payment.status !== 'pending') {
    return NextResponse.json({ error: 'Payment already processed' }, { status: 400 });
  }

  const newStatus = action === 'verify' ? 'verified' : 'rejected';

  // Update payment status
  const { error: updateErr } = await db
    .from('cashapp_payments')
    .update({
      status: newStatus,
      admin_notes: admin_notes || null,
      verified_by: admin.id,
      verified_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // If verified, activate lifetime membership and notify user
  if (action === 'verify') {
    let promoCode: string | null = null;
    try {
      promoCode = await createShopifyPromoCode();
    } catch (err) {
      logError({ source: 'admin', module: 'cashapp', message: 'Failed to create Shopify promo code', metadata: { error: err instanceof Error ? err.message : String(err) }, userId: payment.user_id });
    }

    const { error: profileErr } = await db
      .from('profiles')
      .update({
        subscription_status: 'lifetime',
        shirt_promo_code: promoCode,
        stripe_subscription_id: null,
        subscription_expires_at: null,
      })
      .eq('id', payment.user_id);

    if (profileErr) {
      logError({ source: 'admin', module: 'cashapp', message: 'Failed to activate lifetime', metadata: { error: profileErr.message }, userId: payment.user_id });
      return NextResponse.json({ error: 'Payment verified but membership activation failed' }, { status: 500 });
    }

    logInfo({ source: 'admin', module: 'cashapp', message: 'CashApp payment verified — lifetime activated', metadata: { paymentId: id }, userId: payment.user_id });

    // Send confirmation email to user
    const { data: userAuth } = await db.auth.admin.getUserById(payment.user_id);
    const userEmail = userAuth?.user?.email;
    if (userEmail) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://centenarianos.com';
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@centenarianos.com';
      try {
        await getResend().emails.send({
          from: `CentenarianOS <${fromEmail}>`,
          to: userEmail,
          subject: 'Your CashApp payment is confirmed — Lifetime access is active!',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
              <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 16px;">
                Welcome to Lifetime, ${userAuth.user?.user_metadata?.full_name || 'there'}!
              </h1>
              <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin-bottom: 16px;">
                Your CashApp payment has been verified and your <strong>Lifetime membership</strong> is now active. You have full, permanent access to every CentenarianOS module — no recurring charges, ever.
              </p>
              ${promoCode ? `
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <p style="font-size: 13px; color: #166534; font-weight: 600; margin: 0 0 8px 0;">
                  Your Free Shirt Promo Code
                </p>
                <p style="font-size: 22px; font-family: monospace; font-weight: 700; color: #14532d; letter-spacing: 2px; margin: 0 0 8px 0;">
                  ${promoCode}
                </p>
                <p style="font-size: 13px; color: #166534; margin: 0;">
                  Use this at <a href="https://AwesomeWebStore.com" style="color: #166534; font-weight: 600;">AwesomeWebStore.com</a> to claim your free CentenarianOS shirt.
                </p>
              </div>
              ` : ''}
              <a href="${siteUrl}/dashboard" style="display: inline-block; background: #d946ef; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">
                Go to Dashboard
              </a>
              <p style="font-size: 13px; color: #9ca3af; margin-top: 24px;">
                Questions? Reply to this email or visit <a href="${siteUrl}/dashboard/billing" style="color: #d946ef;">your billing page</a>.
              </p>
            </div>
          `,
        });
        logInfo({ source: 'admin', module: 'cashapp', message: 'Confirmation email sent', metadata: { email: userEmail }, userId: payment.user_id });
      } catch (emailErr) {
        logError({ source: 'admin', module: 'cashapp', message: 'Failed to send confirmation email', metadata: { error: emailErr instanceof Error ? emailErr.message : String(emailErr) }, userId: payment.user_id });
      }
    }
  }

  // If rejected, notify user
  if (action === 'reject') {
    const { data: userAuth } = await db.auth.admin.getUserById(payment.user_id);
    const userEmail = userAuth?.user?.email;
    if (userEmail) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://centenarianos.com';
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@centenarianos.com';
      try {
        await getResend().emails.send({
          from: `CentenarianOS <${fromEmail}>`,
          to: userEmail,
          subject: 'CashApp payment update — action needed',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
              <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 16px;">
                CashApp Payment Update
              </h1>
              <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin-bottom: 16px;">
                We were unable to verify your CashApp payment.${admin_notes ? ` <strong>Reason:</strong> ${admin_notes}` : ''} Please check your CashApp transaction and try again, or use card payment on our pricing page.
              </p>
              <a href="${siteUrl}/pricing" style="display: inline-block; background: #d946ef; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">
                View Pricing
              </a>
              <p style="font-size: 13px; color: #9ca3af; margin-top: 24px;">
                Need help? Reply to this email and we'll sort it out.
              </p>
            </div>
          `,
        });
      } catch {
        // Non-critical — don't block the rejection
      }
    }
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
