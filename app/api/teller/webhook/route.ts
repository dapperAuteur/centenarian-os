// app/api/teller/webhook/route.ts
// POST: Handle Teller webhook events.
// Events: enrollment.disconnected, transactions.processed, account.number_verification.processed, webhook.test
// Verification: HMAC-SHA256 via Teller-Signature header (lib/teller-webhook.ts). Fails closed.
// Notifies admin via existing admin notifications system.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { logInfo, logError } from '@/lib/logging';
import { verifyTellerSignature } from '@/lib/teller-webhook';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const sigHeader = request.headers.get('teller-signature');

  // Verify the signature on every request, in every environment. Fails closed:
  // without TELLER_WEBHOOK_SECRET nothing is accepted.
  const verification = verifyTellerSignature({
    body: rawBody,
    header: sigHeader,
    secret: process.env.TELLER_WEBHOOK_SECRET,
  });

  if (!verification.ok) {
    if (verification.reason === 'missing_secret') {
      logError({ source: 'webhook', module: 'finance', message: 'Teller webhook rejected: TELLER_WEBHOOK_SECRET is not set' });
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }
    logError({
      source: 'webhook',
      module: 'finance',
      message: 'Teller webhook signature verification failed',
      metadata: { reason: verification.reason },
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: {
    id: string;
    type: string;
    timestamp: string;
    payload: Record<string, unknown>;
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const db = getDb();

  switch (event.type) {
    case 'enrollment.disconnected': {
      const enrollmentId = event.payload.enrollment_id as string;
      const reason = event.payload.reason as string;

      // Update enrollment status
      if (enrollmentId) {
        await db
          .from('teller_enrollments')
          .update({ status: 'disconnected' })
          .eq('enrollment_id', enrollmentId);
      }

      // Notify admin
      await db.from('admin_notifications').insert({
        type: 'teller_webhook',
        title: 'Bank Connection Disconnected',
        message: `Enrollment ${enrollmentId} disconnected. Reason: ${reason || 'unknown'}`,
        metadata: { event_id: event.id, enrollment_id: enrollmentId, reason },
      }).then(() => {/* ignore errors */});

      logInfo({ source: 'webhook', module: 'finance', message: 'Teller enrollment disconnected', metadata: { enrollmentId, reason } });
      break;
    }

    case 'transactions.processed': {
      // New transactions are available — log for admin awareness.
      // Actual sync happens via the user-triggered /api/teller/sync route.
      const txnCount = Array.isArray(event.payload.transactions)
        ? event.payload.transactions.length
        : 0;

      logInfo({ source: 'webhook', module: 'finance', message: 'Teller transactions processed', metadata: { count: txnCount } });
      break;
    }

    case 'account.number_verification.processed': {
      const accountId = event.payload.account_id as string;
      const status = event.payload.status as string;

      logInfo({ source: 'webhook', module: 'finance', message: 'Teller account verification update', metadata: { accountId, status } });

      // Notify admin
      await db.from('admin_notifications').insert({
        type: 'teller_webhook',
        title: 'Account Verification Update',
        message: `Account ${accountId} verification: ${status}`,
        metadata: { event_id: event.id, account_id: accountId, status },
      }).then(() => {/* ignore errors */});
      break;
    }

    case 'webhook.test': {
      logInfo({ source: 'webhook', module: 'finance', message: 'Teller webhook test event received', metadata: { eventId: event.id } });
      break;
    }

    default:
      logInfo({ source: 'webhook', module: 'finance', message: `Teller webhook unknown event type: ${event.type}`, metadata: { eventId: event.id } });
  }

  return NextResponse.json({ received: true });
}
