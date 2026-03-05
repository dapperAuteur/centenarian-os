// app/api/teller/webhook/route.ts
// POST: Handle Teller webhook events.
// Events: enrollment.disconnected, transactions.processed, account.number_verification.processed, webhook.test
// Verification: HMAC-SHA256 via Teller-Signature header.
// Notifies admin via existing admin notifications system.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Verify Teller webhook signature (HMAC-SHA256). */
function verifySignature(body: string, header: string | null): boolean {
  const secret = process.env.TELLER_WEBHOOK_SECRET;
  if (!secret || !header) return false;

  // Header format: t=timestamp,v1=signature
  const parts = header.split(',');
  const tsPart = parts.find((p) => p.startsWith('t='));
  const sigPart = parts.find((p) => p.startsWith('v1='));
  if (!tsPart || !sigPart) return false;

  const timestamp = tsPart.slice(2);
  const signature = sigPart.slice(3);

  // Reject events older than 5 minutes
  const age = Date.now() - parseInt(timestamp) * 1000;
  if (age > 5 * 60 * 1000) return false;

  // Compute expected signature: HMAC-SHA256(timestamp.body)
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const sigHeader = request.headers.get('teller-signature');

  // Verify signature (skip in development if secret not set)
  if (process.env.TELLER_WEBHOOK_SECRET) {
    if (!verifySignature(rawBody, sigHeader)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
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

      console.log(`[Teller Webhook] enrollment.disconnected: ${enrollmentId} — ${reason}`);
      break;
    }

    case 'transactions.processed': {
      // New transactions are available — log for admin awareness.
      // Actual sync happens via the user-triggered /api/teller/sync route.
      const txnCount = Array.isArray(event.payload.transactions)
        ? event.payload.transactions.length
        : 0;

      console.log(`[Teller Webhook] transactions.processed: ${txnCount} transactions`);
      break;
    }

    case 'account.number_verification.processed': {
      const accountId = event.payload.account_id as string;
      const status = event.payload.status as string;

      console.log(`[Teller Webhook] account.number_verification: ${accountId} — ${status}`);

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
      console.log(`[Teller Webhook] Test event received: ${event.id}`);
      break;
    }

    default:
      console.log(`[Teller Webhook] Unknown event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
